import { createClient } from "@supabase/supabase-js";
import { DEFAULT_EUR_USD, sinEventosPasados, type Ticket } from "@/lib/tickets";

// Cliente público (anon, sin cookies) para leer el catálogo desde
// Server Components. RLS permite SELECT sobre `tickets` al rol anon.
export function createPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function fetchTickets(): Promise<Ticket[]> {
  // Modo demo: MOCK_DATA=1 fuerza el catálogo de muestra; si Supabase está
  // caído, se usa como fallback para poder seguir desarrollando.
  // En todos los caminos se filtran los eventos ya pasados: el worker no los
  // vuelve a traer, pero las filas viejas quedan en la tabla y no tienen que
  // aparecer en la tienda.
  if (process.env.MOCK_DATA === "1") {
    const { MOCK_TICKETS } = await import("@/lib/mock-tickets");
    const { mockListManual } = await import("@/lib/mock-db");
    // Portal mockeado + manuales del mock-db (así lo cargado desde el panel
    // demo aparece en la tienda).
    return sinEventosPasados([
      ...MOCK_TICKETS.filter((t) => t.source === "portal"),
      ...mockListManual(),
    ]);
  }
  try {
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("tickets")
      .select("id,evento,competicion,fecha,ciudad,categoria,precio_final,stock,estado,source")
      .order("fecha", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return sinEventosPasados((data ?? []) as Ticket[]);
  } catch (err) {
    console.warn("[tienda] Supabase no disponible, usando catálogo mock:", err);
    const { MOCK_TICKETS } = await import("@/lib/mock-tickets");
    return sinEventosPasados(MOCK_TICKETS);
  }
}

// Cotización EUR->USD editable desde el panel. Si no se puede leer, cae al
// default: la tienda nunca se rompe por esto.
export async function fetchEurUsd(): Promise<number> {
  if (process.env.MOCK_DATA === "1") {
    const { mockGetEurUsd } = await import("@/lib/mock-db");
    return mockGetEurUsd();
  }
  try {
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("config")
      .select("value")
      .eq("key", "eur_usd")
      .maybeSingle();
    if (error || data == null) return DEFAULT_EUR_USD;
    const v = Number(data.value);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_EUR_USD;
  } catch {
    return DEFAULT_EUR_USD;
  }
}
