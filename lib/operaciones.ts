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
  status: Status;
  entrada_recibida_at: string | null;
  pago_confirmado_at: string | null;
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
  | "updated_at"
>;

// Estado visible, derivado de cancelada + los dos hitos.
export type Estado =
  | "esperando"
  | "entrada_recibida"
  | "pago_confirmado"
  | "confirmada"
  | "cancelada";

type Hitos = Pick<
  Operacion,
  "status" | "entrada_recibida_at" | "pago_confirmado_at"
>;

export function estadoDe(op: Hitos): Estado {
  if (op.status === "cancelada") return "cancelada";
  const entrada = !!op.entrada_recibida_at;
  const pago = !!op.pago_confirmado_at;
  if (entrada && pago) return "confirmada";
  if (entrada) return "entrada_recibida";
  if (pago) return "pago_confirmado";
  return "esperando";
}

// Etiquetas para la UI.
export const ESTADO_LABEL: Record<Estado, string> = {
  esperando: "En espera",
  entrada_recibida: "Entrada recibida",
  pago_confirmado: "Pago confirmado",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

// Colores por estado (NO semáforo). Se usan tanto en talón como en chips.
export const ESTADO_COLOR: Record<Estado, string> = {
  esperando: "#5F6577", // pizarra
  entrada_recibida: "#B07A14", // ámbar
  pago_confirmado: "#6C5BF2", // violeta marca
  confirmada: "#0D9377", // verde-teal
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
  | { action: "cancelar" }
  | { action: "reabrir" };

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
