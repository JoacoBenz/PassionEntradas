import { z } from "zod";

/**
 * Validación canónica de TODO lo extraído del portal con zod.
 * El portal es INPUT NO CONFIABLE: texto raro, precios fuera de rango, nulls.
 * Forzamos numéricos y rechazamos negativos/no-numéricos antes de tocar la DB.
 */

/** Coacciona "10000", "1.234,56 €", "1,234.56" -> number. null si no se puede. */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  let s = input.replace(/[^\d.,-]/g, "").trim();
  if (s === "") return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // El último separador es el decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Entero desde texto ("4", "12 disponibles", "34"). null si no se puede. */
export function parseInt0(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.trunc(input) : null;
  if (typeof input !== "string") return null;
  const n = parseInt(input.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v ?? null;

/**
 * Schema de un ticket crudo extraído del portal.
 * Lo que no cumpla se descarta (y se cuenta) en el ciclo de sync.
 */
export const RawTicketSchema = z.object({
  id: z.string().min(1),
  evento: z.string().min(1),
  competicion: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  fecha: z.preprocess(emptyToNull, z.string().datetime().nullable()).default(null),
  ciudad: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  categoria: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  // null para on_request; si hay precio, debe ser finito y >= 0.
  precio_origen: z.number().finite().nonnegative().nullable(),
  moneda_origen: z.string().min(1).default("EUR"),
  stock: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.number().int().nonnegative().nullable(),
  ).default(null),
  disponible: z.boolean().default(true),
  url_origen: z.preprocess(emptyToNull, z.string().url().nullable()).default(null),
  estado: z.enum(["book", "on_request"]).default("book"),
});

export type RawTicketParsed = z.infer<typeof RawTicketSchema>;

/** Forma intermedia que produce el parser antes de la validación zod. */
export interface RawTicketInput {
  id: string;
  evento: string;
  competicion?: string | null;
  fecha?: string | null;
  ciudad?: string | null;
  categoria?: string | null;
  precio_origen: number | null;
  moneda_origen?: string;
  stock?: number | null;
  disponible?: boolean;
  url_origen?: string | null;
  estado: "book" | "on_request";
}

/** Evento tal como aparece en la lista (event_list.php), antes del detalle. */
export interface PortalEvent {
  eventId: string;
  titulo: string;
  subCategoria: string | null;
  fechaLista: string | null;
  ubicacion: string | null;
  asientos: number | null;
  estado: "book" | "on_request";
  detailUrl: string;
}
