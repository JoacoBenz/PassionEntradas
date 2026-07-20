// Dominio de las solicitudes de acceso a la tienda (landing pública →
// aprobación del admin → usuario cliente). Sin dependencias de servidor:
// tipos, validación y generación/armado de credenciales.

export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

export type SolicitudAcceso = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  mensaje: string | null;
  estado: EstadoSolicitud;
  user_id: string | null;
  decidida_por: string | null;
  decidida_at: string | null;
  created_at: string;
  updated_at: string;
};

// Lo que entra desde el formulario público, ya saneado.
export type SolicitudInput = {
  nombre: string;
  email: string;
  telefono: string | null;
  mensaje: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Valida y normaliza el input del formulario. Devuelve el error del PRIMER
// campo inválido (mismo criterio en la landing y en la API).
export function validarSolicitud(raw: {
  nombre?: unknown;
  email?: unknown;
  telefono?: unknown;
  mensaje?: unknown;
}): { ok: true; value: SolicitudInput } | { ok: false; error: string } {
  const nombre = String(raw.nombre ?? "").trim().slice(0, 120);
  const email = String(raw.email ?? "").trim().toLowerCase().slice(0, 160);
  const telefono = String(raw.telefono ?? "").trim().slice(0, 40) || null;
  const mensaje = String(raw.mensaje ?? "").trim().slice(0, 1000) || null;

  if (nombre.length < 2) return { ok: false, error: "Ingresá tu nombre" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Ingresá un email válido" };
  return { ok: true, value: { nombre, email, telefono, mensaje } };
}

// Contraseña legible pero fuerte: 4 bloques de 3 (sin caracteres ambiguos).
// Por defecto usa Math.random; en el server conviene pasar una fuente basada
// en crypto (ver generarPasswordSegura en la API).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generarPassword(getRandom: () => number = Math.random): string {
  const bloque = () =>
    Array.from({ length: 3 }, () => ALFABETO[Math.floor(getRandom() * ALFABETO.length)]).join("");
  return `${bloque()}-${bloque()}-${bloque()}-${bloque()}`;
}

// Mensaje listo para pegar en WhatsApp/mail con las credenciales nuevas.
export function mensajeCredenciales(opts: {
  nombre: string;
  email: string;
  password: string;
  urlIngreso: string;
}): string {
  const { nombre, email, password, urlIngreso } = opts;
  return [
    `Hola ${nombre}! Tu acceso a TicketMirror ya está listo.`,
    ``,
    `Entrá acá: ${urlIngreso}`,
    `Usuario: ${email}`,
    `Contraseña: ${password}`,
    ``,
    `Vas a poder ver todas las entradas disponibles. Cualquier consulta, respondé por acá.`,
  ].join("\n");
}
