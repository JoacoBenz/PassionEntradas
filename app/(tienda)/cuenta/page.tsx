import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
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
  let perfil: PerfilInicial = { nombre: "", telefono: "", direccion: "", lang: null };

  if (!isMock()) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !puedeVerTienda(getRol(user))) redirect("/ingresar");
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const lang = metaStr(meta, "lang");
    perfil = {
      nombre: metaStr(meta, "nombre"),
      telefono: metaStr(meta, "telefono"),
      direccion: metaStr(meta, "direccion"),
      lang: lang === "en" || lang === "es" ? lang : null,
    };
  } else {
    perfil = { nombre: "Demo Cliente", telefono: "+54 11 5555 1234", direccion: "Av. Demo 123", lang: null };
  }

  return <CuentaCliente mock={isMock()} perfil={perfil} />;
}
