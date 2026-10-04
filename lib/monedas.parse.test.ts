import { describe, expect, it } from "vitest";
import { parseMoneda } from "./operaciones";

describe("parseMoneda — la app maneja pesos y dólares", () => {
  it("acepta ARS y USD, sin importar mayúsculas", () => {
    expect(parseMoneda("ARS")).toBe("ARS");
    expect(parseMoneda("usd")).toBe("USD");
  });
  it("sin valor: USD (el default histórico)", () => {
    expect(parseMoneda(undefined)).toBe("USD");
    expect(parseMoneda("")).toBe("USD");
  });
  it("el euro (solo origen de Passion) y cualquier otra cosa se rechazan", () => {
    expect(parseMoneda("EUR")).toBeNull();
    expect(parseMoneda("BRL")).toBeNull();
  });
});
