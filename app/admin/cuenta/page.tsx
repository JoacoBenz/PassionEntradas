import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CambiarClave from "@/components/admin/CambiarClave";
import MisDatos from "@/components/admin/MisDatos";
import { isMock, MOCK_USER } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Mi cuenta: datos personales (nombre, apellido, teléfono — cada uno edita
// los suyos) y cambio de contraseña. Para todo el staff (admin y moderador).
export default async function CuentaPage() {
  let email: string | null | undefined;
  let datos = { nombre: "", apellido: "", telefono: "" };

  if (isMock()) {
    email = MOCK_USER.email;
    datos = { nombre: "Demo", apellido: "Passion", telefono: "" };
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/admin/login");
    email = user.email;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    datos = {
      nombre: typeof meta.nombre === "string" ? meta.nombre : "",
      apellido: typeof meta.apellido === "string" ? meta.apellido : "",
      telefono: typeof meta.telefono === "string" ? meta.telefono : "",
    };
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader subtitle="Mi cuenta" email={email} nav />
      <MisDatos inicial={datos} mock={isMock()} />
      <CambiarClave mock={isMock()} />
      <BottomNav />
    </main>
  );
}
