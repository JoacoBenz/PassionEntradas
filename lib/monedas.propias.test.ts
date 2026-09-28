import { describe, expect, it } from "vitest";
import { factorAUsd, normalizarPreciosUsd } from "./tickets";
import { costoUsd, precioUsd, reconciliarItem, type ItemPedido, type TicketRef } from "./pedidos";

const tasas = { eurUsd: 1.15, arsPorUsd: 1500 };

describe("factorAUsd", () => {
  it("portal: siempre euros", () => {
    expect(factorAUsd("portal", "USD", tasas)).toBe(1.15);
  });
  it("propias: según la moneda con que se cargaron", () => {
    expect(factorAUsd("manual", "USD", tasas)).toBe(1);
    expect(factorAUsd("manual", null, tasas)).toBe(1);
    expect(factorAUsd("manual", "EUR", tasas)).toBe(1.15);
    expect(factorAUsd("manual", "ARS", tasas)).toBeCloseTo(1 / 1500);
  });
  it("pesos sin cotización cargada: no se puede convertir", () => {
    expect(factorAUsd("manual", "ARS", { eurUsd: 1.15 })).toBeNull();
    expect(factorAUsd("manual", "ARS", { eurUsd: 1.15, arsPorUsd: 0 })).toBeNull();
  });
  it("acepta el número suelto de antes (solo EUR)", () => {
    expect(factorAUsd("portal", null, 1.2)).toBe(1.2);
  });
});

describe("normalizarPreciosUsd con entradas propias", () => {
  const fila = (moneda: string, precio: number) => ({
    precio_final: precio,
    source: "manual" as const,
    moneda_final: moneda,
  });

  it("el bug: una propia en pesos ya no aparece como dólares", () => {
    const [r] = normalizarPreciosUsd([fila("ARS", 150_000)], tasas);
    expect(r.precio_final).toBe(100); // 150.000 / 1500
  });
  it("euros propios se convierten igual que el portal", () => {
    const [r] = normalizarPreciosUsd([fila("EUR", 100)], tasas);
    expect(r.precio_final).toBeCloseTo(115);
  });
  it("dólares quedan igual", () => {
    const [r] = normalizarPreciosUsd([fila("USD", 250)], tasas);
    expect(r.precio_final).toBe(250);
  });
  it("pesos sin cotización: sin precio (la tienda la ofrece a consultar)", () => {
    const [r] = normalizarPreciosUsd([fila("ARS", 150_000)], { eurUsd: 1.15 });
    expect(r.precio_final).toBeNull();
  });
});

describe("pedido de una entrada propia en pesos", () => {
  const ref: TicketRef = {
    evento: "Boca vs River",
    categoria: "Platea",
    precio_final: 150_000,
    precio_costo: 120_000,
    stock: 5,
    fecha: "2026-10-10",
    source: "manual",
    moneda_final: "ARS",
  };
  const item: ItemPedido = {
    tipo: "pedido",
    evento: "Boca vs River",
    sector: "Platea",
    ticket_id: "manual::x",
    monto: 150_000,
    cantidad: 2,
    fecha_evento: null,
  };

  it("se cobra en dólares al precio que vio el cliente, con su comisión", () => {
    expect(precioUsd(ref, tasas)).toBe(100);
    expect(costoUsd(ref, tasas)).toBe(80);
    const r = reconciliarItem(item, ref, tasas);
    expect(r.tipo).toBe("pedido");
    expect(r.monto).toBe(200); // 2 × US$ 100
    expect(r.comision).toBe(40); // 2 × (100 − 80)
  });

  it("sin cotización de pesos pasa a consulta, nunca a un pedido de US$ 0", () => {
    const r = reconciliarItem(item, ref, { eurUsd: 1.15 });
    expect(r.tipo).toBe("consulta");
    expect(r.monto).toBe(0);
  });
});
