import { describe, expect, it } from "vitest";
import {
  claveAvisoEquipo,
  DESTINO_LISTA_FIJA,
  edad,
  estadoWhatsappAviso,
  etiquetaPrioridad,
  motivoWhatsapp,
  paraModeradores,
  pendienteDeConsulta,
  pendienteDeOp,
  pendientes,
  resumenPendientes,
  textoAvisoEquipo,
} from "./recordatorios";

// 9 de octubre, 12:00 en Buenos Aires.
const AHORA = new Date("2026-10-09T15:00:00Z");
const haceH = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();
const enH = (h: number) => new Date(AHORA.getTime() + h * 3_600_000).toISOString();

const op = (extra: Record<string, unknown> = {}) =>
  ({
    id: "o1", code: "BX-1", evento: "River vs Boca", status: "esperando_entrada", tipo: "pedido",
    confirmada_at: null, entrada_recibida_at: null, pago_confirmado_at: null, cerrada_at: null,
    fecha_evento: null, created_at: haceH(1), ...extra,
  }) as any;
const consulta = (extra: Record<string, unknown> = {}) =>
  ({ id: "c1", code: "BX-C", evento: "Final", estado: "pendiente", vence_at: null, created_at: haceH(1), ...extra }) as any;

describe("pendienteDeOp", () => {
  it("pedido sin confirmar: a las 2 h pasa a prioridad", () => {
    expect(pendienteDeOp(op({ created_at: haceH(1.9) }), AHORA)).toBeNull();
    expect(pendienteDeOp(op({ created_at: haceH(2) }), AHORA)?.tipo).toBe("confirmar");
    expect(pendienteDeOp(op({ created_at: haceH(5), confirmada_at: "x" }), AHORA)).toBeNull();
    expect(pendienteDeOp(op({ created_at: haceH(5), tipo: "operacion" }), AHORA)).toBeNull();
  });
  it("evento en menos de 48 h sin entregar (día argentino)", () => {
    const conf = { confirmada_at: "x" };
    expect(pendienteDeOp(op({ ...conf, fecha_evento: "2026-10-09" }), AHORA)?.tipo).toBe("evento");
    expect(pendienteDeOp(op({ ...conf, fecha_evento: "2026-10-11" }), AHORA)?.tipo).toBe("evento");
    expect(pendienteDeOp(op({ ...conf, fecha_evento: "2026-10-12" }), AHORA)).toBeNull();
    expect(pendienteDeOp(op({ ...conf, fecha_evento: "2026-10-08" }), AHORA)).toBeNull();
    expect(pendienteDeOp(op({ ...conf, fecha_evento: "2026-10-10", cerrada_at: "x" }), AHORA)).toBeNull();
    expect(pendienteDeOp(op({ ...conf, fecha_evento: "2026-10-10", status: "cancelada" }), AHORA)).toBeNull();
  });
});

describe("pendienteDeConsulta", () => {
  it("sin cotizar a las 4 h; cotización por vencer en menos de 6 h", () => {
    expect(pendienteDeConsulta(consulta({ created_at: haceH(3.9) }), AHORA)).toBeNull();
    expect(pendienteDeConsulta(consulta({ created_at: haceH(4) }), AHORA)?.tipo).toBe("cotizar");
    expect(pendienteDeConsulta(consulta({ estado: "cotizada", vence_at: enH(5) }), AHORA)?.tipo).toBe("vence");
    expect(pendienteDeConsulta(consulta({ estado: "cotizada", vence_at: enH(7) }), AHORA)).toBeNull();
    expect(pendienteDeConsulta(consulta({ estado: "cotizada", vence_at: haceH(1) }), AHORA)).toBeNull();
  });
});

describe("resumen y textos", () => {
  it("una línea con los pendientes agrupados", () => {
    const ps = pendientes(
      [op({ id: "a", created_at: haceH(3) }), op({ id: "b", created_at: haceH(3) }), op({ id: "c", confirmada_at: "x", fecha_evento: "2026-10-10" })],
      [],
      AHORA
    );
    expect(resumenPendientes(ps)).toBe("3 pendientes: 2 por confirmar, 1 por entregar");
    expect(resumenPendientes([{ tipo: "vence" }])).toBe("1 pendiente: 1 cotización por vencer");
  });
  it("edad y badge", () => {
    expect(edad(haceH(0.25), AHORA)).toBe("15 min");
    expect(edad(haceH(3), AHORA)).toBe("3 h");
    expect(edad(haceH(72), AHORA)).toBe("3 d");
    expect(etiquetaPrioridad(pendienteDeOp(op({ created_at: haceH(3) }), AHORA)!, AHORA)).toBe("Sin confirmar hace 3 h");
    expect(etiquetaPrioridad(pendienteDeOp(op({ confirmada_at: "x", fecha_evento: "2026-10-10" }), AHORA)!, AHORA)).toBe(
      "Evento mañana, sin entregar"
    );
  });
  it("quién recibe qué y la campana", () => {
    expect(paraModeradores("nueva_consulta")).toBe(true);
    expect(paraModeradores("recordatorio_vence")).toBe(true);
    expect(paraModeradores("nuevo_pedido")).toBe(false);
    expect(paraModeradores("recordatorio_confirmar")).toBe(false);
    expect(textoAvisoEquipo("nuevo_pedido", { cliente: "Ana", detalle: "River x2", total: "US$ 300" })).toEqual({
      titulo: "Pedido nuevo de Ana",
      cuerpo: "River x2 · US$ 300",
    });
    expect(textoAvisoEquipo("raro", {})).toBeNull();
    expect(claveAvisoEquipo("u1", "recordatorio_cotizar", "c1")).toBe("equipo:u1:recordatorio_cotizar:c1");
  });
});

describe("estado del WhatsApp en la campana", () => {
  const meta = (code: number, message: string) =>
    `WhatsApp no aceptó ningún envío. 5491100000000: 400 {"error":{"message":"${message}","type":"OAuthException","code":${code}}}`;

  it("dice el motivo de los errores de Meta conocidos", () => {
    expect(motivoWhatsapp(meta(131030, "(#131030) Recipient phone number not in allowed list"))).toBe(
      "ese número no está en la lista de permitidos de Meta"
    );
    expect(motivoWhatsapp(meta(131047, "Re-engagement message"))).toMatch(/24 h/);
  });

  it("si no lo conoce, el mensaje de Meta; si no hay JSON, el texto", () => {
    expect(motivoWhatsapp(meta(999, "Something new"))).toBe("Something new");
    expect(motivoWhatsapp("No hay vendedores cargados en WHATSAPP_VENDEDORES.")).toBe(
      "No hay vendedores cargados en WHATSAPP_VENDEDORES."
    );
    expect(motivoWhatsapp("")).toBe("sin detalle");
    expect(motivoWhatsapp("x".repeat(300)).length).toBeLessThanOrEqual(140);
  });

  it("a quién salió, sin mostrar el número", () => {
    expect(estadoWhatsappAviso({ whatsapp_estado: "enviado", whatsapp_destino: "5491100000000" })).toEqual({
      tono: "ok",
      texto: "WhatsApp enviado a tu teléfono",
    });
    expect(estadoWhatsappAviso({ whatsapp_estado: "enviado", whatsapp_destino: DESTINO_LISTA_FIJA })?.texto).toBe(
      "WhatsApp enviado a la lista fija"
    );
    expect(
      estadoWhatsappAviso({ whatsapp_estado: "error", whatsapp_destino: DESTINO_LISTA_FIJA, whatsapp_error: meta(190, "x") })
    ).toEqual({ tono: "error", texto: "El WhatsApp a la lista fija no salió: el token de WhatsApp venció o no es válido" });
  });

  it("sin WhatsApp (o todavía saliendo), nada", () => {
    expect(estadoWhatsappAviso({ whatsapp_estado: "no_aplica" })).toBeNull();
    expect(estadoWhatsappAviso({ whatsapp_estado: "pendiente" })).toBeNull();
    expect(estadoWhatsappAviso({})).toBeNull();
    expect(estadoWhatsappAviso({ whatsapp_estado: "sin_configurar" })?.tono).toBe("gris");
  });
});
