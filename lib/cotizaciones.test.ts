import { describe, expect, it } from "vitest";
import { estadoCotizacion, parseHoras, tiempoRestante, venceAt } from "./cotizaciones";

const AHORA = new Date("2026-10-05T12:00:00Z");

describe("cotizaciones", () => {
  it("vence a las N horas", () => {
    expect(venceAt(AHORA, 48)).toBe("2026-10-07T12:00:00.000Z");
  });
  it("estado: a cotizar, esperando, vencida", () => {
    expect(estadoCotizacion({ estado: "pendiente", vence_at: null }, AHORA)).toBe("a_cotizar");
    expect(estadoCotizacion({ estado: "cotizada", vence_at: "2026-10-05T13:00:00Z" }, AHORA)).toBe("esperando");
    expect(estadoCotizacion({ estado: "cotizada", vence_at: "2026-10-05T11:59:00Z" }, AHORA)).toBe("vencida");
    expect(estadoCotizacion({ estado: "rechazada", vence_at: null }, AHORA)).toBe("cerrada");
  });
  it("tiempo restante legible", () => {
    expect(tiempoRestante("2026-10-07T12:00:00Z", AHORA)).toBe("vence en 48 h");
    expect(tiempoRestante("2026-10-05T12:25:00Z", AHORA)).toBe("vence en 25 min");
    expect(tiempoRestante("2026-10-05T11:00:00Z", AHORA)).toBe("venció");
    expect(tiempoRestante("2026-10-05T14:00:00Z", AHORA, "en")).toBe("expires in 2 h");
  });
  it("horas del panel: enteras entre 1 y 720", () => {
    expect(parseHoras("48")).toBe(48);
    expect(parseHoras("0")).toBeNull();
    expect(parseHoras("1,5")).toBeNull();
    expect(parseHoras("721")).toBeNull();
    expect(parseHoras("abc")).toBeNull();
  });
});
