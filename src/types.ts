/**
 * Tipos de dominio compartidos. La validación canónica vive en
 * `src/portal/types.ts` (zod). Estos tipos describen la forma ya validada.
 */

/** Ticket tal como se extrae del portal, antes de aplicar pricing. */
export interface RawTicket {
  id: string;
  evento: string;
  competicion: string | null;
  fecha: string | null; // ISO 8601
  ciudad: string | null;
  categoria: string | null;
  precio_origen: number; // EUR
  moneda_origen: string; // 'EUR'
  stock: number | null;
  disponible: boolean;
  url_origen: string | null;
}

/** Fila lista para upsert en la tabla `tickets`. */
export interface TicketRow extends RawTicket {
  precio_final: number;
  moneda_final: string; // 'EUR' | 'ARS'
  scraped_at: string; // ISO; igual para todo el lote del ciclo (marca "visto")
}

/** Resumen de un ciclo de sync, para logging y auditoría. */
export interface SyncSummary {
  status: "ok" | "aborted" | "error";
  reason: string;
  scrapedRaw: number;
  scrapedValid: number;
  discarded: number;
  baselineAvailable: number;
  upserted: number;
  markedUnavailable: number;
  durationMs: number;
}
