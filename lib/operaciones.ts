// Lógica de dominio de las operaciones: tipos, máquina de estados,
// etiquetas para la UI, colores por estado y helpers (code, WhatsApp).

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
  | "updated_at"
>;

// Etiquetas para la UI.
export const STATUS_LABEL: Record<Status, string> = {
  esperando_entrada: "En espera de entrada",
  entrada_recibida: "Entrada recibida",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

// Colores por estado (NO semáforo). Se usan tanto en talón como en chips.
export const STATUS_COLOR: Record<Status, string> = {
  esperando_entrada: "#5F6577", // pizarra
  entrada_recibida: "#B07A14", // ámbar
  confirmada: "#0D9377", // verde-teal
  cancelada: "#D14D68", // rosa
};

// Máquina de estados.
// esperando_entrada -> entrada_recibida -> confirmada
// Desde cualquier estado no terminal se puede cancelar.
// cancelada se puede reabrir a esperando_entrada.
export const TERMINAL: Status[] = ["confirmada", "cancelada"];

// Siguiente estado del flujo "feliz" (botón de un toque). null si no aplica.
export function nextStatus(status: Status): Status | null {
  switch (status) {
    case "esperando_entrada":
      return "entrada_recibida";
    case "entrada_recibida":
      return "confirmada";
    default:
      return null;
  }
}

// Label del botón primario de "un toque" en el admin.
export function nextStatusLabel(status: Status): string | null {
  switch (status) {
    case "esperando_entrada":
      return "Marcar entrada recibida";
    case "entrada_recibida":
      return "Confirmar pago";
    default:
      return null;
  }
}

// Valida si una transición está permitida por la máquina de estados.
export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return false;

  // Cancelar: permitido desde cualquier estado no terminal.
  if (to === "cancelada") {
    return !TERMINAL.includes(from);
  }

  // Reabrir: solo desde cancelada, hacia esperando_entrada.
  if (from === "cancelada") {
    return to === "esperando_entrada";
  }

  // Avance del flujo feliz.
  return nextStatus(from) === to;
}

// Pasos de la barra de progreso pública: Entrada -> Pago -> Listo.
// Devuelve el índice (0..3) hasta el que hay que "llenar".
export function progressStep(status: Status): number {
  switch (status) {
    case "esperando_entrada":
      return 0;
    case "entrada_recibida":
      return 1;
    case "confirmada":
      return 3;
    case "cancelada":
      return 0;
  }
}

export const PROGRESS_LABELS = ["Entrada", "Pago", "Listo"] as const;

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
