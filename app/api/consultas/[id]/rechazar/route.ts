import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getRol, puedeVerTienda } from "@/lib/auth";
import { notificarVendedoresEmail } from "@/lib/email";
import { isMock, mockRechazarCotizacion } from "@/lib/mock-db";

// POST /api/consultas/[id]/rechazar — el CLIENTE rechaza la cotización que le
// mandaron. Solo la suya y solo si sigue cotizada. Queda como "rechazada".
const CLIENTE_DEMO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (isMock()) {
    const r = mockRechazarCotizacion(params.id, CLIENTE_DEMO);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !puedeVerTienda(getRol(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("consultas")
    .update({ estado: "rechazada", resuelta_por: "cliente", resuelta_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("cliente_id", user.id)
    .eq("estado", "cotizada")
    .select("code, evento")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    const { data: existe } = await admin
      .from("consultas")
      .select("id")
      .eq("id", params.id)
      .eq("cliente_id", user.id)
      .maybeSingle();
    return existe
      ? NextResponse.json({ error: "Esta cotización ya no está disponible" }, { status: 409 })
      : NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  try {
    await notificarVendedoresEmail(
      `❌ Cotización rechazada — ${data.code}`,
      `El cliente ${user.email ?? user.id} rechazó la cotización de ${data.evento} (${data.code}).`
    );
  } catch (e) {
    console.error("[rechazar] no se pudo avisar a los vendedores:", e);
  }
  return NextResponse.json({ ok: true });
}
