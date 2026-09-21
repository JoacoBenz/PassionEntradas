import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda } from "@/lib/auth";
import { CuentaCliente, type PerfilInicial } from "@/components/tienda/CuentaCliente";
import { isMock } from "@/lib/mock-db";

// Mi cuenta del cliente en la tienda: perfil (nombre/teléfono/dirección),
// contraseña, idioma y contacto por WhatsApp. Acceso reafirmado en el servidor.
export const dynamic = "force-dynamic";

function metaStr(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  return typeof v === "string" ? v : "";
}

export default async function CuentaTiendaPage() {
  let perfil: PerfilInicial = { nombre: "", telefono: "", legajo: "", lang: null };

  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !puedeVerTienda(getRol(user))) redirect("/ingresar");
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const lang = metaStr(meta, "lang");
    let nombre = metaStr(meta, "nombre");
    let telefono = metaStr(meta, "telefono");
    let legajo = metaStr(meta, "legajo");

    // Clientes aprobados antes de que se guardara el perfil en la cuenta no
    // tienen estos datos en user_metadata: los recuperamos de su solicitud
    // (misma info que cargaron en la landing). Service role: la tabla es
    // deny-all. Solo si falta todo, para no pisar lo que el cliente ya editó.
    if (!nombre && !telefono && !legajo && user.email) {
      const { data: sol } = await createAdminSupabase()
        .from("solicitudes_acceso")
        .select("nombre, telefono, legajo")
        .eq("email", user.email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sol) {
        nombre = sol.nombre ?? "";
        telefono = sol.telefono ?? "";
        legajo = sol.legajo ?? "";
      }
    }

    perfil = {
      nombre,
      telefono,
      legajo,
      lang: lang === "en" || lang === "es" ? lang : null,
    };
  } else {
    perfil = { nombre: "Demo Cliente", telefono: "+54 11 5555 1234", legajo: "20-31222333-9", lang: null };
  }

  return <CuentaCliente mock={isMock()} perfil={perfil} />;
}
