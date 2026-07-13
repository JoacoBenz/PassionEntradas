import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import TicketsPanel from "@/components/admin/TicketsPanel";
import MargenesPanel from "@/components/admin/MargenesPanel";
import type { SyncRun, TicketFull } from "@/lib/tickets";
import {
  isMock,
  MOCK_USER,
  mockGetPortalActivo,
  mockListManual,
  mockPortalCount,
  mockSyncRuns,
} from "@/lib/mock-db";

// Día calendario (UTC) para separar eventos vigentes de los ya pasados,
// mismo criterio que el worker y la tienda.
function hoyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export const dynamic = "force-dynamic";

// Gestión del catálogo de la tienda: carga manual de entradas propias y
// estado de la sincronización del worker (portal Passion Events).
export default async function AdminEntradasPage() {
  let email: string | null | undefined;
  let manual: TicketFull[];
  let syncRuns: SyncRun[];
  let portalCount: number;
  let portalComprables: number;
  let portalActivo: boolean;

  if (isMock()) {
    email = MOCK_USER.email;
    manual = mockListManual();
    syncRuns = mockSyncRuns();
    portalCount = mockPortalCount();
    portalComprables = portalCount;
    portalActivo = mockGetPortalActivo();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/admin/login");
    if (getRol(user) !== "administrador") redirect("/moderador");
    email = user.email;

    // Los conteos del portal excluyen eventos ya pasados: las filas viejas
    // quedan en la tabla (regla anti-borrado del worker) pero no cuentan
    // como catálogo. "Comprables" = con stock y reservables ahora.
    const hoy = hoyUTC();
    const [manualRes, syncRes, countRes, comprablesRes, portalRes] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("source", "manual")
        .order("fecha", { ascending: true, nullsFirst: false })
        .limit(1000),
      supabase
        .from("sync_runs")
        .select(
          "id,status,reason,scraped_valid,upserted,marked_unavailable,complete,duration_ms,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("source", "portal")
        .or(`fecha.is.null,fecha.gte.${hoy}`),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("source", "portal")
        .eq("estado", "book")
        .eq("disponible", true)
        .gt("stock", 0)
        .or(`fecha.is.null,fecha.gte.${hoy}`),
      // Interruptor de Passion (config es legible por usuarios logueados).
      supabase.from("config").select("value").eq("key", "portal_activo").maybeSingle(),
    ]);
    manual = (manualRes.data ?? []) as TicketFull[];
    syncRuns = (syncRes.data ?? []) as SyncRun[];
    portalCount = countRes.count ?? 0;
    portalComprables = comprablesRes.count ?? 0;
    // Sin fila = activado (default histórico).
    portalActivo = portalRes.data == null || Number(portalRes.data.value) !== 0;
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader
        subtitle="Entradas de la tienda"
        email={email}
        nav
        action={{ href: "/", label: "Ver tienda ↗" }}
      />
      <TicketsPanel
        initial={manual}
        syncRuns={syncRuns}
        portalCount={portalCount}
        portalComprables={portalComprables}
        portalActivo={portalActivo}
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <MargenesPanel />
      </div>
      <BottomNav />
    </main>
  );
}
