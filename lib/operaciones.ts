// Lógica de dominio de las operaciones: tipos, estado derivado, etiquetas
// para la UI, colores por estado y helpers (code, WhatsApp).
//
// Modelo: "entrada recibida" y "pago confirmado" son hitos INDEPENDIENTES
// (timestamps nullable); cada uno se marca/desmarca por separado. La
// operación está confirmada cuando están los dos. El enum `status` de la
// base solo se usa para cancelada / reabrir.

export type Status =
  | "esperando_entrada"
  | "entrada_recibida"
  | "confirmada"
  | "cancelada";

export type Operacion = {
  id: string;
  code: string;
  evento: string;
  comprador_alias: string | null;
  vendedor_alias: string | null;
  monto: number;
  fee: number;
  // Cuenta (alias/CBU) de la que se debita la plata. Dato interno del
  // panel — nunca se muestra en el link público.
  cuenta_debitar: string | null;
  status: Status;
  entrada_recibida_at: string | null;
  pago_confirmado_at: string | null;
  // Cierre explícito: con los dos hitos listos, el admin cierra la operación.
  cerrada_at: string | null;
  // Fecha del evento (date, sin hora): prioriza lo urgente en el panel.
  fecha_evento: string | null;
  // Notas internas del panel. NUNCA se exponen en la vista pública.
  notas: string | null;
  // Entrada del catálogo de la tienda que originó la operación (opcional).
  ticket_id: string | null;
  created_at: string;
  updated_at: string;
};

// Vista pública: subconjunto seguro de campos (sin datos de contacto y sin
// la comisión, que es un dato interno entre el admin y las partes).
export type OperacionPublica = Pick<
  Operacion,
  | "code"
  | "evento"
  | "comprador_alias"
  | "vendedor_alias"
  | "monto"
  | "status"
  | "entrada_recibida_at"
  | "pago_confirmado_at"
  | "cerrada_at"
  | "fecha_evento"
  | "updated_at"
>;

// Estado visible, derivado de cancelada + los hitos + el cierre.
export type Estado =
  | "esperando"
  | "entrada_recibida"
  | "pago_confirmado"
  | "lista_para_cerrar"
  | "cerrada"
  | "cancelada";

type Hitos = Pick<
  Operacion,
  "status" | "entrada_recibida_at" | "pago_confirmado_at" | "cerrada_at"
>;

export function estadoDe(op: Hitos): Estado {
  if (op.status === "cancelada") return "cancelada";
  if (op.cerrada_at) return "cerrada";
  const entrada = !!op.entrada_recibida_at;
  const pago = !!op.pago_confirmado_at;
  if (entrada && pago) return "lista_para_cerrar";
  if (entrada) return "entrada_recibida";
  if (pago) return "pago_confirmado";
  return "esperando";
}

// Etiquetas del panel.
export const ESTADO_LABEL: Record<Estado, string> = {
  esperando: "En espera",
  entrada_recibida: "Entrada recibida",
  pago_confirmado: "Pago confirmado",
  lista_para_cerrar: "Lista para entregar",
  cerrada: "Entregada",
  cancelada: "Cancelada",
};

// Etiquetas del link público, siguiendo la secuencia del proceso: con
// entrada y pago listos, el administrador está entregando las entradas
// al comprador; el cierre es la entrega hecha.
export const ESTADO_LABEL_PUBLICO: Record<Estado, string> = {
  ...ESTADO_LABEL,
  lista_para_cerrar: "En entrega",
  cerrada: "Entradas entregadas",
};

// Colores por estado (NO semáforo). Se usan tanto en talón como en chips.
export const ESTADO_COLOR: Record<Estado, string> = {
  esperando: "#5F6577", // pizarra
  entrada_recibida: "#B07A14", // ámbar
  pago_confirmado: "#6C5BF2", // violeta marca
  lista_para_cerrar: "#0D9377", // verde-teal (todo listo, falta cerrar)
  cerrada: "#171B2B", // tinta: sello final, tipo "CANJEADO"
  cancelada: "#D14D68", // rosa
};

// Colores de cada hito individual (botones y pasos).
export const HITO_COLOR = {
  entrada: "#B07A14",
  pago: "#6C5BF2",
  listo: "#0D9377",
} as const;

// Acciones que acepta la API de estado.
export type StatusAction =
  | { action: "entrada"; done: boolean }
  | { action: "pago"; done: boolean }
  | { action: "cerrar"; done: boolean }
  | { action: "cancelar" }
  | { action: "reabrir" };

// Días que faltan hasta la fecha del evento (0 = hoy, negativo = ya pasó).
// null si la operación no tiene fecha cargada.
export function diasHastaEvento(fecha_evento: string | null): number | null {
  if (!fecha_evento) return null;
  const [y, m, d] = fecha_evento.split("-").map(Number);
  if (!y || !m || !d) return null;
  const evento = new Date(y, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((evento.getTime() - hoy.getTime()) / 86_400_000);
}

// Fecha del evento formateada corta, ej "12 ago 2026".
export function formatFecha(fecha_evento: string): string {
  const [y, m, d] = fecha_evento.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Genera el code legible para el admin, ej "BX-7F3K9Q2M".
// Sin caracteres ambiguos (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCode(): string {
  let body = "";
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    body += CODE_ALPHABET[idx];
  }
  return `BX-${body}`;
}

// Formato de moneda ARS sin decimales.
export function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

// Mensaje de WhatsApp ya armado para pegar en el chat.
export function whatsappMessage(evento: string, link: string): string {
  return `Hola 👋 Soy del equipo de AdminTickets (${evento}). Seguí el estado de tu operación acá: ${link}. Se actualiza solo, no hace falta que preguntes.`;
}
