/**
 * Pricing: función PURA y testeada.
 *
 *   precio_final = round( precio_origen * (1 + markup) * tasaConversion )
 *
 * - Sin conversión: tasaConversion = 1, moneda_final = 'EUR', redondeo a 2 dec.
 * - Con conversión: tasaConversion = EUR_ARS_RATE, moneda_final = 'ARS',
 *   redondeo al múltiplo configurado (default 100).
 *
 * Se guarda SIEMPRE precio_origen y precio_final por separado (trazabilidad).
 */

export interface PricingOptions {
  /** Markup fijo. 0.20 = +20%. */
  markup: number;
  /** Si true, convierte a ARS usando eurArsRate. */
  convertToArs: boolean;
  /** Tasa EUR->ARS. Requerida si convertToArs=true. */
  eurArsRate?: number;
  /** Múltiplo de redondeo para ARS. 100 => al cien más cercano; 1 => entero. */
  arsRoundTo: number;
}

export interface PricedResult {
  precioFinal: number;
  monedaFinal: "EUR" | "ARS";
}

/** Redondeo a 2 decimales, estable ante errores de coma flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Redondeo al múltiplo `m` más cercano (m > 0). */
export function roundToMultiple(value: number, m: number): number {
  if (!(m > 0)) throw new Error(`arsRoundTo inválido: ${m}`);
  return Math.round(value / m) * m;
}

/**
 * Calcula precio final aplicando markup y conversión opcional.
 * Lanza si el precio de origen no es un número finito >= 0 (input no confiable).
 */
export function computeFinalPrice(precioOrigen: number, opts: PricingOptions): PricedResult {
  if (!Number.isFinite(precioOrigen) || precioOrigen < 0) {
    throw new Error(`precio_origen inválido: ${precioOrigen}`);
  }
  if (!Number.isFinite(opts.markup) || opts.markup < 0) {
    throw new Error(`markup inválido: ${opts.markup}`);
  }

  if (opts.convertToArs) {
    const rate = opts.eurArsRate;
    if (!Number.isFinite(rate) || (rate as number) <= 0) {
      throw new Error(`eurArsRate inválido: ${rate}`);
    }
    const raw = precioOrigen * (1 + opts.markup) * (rate as number);
    return { precioFinal: roundToMultiple(raw, opts.arsRoundTo), monedaFinal: "ARS" };
  }

  const raw = precioOrigen * (1 + opts.markup);
  return { precioFinal: round2(raw), monedaFinal: "EUR" };
}

/**
 * Variante tolerante a null: los eventos "on_request" no tienen precio de
 * origen, así que precio_final también es null (no hay nada que markupear).
 */
export function priceTicket(
  precioOrigen: number | null,
  opts: PricingOptions,
): { precioFinal: number | null; monedaFinal: "EUR" | "ARS" | null } {
  if (precioOrigen == null) return { precioFinal: null, monedaFinal: null };
  const r = computeFinalPrice(precioOrigen, opts);
  return { precioFinal: r.precioFinal, monedaFinal: r.monedaFinal };
}
