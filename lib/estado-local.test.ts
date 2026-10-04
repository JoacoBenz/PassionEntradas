import { describe, expect, it } from "vitest";
import { fusionarRefresco, parcheOptimista, previoDe } from "./estado-local";
import type { Operacion } from "./operaciones";

const AHORA = "2026-10-05T12:00:00.000Z";
const op = (id: string, extra: Partial<Operacion> = {}): Operacion =>
  ({
    id, code: id, evento: "E", status: "esperando_entrada", tipo: "operacion",
    entrada_recibida_at: null, pago_confirmado_at: null, pago_proveedor_at: null, cerrada_at: null,
    entrada_recibida_por: null, pago_confirmado_por: null, pago_proveedor_por: null, cerrada_por: null,
    confirmada_at: null, updated_at: "2026-10-05T11:00:00.000Z", ...extra,
  }) as Operacion;

describe("parcheOptimista", () => {
  it("marcar y desmarcar un hito se ve al instante", () => {
    expect(parcheOptimista(op("a"), { action: "pago", done: true }, AHORA)).toMatchObject({ pago_confirmado_at: AHORA });
    expect(parcheOptimista(op("a", { pago_confirmado_at: AHORA }), { action: "pago", done: false }, AHORA)).toMatchObject({ pago_confirmado_at: null });
  });
  it("marcar cualquier hito confirma un pedido nuevo (igual que el server)", () => {
    for (const a of ["entrada", "pago", "proveedor", "cerrar"] as const) {
      expect(parcheOptimista(op("a"), { action: a, done: true }, AHORA)?.confirmada_at).toBe(AHORA);
    }
    expect(parcheOptimista(op("a", { confirmada_at: "x" }), { action: "pago", done: true }, AHORA)?.confirmada_at).toBeUndefined();
  });
  it("cancelar y reabrir esperan al server", () => {
    expect(parcheOptimista(op("a"), { action: "cancelar" }, AHORA)).toBeNull();
    expect(parcheOptimista(op("a"), { action: "reabrir" }, AHORA)).toBeNull();
  });
  it("previoDe guarda lo que había para poder revertir", () => {
    const o = op("a", { entrada_recibida_at: "antes", entrada_recibida_por: "kiru" });
    const p = parcheOptimista(o, { action: "entrada", done: false }, AHORA)!;
    expect(previoDe(o, p)).toEqual({ entrada_recibida_at: "antes", entrada_recibida_por: "kiru" });
  });
});

describe("fusionarRefresco — el refresco no pisa clicks", () => {
  const local = [op("a", { entrada_recibida_at: AHORA, updated_at: "2026-10-05T12:00:01.000Z" }), op("b")];
  const viejo = [op("a", { updated_at: "2026-10-05T11:59:00.000Z" }), op("b", { pago_confirmado_at: AHORA, updated_at: "2026-10-05T12:00:05.000Z" })];

  it("con un click en vuelo gana la local", () => {
    const r = fusionarRefresco(local, viejo, (id) => (id === "a" ? 1 : 0), () => undefined);
    expect(r[0].entrada_recibida_at).toBe(AHORA);
  });
  it("si la última respuesta es más nueva que la foto del refresco, gana la local", () => {
    const r = fusionarRefresco(local, viejo, () => 0, (id) => (id === "a" ? "2026-10-05T12:00:01.000Z" : undefined));
    expect(r[0].entrada_recibida_at).toBe(AHORA);
  });
  it("los cambios de otro (sin clicks locales) entran", () => {
    const r = fusionarRefresco(local, viejo, () => 0, () => undefined);
    expect(r[1].pago_confirmado_at).toBe(AHORA);
  });
  it("una foto más nueva que la respuesta local gana", () => {
    const nuevo = [op("a", { cerrada_at: AHORA, updated_at: "2026-10-05T12:10:00.000Z" })];
    const r = fusionarRefresco(local, nuevo, () => 0, () => "2026-10-05T12:00:01.000Z");
    expect(r[0].cerrada_at).toBe(AHORA);
  });
  it("operaciones nuevas del server aparecen; las que ya no vienen se van", () => {
    const r = fusionarRefresco(local, [op("c")], () => 0, () => undefined);
    expect(r.map((o) => o.id)).toEqual(["c"]);
  });
});
