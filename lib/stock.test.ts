import { describe, expect, it } from "vitest";
import { avisoDeSobreventa, movimientoDeStock } from "./stock";

const abierta = { status: "esperando_entrada", pago_confirmado_at: null as string | null };
const paga = { status: "esperando_entrada", pago_confirmado_at: "2026-10-01T00:00:00Z" };

describe("movimientoDeStock", () => {
  it("marcar el pago toma stock; desmarcarlo lo devuelve", () => {
    expect(movimientoDeStock({ action: "pago", done: true }, paga)).toBe("tomar");
    expect(movimientoDeStock({ action: "pago", done: false }, abierta)).toBe("devolver");
  });
  it("entregar ya no mueve stock (antes descontaba 1)", () => {
    expect(movimientoDeStock({ action: "cerrar", done: true }, paga)).toBeNull();
    expect(movimientoDeStock({ action: "cerrar", done: false }, paga)).toBeNull();
  });
  it("los hitos internos no mueven stock", () => {
    expect(movimientoDeStock({ action: "entrada", done: true }, abierta)).toBeNull();
    expect(movimientoDeStock({ action: "proveedor", done: true }, abierta)).toBeNull();
  });
  it("cancelar devuelve; reabrir una paga vuelve a tomar", () => {
    expect(movimientoDeStock({ action: "cancelar" }, paga)).toBe("devolver");
    expect(movimientoDeStock({ action: "reabrir" }, paga)).toBe("tomar");
    expect(movimientoDeStock({ action: "reabrir" }, abierta)).toBeNull();
  });
});

describe("avisoDeSobreventa", () => {
  it("sin faltante, sin aviso", () => {
    expect(avisoDeSobreventa([{ ticket_id: "a", cantidad: 2, pedido: 2 }])).toBeNull();
    expect(avisoDeSobreventa([])).toBeNull();
    expect(avisoDeSobreventa(null)).toBeNull();
  });
  it("avisa cuántas faltaron", () => {
    expect(avisoDeSobreventa([{ ticket_id: "a", cantidad: 1, pedido: 3 }])).toMatch(/faltaron 2 entradas/);
    expect(avisoDeSobreventa([{ ticket_id: "a", cantidad: 0, pedido: 1 }])).toMatch(/faltaron 1 entrada\b/);
  });
});
