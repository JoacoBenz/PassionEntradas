import { describe, expect, it } from "vitest";
import { computeMetrics, metricasDominantes } from "./metrics";

const base = {
  monto: 100_000,
  fee: 10_000,
  status: "esperando_entrada" as const,
  pago_confirmado_at: null as string | null,
  cerrada_at: null as string | null, moneda: "USD" as const };

describe("computeMetrics", () => {
  it("suma plata, comisión y ventas solo con pago confirmado", () => {
    const m = computeMetrics([
      { ...base, pago_confirmado_at: "2026-07-01T00:00:00Z" },
      { ...base, monto: 50_000, fee: 5_000, pago_confirmado_at: "2026-07-02T00:00:00Z", cerrada_at: "2026-07-03T00:00:00Z" },
      { ...base }, // abierta sin pago -> en juego
    ]);
    expect(m.plataMovida).toBe(150_000);
    expect(m.comisionGanada).toBe(15_000);
    expect(m.entradasVendidas).toBe(2);
    expect(m.ticketPromedio).toBe(75_000);
  });

  it("las canceladas no cuentan nunca, ni con pago previo", () => {
    const m = computeMetrics([
      { ...base, status: "cancelada", pago_confirmado_at: "2026-07-01T00:00:00Z" },
      { ...base, status: "cancelada" },
    ]);
    expect(m.plataMovida).toBe(0);
    expect(m.entradasVendidas).toBe(0);
    expect(m.enJuegoOps).toBe(0);
  });

  it("en juego: abiertas sin pago; las cerradas sin pago no cuentan", () => {
    const m = computeMetrics([
      { ...base }, // abierta
      { ...base, monto: 30_000 }, // abierta
      { ...base, cerrada_at: "2026-07-01T00:00:00Z" }, // cerrada sin pago (raro, pero no es exposición)
    ]);
    expect(m.enJuegoMonto).toBe(130_000);
    expect(m.enJuegoOps).toBe(2);
  });

  it("vacío: todo en cero sin dividir por cero", () => {
    const m = computeMetrics([]);
    expect(m.ticketPromedio).toBe(0);
    expect(m.plataMovida).toBe(0);
  });
});

// Regresión: con varias monedas el cálculo en JS sumaba pesos con dólares en un
// pozo único y lo etiquetaba con la moneda de la PRIMERA operación. El tablero
// del demo mostraba un número que no era de ninguna moneda. Ahora agrupa y
// devuelve la dominante, igual que el RPC de producción.
describe("computeMetrics — varias monedas", () => {
  const pagada = (monto: number, fee: number, moneda: "ARS" | "USD" | "EUR") => ({
    ...base,
    monto,
    fee,
    moneda,
    pago_confirmado_at: "2026-07-01T00:00:00Z",
  });

  it("no mezcla monedas: dólares por un lado, pesos en su pestaña", () => {
    const m = computeMetrics([
      pagada(500_000, 1_000, "ARS"),
      pagada(1_000, 100, "USD"),
      pagada(2_000, 200, "USD"),
    ]);
    // La principal es USD aunque $ 500.000 sea un número más grande:
    // comparar montos crudos de monedas distintas no significa nada.
    expect(m.moneda).toBe("USD");
    expect(m.plataMovida).toBe(3_000);
    // Lo que NO tiene que pasar: 503.000 de algo.
    expect(m.plataMovida).not.toBe(503_000);
    const ars = m.otrasMonedas?.find((x) => x.moneda === "ARS");
    expect(ars?.plataMovida).toBe(500_000);
    expect(ars?.entradasVendidas).toBe(1);
  });

  it("sin movimiento en dólares, la principal es la que tiene operaciones", () => {
    const m = computeMetrics([pagada(9_000, 900, "EUR")]);
    expect(m.moneda).toBe("EUR");
    expect(m.plataMovida).toBe(9_000);
    expect(m.comisionGanada).toBe(900);
    expect(m.otrasMonedas).toEqual([]);
  });

  it("el 'en juego' también es por moneda", () => {
    const m = computeMetrics([
      { ...base, monto: 400_000, moneda: "ARS" },
      { ...base, monto: 1_000, moneda: "USD" },
      pagada(900_000, 0, "ARS"),
    ]);
    expect(m.moneda).toBe("USD");
    expect(m.enJuegoMonto).toBe(1_000);
    const ars = m.otrasMonedas?.find((x) => x.moneda === "ARS");
    expect(ars?.enJuegoMonto).toBe(400_000);
    expect(ars?.enJuegoOps).toBe(1);
  });

  it("una sola moneda se comporta igual que antes", () => {
    const m = computeMetrics([
      pagada(100_000, 10_000, "USD"),
      pagada(50_000, 5_000, "USD"),
    ]);
    expect(m.moneda).toBe("USD");
    expect(m.plataMovida).toBe(150_000);
    expect(m.ticketPromedio).toBe(75_000);
  });
});

describe("metricasDominantes — lo que devuelve el RPC", () => {
  it("USD es la principal y cada otra moneda va aparte, con sus números", () => {
    const m = metricasDominantes([
      { moneda: "USD", plata_movida: 100, comision_ganada: 10, entradas_vendidas: 2, en_juego_monto: 5, en_juego_ops: 1 },
      { moneda: "ARS", plata_movida: 900, comision_ganada: 90, entradas_vendidas: 3, en_juego_monto: 7, en_juego_ops: 2 },
    ]);
    expect(m.moneda).toBe("USD");
    expect(m.plataMovida).toBe(100);
    expect(m.ticketPromedio).toBe(50);
    const [ars] = m.otrasMonedas ?? [];
    expect(ars.moneda).toBe("ARS");
    expect(ars.plataMovida).toBe(900);
    expect(ars.entradasVendidas).toBe(3);
    expect(ars.ticketPromedio).toBe(300);
  });

  it("una moneda sin ninguna operación no aparece como pestaña", () => {
    const m = metricasDominantes([
      { moneda: "USD", plata_movida: 100, entradas_vendidas: 1 },
      { moneda: "EUR", plata_movida: 0, entradas_vendidas: 0, en_juego_ops: 0 },
    ]);
    expect(m.otrasMonedas).toEqual([]);
  });

  it("sin filas no rompe ni divide por cero", () => {
    const m = metricasDominantes([]);
    expect(m.moneda).toBe("USD");
    expect(m.plataMovida).toBe(0);
    expect(m.ticketPromedio).toBe(0);
  });
});

describe("computeMetrics — misma definición que el RPC (0035)", () => {
  const b = {
    monto: 300,
    fee: 30,
    status: "esperando_entrada" as const,
    pago_confirmado_at: null as string | null,
    cerrada_at: null as string | null,
    moneda: "USD" as const,
  };

  it("la plata se mueve cuando el cliente paga, aunque la entrada no se haya entregado", () => {
    const m = computeMetrics([{ ...b, pago_confirmado_at: "2026-09-20T15:00:00Z" }]);
    expect(m.plataMovida).toBe(300);
  });

  it("entregada sin pago no es plata movida", () => {
    const m = computeMetrics([{ ...b, cerrada_at: "2026-09-20T15:00:00Z" }]);
    expect(m.plataMovida).toBe(0);
  });

  it("entradas vendidas suma cantidades: un pedido de 3 son 3 entradas", () => {
    const m = computeMetrics([
      { ...b, cantidad: 3, pago_confirmado_at: "2026-09-20T15:00:00Z" },
      { ...b, cantidad: 1, pago_confirmado_at: "2026-09-20T15:00:00Z" },
    ]);
    expect(m.entradasVendidas).toBe(4);
    expect(m.ticketPromedio).toBe(150); // 600 / 4
  });

  it("el rango usa el día del pago en hora argentina", () => {
    // 01:30 UTC del 21 = 22:30 del 20 en Buenos Aires.
    const op = { ...b, pago_confirmado_at: "2026-09-21T01:30:00Z" };
    expect(computeMetrics([op], "2026-09-20", "2026-09-20").plataMovida).toBe(300);
    expect(computeMetrics([op], "2026-09-21", "2026-09-21").plataMovida).toBe(0);
  });
});
