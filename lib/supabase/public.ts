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
      .select(
        "id,evento,competicion,fecha,ciudad,categoria,precio_final,stock,estado,source,disponible"
      )
      .order("fecha", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    // Entradas "book" que el portal retiró (el worker las marca
    // disponible=false y stock=0): afuera. Ojo: las on_request vigentes
    // también vienen con disponible=false por diseño, esas se quedan
    // (son las de "Consultar").
    const rows = ((data ?? []) as (Ticket & { disponible: boolean })[]).filter(
      (t) => !(t.source === "portal" && t.estado === "book" && !t.disponible)
    );
    return sinEventosPasados(rows);
  } catch (err) {
    console.warn("[tienda] Supabase no disponible, usando catálogo mock:", err);
    const { MOCK_TICKETS } = await import("@/lib/mock-tickets");
    return sinEventosPasados(MOCK_TICKETS);
  }
}

// Config de la tienda (tabla config, editable desde el panel):
// - eurUsd: cotización EUR->USD para las entradas de Passion.
// - portalActivo: si las entradas de Passion se muestran (false = solo propias).
// Ante cualquier error caen a defaults seguros: la tienda nunca se rompe.
export type ConfigTienda = { eurUsd: number; portalActivo: boolean };

export async function fetchConfigTienda(): Promise<ConfigTienda> {
  if (process.env.MOCK_DATA === "1") {
    const { mockGetEurUsd, mockGetPortalActivo } = await import("@/lib/mock-db");
    return { eurUsd: mockGetEurUsd(), portalActivo: mockGetPortalActivo() };
  }
  try {
    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("config")
      .select("key, value")
      .in("key", ["eur_usd", "portal_activo"]);
    if (error || !data) return { eurUsd: DEFAULT_EUR_USD, portalActivo: true };
    const de = (key: string) => {
      const v = Number(data.find((r) => r.key === key)?.value);
      return Number.isFinite(v) ? v : null;
    };
    const eurUsd = de("eur_usd");
    const activo = de("portal_activo");
    return {
      eurUsd: eurUsd != null && eurUsd > 0 ? eurUsd : DEFAULT_EUR_USD,
      // Sin fila = activado (default histórico).
      portalActivo: activo == null ? true : activo !== 0,
    };
  } catch {
    return { eurUsd: DEFAULT_EUR_USD, portalActivo: true };
  }
}
