import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol } from "@/lib/auth";
import { isMock, mockListAvisos } from "@/lib/mock-db";

// GET /api/operaciones/[id]/avisos — lo que se le avisó al CLIENTE de esta
// operación (Confirmado, Para pagar, Entregada) y si el email le llegó a
// salir. Para la tarjeta del panel; solo el equipo.
export const dynamic = "force-dynamic";

type Fila = { id: string; tipo: string; email_estado: string | null; email_error: string | null; leida_at: string | null; created_at: string };

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: "Operación inválida" }, { status: 400 });
  }
  let filas: Fila[];
  if (isMock()) {
    filas = mockListAvisos((a) => a.audiencia === "cliente" && a.operacion_id === params.id, 20);
  } else {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (!esStaff(getRol(user))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const { data } = await createAdminSupabase()
      .from("notificaciones")
      .select("id, tipo, email_estado, email_error, leida_at, created_at")
      .eq("audiencia", "cliente")
      .eq("operacion_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20);
    // Sin la tabla (migración sin aplicar): lista vacía, sin error.
    filas = (data ?? []) as Fila[];
  }
  return NextResponse.json({
    avisos: filas
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((f) => ({
        id: f.id,
        tipo: f.tipo,
        email_estado: f.email_estado,
        email_error: f.email_error,
        leida: !!f.leida_at,
        created_at: f.created_at,
      })),
  });
}
