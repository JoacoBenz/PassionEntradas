import { describe, expect, it } from "vitest";
import {
  buildEvents,
  factorAVenta,
  fmtPrice,
  monedaDeVenta,
  normalizarPrecios,
  valorComparableUsd,
  type Ticket,
} from "./tickets";
import {
  agruparPorMoneda,
  costoVenta,
  precioVenta,
  reconciliarItem,
  type ItemPedido,
  type TicketRef,
} from "./pedidos";

const tasas = { eurUsd: 1.15, arsPorUsd: 1500 };

describe("monedaDeVenta: la regla única", () => {
  it("una propia en pesos se cobra en pesos", () => {
    expect(monedaDeVenta("manual", "ARS")).toBe("ARS");
    expect(monedaDeVenta("manual", "ars")).toBe("ARS");
  });
  it("todo lo demás se cobra en dólares", () => {
    expect(monedaDeVenta("manual", "USD")).toBe("USD");
    expect(monedaDeVenta("manual", "EUR")).toBe("USD");
    expect(monedaDeVenta("manual", null)).toBe("USD");
    expect(monedaDeVenta("portal", "EUR")).toBe("USD");
    // Un portal nunca se cobra en pesos, aunque una fila venga rara.
    expect(monedaDeVenta("portal", "ARS")).toBe("USD");
  });
});

describe("factorAVenta", () => {
  it("pesos quedan como están (no se convierten)", () => {
    expect(factorAVenta("manual", "ARS", tasas)).toBe(1);
    // Ni siquiera hace falta la cotización del peso para cobrar.
    expect(factorAVenta("manual", "ARS", { eurUsd: 1.15 })).toBe(1);
  });
  it("euros pasan a dólares (portal y propias)", () => {
    expect(factorAVenta("portal", "EUR", tasas)).toBe(1.15);
    expect(factorAVenta("manual", "EUR", tasas)).toBe(1.15);
  });
  it("dólares quedan como están", () => {
    expect(factorAVenta("manual", "USD", tasas)).toBe(1);
  });
});

describe("normalizarPrecios: lo que ve el cliente", () => {
  const fila = (moneda: string, precio: number, source: "manual" | "portal" = "manual") => ({
    precio_final: precio,
    source,
    moneda_final: moneda,
  });

  it("el caso Boca: $ 600.000 se muestra en pesos, no como US$ 600,000", () => {
    const [r] = normalizarPrecios([fila("ARS", 600_000)], tasas);
    expect(r.precio_final).toBe(600_000);
    expect(r.moneda_venta).toBe("ARS");
    expect(fmtPrice(r.precio_final, "es", r.moneda_venta)).toBe("$ 600.000");
  });
  it("una propia en euros se muestra en dólares", () => {
    const [r] = normalizarPrecios([fila("EUR", 100)], tasas);
    expect(r.moneda_venta).toBe("USD");
    expect(r.precio_final).toBeCloseTo(115);
  });
  it("pesos sin cotización igual tienen precio (solo no se pueden comparar)", () => {
    const [r] = normalizarPrecios([fila("ARS", 600_000)], { eurUsd: 1.15 });
    expect(r.precio_final).toBe(600_000);
    expect(r.precio_cmp).toBeNull();
  });
});

describe("valorComparableUsd", () => {
  it("compara pesos con dólares usando la cotización", () => {
    expect(valorComparableUsd(600_000, "ARS", tasas)).toBe(400);
    expect(valorComparableUsd(500, "USD", tasas)).toBe(500);
  });
});

describe("evento con sectores en pesos y en dólares", () => {
  const base = {
    evento: "Boca vs Vasco",
    competicion: "Libertadores",
    fecha: "2026-11-01",
    ciudad: "La Bombonera",
    estado: "book",
    stock: 3,
  };
  const rows = (t: typeof tasas | { eurUsd: number }) =>
    normalizarPrecios(
      [
        { ...base, id: "a", categoria: "Platea", precio_final: 600_000, moneda_final: "ARS", source: "manual" as const },
        { ...base, id: "b", categoria: "VIP", precio_final: 500, moneda_final: "USD", source: "manual" as const },
      ],
      t
    ) as unknown as Ticket[];

  it("el 'desde' es el más barato de verdad, en su moneda", () => {
    // $ 600.000 / 1500 = US$ 400 < US$ 500
    const [ev] = buildEvents(rows(tasas));
    expect(ev.minPrice).toBe(600_000);
    expect(ev.minMoneda).toBe("ARS");
    expect(ev.ubicaciones.map((u) => u.categoria)).toEqual(["Platea", "VIP"]);
  });
  it("sin cotización no compara 600.000 contra 500: el 'desde' queda en dólares", () => {
    const [ev] = buildEvents(rows({ eurUsd: 1.15 }));
    expect(ev.minMoneda).toBe("USD");
    expect(ev.minPrice).toBe(500);
  });
});

describe("pedido de una entrada propia en pesos", () => {
  const ref: TicketRef = {
    evento: "Boca vs Vasco",
    categoria: "Platea Baja",
    precio_final: 600_000,
    precio_costo: 390_000,
    stock: 7,
    fecha: "2026-11-01",
    source: "manual",
    moneda_final: "ARS",
  };
  const item: ItemPedido = {
    tipo: "pedido",
    evento: "x",
    sector: "x",
    ticket_id: "manual::boca",
    monto: 1,
    cantidad: 2,
    fecha_evento: null,
  };

  it("se cobra en pesos: el caso real (2 × $ 600.000, comisión 2 × $ 210.000)", () => {
    expect(precioVenta(ref, tasas)).toBe(600_000);
    expect(costoVenta(ref, tasas)).toBe(390_000);
    const r = reconciliarItem(item, ref, tasas);
    expect(r.moneda).toBe("ARS");
    expect(r.tipo).toBe("pedido");
    expect(r.monto).toBe(1_200_000);
    expect(r.comision).toBe(420_000);
  });

  it("no depende de la cotización del peso", () => {
    const r = reconciliarItem(item, ref, { eurUsd: 1.15 });
    expect(r.tipo).toBe("pedido");
    expect(r.monto).toBe(1_200_000);
  });
});

describe("agruparPorMoneda: un carrito, una operación por moneda", () => {
  const l = (moneda: "ARS" | "USD" | undefined, monto: number): ItemPedido => ({
    tipo: "pedido",
    evento: "e",
    sector: null,
    ticket_id: null,
    monto,
    cantidad: 1,
    fecha_evento: null,
    moneda,
  });
  it("separa pesos de dólares y nunca los suma", () => {
    const g = agruparPorMoneda([l("ARS", 600_000), l("USD", 500), l("ARS", 300_000)]);
    expect(g.map((x) => x.moneda)).toEqual(["USD", "ARS"]);
    expect(g[1].lineas.reduce((a, x) => a + x.monto, 0)).toBe(900_000);
  });
  it("una línea sin moneda (sin entrada vinculada) es USD", () => {
    expect(agruparPorMoneda([l(undefined, 10)])[0].moneda).toBe("USD");
  });
  it("todo en una moneda: un solo grupo", () => {
    expect(agruparPorMoneda([l("USD", 1), l("USD", 2)])).toHaveLength(1);
  });
});
