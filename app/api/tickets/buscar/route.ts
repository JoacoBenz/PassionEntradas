import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol } from "@/lib/auth";
import { hoyArgentina } from "@/lib/tickets";
import { isMock, mockListManual } from "@/lib/mock-db";
import { MOCK_TICKETS } from "@/lib/mock-tickets";

// GET /api/tickets/buscar?q=... — busca entradas VIGENTES del catálogo para
// vincular a una operación desde "Nueva operación". Staff (el moderador
// también carga operaciones). Devuelve pocas y ordenadas: propias primero,
// después por fecha.
export const dynamic = "force-dynamic";

export type TicketMatch = {
  id: string;
  evento: string;
  competicion: string | null;
  fecha: string | null;
  categoria: string | null;
  precio_final: number | null;
  stock: number | null;
  source: "portal" | "manual";
};

const LIMITE = 12;

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  if (isMock()) {
    const hoy = hoyArgentina();
    const ql = q.toLowerCase();
    const todos = [...mockListManual(), ...MOCK_TICKETS.filter((t) => t.source === "portal")];
    const out = todos
      .filter(
        (t) =>
          (!t.fecha || t.fecha.slice(0, 10) >= hoy) &&
          (t.evento.toLowerCase().includes(ql) ||
            (t.categoria ?? "").toLowerCase().includes(ql))
      )
      .slice(0, LIMITE)
      .map(({ id, evento, competicion, fecha, categoria, precio_final, stock, source }) => ({
        id,
        evento,
        competicion,
        fecha,
        categoria,
        precio_final,
        stock,
        source,
      }));
    return NextResponse.json(out);
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !esStaff(getRol(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hoy = hoyArgentina();
  // Sanitizar el término: coma/paréntesis/comillas separan condiciones en el
  // .or() de PostgREST, y %_\ son comodines de ilike. Después se busca por
  // PALABRAS: todas tienen que aparecer (en evento o sector), en cualquier
  // orden — "france spain" encuentra "France vs Spain".
  const palabras = q
    .replace(/[,()"']/g, " ")
    .replace(/[%_\\]/g, (c) => `\\${c}`)
    .split(/\s+/)
    .filter((p) => p.length >= 2)
    .slice(0, 4);
  if (palabras.length === 0) return NextResponse.json([]);

  let query = createAdminSupabase()
    .from("tickets")
    .select("id, evento, competicion, fecha, categoria, precio_final, stock, source")
    .or(`fecha.is.null,fecha.gte.${hoy}`);
  for (const p of palabras) {
    query = query.or(`evento.ilike.%${p}%,categoria.ilike.%${p}%`);
  }
  const { data, error } = await query
    // Propias primero ('portal' < 'manual' => descendente), después lo más próximo.
    .order("source", { ascending: false })
    .order("fecha", { ascending: true, nullsFirst: false })
    .limit(LIMITE);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json((data ?? []) as TicketMatch[]);
}
