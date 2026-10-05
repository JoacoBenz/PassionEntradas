import { describe, expect, it } from "vitest";
import { resumenHome } from "@/lib/resumen-home";
import { MOCK_TICKETS } from "@/lib/mock-tickets";
import { buildEvents, normalizarPrecios } from "@/lib/tickets";

describe("resumen de la home", () => {
  const rows = normalizarPrecios(MOCK_TICKETS, { eurUsd: 1.1, arsPorUsd: 1200 });
  const r = resumenHome(rows);
  const events = buildEvents(rows);

  it("totales iguales a los del catálogo", () => {
    expect(r.totalEv).toBe(events.length);
    expect(r.totalStock).toBe(events.reduce((a, e) => a + e.bookStock, 0));
  });

  it("hasta 6 próximos, por fecha, sin los sectores", () => {
    expect(r.populares.length).toBe(Math.min(6, events.length));
    const fechas = r.populares.map((e) => (e.fecha ? Date.parse(e.fecha) : Infinity));
    expect([...fechas].sort((a, b) => a - b)).toEqual(fechas);
    for (const e of r.populares) expect("ubicaciones" in e).toBe(false);
  });

  it("hasta 8 categorías, en orden alfabético, con su cantidad", () => {
    expect(r.topCats.length).toBeLessThanOrEqual(8);
    const nombres = r.topCats.map(([c]) => c);
    expect([...nombres].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))).toEqual(nombres);
    for (const [c, n] of r.topCats) expect(n).toBe(events.filter((e) => e.comp === c).length);
  });

  it("vacío", () => {
    expect(resumenHome([])).toEqual({ totalEv: 0, totalStock: 0, populares: [], topCats: [] });
  });
});
