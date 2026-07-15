import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SolicitudesBandeja from "@/components/admin/SolicitudesBandeja";
import type { SolicitudConPublicacion } from "@/lib/comunidad";
import { isMock, MOCK_USER, mockListSolicitudes } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Bandeja del mercado (V2): las solicitudes de compra de la comunidad.
// El admin las convierte en operaciones de custodia, las rechaza o las
// concreta cuando la operación terminó.
export default async function AdminSolicitudesPage() {
  let email: string | null | undefined;
  let solicitudes: SolicitudConPublicacion[];

  if (isMock()) {
    email = MOCK_USER.email;
    solicitudes = mockListSolicitudes();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/admin/login");
    if (getRol(user) !== "administrador") redirect("/moderador");
    email = user.email;

    const admin = createAdminSupabase();
    const { data } = await admin
      .from("solicitudes")
      .select(
        "*, publicacion:publicaciones(*), operacion:operaciones(id,status,entrada_recibida_at,pago_confirmado_at,cerrada_at)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    solicitudes = (data ?? []).filter(
      (s: any) => s.publicacion
    ) as SolicitudConPublicacion[];
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader
        subtitle="Mercado de la comunidad"
        email={email}
        nav
        action={{ href: "/feed", label: "Ver feed ↗" }}
      />
      <SolicitudesBandeja initial={solicitudes} />
      <BottomNav />
    </main>
  );
}
