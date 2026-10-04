// Textos de pago por moneda: lo que ve el cliente cuando su pedido está listo
// para pagar (alias, CBU, link de pago...). Se editan desde el panel y viven en
// `textos_config` (deny-all; solo service role, ver migración 0040).

import type { Moneda } from "@/lib/operaciones";

export const MONEDAS_PAGO: Moneda[] = ["ARS", "USD", "EUR"];

export const claveTextoPago = (m: Moneda) => `pago_${m}`;

// Tope generoso: es un texto para leer, no un documento.
export const TEXTO_PAGO_MAX = 1000;

/** Normaliza lo que manda el panel: recorta y limita, "" = borrar. */
export function limpiarTextoPago(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n/g, "\n").trim();
  if (t.length > TEXTO_PAGO_MAX) return null;
  return t;
}

/** Texto de pago para una moneda, o null si no se cargó. */
export function textoPagoDe(textos: Record<string, string>, moneda: Moneda | null | undefined): string | null {
  if (!moneda) return null;
  return textos[claveTextoPago(moneda)]?.trim() || null;
}
