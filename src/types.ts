/**
 * Tipos de dominio compartidos. La validación canónica vive en
 * `src/portal/types.ts` (zod). Estos tipos describen la forma ya validada.
 */

/** Estado del evento en el portal de agentes. */
export type Estado = "book" | "on_request";

/** Ticket tal como se extrae del portal, antes de aplicar pricing. */
export interface RawTicket {
  id: string;
  evento: string;
  competicion: string | null;
  fecha: string | null; // ISO 8601
  ciudad: string | null;
  categoria: string | null;
  /** EUR del portal. null para eventos "on_request" (sin precio publicado). */
  precio_origen: number | null;
  moneda_origen: string; // 'EUR'
  stock: number | null;
  disponible: boolean;
  url_origen: string | null;
  estado: Estado;
}

/** Fila lista para upsert en la tabla `tickets`. */
export interface TicketRow extends RawTicket {
  /** null para "on_request" (no hay precio que markupear). */
  precio_final: number | null;
  moneda_final: string | null; // 'EUR' | 'ARS' | null
  scraped_at: string; // ISO; igual para todo el lote del ciclo (marca "visto")
}

/** Resumen de un ciclo de sync, para logging y auditoría. */
export interface SyncSummary {
  status: "ok" | "aborted" | "error";
  reason: string;
  scrapedRaw: number;
  scrapedValid: number;
  discarded: number;
  baselineCount: number;
  upserted: number;
  markedUnavailable: number;
  complete: boolean;
  durationMs: number;
}
