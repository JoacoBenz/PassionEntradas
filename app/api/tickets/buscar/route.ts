import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { esStaff, getRol } from "@/lib/auth";
import { DEFAULT_EUR_USD, hoyArgentina } from "@/lib/tickets";
import { fetchConfigTienda } from "@/lib/supabase/public";
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
  // Lo que nos costó: precarga el "precio de costo" al cargar la operación.
  precio_costo: number | null;
  stock: number | null;
  source: "portal" | "manual";
  // Costo y precio YA en USD, con la misma conversión que usa la tienda. Se
  // resuelven acá porque el formulario no tiene la cotización (es de admin) y
  // porque así la operación se carga con los mismos números que vio el
  // cliente. Para las del portal, el costo es lo que cobra Passion y la
  // diferencia con el precio es nuestro markup.
  costo_usd: number | null;
  precio_usd: number | null;
};

// Misma conversión que la tienda: el portal guarda EUR, las propias ya USD.
function enUsd(valor: unknown, source: "portal" | "manual", tasa: number): number | null {
  if (valor == null) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  const usd = source === "portal" ? n * tasa : n;
  return Math.round(usd * 100) / 100;
}

const LIMITE = 12;

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const { eurUsd } = await fetchConfigTienda().catch(() => ({ eurUsd: DEFAULT_EUR_USD }));
  const tasa = eurUsd > 0 ? eurUsd : DEFAULT_EUR_USD;

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
      // Las del portal no tienen costo propio (se compran al publicarse), así
      // que solo las manuales traen `precio_costo`.
      .map(({ id, evento, competicion, fecha, categoria, precio_final, stock, source, ...resto }) => {
        const r = resto as { precio_costo?: number | null; precio_origen?: number | null };
        // El costo del portal es lo que cobra Passion (precio_origen).
        const costo = source === "portal" ? r.precio_origen ?? null : r.precio_costo ?? null;
        return {
          id,
          evento,
          competicion,
          fecha,
          categoria,
          precio_final,
          precio_costo: r.precio_costo ?? null,
          stock,
          source,
          costo_usd: enUsd(costo, source, tasa),
          precio_usd: enUsd(precio_final, source, tasa),
        };
      });
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
    .select(
      "id, evento, competicion, fecha, categoria, precio_final, precio_origen, precio_costo, stock, source"
    )
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
  const out: TicketMatch[] = ((data ?? []) as any[]).map((t) => {
    const source: "portal" | "manual" = t.source === "manual" ? "manual" : "portal";
    const costo = source === "portal" ? t.precio_origen : t.precio_costo;
    return {
      id: t.id,
      evento: t.evento,
      competicion: t.competicion ?? null,
      fecha: t.fecha ?? null,
      categoria: t.categoria ?? null,
      precio_final: t.precio_final ?? null,
      precio_costo: t.precio_costo ?? null,
      stock: t.stock ?? null,
      source,
      costo_usd: enUsd(costo, source, tasa),
      precio_usd: enUsd(t.precio_final, source, tasa),
    };
  });
  return NextResponse.json(out);
}
