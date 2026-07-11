import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import ModeradorDashboard from "@/components/moderador/ModeradorDashboard";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import type { Operacion } from "@/lib/operaciones";
import { computeMetrics, type Metrics } from "@/lib/metrics";
import { isMock, MOCK_USER, mockListOps } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Módulo del moderador: carga la entrada a vender con los datos de
// comprador y vendedor. También lo puede usar el admin para cargar.
export default async function ModeradorPage({
  searchParams,
}: {
  searchParams?: { evento?: string; ticket?: string };
}) {
  let email: string | null | undefined;
  let esAdmin: boolean;
  let ops: Operacion[];
  let metrics: Metrics;

  if (isMock()) {
    email = MOCK_USER.email;
    esAdmin = true;
    ops = mockListOps(10);
    metrics = computeMetrics(mockListOps());
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/admin/login");
    }
    email = user.email;
    esAdmin = getRol(user) === "administrador";

    // Últimas operaciones cargadas, para referencia y para copiar links.
    // Con service role: la tabla está en RLS deny-all y la sesión del
    // usuario no ve filas (la sesión solo se usa para validar quién es).
    const admin = createAdminSupabase();
    const [recentes, todas] = await Promise.all([
      admin
        .from("operaciones")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      // Solo las columnas que necesitan las métricas, de TODAS las
      // operaciones (la lista de arriba está limitada a 10).
      admin
        .from("operaciones")
        .select("monto, fee, status, pago_confirmado_at, cerrada_at"),
    ]);
    ops = (recentes.data ?? []) as Operacion[];
    metrics = computeMetrics(
      (todas.data ?? []) as Parameters<typeof computeMetrics>[0]
    );
  }

  return (
    // El moderador puro tiene una sola sección: sin navegación ni padding.
    <main className={`min-h-svh ${esAdmin ? "pb-16 md:pb-10" : ""}`}>
      <AppHeader subtitle="Carga de operaciones" email={email} nav={esAdmin} />
      <ModeradorDashboard
        initial={ops}
        metrics={metrics}
        baseUrl={getBaseUrl()}
        prefill={
          searchParams?.evento || searchParams?.ticket
            ? { evento: searchParams.evento, ticketId: searchParams.ticket }
            : undefined
        }
      />
      {esAdmin && <BottomNav />}
    </main>
  );
}
