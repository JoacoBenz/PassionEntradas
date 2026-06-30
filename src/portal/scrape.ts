import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { fetchPortalJson } from "./client.js";
import { LISTING_PATHS, parseApiResponse, parseListingHtml } from "./parser.js";
import type { PortalSession } from "./session.js";
import type { RawTicketInput } from "./types.js";

/**
 * Orquesta la extracción según PE_SCRAPE_MODE:
 *  - api: replica el endpoint JSON interno reusando la cookie (preferido).
 *  - playwright: recorre LISTING_PATHS y parsea el HTML renderizado.
 *
 * Devuelve crudos (sin validar/priceear). Dedup por id estable (último gana).
 */
export async function scrapeRawTickets(deps: {
  cfg: Config;
  log: Logger;
  session: PortalSession;
  signal?: AbortSignal;
}): Promise<RawTicketInput[]> {
  const { cfg, log, session, signal } = deps;
  const collected: RawTicketInput[] = [];

  if (cfg.PE_SCRAPE_MODE === "api") {
    if (!cfg.PE_API_ENDPOINT) {
      throw new Error("PE_SCRAPE_MODE=api requiere PE_API_ENDPOINT");
    }
    const cookieHeader = await session.getCookieHeader();
    const json = await fetchPortalJson({
      url: cfg.PE_API_ENDPOINT,
      cookieHeader,
      cfg,
      log,
      signal,
    });
    collected.push(...parseApiResponse(json));
  } else {
    for (const p of LISTING_PATHS) {
      try {
        const html = await session.fetchHtml(p);
        const items = parseListingHtml(html, cfg.PE_BASE_URL);
        log.debug({ path: p, items: items.length }, "listado parseado");
        collected.push(...items);
      } catch (err) {
        // Un path que falla no debe tumbar el ciclo entero; lo registramos y
        // seguimos. La detección de sync parcial protege contra publicar de menos.
        log.warn({ err, path: p }, "fallo parseando un listado, continúo");
      }
    }
  }

  // Dedup por id estable.
  const byId = new Map<string, RawTicketInput>();
  for (const item of collected) byId.set(item.id, item);
  return [...byId.values()];
}
