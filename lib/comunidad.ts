// Dominio de la comunidad (V2): publicaciones de usuarios y solicitudes de
// compra. Todo se concreta por medio de los administradores: una solicitud
// aceptada se convierte en una operación de custodia (ver lib/operaciones).

import type { Status } from "@/lib/operaciones";

export type PublicacionEstado = "activa" | "en_proceso" | "vendida" | "retirada";
export type SolicitudEstado = "pendiente" | "en_proceso" | "concretada" | "rechazada";

export type Publicacion = {
  id: string;
  user_id: string;
  vendedor_alias: string;
  evento: string;
  descripcion: string | null;
  fecha_evento: string | null;
  precio: number;
  cantidad: number;
  estado: PublicacionEstado;
  created_at: string;
  updated_at: string;
};

export type Solicitud = {
  id: string;
  publicacion_id: string;
  comprador_id: string;
  comprador_alias: string;
  mensaje: string | null;
  estado: SolicitudEstado;
  operacion_id: string | null;
  created_at: string;
  updated_at: string;
};

// Resumen de la operación enlazada, para pintar el estado real de la
// custodia en la bandeja sin cargar la operación entera.
export type OperacionResumen = {
  id: string;
  status: Status;
  entrada_recibida_at: string | null;
  pago_confirmado_at: string | null;
  cerrada_at: string | null;
};

// Solicitud con su publicación embebida (y la operación si existe), como
// la consume el panel admin.
export type SolicitudConPublicacion = Solicitud & {
  publicacion: Publicacion;
  operacion?: OperacionResumen | null;
};

export const PUBLICACION_LABEL: Record<PublicacionEstado, string> = {
  activa: "Publicada",
  en_proceso: "En custodia",
  vendida: "Vendida",
  retirada: "Retirada",
};

export const PUBLICACION_COLOR: Record<PublicacionEstado, string> = {
  activa: "#0D9377",
  en_proceso: "#B07A14",
  vendida: "#6C5BF2",
  retirada: "#9A9DB0",
};

export const SOLICITUD_LABEL: Record<SolicitudEstado, string> = {
  pendiente: "Pendiente",
  en_proceso: "Operación en curso",
  concretada: "Concretada",
  rechazada: "Rechazada",
};

export const SOLICITUD_COLOR: Record<SolicitudEstado, string> = {
  pendiente: "#B07A14",
  en_proceso: "#2563EB",
  concretada: "#0D9377",
  rechazada: "#9A9DB0",
};

const ALIAS_RE = /^[a-zA-Z0-9._-]{3,30}$/;

export function aliasValido(alias: string): boolean {
  return ALIAS_RE.test(alias);
}
