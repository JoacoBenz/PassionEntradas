import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "../logger.js";
import type { SyncSummary, TicketRow } from "../types.js";

const TABLE = "tickets";
const RUNS_TABLE = "sync_runs";

/**
 * Acceso a datos. Implementa la REGLA ANTI-BORRADO:
 *  - upsert por lotes (nunca delete masivo).
 *  - los ids ausentes se marcan disponible=false/stock=0, NO se borran.
 *  - el marcado de ausentes lo decide el ciclo (tras pasar el guard parcial).
 */
export class TicketRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly log: Logger,
  ) {}

  /** Cantidad de tickets disponibles actualmente (baseline para el guard). */
  async getAvailableCount(): Promise<number> {
    const { count, error } = await this.db
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("disponible", true);
    if (error) throw new Error(`getAvailableCount: ${error.message}`);
    return count ?? 0;
  }

  /** Upsert por lotes (onConflict id). Devuelve cuántas filas se enviaron. */
  async upsertBatches(rows: TicketRow[], batchSize: number): Promise<number> {
    let sent = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize).map(toDbRow);
      const { error } = await this.db.from(TABLE).upsert(chunk, { onConflict: "id" });
      if (error) throw new Error(`upsert lote ${i / batchSize}: ${error.message}`);
      sent += chunk.length;
      this.log.debug({ sent, total: rows.length }, "lote upserted");
    }
    return sent;
  }

  /**
   * Marca como no disponibles los ids NO vistos en este ciclo: aquellos cuyo
   * scraped_at quedó anterior a runStartedAtIso y siguen disponible=true.
   * (Todas las filas del ciclo se upsertean con scraped_at = runStartedAtIso.)
   */
  async markAbsentBefore(runStartedAtIso: string): Promise<number> {
    const { data, error } = await this.db
      .from(TABLE)
      .update({ disponible: false, stock: 0 })
      .lt("scraped_at", runStartedAtIso)
      .eq("disponible", true)
      .select("id");
    if (error) throw new Error(`markAbsentBefore: ${error.message}`);
    return data?.length ?? 0;
  }

  /** Registra el resultado del ciclo para auditoría/observabilidad. */
  async recordSyncRun(summary: SyncSummary): Promise<void> {
    const { error } = await this.db.from(RUNS_TABLE).insert({
      status: summary.status,
      reason: summary.reason,
      scraped_raw: summary.scrapedRaw,
      scraped_valid: summary.scrapedValid,
      discarded: summary.discarded,
      baseline_available: summary.baselineAvailable,
      upserted: summary.upserted,
      marked_unavailable: summary.markedUnavailable,
      duration_ms: summary.durationMs,
    });
    if (error) this.log.warn({ err: error.message }, "no se pudo registrar sync_run");
  }
}

/** Mapea el modelo de dominio a columnas de la tabla. updated_at lo pone el trigger. */
function toDbRow(t: TicketRow): Record<string, unknown> {
  return {
    id: t.id,
    evento: t.evento,
    competicion: t.competicion,
    fecha: t.fecha,
    ciudad: t.ciudad,
    categoria: t.categoria,
    precio_origen: t.precio_origen,
    moneda_origen: t.moneda_origen,
    precio_final: t.precio_final,
    moneda_final: t.moneda_final,
    stock: t.stock,
    disponible: t.disponible,
    url_origen: t.url_origen,
    scraped_at: t.scraped_at,
  };
}
