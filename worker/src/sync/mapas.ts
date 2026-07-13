import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { fetchPortalBytes } from "../portal/client.js";
import { extensionDe } from "../portal/imagen.js";
import type { PortalSession } from "../portal/session.js";
import type { TicketRepository } from "../db/repository.js";
import { sleep } from "../util/time.js";

/** Tope de mapas NUEVOS por ciclo: reparte la carga y no alarga el sync. */
const MAX_NUEVOS_POR_CICLO = 10;

/**
 * Resuelve los mapas de sectores del ciclo: para cada evento con imagen
 * candidata en el portal que todavía no tiene mapa subido, la descarga con
 * la sesión y la re-sube al bucket público `mapas`. Devuelve el mapa
 * COMPLETO eventId -> URL pública (existentes + nuevos) para estampar en
 * las filas antes del upsert.
 *
 * Enteramente fail-soft: cualquier error deja al evento sin imagen y el
 * sync sigue — el catálogo nunca se frena por un mapa.
 */
export async function sincronizarMapas(deps: {
  cfg: Config;
  log: Logger;
  session: PortalSession;
  repo: TicketRepository;
  candidatas: Map<string, string>;
  signal?: AbortSignal;
}): Promise<Map<string, string>> {
  const { cfg, log, session, repo, candidatas, signal } = deps;

  const resueltos = await repo.mapasExistentes();
  const pendientes = [...candidatas].filter(([eventId]) => !resueltos.has(eventId));
  if (pendientes.length === 0) return resueltos;

  const lote = pendientes.slice(0, MAX_NUEVOS_POR_CICLO);
  if (pendientes.length > lote.length) {
    log.info(
      { pendientes: pendientes.length, lote: lote.length },
      "mapas: quedan más para próximos ciclos",
    );
  }

  let cookieHeader: string;
  try {
    cookieHeader = await session.getCookieHeader();
  } catch (err) {
    log.warn({ err }, "mapas: sin sesión para descargar, se saltea el ciclo");
    return resueltos;
  }

  let subidos = 0;
  for (const [eventId, url] of lote) {
    try {
      const bin = await fetchPortalBytes({ url, cookieHeader, cfg, log, signal });
      if (!bin) continue;
      const ext = extensionDe(bin.contentType);
      if (!ext) {
        log.info({ eventId, contentType: bin.contentType }, "mapas: no es imagen, salteado");
        continue;
      }
      const publica = await repo.subirMapa(eventId, bin.buffer, bin.contentType!, ext);
      if (publica) {
        resueltos.set(eventId, publica);
        subidos++;
      }
    } catch (err) {
      // Incluye SessionExpired en mitad del lote: no vale tumbar el sync por
      // una imagen; el próximo ciclo la reintenta con sesión fresca.
      log.warn({ err, eventId }, "mapas: fallo con una imagen, continúo");
    }
    if (cfg.PE_DETAIL_THROTTLE_MS > 0) {
      await sleep(cfg.PE_DETAIL_THROTTLE_MS, signal);
    }
  }
  if (subidos > 0) log.info({ subidos }, "mapas de sectores subidos al bucket");

  return resueltos;
}
