// Cotizaciones: el staff le pone precio a una consulta y el CLIENTE la acepta
// antes de que sea un pedido. La aceptación es atómica en la base (función
// aceptar_cotizacion, migración 0041); acá vive lo que se calcula igual en el
// server, en el panel y en Mis pedidos.

import type { Consulta } from "@/lib/operaciones";

// Plazo por defecto para aceptar; se cambia en Ajustes (config.cotizacion_vence_horas).
export const VENCE_HORAS_DEFAULT = 48;
export const VENCE_HORAS_MIN = 1;
export const VENCE_HORAS_MAX = 720; // 30 días

/** Horas que llegan del panel: enteras, entre 1 y 720. null si no sirven. */
export function parseHoras(raw: unknown): number | null {
  const n = Number(String(raw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n >= VENCE_HORAS_MIN && n <= VENCE_HORAS_MAX ? n : null;
}

export function venceAt(desde: Date, horas: number): string {
  return new Date(desde.getTime() + horas * 3600_000).toISOString();
}

/** Lo que muestra el panel y Mis pedidos: la vencida es una cotizada pasada de plazo. */
export type EstadoCotizacion = "a_cotizar" | "esperando" | "vencida" | "cerrada";

export function estadoCotizacion(
  c: Pick<Consulta, "estado" | "vence_at">,
  ahora: Date = new Date()
): EstadoCotizacion {
  if (c.estado === "pendiente") return "a_cotizar";
  if (c.estado === "cotizada") {
    return c.vence_at && new Date(c.vence_at).getTime() < ahora.getTime() ? "vencida" : "esperando";
  }
  return "cerrada";
}

/** "vence en 47 h" / "vence en 25 min" / "venció". Corto, para chips. */
export function tiempoRestante(
  vence: string | null | undefined,
  ahora: Date = new Date(),
  lang: "es" | "en" = "es"
): string {
  if (!vence) return "";
  const ms = new Date(vence).getTime() - ahora.getTime();
  if (ms <= 0) return lang === "en" ? "expired" : "venció";
  const min = Math.ceil(ms / 60_000);
  const t = min < 60 ? `${min} min` : `${Math.floor(min / 60)} h`;
  return lang === "en" ? `expires in ${t}` : `vence en ${t}`;
}
