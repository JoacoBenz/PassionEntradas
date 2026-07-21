import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol } from "@/lib/auth";
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
      redirect("/ingresar");
    }
    const rol = getRol(user);
    // Refuerzo del middleware: sin rol del panel no hay módulo de carga.
    if (!esStaff(rol)) {
      redirect("/ingresar");
    }
    email = user.email;
    esAdmin = rol === "administrador";

    // Últimas operaciones cargadas, para referencia y para copiar links.
    // Con service role: la tabla está en RLS deny-all y la sesión del
    // usuario no ve filas (la sesión solo se usa para validar quién es).
    // Columnas explícitas: notas y cuenta_debitar son datos internos del
    // panel de administración, el módulo del moderador no los necesita.
    const admin = createAdminSupabase();
    const [recentes, agregados] = await Promise.all([
      admin
        .from("operaciones")
        .select(
          "id, code, evento, comprador_alias, vendedor_alias, monto, cantidad, fee, status, entrada_recibida_at, pago_confirmado_at, cerrada_at, fecha_evento, ticket_id, tipo, cliente_email, sector, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(10),
      // Métricas agregadas en la base (RPC): antes se bajaban TODAS las
      // filas históricas para sumar en JS — la única query sin tope del
      // panel, y crecía para siempre.
      admin.rpc("metricas_operaciones").single(),
    ]);
    ops = (recentes.data ?? []).map((o) => ({
      ...o,
      notas: null,
      cuenta_debitar: null,
      cliente_id: null,
    })) as Operacion[];
    const m = (agregados.data ?? {}) as Record<string, number | null>;
    const plataMovida = Number(m.plata_movida ?? 0);
    const entradasVendidas = Number(m.entradas_vendidas ?? 0);
    metrics = {
      plataMovida,
      comisionGanada: Number(m.comision_ganada ?? 0),
      entradasVendidas,
      enJuegoMonto: Number(m.en_juego_monto ?? 0),
      enJuegoOps: Number(m.en_juego_ops ?? 0),
      ticketPromedio:
        entradasVendidas > 0 ? Math.round(plataMovida / entradasVendidas) : 0,
    };
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
