import { describe, expect, it } from "vitest";
import {
  computeFinalPrice,
  priceTicket,
  round2,
  roundToMultiple,
  type PricingOptions,
} from "./index.js";

const EUR: PricingOptions = {
  markup: 0.2,
  convertToArs: false,
  arsRoundTo: 100,
};

describe("round2", () => {
  it("redondea a 2 decimales de forma estable", () => {
    expect(round2(23.988)).toBe(23.99);
    expect(round2(120)).toBe(120);
    expect(round2(0.1 + 0.2)).toBe(0.3); // sin error de coma flotante
  });
});

describe("roundToMultiple", () => {
  it("redondea al múltiplo más cercano", () => {
    expect(roundToMultiple(13072.42, 100)).toBe(13100);
    expect(roundToMultiple(13049, 100)).toBe(13000);
    expect(roundToMultiple(125.6, 1)).toBe(126);
  });
  it("lanza si el múltiplo no es > 0", () => {
    expect(() => roundToMultiple(100, 0)).toThrow();
  });
});

describe("computeFinalPrice (EUR, markup 20%)", () => {
  it("aplica el markup y redondea a 2 decimales", () => {
    expect(computeFinalPrice(100, EUR)).toEqual({ precioFinal: 120, monedaFinal: "EUR" });
    expect(computeFinalPrice(350, EUR)).toEqual({ precioFinal: 420, monedaFinal: "EUR" });
    expect(computeFinalPrice(19.99, EUR)).toEqual({ precioFinal: 23.99, monedaFinal: "EUR" });
  });

  it("markup 0 => precio_final == precio_origen redondeado", () => {
    expect(computeFinalPrice(33.33, { ...EUR, markup: 0 })).toEqual({
      precioFinal: 33.33,
      monedaFinal: "EUR",
    });
  });
});

describe("computeFinalPrice (conversión a ARS)", () => {
  const ARS: PricingOptions = {
    markup: 0.2,
    convertToArs: true,
    eurArsRate: 1050.5,
    arsRoundTo: 100,
  };

  it("convierte y redondea al múltiplo de 100", () => {
    // 10.37 * 1.2 * 1050.5 = 13072.42... -> 13100
    expect(computeFinalPrice(10.37, ARS)).toEqual({ precioFinal: 13100, monedaFinal: "ARS" });
    // 100 * 1.2 * 1050.5 = 126060 -> 126100
    expect(computeFinalPrice(100, ARS)).toEqual({ precioFinal: 126100, monedaFinal: "ARS" });
  });

  it("respeta arsRoundTo=1 (entero)", () => {
    const r = computeFinalPrice(10, { ...ARS, eurArsRate: 1000, arsRoundTo: 1 });
    expect(r).toEqual({ precioFinal: 12000, monedaFinal: "ARS" });
  });

  it("lanza si falta eurArsRate", () => {
    expect(() => computeFinalPrice(10, { ...ARS, eurArsRate: undefined })).toThrow();
  });
});

describe("computeFinalPrice (input no confiable)", () => {
  it("lanza ante precio negativo, NaN o Infinity", () => {
    expect(() => computeFinalPrice(-1, EUR)).toThrow();
    expect(() => computeFinalPrice(Number.NaN, EUR)).toThrow();
    expect(() => computeFinalPrice(Number.POSITIVE_INFINITY, EUR)).toThrow();
  });
});

describe("priceTicket (tolerante a null para on_request)", () => {
  it("null -> precio_final null, moneda null", () => {
    expect(priceTicket(null, EUR)).toEqual({ precioFinal: null, monedaFinal: null });
  });
  it("con precio aplica el markup", () => {
    expect(priceTicket(10000, EUR)).toEqual({ precioFinal: 12000, monedaFinal: "EUR" });
  });
});
