import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AppHeader from "@/components/AppHeader";
import AutoRefresh from "@/components/AutoRefresh";
import BottomNav from "@/components/BottomNav";
import type { Operacion } from "@/lib/operaciones";
import { isMock, MOCK_USER, mockListOps } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Deriva la URL base para armar los links públicos.
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Módulo del administrador: chequea y actualiza los estados.
export default async function AdminPage() {
  let email: string | null | undefined;
  let ops: Operacion[];

  if (isMock()) {
    email = MOCK_USER.email;
    ops = mockListOps();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Refuerzo por si el middleware no corrió (defensa en profundidad).
    if (!user) {
      redirect("/admin/login");
    }
    if (getRol(user) !== "administrador") {
      redirect("/moderador");
    }
    email = user.email;

    // Lectura con service role: la tabla quedó en RLS deny-all (sin policy
    // de select para authenticated), así que la sesión del usuario no ve
    // filas. El rol ya fue validado arriba.
    const { data } = await createAdminSupabase()
      .from("operaciones")
      .select("*")
      .order("created_at", { ascending: false });
    ops = (data ?? []) as Operacion[];
  }

  return (
    // pb-24 solo en móvil: aire para que la BottomNav no tape la última card.
    <main className="min-h-dvh pb-24 md:pb-10">
      <AppHeader subtitle="Administración" email={email} nav />
      {/* Lista viva: refresca el server component en intervalo; el dashboard
          sincroniza su estado local cuando cambia `initial`. */}
      <AutoRefresh intervalMs={15000} />
      <AdminDashboard initial={ops} baseUrl={getBaseUrl()} />
      <BottomNav />
    </main>
  );
}
