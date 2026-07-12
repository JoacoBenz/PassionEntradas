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
    // Tope de 1000: con historial grande el payload de "todo" crece sin
    // límite (el stress test midió ~4,7 MB con 20k filas). Las más viejas
    // que quedan afuera ya están cerradas o canceladas.
    // Columnas explícitas: lo que consume el panel (el tipo Operacion).
    // Evita arrastrar columnas internas (created_by) en un payload que se
    // re-baja entero en cada refresh.
    const { data } = await createAdminSupabase()
      .from("operaciones")
      .select(
        "id, code, evento, comprador_alias, vendedor_alias, monto, fee, cuenta_debitar, status, entrada_recibida_at, pago_confirmado_at, cerrada_at, fecha_evento, notas, ticket_id, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    ops = (data ?? []) as Operacion[];
  }

  return (
    // pb-24 solo en móvil: aire para que la BottomNav no tape la última card.
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader subtitle="Administración" email={email} nav />
      {/* Lista viva: consulta la versión en intervalo y solo refresca el
          server component cuando hubo cambios; el dashboard sincroniza su
          estado local cuando cambia `initial`. */}
      <AutoRefresh intervalMs={15000} versionUrl="/api/operaciones/version" />
      <AdminDashboard initial={ops} baseUrl={getBaseUrl()} />
      <BottomNav />
    </main>
  );
}
