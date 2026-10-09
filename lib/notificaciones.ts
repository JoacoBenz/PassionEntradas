// Avisos al cliente: cuándo se manda uno y qué dice (campana y email).
//
// Solo tres momentos (decisiones 13 y 19): Confirmado, Para pagar y Entregada.
// Se detectan comparando lo que ve el cliente antes y después de un cambio de
// estado en el panel. Funciones puras: el envío vive en lib/avisos.ts.

import { estadoPublicoDe, formatMonto, type EstadoPublico, type Moneda } from "./operaciones";

export type TipoAvisoCliente = "pedido_confirmado" | "para_pagar" | "entregada";

const AVISO_DE_ESTADO: Partial<Record<EstadoPublico, TipoAvisoCliente>> = {
  pedido_confirmado: "pedido_confirmado",
  listo_para_pagar: "para_pagar",
  entregada: "entregada",
};

type Hitos = Parameters<typeof estadoPublicoDe>[0];

// Orden de los pasos que ve el cliente. Cancelada queda afuera: reabrir no
// es avanzar.
const PASO: Partial<Record<EstadoPublico, number>> = {
  pedido_recibido: 0,
  pedido_confirmado: 1,
  listo_para_pagar: 2,
  pago_recibido: 3,
  entregada: 4,
};

/**
 * El aviso que corresponde a un cambio, o null. Solo cuando el pedido AVANZA:
 * desmarcar un hito (de "Para pagar" a "Confirmado") o reabrir una cancelada
 * no avisa nada; si no, al cliente le llegaba "Confirmamos tu pedido" después
 * de "Ya podés pagar". Si un cambio saltea pasos (de "Recibido" directo a
 * "Para pagar") va solo el del paso al que llegó: ese ya dice que está
 * confirmado.
 */
export function avisoDeCambio(antes: Hitos, despues: Hitos): TipoAvisoCliente | null {
  const a = PASO[estadoPublicoDe(antes)];
  const d = estadoPublicoDe(despues);
  const dn = PASO[d];
  if (a === undefined || dn === undefined || dn <= a) return null;
  return AVISO_DE_ESTADO[d] ?? null;
}

/** Deduplicación: un aviso por pedido y momento, aunque se desmarque y remarque. */
export function claveAvisoCliente(operacionId: string, tipo: TipoAvisoCliente): string {
  return `cliente:${operacionId}:${tipo}`;
}

export type DatosAviso = {
  code: string;
  evento: string;
  monto?: number | null;
  moneda?: Moneda | null;
};

type Lang = "es" | "en";

const TXT = {
  es: {
    pedido_confirmado: {
      titulo: (d: DatosAviso) => `Pedido ${d.code} confirmado`,
      cuerpo: (d: DatosAviso) => `Confirmamos tu pedido de ${d.evento}. Te avisamos cuando esté listo para pagar.`,
    },
    para_pagar: {
      titulo: (d: DatosAviso) => `Pedido ${d.code} listo para pagar`,
      cuerpo: (d: DatosAviso) =>
        `Ya tenemos tus entradas de ${d.evento}${d.monto != null && d.moneda ? ` (${formatMonto(d.monto, d.moneda)})` : ""}. Fijate cómo pagar en Mis pedidos.`,
    },
    entregada: {
      titulo: (d: DatosAviso) => `Pedido ${d.code} entregado`,
      cuerpo: (d: DatosAviso) => `Tus entradas de ${d.evento} ya fueron entregadas. ¡Que lo disfrutes!`,
    },
    pie: "Mirá el detalle en Mis pedidos:",
    saludo: "Hola",
    firma: "— TicketMirror",
    comoPagar: "Cómo pagar:",
  },
  en: {
    pedido_confirmado: {
      titulo: (d: DatosAviso) => `Order ${d.code} confirmed`,
      cuerpo: (d: DatosAviso) => `We confirmed your order for ${d.evento}. We'll let you know when it's ready to pay.`,
    },
    para_pagar: {
      titulo: (d: DatosAviso) => `Order ${d.code} ready to pay`,
      cuerpo: (d: DatosAviso) =>
        `We have your tickets for ${d.evento}${d.monto != null && d.moneda ? ` (${formatMonto(d.monto, d.moneda)})` : ""}. See how to pay in My orders.`,
    },
    entregada: {
      titulo: (d: DatosAviso) => `Order ${d.code} delivered`,
      cuerpo: (d: DatosAviso) => `Your tickets for ${d.evento} have been delivered. Enjoy!`,
    },
    pie: "See the details in My orders:",
    saludo: "Hi",
    firma: "— TicketMirror",
    comoPagar: "How to pay:",
  },
} as const;

const AVISO_TIPOS: Record<TipoAvisoCliente, true> = { pedido_confirmado: true, para_pagar: true, entregada: true };

/** Título y texto de la campana, en el idioma de quien la mira. */
export function textoAviso(tipo: string, datos: DatosAviso, lang: Lang): { titulo: string; cuerpo: string } | null {
  const t = TXT[lang] as (typeof TXT)["es"];
  const k = tipo as TipoAvisoCliente;
  if (!(k in AVISO_TIPOS)) return null;
  return { titulo: t[k].titulo(datos), cuerpo: t[k].cuerpo(datos) };
}

/** Email al cliente (texto plano, como el de credenciales). */
export function emailAviso(
  tipo: TipoAvisoCliente,
  datos: DatosAviso & { nombre?: string | null; textoPago?: string | null; url: string },
  lang: Lang
): { subject: string; text: string } {
  const t = TXT[lang] as (typeof TXT)["es"];
  const lineas = [
    datos.nombre ? `${t.saludo} ${datos.nombre},` : `${t.saludo},`,
    ``,
    t[tipo].cuerpo(datos),
  ];
  if (tipo === "para_pagar" && datos.textoPago) {
    lineas.push(``, t.comoPagar, datos.textoPago);
  }
  lineas.push(``, `${t.pie} ${datos.url}`, ``, t.firma);
  return { subject: t[tipo].titulo(datos), text: lineas.join("\n") };
}

export function idiomaDe(v: unknown): Lang {
  return v === "en" ? "en" : "es";
}
