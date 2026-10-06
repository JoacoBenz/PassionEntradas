import type { SupabaseClient, User } from "@supabase/supabase-js";
import { esStaff, getRol } from "@/lib/auth";

// Quién es del EQUIPO (administrador / moderador) entre los usuarios de Auth.
//
// Un cliente puede pasar a ser parte del equipo (se le cambia el rol), pero su
// solicitud de acceso aprobada sigue en "Accesos". Antes, desde ahí:
// - "Revocar" + "Reactivar" lo devolvía como CLIENTE (perdía el rol de staff),
// - "Reenviar acceso" le cambiaba la contraseña,
// - y aparecía como cliente en el desplegable de comprador.
// Ahora Accesos solo gestiona clientes: a los del equipo los muestra marcados
// y no deja tocarlos (se gestionan aparte, en la futura pantalla de Equipo).

export type RolEquipo = "administrador" | "moderador";

type ConRol = Pick<User, "id" | "app_metadata">;

export function rolEquipoDeUsuario(user: ConRol): RolEquipo | null {
  const rol = getRol(user as User);
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

/** Todos los del equipo (Auth). Son pocos usuarios: se pagina por las dudas. */
export async function leerEquipo(admin: SupabaseClient): Promise<Map<string, RolEquipo>> {
  const users: ConRol[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return mapaEquipo(users);
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
