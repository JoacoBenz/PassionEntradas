import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol, nombreDe } from "@/lib/auth";
import { isMock, MOCK_USER, mockDescartarConsulta } from "@/lib/mock-db";

// POST /api/consultas/[id]/descartar — staff. Cierra una consulta sin precio
// (no hay entrada, el cliente ya no la quiere, etc.). El cliente la ve como
// "No disponible" en Mis pedidos. No se borra: queda el rastro.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  let quien = MOCK_USER.email;

  if (isMock()) {
    const r = mockDescartarConsulta(params.id, quien);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !esStaff(getRol(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  quien = nombreDe(user) ?? user.email ?? "staff";

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("consultas")
    .update({ estado: "descartada", resuelta_por: quien, resuelta_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    const { data: existe } = await admin.from("consultas").select("id").eq("id", params.id).maybeSingle();
    return existe
      ? NextResponse.json({ error: "Esta consulta ya fue resuelta" }, { status: 409 })
      : NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
