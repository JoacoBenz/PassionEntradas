import { describe, expect, it } from "vitest";
import { margenPara, type ReglaMargen } from "./margenes.js";

const REGLAS: ReglaMargen[] = [
  { competicion: null, porcentaje: 20 },
  { competicion: "World Cup 2026 Canada / Mexico / USA", porcentaje: 35 },
  { competicion: "Euro 2028", porcentaje: 12.5 },
];

describe("margenPara", () => {
  it("la regla del torneo/evento gana", () => {
    expect(margenPara(REGLAS, "World Cup 2026 Canada / Mexico / USA", 0.2)).toBe(0.35);
    expect(margenPara(REGLAS, "Euro 2028", 0.2)).toBe(0.125);
  });

  it("sin regla específica cae al margen general", () => {
    expect(margenPara(REGLAS, "English Premier League", 0.99)).toBe(0.2);
    expect(margenPara(REGLAS, null, 0.99)).toBe(0.2);
  });

  it("sin reglas usa el fallback de config", () => {
    expect(margenPara([], "Euro 2028", 0.2)).toBe(0.2);
    expect(margenPara([], null, 0.3)).toBe(0.3);
  });

  it("margen general en 0 vale (vender a precio de origen)", () => {
    expect(margenPara([{ competicion: null, porcentaje: 0 }], "Euro 2028", 0.2)).toBe(0);
  });
});
