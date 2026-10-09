import { describe, expect, it } from "vitest";
import { avisoDeCambio, claveAvisoCliente, emailAviso, idiomaDe, textoAviso } from "./notificaciones";

const op = (extra: Record<string, unknown> = {}) =>
  ({
    status: "esperando_entrada", tipo: "pedido", confirmada_at: null,
    entrada_recibida_at: null, pago_confirmado_at: null, cerrada_at: null, ...extra,
  }) as any;

describe("avisoDeCambio", () => {
  it("los tres momentos", () => {
    expect(avisoDeCambio(op(), op({ confirmada_at: "x" }))).toBe("pedido_confirmado");
    expect(avisoDeCambio(op({ confirmada_at: "x" }), op({ confirmada_at: "x", entrada_recibida_at: "x" }))).toBe("para_pagar");
    expect(avisoDeCambio(op({ pago_confirmado_at: "x" }), op({ pago_confirmado_at: "x", cerrada_at: "x" }))).toBe("entregada");
  });
  it("saltear pasos avisa solo el de llegada", () => {
    expect(avisoDeCambio(op(), op({ confirmada_at: "x", entrada_recibida_at: "x" }))).toBe("para_pagar");
  });
  it("desmarcar o reabrir no avisa (solo cuando el pedido avanza)", () => {
    const conf = { confirmada_at: "x" };
    // Para pagar -> Confirmado (se desmarcó la entrada).
    expect(avisoDeCambio(op({ ...conf, entrada_recibida_at: "x" }), op(conf))).toBeNull();
    // Entregada -> Para pagar (se desmarcó la entrega).
    expect(avisoDeCambio(op({ ...conf, entrada_recibida_at: "x", cerrada_at: "x" }), op({ ...conf, entrada_recibida_at: "x" }))).toBeNull();
    // Una del staff (nace confirmada) a la que se le desmarca la entrada.
    expect(avisoDeCambio(op({ tipo: "operacion", entrada_recibida_at: "x" }), op({ tipo: "operacion" }))).toBeNull();
    // Reabrir una cancelada.
    expect(avisoDeCambio(op({ tipo: "operacion", status: "cancelada" }), op({ tipo: "operacion" }))).toBeNull();
    expect(avisoDeCambio(op({ ...conf, status: "cancelada" }), op(conf))).toBeNull();
  });
  it("lo que no es uno de los tres no avisa", () => {
    // Pagado: el cliente ya lo sabe.
    expect(avisoDeCambio(op({ entrada_recibida_at: "x" }), op({ entrada_recibida_at: "x", pago_confirmado_at: "x" }))).toBeNull();
    expect(avisoDeCambio(op({ confirmada_at: "x" }), op({ confirmada_at: "x", status: "cancelada" }))).toBeNull();
    // Desmarcar la entrada vuelve a "Confirmado": no se re-avisa (la clave lo frena igual).
    expect(avisoDeCambio(op({ confirmada_at: "x" }), op({ confirmada_at: "x" }))).toBeNull();
  });
  it("una operación del staff nace confirmada: el primer aviso es Para pagar", () => {
    expect(avisoDeCambio(op({ tipo: "operacion" }), op({ tipo: "operacion", entrada_recibida_at: "x" }))).toBe("para_pagar");
  });
});

describe("textos", () => {
  const datos = { code: "BX-1", evento: "River vs Boca", monto: 300, moneda: "USD" as const };
  it("campana en los dos idiomas", () => {
    expect(textoAviso("para_pagar", datos, "es")?.titulo).toBe("Pedido BX-1 listo para pagar");
    expect(textoAviso("para_pagar", datos, "en")?.titulo).toBe("Order BX-1 ready to pay");
    expect(textoAviso("otro", datos, "es")).toBeNull();
  });
  it("email con cómo pagar y el link", () => {
    const m = emailAviso("para_pagar", { ...datos, nombre: "Ana", textoPago: "Alias: x.y.z", url: "https://t/mis-pedidos" }, "es");
    expect(m.subject).toBe("Pedido BX-1 listo para pagar");
    expect(m.text).toMatch(/^Hola Ana,/);
    expect(m.text).toMatch(/Cómo pagar:\nAlias: x\.y\.z/);
    expect(m.text).toMatch(/https:\/\/t\/mis-pedidos/);
    expect(emailAviso("entregada", { ...datos, url: "u" }, "en").text).toMatch(/^Hi,/);
  });
  it("clave e idioma", () => {
    expect(claveAvisoCliente("op1", "entregada")).toBe("cliente:op1:entregada");
    expect(idiomaDe("en")).toBe("en");
    expect(idiomaDe(null)).toBe("es");
  });
});
