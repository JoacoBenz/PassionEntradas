import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda } from "@/lib/auth";
import { isMock } from "@/lib/mock-db";

// Defensa en profundidad para la tienda (/entradas, /buscar). El middleware ya
// rutea, pero usa getSession() (lee la cookie sin validar contra Auth) por
// performance. Acá reafirmamos con getUser(), que SÍ valida el token contra el
// servidor de Auth: una cookie forjada rebota. Sin sesión con acceso (staff o
// cliente aprobado) -> al login de cliente.
//
// Consecuencia: la página que llama a esto se vuelve dinámica (lee cookies).
// Es lo correcto para un área privada; la landing pública (/) no lo usa.
export async function requireAccesoTienda(): Promise<void> {
  if (isMock()) return;
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !puedeVerTienda(getRol(user))) {
    redirect("/ingresar");
  }
}
