import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { fetchPortalHtml } from "./client.js";
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
  let complete = true;

  // On Request (sin precio).
  if (cfg.PE_INCLUDE_ON_REQUEST) {
    for (const e of events.filter((e) => e.estado === "on_request")) rows.push(buildOnRequestRow(e));
  }

  // Book (con precio): un GET de detalle por evento.
  let books = events.filter((e) => e.estado === "book");
  if (cfg.PE_MAX_DETAILS_PER_CYCLE > 0 && books.length > cfg.PE_MAX_DETAILS_PER_CYCLE) {
    log.warn(
      { tope: cfg.PE_MAX_DETAILS_PER_CYCLE, totalBook: books.length },
      "tope de detalles alcanzado: ciclo INCOMPLETO (no se marcarán ausentes)",
    );
    books = books.slice(0, cfg.PE_MAX_DETAILS_PER_CYCLE);
    complete = false;
  }

  for (let i = 0; i < books.length; i++) {
    const e = books[i]!;
    try {
      const html = await fetchPortalHtml({ url: e.detailUrl, cookieHeader, cfg, log, signal });
      const sectors = parseEventDetail(html, e);
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
        } else {
          // Era una página "book" pero no pudimos parsear sectores: conservador.
          log.warn({ eventId: e.eventId }, "detalle book sin sectores parseables");
          complete = false;
        }
      }
    } catch (err) {
      // Un detalle que falla no tumba el ciclo, pero lo marca incompleto.
      log.warn({ err, eventId: e.eventId }, "fallo al traer/parsear detalle, continúo");
      complete = false;
    }
    if (i < books.length - 1 && cfg.PE_DETAIL_THROTTLE_MS > 0) {
      await sleep(cfg.PE_DETAIL_THROTTLE_MS, signal);
    }
  }

  // Dedup por id estable (último gana).
  const byId = new Map<string, RawTicketInput>();
  for (const r of rows) byId.set(r.id, r);
  return { rows: [...byId.values()], complete };
}
