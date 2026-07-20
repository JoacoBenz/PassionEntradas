import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SolicitudesAcceso from "@/components/admin/SolicitudesAcceso";
import type { SolicitudAcceso } from "@/lib/acceso";
import { isMock, MOCK_USER, mockListSolicitudes } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Cola de solicitudes de acceso a la tienda (SOLO administrador). Aprobar crea
// el usuario cliente y muestra las credenciales para enviarlas.
export default async function SolicitudesPage() {
  let email: string | null | undefined;
  let solicitudes: SolicitudAcceso[];

  if (isMock()) {
    email = MOCK_USER.email;
    solicitudes = mockListSolicitudes();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/ingresar");
    if (getRol(user) !== "administrador") redirect("/moderador");
    email = user.email;

    // Lectura con service role (tabla RLS deny-all). El rol ya fue validado.
    const { data } = await createAdminSupabase()
      .from("solicitudes_acceso")
      .select(
        "id, nombre, email, telefono, direccion, mensaje, estado, user_id, decidida_por, decidida_at, revocada_at, revocada_por, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);
    solicitudes = (data ?? []) as SolicitudAcceso[];
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader subtitle="Solicitudes" email={email} nav />
      <div className="mx-auto w-full max-w-5xl px-4 py-5">
        <SolicitudesAcceso initial={solicitudes} />
      </div>
      <BottomNav />
    </main>
  );
}
