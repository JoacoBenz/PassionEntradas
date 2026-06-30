import { z } from "zod";

/**
 * Validación canónica de TODO lo extraído del portal con zod.
 * El portal es INPUT NO CONFIABLE: texto raro, precios fuera de rango, nulls.
 * Forzamos numéricos y rechazamos negativos/no-numéricos antes de tocar la DB.
 */

/** Coacciona "1.234,56 €", "1234.56", "1,234.56" -> number. null si no se puede. */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  let s = input.replace(/[^\d.,-]/g, "").trim();
  if (s === "") return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // El último separador es el decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", "."); // formato europeo 1.234,56
    } else {
      s = s.replace(/,/g, ""); // formato 1,234.56
    }
  } else if (hasComma) {
    s = s.replace(",", "."); // 1234,56
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Intenta normalizar una fecha a ISO 8601; null si no parsea. */
export function parseDateIso(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input !== "string" && typeof input !== "number") return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
  precio_origen: z.number().finite().nonnegative(),
  moneda_origen: z.string().min(1).default("EUR"),
  stock: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.number().int().nonnegative().nullable(),
  ).default(null),
  disponible: z.boolean().default(true),
  url_origen: z.preprocess(emptyToNull, z.string().url().nullable()).default(null),
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
}
