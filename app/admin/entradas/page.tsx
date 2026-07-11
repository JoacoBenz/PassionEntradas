import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRol } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import TicketsPanel from "@/components/admin/TicketsPanel";
import type { SyncRun, TicketFull } from "@/lib/tickets";
import { isMock, MOCK_USER, mockListManual, mockPortalCount, mockSyncRuns } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

// Gestión del catálogo de la tienda: carga manual de entradas propias y
// estado de la sincronización del worker (portal Passion Events).
export default async function AdminEntradasPage() {
  let email: string | null | undefined;
  let manual: TicketFull[];
  let syncRuns: SyncRun[];
  let portalCount: number;

  if (isMock()) {
    email = MOCK_USER.email;
    manual = mockListManual();
    syncRuns = mockSyncRuns();
    portalCount = mockPortalCount();
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/admin/login");
    if (getRol(user) !== "administrador") redirect("/moderador");
    email = user.email;

    const [manualRes, syncRes, countRes] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("source", "manual")
        .order("fecha", { ascending: true, nullsFirst: false }),
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
        .eq("source", "portal"),
    ]);
    manual = (manualRes.data ?? []) as TicketFull[];
    syncRuns = (syncRes.data ?? []) as SyncRun[];
    portalCount = countRes.count ?? 0;
  }

  return (
    <main className="min-h-svh pb-16 md:pb-10">
      <AppHeader
        subtitle="Entradas de la tienda"
        email={email}
        nav
        action={{ href: "/", label: "Ver tienda ↗" }}
      />
      <TicketsPanel initial={manual} syncRuns={syncRuns} portalCount={portalCount} />
      <BottomNav />
    </main>
  );
}
