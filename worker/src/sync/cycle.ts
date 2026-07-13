import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { priceTicket, type PricingOptions } from "../pricing/index.js";
import { scrapeRawTickets } from "../portal/scrape.js";
import type { PortalSession } from "../portal/session.js";
import { RawTicketSchema } from "../portal/types.js";
import type { TicketRepository } from "../db/repository.js";
import type { SyncSummary, TicketRow } from "../types.js";
import { decidePublish } from "./partial-guard.js";
import { isPastEvent } from "./past-filter.js";
import { sincronizarMapas } from "./mapas.js";
import { margenPara } from "../pricing/margenes.js";

export interface CycleDeps {
  cfg: Config;
  log: Logger;
  session: PortalSession;
  repo: TicketRepository;
  signal?: AbortSignal;
  /** Inyectable para tests. Default: Date.now(). */
  now?: () => number;
}

function pricingOptions(cfg: Config): PricingOptions {
  return {
    markup: cfg.PRICE_MARKUP,
    convertToArs: cfg.CONVERT_TO_ARS,
    eurArsRate: cfg.EUR_ARS_RATE,
    arsRoundTo: cfg.ARS_ROUND_TO,
  };
}

/**
 * Ejecuta un ciclo completo:
 *  scrape (lista + detalle) -> validar (zod) -> guard anti-borrado ->
 *  markup (precio_final, null para on_request) -> upsert ->
 *  marcar ausentes (solo si el scrape fue completo) -> registrar resumen.
 */
export async function runSyncCycle(deps: CycleDeps): Promise<SyncSummary> {
  const { cfg, log, session, repo, signal } = deps;
  const now = deps.now ?? Date.now;
  const startMs = now();
  const startedAtIso = new Date(startMs).toISOString();

  // 1. Extraer (rows + mapas de sectores candidatos por evento).
  const { rows: raw, complete, imagenes } = await scrapeRawTickets({ cfg, log, session, signal });

  // 2. Validar con zod + aplicar markup. Descartar inválidos y contar.
  // El margen sale de la tabla `margenes` (editable desde el panel), con
  // PRICE_MARKUP de config como fallback si no hay reglas.
  const opts = pricingOptions(cfg);
  const reglas = await repo.fetchMargenes();
  const rows: TicketRow[] = [];
  let discarded = 0;
  let pastFiltered = 0;
  for (const item of raw) {
    const parsed = RawTicketSchema.safeParse(item);
    if (!parsed.success) {
      discarded++;
      continue;
    }
    // Eventos ya pasados: fuera del catálogo (los que estaban en la DB
    // quedan disponible=false vía "marcar ausentes" al fin del ciclo).
    if (isPastEvent(parsed.data.fecha, startMs)) {
      pastFiltered++;
      continue;
    }
    try {
      const markup = margenPara(reglas, parsed.data.competicion ?? null, cfg.PRICE_MARKUP);
      const { precioFinal, monedaFinal } = priceTicket(parsed.data.precio_origen, {
        ...opts,
        markup,
      });
      rows.push({
        ...parsed.data,
        precio_final: precioFinal,
        moneda_final: monedaFinal,
        scraped_at: startedAtIso,
        imagen_url: null, // se estampa tras resolver los mapas (paso 4)
      });
    } catch (err) {
      discarded++;
      log.warn({ err, id: item.id }, "ticket descartado en pricing");
    }
  }

  if (pastFiltered > 0) {
    log.info({ pastFiltered }, "eventos pasados filtrados del catálogo");
  }

  // 3. Guard anti-borrado: baseline = ítems válidos del último sync exitoso.
  const baseline = await repo.getLastSuccessfulScrapedCount();
  const decision = decidePublish({
    scrapedValid: rows.length,
    baselineAvailable: baseline,
    dropAbortRatio: cfg.SYNC_DROP_ABORT_RATIO,
  });

  const base: Omit<SyncSummary, "status" | "reason" | "upserted" | "markedUnavailable"> = {
    scrapedRaw: raw.length,
    scrapedValid: rows.length,
    discarded,
    baselineCount: baseline,
    complete,
    durationMs: 0,
  };

  if (!decision.publish) {
    const summary: SyncSummary = {
      ...base,
      status: "aborted",
      reason: decision.reason,
      upserted: 0,
      markedUnavailable: 0,
      durationMs: now() - startMs,
    };
    log.warn(summary, "sync ABORTADO (anti-borrado): se preservan los datos viejos");
    await repo.recordSyncRun(summary);
    return summary;
  }

  // 4. Mapas de sectores: descargar/subir los nuevos y estampar la URL
  // pública en cada fila del evento (los ya subidos se reusan; sin esto el
  // upsert pisaría con null las URLs existentes). Fail-soft siempre.
  const mapas = await sincronizarMapas({ cfg, log, session, repo, candidatas: imagenes, signal });
  for (const r of rows) {
    r.imagen_url = mapas.get(r.id.split("::")[0]!) ?? null;
  }

  // 5. Publicar: upsert siempre; marcar ausentes solo si el scrape fue completo.
  const upserted = await repo.upsertBatches(rows, cfg.UPSERT_BATCH_SIZE);
  let markedUnavailable = 0;
  if (complete) {
    markedUnavailable = await repo.markAbsentBefore(startedAtIso);
  } else {
    log.warn("scrape incompleto: NO se marcan ausentes (evita falsos agotados)");
  }

  const summary: SyncSummary = {
    ...base,
    status: "ok",
    reason: complete ? "ok" : "ok_incomplete",
    upserted,
    markedUnavailable,
    durationMs: now() - startMs,
  };
  log.info(summary, "sync OK");
  await repo.recordSyncRun(summary);
  return summary;
}
