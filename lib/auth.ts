import type { User } from "@supabase/supabase-js";

// Roles de la app:
// - administrador: gestiona operaciones (ver lista, avanzar/cancelar estados).
// - moderador: solo carga operaciones nuevas y comparte el link.
// - usuario: se registra solo; publica entradas y pide comprar en el feed.
//
// El rol se guarda en app_metadata.role del usuario de Supabase (no editable
// por el propio usuario). Desde la V2 el default es el rol MENOS privilegiado:
// una cuenta sin rol explícito es "usuario" y solo accede al feed.
export type Rol = "administrador" | "moderador" | "usuario";

export function getRol(user: User): Rol {
  const role = (user.app_metadata as Record<string, unknown> | undefined)?.[
    "role"
  ];
  if (role === "administrador") return "administrador";
  if (role === "moderador") return "moderador";
  return "usuario";
}

// Alias público del usuario (se define al registrarse). Fallback al email.
export function getAlias(user: User): string {
  const alias = (user.user_metadata as Record<string, unknown> | undefined)?.[
    "alias"
  ];
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return user.email?.split("@")[0] ?? "usuario";
}

// Los que operan el panel: pueden crear operaciones de custodia.
export function esStaff(rol: Rol): boolean {
  return rol === "administrador" || rol === "moderador";
}
