import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { isMock, mockListOps } from "@/lib/mock-db";

// GET /api/operaciones/version — versión mínima de la lista de operaciones.
// Devuelve { v } donde v cambia si se creó/actualizó cualquier operación
// (cantidad + updated_at más reciente). AutoRefresh la consulta en intervalo
// y solo re-renderiza el panel cuando cambió: unos bytes por tick en vez de
// re-traer toda la página.
export const dynamic = "force-dynamic";

export async function GET() {
  if (isMock()) {
    const ops = mockListOps();
    const max = ops.reduce((m, o) => (o.updated_at > m ? o.updated_at : m), "");
    return NextResponse.json({ v: `${ops.length}:${max}` });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, count, error } = await createAdminSupabase()
    .from("operaciones")
    .select("updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const max = data?.[0]?.updated_at ?? "";
  return NextResponse.json({ v: `${count ?? 0}:${max}` });
}
