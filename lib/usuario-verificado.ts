import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { HDR_USUARIO, verificarUsuarioFirmado } from "@/lib/usuario-firmado";

// Usuario de la request en una página del panel o de la tienda. Usa el que ya
// validó el middleware (header firmado, ver lib/usuario-firmado.ts) y solo si
// no está —o no es válido— valida la sesión contra Auth como antes.
export async function usuarioVerificado(): Promise<User | null> {
  const delMiddleware = await verificarUsuarioFirmado(headers().get(HDR_USUARIO));
  if (delMiddleware) return delMiddleware;
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser();
  return user;
}
