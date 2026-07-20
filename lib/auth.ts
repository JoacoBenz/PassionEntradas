import type { User } from "@supabase/supabase-js";

// Roles de la app:
// - administrador: gestiona operaciones (ver lista, avanzar/cancelar estados).
// - moderador: solo carga operaciones nuevas y comparte el link.
// - cliente: visitante aprobado; SOLO ve la tienda de entradas (no el panel).
//
// El rol se guarda en app_metadata.role del usuario de Supabase (no editable
// por el propio usuario). SIN rol asignado => null (sin acceso a nada): antes
// se asumía administrador, lo que dejaba fail-open ante cualquier cuenta
// creada por fuera (p.ej. signup habilitado en Supabase). Todos los usuarios
// reales tienen el rol explícito en app_metadata.
export type Rol = "administrador" | "moderador" | "cliente";

export function getRol(user: User): Rol | null {
  const role = (user.app_metadata as Record<string, unknown> | undefined)?.[
    "role"
  ];
  if (role === "administrador" || role === "moderador" || role === "cliente") {
    return role;
  }
  return null;
}

// Staff = roles del panel. null (sin rol) y cliente NO son staff.
export function esStaff(rol: Rol | null): rol is "administrador" | "moderador" {
  return rol === "administrador" || rol === "moderador";
}

// Quién puede ver la tienda de entradas: el staff (además de su panel) y los
// clientes aprobados desde la landing. El resto queda afuera.
export function puedeVerTienda(rol: Rol | null): boolean {
  return rol === "administrador" || rol === "moderador" || rol === "cliente";
}

// Nombre para la auditoría de hitos: "Nombre Apellido" si el usuario cargó
// sus datos en Mi cuenta; si no, el email (quienDe lo acorta al mostrar).
export function nombreDe(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre = typeof meta.nombre === "string" ? meta.nombre.trim() : "";
  const apellido = typeof meta.apellido === "string" ? meta.apellido.trim() : "";
  const completo = `${nombre} ${apellido}`.trim();
  return completo || user.email || null;
}
