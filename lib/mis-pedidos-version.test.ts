import { describe, expect, it } from "vitest";
import { versionMisPedidos } from "@/lib/mis-pedidos-version";

const base = {
  ops: [{ updated_at: "2026-10-01T10:00:00Z" }, { updated_at: "2026-10-02T10:00:00Z" }],
  consultas: [{ updated_at: "2026-10-01T09:00:00Z", estado: "cotizada", vence_at: "2026-10-05T12:00:00Z" }],
  facturas: 1,
  textos: [{ updated_at: "2026-09-01T00:00:00Z" }],
  ahora: Date.parse("2026-10-05T11:00:00Z"),
};

describe("versión de Mis pedidos", () => {
  it("igual si no cambió nada", () => {
    expect(versionMisPedidos(base)).toBe(versionMisPedidos({ ...base }));
  });
  it("cambia si se toca una operación", () => {
    const v = versionMisPedidos({
      ...base,
      ops: [base.ops[0], { updated_at: "2026-10-05T10:59:00Z" }],
    });
    expect(v).not.toBe(versionMisPedidos(base));
  });
  it("cambia con un pedido nuevo, una factura o un texto de pago", () => {
    const v0 = versionMisPedidos(base);
    expect(versionMisPedidos({ ...base, ops: [...base.ops, { updated_at: null }] })).not.toBe(v0);
    expect(versionMisPedidos({ ...base, facturas: 2 })).not.toBe(v0);
    expect(versionMisPedidos({ ...base, textos: [{ updated_at: "2026-10-05T10:00:00Z" }] })).not.toBe(v0);
  });
  it("cambia cuando vence una cotización aunque la base no cambie", () => {
    const antes = versionMisPedidos(base);
    const despues = versionMisPedidos({ ...base, ahora: Date.parse("2026-10-05T12:00:01Z") });
    expect(despues).not.toBe(antes);
  });
});
