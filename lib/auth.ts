import type { User } from "@supabase/supabase-js";

// Roles de la app:
// - administrador: gestiona operaciones (ver lista, avanzar/cancelar estados).
// - moderador: solo carga operaciones nuevas y comparte el link.
//
// El rol se guarda en app_metadata.role del usuario de Supabase (no editable
// por el propio usuario). SIN rol asignado => null (sin acceso al panel):
// antes se asumía administrador, lo que dejaba fail-open ante cualquier
// cuenta creada por fuera (p.ej. signup habilitado en Supabase). Todos los
// usuarios reales tienen el rol explícito en app_metadata.
export type Rol = "administrador" | "moderador";

export function getRol(user: User): Rol | null {
  const role = (user.app_metadata as Record<string, unknown> | undefined)?.[
    "role"
  ];
  if (role === "administrador" || role === "moderador") return role;
  return null;
}

// Staff = cualquier rol del panel. null (sin rol) no es staff.
export function esStaff(rol: Rol | null): rol is Rol {
  return rol === "administrador" || rol === "moderador";
}
