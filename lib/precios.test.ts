import { describe, expect, it } from "vitest";
import { parsePrecio, totalPrecio } from "./precios";

describe("totalPrecio", () => {
  it("suma costo y comisión", () => {
    expect(totalPrecio(100, 30)).toBe(130);
  });

  it("no arrastra basura de punto flotante", () => {
    expect(totalPrecio(0.1, 0.2)).toBe(0.3);
  });
});

describe("parsePrecio", () => {
  it("costo y comisión válidos dan el total", () => {
    const r = parsePrecio("100", "30");
    expect(r).toEqual({ ok: true, costo: 100, comision: 30, total: 130 });
  });

  it("comisión vacía cuenta como cero (venta al costo)", () => {
    // Regresión: antes el alta exigía un precio de venta aparte y cargar solo
    // el costo tiraba "El precio debe ser mayor a 0".
    const r = parsePrecio("100", "");
    expect(r).toEqual({ ok: true, costo: 100, comision: 0, total: 100 });
  });

  it("costo vacío cuenta como cero (entrada de cortesía con comisión)", () => {
    const r = parsePrecio("", "50");
    expect(r).toEqual({ ok: true, costo: 0, comision: 50, total: 50 });
  });

  it("costo 0 explícito con comisión es válido", () => {
    expect(parsePrecio(0, 50)).toEqual({ ok: true, costo: 0, comision: 50, total: 50 });
  });

  it("los dos en cero no alcanzan: no hay nada que cobrar", () => {
    const r = parsePrecio("0", "0");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("mayor a 0");
  });

  it("vacío del todo tampoco", () => {
    expect(parsePrecio("", "").ok).toBe(false);
  });

  it("negativos se rechazan por separado, con su mensaje", () => {
    const c = parsePrecio("-1", "10");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toContain("costo");

    const k = parsePrecio("10", "-1");
    expect(k.ok).toBe(false);
    if (!k.ok) expect(k.error).toContain("omisión");
  });

  it("texto que no es número se rechaza", () => {
    expect(parsePrecio("abc", "10").ok).toBe(false);
  });

  it("el sufijo `donde` se pega al final del mensaje", () => {
    const r = parsePrecio("0", "0", " (sector 2)");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/\(sector 2\)$/);
  });
});
