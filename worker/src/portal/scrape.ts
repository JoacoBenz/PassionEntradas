import type { Config } from "../config/index.js";
import { BlockedError, SessionExpiredError } from "../errors.js";
import type { Logger } from "../logger.js";
import { fetchPortalHtml } from "./client.js";
import { extraerMapaUrl } from "./imagen.js";
import { buildOnRequestRow, classifyDetail, parseEventDetail, parseEventList } from "./parser.js";
import type { PortalSession } from "./session.js";
import type { PortalEvent, RawTicketInput } from "./types.js";
import { sleep } from "../util/time.js";

export interface ScrapeResult {
  rows: RawTicketInput[];
  /**
   * true solo si recorrimos TODO lo previsto (sin tope de detalles y sin fallos
   * de detalle). El ciclo solo marca ausentes si el scrape fue completo, para
   * no marcar como agotados eventos que simplemente no alcanzamos a procesar.
   */
  complete: boolean;
  /**
   * Mapa de sectores por evento: eventId -> URL de la imagen EN EL PORTAL
   * (detrás del login). Se extrae del mismo HTML de detalle ya bajado (cero
   * requests extra); el ciclo decide cuáles descargar y re-subir al bucket.
   */
  imagenes: Map<string, string>;
}

function matchesCategories(ev: PortalEvent, cats: string[]): boolean {
  if (cats.length === 0) return true;
  const hay = `${ev.subCategoria ?? ""} ${ev.titulo}`.toLowerCase();
  return cats.some((c) => hay.includes(c.toLowerCase()));
}

/**
 * Flujo Passion Events:
 *   1. GET event_list.php -> eventos (book / on_request).
 *   2. on_request -> una fila sin precio (disponible=false).
 *   3. book -> GET event_detail.php (throttle) -> una fila por sector con precio.
 * La cookie de sesión sale de PortalSession (login con Playwright).
 */
export async function scrapeRawTickets(deps: {
  cfg: Config;
  log: Logger;
  session: PortalSession;
  signal?: AbortSignal;
}): Promise<ScrapeResult> {
  const { cfg, log, session, signal } = deps;
  const cookieHeader = await session.getCookieHeader();

  const listUrl = new URL(cfg.PE_EVENT_LIST_PATH, cfg.PE_BASE_URL).toString();
  const listHtml = await fetchPortalHtml({ url: listUrl, cookieHeader, cfg, log, signal });

  let events = parseEventList(listHtml, cfg.PE_BASE_URL);
  const totalEvents = events.length;
  events = events.filter((e) => matchesCategories(e, cfg.PE_SYNC_CATEGORIES));
  log.info(
    { totalEvents, tras_filtro: events.length, categorias: cfg.PE_SYNC_CATEGORIES },
    "eventos listados",
  );

  const rows: RawTicketInput[] = [];
  const imagenes = new Map<string, string>();
  let complete = true;

  // Tanto "book" como "on_request" tienen una página de detalle con la tabla de
  // sectores (precio + stock reales); solo cambia la acción (comprar vs Request).
  // Por eso pedimos el detalle de AMBOS y dejamos que el parser fije el estado.
  let targets = cfg.PE_INCLUDE_ON_REQUEST
    ? events
    : events.filter((e) => e.estado === "book");
  if (cfg.PE_MAX_DETAILS_PER_CYCLE > 0 && targets.length > cfg.PE_MAX_DETAILS_PER_CYCLE) {
    log.warn(
      { tope: cfg.PE_MAX_DETAILS_PER_CYCLE, total: targets.length },
      "tope de detalles alcanzado: ciclo INCOMPLETO (no se marcarán ausentes)",
    );
    targets = targets.slice(0, cfg.PE_MAX_DETAILS_PER_CYCLE);
    complete = false;
  }

  for (let i = 0; i < targets.length; i++) {
    const e = targets[i]!;
    try {
      const html = await fetchPortalHtml({ url: e.detailUrl, cookieHeader, cfg, log, signal });
      // Mapa de sectores del evento, si el detalle trae una imagen con pinta.
      let mapa = extraerMapaUrl(html, e.detailUrl);
      let sectors = parseEventDetail(html, e);

      // Fallback clave: la página "Book" (event_detail.php) de un evento
      // AGOTADO devuelve un stub SIN tabla de sectores; las categorías reales
      // y el mapa viven en event_detail_request.php. Si el book vino vacío y
      // hay una URL de request, reintentamos ahí antes de rendirnos a un stub.
      if (
        sectors.length === 0 &&
        e.detailUrl.includes("event_detail.php") &&
        !e.detailUrl.includes("event_detail_request.php")
      ) {
        const reqUrl = e.detailUrl.replace(
          "event_detail.php",
          "event_detail_request.php",
        );
        try {
          const reqHtml = await fetchPortalHtml({ url: reqUrl, cookieHeader, cfg, log, signal });
          const reqSectors = parseEventDetail(reqHtml, { ...e, detailUrl: reqUrl });
          if (reqSectors.length > 0) {
            sectors = reqSectors;
            const reqMapa = extraerMapaUrl(reqHtml, reqUrl);
            if (reqMapa) mapa = reqMapa;
            log.info(
              { eventId: e.eventId },
              "sectores recuperados desde event_detail_request.php",
            );
          }
        } catch (err2) {
          if (err2 instanceof BlockedError || err2 instanceof SessionExpiredError) throw err2;
          log.warn({ err: err2, eventId: e.eventId }, "reintento request.php falló, sigo con el stub");
        }
      }

      if (mapa) imagenes.set(e.eventId, mapa);
      if (sectors.length > 0) {
        rows.push(...sectors);
      } else {
        // El portal devolvió una página sin sectores: puede ser un evento que
        // en realidad es On Request, un Servicio Extra (merch) o un cambio de
        // layout. Clasificamos para no marcar "incompleto" en los dos primeros.
        const kind = classifyDetail(html);
        if (kind === "on_request") {
          rows.push(buildOnRequestRow(e));
          log.info({ eventId: e.eventId }, "evento sin sectores: tratado como On Request");
        } else if (kind === "other") {
          log.info({ eventId: e.eventId }, "detalle no es un evento (Servicio Extra), omitido");
        } else if (e.estado === "on_request") {
          // Evento On Request sin tabla de sectores: fila única "a consultar".
          rows.push(buildOnRequestRow(e));
        } else {
          // Era una página "book" pero no pudimos parsear sectores: conservador.
          log.warn({ eventId: e.eventId }, "detalle book sin sectores parseables");
          complete = false;
        }
      }
    } catch (err) {
      // Bloqueo (captcha/MFA) o sesión caída: cortar el ciclo YA. Seguir
      // iterando martillaría el portal contra la página de bloqueo una vez
      // por detalle — lo contrario del diseño "no se evade, se enfría".
      // El loop principal ya sabe tratar estos errores (cooldown/re-login).
      if (err instanceof BlockedError || err instanceof SessionExpiredError) {
        throw err;
      }
      // Cualquier otro fallo de un detalle no tumba el ciclo, pero lo marca
      // incompleto.
      log.warn({ err, eventId: e.eventId }, "fallo al traer/parsear detalle, continúo");
      complete = false;
    }
    if (i < targets.length - 1 && cfg.PE_DETAIL_THROTTLE_MS > 0) {
      await sleep(cfg.PE_DETAIL_THROTTLE_MS, signal);
    }
  }

  // Dedup por id estable (último gana).
  const byId = new Map<string, RawTicketInput>();
  for (const r of rows) byId.set(r.id, r);
  return { rows: [...byId.values()], complete, imagenes };
}
