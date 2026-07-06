import { createClient } from "@supabase/supabase-js";
import type { Ticket } from "@/lib/tickets";

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
  if (process.env.MOCK_DATA === "1") {
    const { MOCK_TICKETS } = await import("@/lib/mock-tickets");
    const { mockListManual } = await import("@/lib/mock-db");
    // Portal mockeado + manuales del mock-db (así lo cargado desde el panel
    // demo aparece en la tienda).
    return [...MOCK_TICKETS.filter((t) => t.source === "portal"), ...mockListManual()];
  }
  try {
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("tickets")
      .select("id,evento,competicion,fecha,ciudad,categoria,precio_final,stock,estado,source")
      .order("fecha", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Ticket[];
  } catch (err) {
    console.warn("[tienda] Supabase no disponible, usando catálogo mock:", err);
    const { MOCK_TICKETS } = await import("@/lib/mock-tickets");
    return MOCK_TICKETS;
  }
}
