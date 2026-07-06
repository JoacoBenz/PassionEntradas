import type { User } from "@supabase/supabase-js";

// Roles de la app:
// - administrador: gestiona operaciones (ver lista, avanzar/cancelar estados).
// - moderador: solo carga operaciones nuevas y comparte el link.
//
// El rol se guarda en app_metadata.role del usuario de Supabase (no editable
// por el propio usuario). Si no tiene rol asignado, se asume administrador
// para no romper el usuario existente. Ver README para asignar moderadores.
export type Rol = "administrador" | "moderador";

export function getRol(user: User): Rol {
  const role = (user.app_metadata as Record<string, unknown> | undefined)?.[
    "role"
  ];
  return role === "moderador" ? "moderador" : "administrador";
}
