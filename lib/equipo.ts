import type { SupabaseClient, User } from "@supabase/supabase-js";
import { desactivado, esStaff, rolGuardado } from "@/lib/auth";

// Quién es del EQUIPO (administrador / moderador) entre los usuarios de Auth.
//
// Un cliente puede pasar a ser parte del equipo (se le cambia el rol), pero su
// solicitud de acceso aprobada sigue en "Accesos". Antes, desde ahí:
// - "Revocar" + "Reactivar" lo devolvía como CLIENTE (perdía el rol de staff),
// - "Reenviar acceso" le cambiaba la contraseña,
// - y aparecía como cliente en el desplegable de comprador.
// Ahora Accesos solo gestiona clientes: a los del equipo los muestra marcados
// y no deja tocarlos: se gestionan en la pantalla Equipo.

export type RolEquipo = "administrador" | "moderador";

type ConRol = Pick<User, "id" | "app_metadata">;

// Con el rol GUARDADO: un miembro desactivado sigue siendo del equipo (si
// no, Accesos lo vería como cliente y "Reactivar" lo devolvería como tal).
export function rolEquipoDeUsuario(user: ConRol): RolEquipo | null {
  const rol = rolGuardado(user);
  return esStaff(rol) ? rol : null;
}

/** id de usuario -> rol, solo para los del equipo. */
export function mapaEquipo(users: ConRol[]): Map<string, RolEquipo> {
  const out = new Map<string, RolEquipo>();
  for (const u of users) {
    const rol = rolEquipoDeUsuario(u);
    if (rol) out.set(u.id, rol);
  }
  return out;
}

/** Por qué Accesos no puede tocar a este usuario, o null si es un cliente. */
export function bloqueoEnAccesos(
  rol: RolEquipo | null,
  accion: "revocar" | "reactivar" | "reenviar"
): string | null {
  if (!rol) return null;
  const quien = rol === "administrador" ? "administrador" : "moderador";
  const que =
    accion === "reenviar" ? "reenviarle el acceso (le cambiaría la contraseña)" : `${accion}lo desde Accesos`;
  return `Es parte del equipo (${quien}): no se puede ${que}.`;
}

/** Todos los usuarios de Auth. Son pocos: se pagina por las dudas. */
export async function leerUsuarios(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

/** Todos los del equipo (Auth). */
export async function leerEquipo(admin: SupabaseClient): Promise<Map<string, RolEquipo>> {
  return mapaEquipo(await leerUsuarios(admin));
}

/**
 * Rol de equipo de UN usuario (null = cliente). Si no se puede leer el usuario
 * TIRA: quien llama no tiene que seguir a ciegas (fallar cerrado).
 */
export async function rolEquipoDe(admin: SupabaseClient, userId: string): Promise<RolEquipo | null> {
  let res;
  try {
    res = await admin.auth.admin.getUserById(userId);
  } catch (e) {
    throw new Error(`No se pudo verificar el usuario: ${(e as Error).message}`);
  }
  if (res.error || !res.data?.user) {
    throw new Error(`No se pudo verificar el usuario: ${res.error?.message ?? "no existe"}`);
  }
  return rolEquipoDeUsuario(res.data.user);
}

// ---- Pantalla Equipo -------------------------------------------------------

export type MiembroEquipo = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: RolEquipo;
  // Desactivado: conserva el rol pero no puede entrar (ver getRol).
  activo: boolean;
  telefono: string | null;
  ultimoIngreso: string | null;
  // Recibe los avisos por WhatsApp (al teléfono de "Mi cuenta").
  avisosWhatsapp: boolean;
};

// Lo que se usa de un usuario de Auth (o del espejo del modo demo).
export type UsuarioAuth = {
  id: string;
  email?: string | null;
  app_metadata: User["app_metadata"];
  user_metadata?: Record<string, unknown> | null;
  last_sign_in_at?: string | null;
};

export function miembroDe(user: UsuarioAuth): MiembroEquipo | null {
  const rol = rolEquipoDeUsuario(user);
  if (!rol) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const texto = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string).trim() : "");
  const nombre = `${texto("nombre")} ${texto("apellido")}`.trim();
  return {
    id: user.id,
    email: user.email ?? null,
    nombre: nombre || null,
    rol,
    activo: !desactivado(user),
    telefono: texto("telefono") || null,
    ultimoIngreso: user.last_sign_in_at ?? null,
    avisosWhatsapp: (user.app_metadata as Record<string, unknown> | undefined)?.avisos_whatsapp === true,
  };
}

/** El equipo para la pantalla: activos primero, admins arriba, por nombre. */
export function listarMiembros(users: UsuarioAuth[]): MiembroEquipo[] {
  return users
    .map(miembroDe)
    .filter((m): m is MiembroEquipo => m !== null)
    .sort((a, b) => {
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      if (a.rol !== b.rol) return a.rol === "administrador" ? -1 : 1;
      return (a.nombre ?? a.email ?? "").localeCompare(b.nombre ?? b.email ?? "", "es");
    });
}

export type CambioEquipo =
  | { accion: "rol"; rol: RolEquipo }
  | { accion: "desactivar" }
  | { accion: "reactivar" }
  | { accion: "whatsapp"; activo: boolean };

export function parsearCambio(body: unknown): CambioEquipo | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.accion === "desactivar" || b.accion === "reactivar") return { accion: b.accion };
  if (b.accion === "rol" && (b.rol === "administrador" || b.rol === "moderador")) {
    return { accion: "rol", rol: b.rol };
  }
  if (b.accion === "whatsapp" && typeof b.activo === "boolean") return { accion: "whatsapp", activo: b.activo };
  return null;
}

const NOMBRE_ROL: Record<RolEquipo, string> = { administrador: "administrador", moderador: "moderador" };

/**
 * Por qué no se puede aplicar el cambio, o null si se puede. Las guardas:
 * nadie se baja ni se desactiva a sí mismo (se quedaría afuera), y siempre
 * queda al menos un administrador activo.
 */
export function validarCambioEquipo(
  actorId: string,
  objetivo: MiembroEquipo,
  cambio: CambioEquipo,
  equipo: MiembroEquipo[]
): string | null {
  const quitaAdmin =
    objetivo.rol === "administrador" &&
    objetivo.activo &&
    (cambio.accion === "desactivar" || (cambio.accion === "rol" && cambio.rol !== "administrador"));

  if (objetivo.id === actorId) {
    if (cambio.accion === "desactivar") return "No te podés desactivar a vos mismo.";
    if (quitaAdmin) return "No te podés sacar el rol de administrador a vos mismo.";
  }
  if (cambio.accion === "rol" && cambio.rol === objetivo.rol) {
    return `Ya es ${NOMBRE_ROL[cambio.rol]}.`;
  }
  if (cambio.accion === "whatsapp") {
    // Se avisa al teléfono de "Mi cuenta": sin teléfono no hay a dónde.
    if (cambio.activo && !objetivo.telefono) return "No tiene teléfono cargado en Mi cuenta.";
    return null;
  }
  if (cambio.accion === "desactivar" && !objetivo.activo) return "Ya está desactivado.";
  if (cambio.accion === "reactivar" && objetivo.activo) return "Ya está activo.";
  if (quitaAdmin) {
    const otros = equipo.filter((m) => m.id !== objetivo.id && m.rol === "administrador" && m.activo);
    if (otros.length === 0) return "Tiene que quedar al menos un administrador activo.";
  }
  return null;
}

/** Lo que cambia en app_metadata (Supabase hace merge con el resto de las claves). */
export function metadataDeCambio(cambio: CambioEquipo): Record<string, unknown> {
  if (cambio.accion === "rol") return { role: cambio.rol };
  if (cambio.accion === "whatsapp") return { avisos_whatsapp: cambio.activo };
  return { desactivado: cambio.accion === "desactivar" };
}

/** Fila del registro de cambios del equipo (tabla equipo_cambios). */
export type RegistroEquipo = {
  user_id: string;
  email: string | null;
  accion: "alta" | "rol" | "desactivar" | "reactivar";
  rol_antes: string | null;
  rol_despues: string | null;
  por: string;
};

// El aviso por WhatsApp es una preferencia, no un cambio de acceso: no se
// registra (null).
export function registroDeCambio(objetivo: MiembroEquipo, cambio: CambioEquipo, por: string): RegistroEquipo | null {
  if (cambio.accion === "whatsapp") return null;
  return {
    user_id: objetivo.id,
    email: objetivo.email,
    accion: cambio.accion,
    rol_antes: objetivo.rol,
    rol_despues: cambio.accion === "rol" ? cambio.rol : objetivo.rol,
    por,
  };
}

/** Mensaje con las credenciales de alguien que se suma al equipo. */
export function mensajeAltaEquipo(opts: {
  nombre: string;
  email: string;
  password: string;
  urlIngreso: string;
  rol: RolEquipo;
}): string {
  const que = opts.rol === "administrador" ? "el panel de administración" : "el módulo de carga";
  return [
    `Hola ${opts.nombre}! Ya tenés acceso a ${que} de TicketMirror.`,
    ``,
    `Entrá acá: ${opts.urlIngreso}`,
    `Usuario: ${opts.email}`,
    `Contraseña temporal: ${opts.password}`,
    ``,
    `Cambiala la primera vez que entres, desde "Mi cuenta".`,
  ].join("\n");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AltaEquipo = { email: string; nombre: string; apellido: string; rol: RolEquipo; promover: boolean };

/** Valida el body del alta. Devuelve el alta o el error para mostrar. */
export function parsearAlta(body: unknown): AltaEquipo | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const txt = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const email = txt("email").toLowerCase();
  const nombre = txt("nombre");
  if (!EMAIL_RE.test(email)) return { error: "Email inválido" };
  if (!nombre) return { error: "Falta el nombre" };
  if (b.rol !== "administrador" && b.rol !== "moderador") return { error: "Rol inválido" };
  return { email, nombre: nombre.slice(0, 80), apellido: txt("apellido").slice(0, 80), rol: b.rol, promover: b.promover === true };
}

// ---- El vendedor de una operación (decisión 6a) ------------------------------

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * La persona del equipo que es el vendedor de una operación, si el texto de
 * `vendedor_alias` la nombra SIN dudas: su nombre completo, su nombre de pila,
 * su email o la parte de antes de la @ (sin mayúsculas ni tildes). Si no
 * coincide nadie, o coincide más de uno, null: el aviso va a todos los que
 * correspondan por rol.
 */
export function miembroPorAlias(
  equipo: Pick<MiembroEquipo, "id" | "nombre" | "email" | "activo">[],
  alias: string | null | undefined
): string | null {
  const a = normalizar(alias ?? "");
  if (!a) return null;
  const coinciden = equipo.filter((m) => {
    if (!m.activo) return false;
    const nombre = normalizar(m.nombre ?? "");
    const email = normalizar(m.email ?? "");
    return (
      (!!nombre && (nombre === a || nombre.split(" ")[0] === a)) ||
      (!!email && (email === a || email.split("@")[0] === a))
    );
  });
  return coinciden.length === 1 ? coinciden[0].id : null;
}
