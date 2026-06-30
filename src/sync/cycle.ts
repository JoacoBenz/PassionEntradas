import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { computeFinalPrice, type PricingOptions } from "../pricing/index.js";
import { scrapeRawTickets } from "../portal/scrape.js";
import type { PortalSession } from "../portal/session.js";
import { RawTicketSchema } from "../portal/types.js";
import type { TicketRepository } from "../db/repository.js";
import type { SyncSummary, TicketRow } from "../types.js";
import { decidePublish } from "./partial-guard.js";

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
 *  scrape -> validar (zod) -> guard anti-borrado -> markup -> upsert ->
 *  marcar ausentes -> registrar resumen.
 */
export async function runSyncCycle(deps: CycleDeps): Promise<SyncSummary> {
  const { cfg, log, session, repo, signal } = deps;
  const now = deps.now ?? Date.now;
  const startMs = now();
  const startedAtIso = new Date(startMs).toISOString();

  // 1. Extraer.
  const raw = await scrapeRawTickets({ cfg, log, session, signal });

  // 2. Validar con zod. Descartar inválidos y contar.
  const opts = pricingOptions(cfg);
  const rows: TicketRow[] = [];
  let discarded = 0;
  for (const item of raw) {
    const parsed = RawTicketSchema.safeParse(item);
    if (!parsed.success) {
      discarded++;
      continue;
    }
    try {
      const { precioFinal, monedaFinal } = computeFinalPrice(parsed.data.precio_origen, opts);
      rows.push({
        ...parsed.data,
        precio_final: precioFinal,
        moneda_final: monedaFinal,
        scraped_at: startedAtIso,
      });
    } catch (err) {
      discarded++;
      log.warn({ err, id: item.id }, "ticket descartado en pricing");
    }
  }

  // 3. Guard anti-borrado: baseline = disponibles actuales.
  const baseline = await repo.getAvailableCount();
  const decision = decidePublish({
    scrapedValid: rows.length,
    baselineAvailable: baseline,
    dropAbortRatio: cfg.SYNC_DROP_ABORT_RATIO,
  });

  if (!decision.publish) {
    const summary: SyncSummary = {
      status: "aborted",
      reason: decision.reason,
      scrapedRaw: raw.length,
      scrapedValid: rows.length,
      discarded,
      baselineAvailable: baseline,
      upserted: 0,
      markedUnavailable: 0,
      durationMs: now() - startMs,
    };
    log.warn(summary, "sync ABORTADO (anti-borrado): se preservan los datos viejos");
    await repo.recordSyncRun(summary);
    return summary;
  }

  // 4. Publicar: upsert + marcar ausentes.
  const upserted = await repo.upsertBatches(rows, cfg.UPSERT_BATCH_SIZE);
  const markedUnavailable = await repo.markAbsentBefore(startedAtIso);

  const summary: SyncSummary = {
    status: "ok",
    reason: "ok",
    scrapedRaw: raw.length,
    scrapedValid: rows.length,
    discarded,
    baselineAvailable: baseline,
    upserted,
    markedUnavailable,
    durationMs: now() - startMs,
  };
  log.info(summary, "sync OK");
  await repo.recordSyncRun(summary);
  return summary;
}
