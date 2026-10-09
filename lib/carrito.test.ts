import { describe, expect, it } from "vitest";
import { resumenCarrito, totalesPorMoneda } from "./carrito";

describe("resumenCarrito", () => {
  it("separa pedidos de consultas y suma por moneda sin mezclar", () => {
    const r = resumenCarrito([
      { key: "a", tipo: "pedido" as const, monto: 100, cantidad: 2, moneda: "USD" as const },
      { key: "b", tipo: "pedido" as const, monto: 50_000, cantidad: 1, moneda: "ARS" as const },
      { key: "c", tipo: "consulta" as const, monto: 0, cantidad: 1 },
    ]);
    expect(r.pedidos.map((i) => i.key)).toEqual(["a", "b"]);
    expect(r.consultas.map((i) => i.key)).toEqual(["c"]);
    expect(r.totales).toEqual([
      { moneda: "USD", total: 200 },
      { moneda: "ARS", total: 50_000 },
    ]);
  });
  it("sin moneda es dólares; sin precio no suma ni aparece", () => {
    expect(totalesPorMoneda([{ tipo: "pedido", monto: 80, cantidad: 3 }])).toEqual([{ moneda: "USD", total: 240 }]);
    expect(totalesPorMoneda([{ tipo: "consulta", monto: 0, cantidad: 1 }])).toEqual([]);
  });
});
