import { describe, expect, it } from "vitest";
import { computeMetrics } from "./metrics";

const base = {
  monto: 100_000,
  fee: 10_000,
  status: "esperando_entrada" as const,
  pago_confirmado_at: null as string | null,
  cerrada_at: null as string | null,
};

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
