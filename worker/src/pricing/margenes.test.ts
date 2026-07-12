import { describe, expect, it } from "vitest";
import { margenPara, type ReglaMargen } from "./margenes.js";

const REGLAS: ReglaMargen[] = [
  { categoria: null, porcentaje: 20 },
  { categoria: "VIP", porcentaje: 35 },
  { categoria: "WC Cat 2", porcentaje: 12.5 },
];

describe("margenPara", () => {
  it("la regla específica de la categoría gana", () => {
    expect(margenPara(REGLAS, "VIP", 0.2)).toBe(0.35);
    expect(margenPara(REGLAS, "WC Cat 2", 0.2)).toBe(0.125);
  });

  it("sin regla específica cae al margen general", () => {
    expect(margenPara(REGLAS, "A+", 0.99)).toBe(0.2);
    expect(margenPara(REGLAS, null, 0.99)).toBe(0.2);
  });

  it("sin reglas usa el fallback de config", () => {
    expect(margenPara([], "VIP", 0.2)).toBe(0.2);
    expect(margenPara([], null, 0.3)).toBe(0.3);
  });

  it("margen general en 0 vale (vender a precio de origen)", () => {
    expect(margenPara([{ categoria: null, porcentaje: 0 }], "A", 0.2)).toBe(0);
  });
});
