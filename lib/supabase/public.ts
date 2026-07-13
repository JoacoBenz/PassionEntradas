import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_EUR_USD,
  hoyArgentina,
  sinEventosPasados,
  type Ticket,
} from "@/lib/tickets";

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
    // OJO: PostgREST devuelve como mucho 1000 filas por consulta. Con el
    // catálogo completo (235 eventos ≈ 1500 filas) una sola consulta se
    // cortaba en 1000 y la tienda mostraba una fracción de los eventos.
    // Solución doble: filtrar en el server (afuera los eventos ya pasados y
    // las book retiradas del portal) y paginar con range() hasta agotar.
    const hoy = hoyArgentina();
    const PAGINA = 1000;
    const MAX_PAGINAS = 10; // red de seguridad: 10k filas es 6x el catálogo
    let rows: (Ticket & { disponible: boolean })[] = [];
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,evento,competicion,fecha,ciudad,categoria,precio_final,stock,estado,source,disponible,imagen_url"
        )
        // Eventos vigentes (sin fecha o de hoy en adelante, día argentino).
        .or(`fecha.is.null,fecha.gte.${hoy}`)
        // NOT (book y retirada) = no-book O disponible. Las on_request
        // vigentes vienen con disponible=false por diseño y se quedan
        // (son las de "Consultar").
        .or("estado.neq.book,disponible.eq.true")
        .order("fecha", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(p * PAGINA, (p + 1) * PAGINA - 1);
      if (error) throw new Error(error.message);
      rows = rows.concat((data ?? []) as (Ticket & { disponible: boolean })[]);
      if ((data ?? []).length < PAGINA) break;
    }
    // El filtro de pasados de nuevo en JS: barato, y cubre el borde del
    // cambio de día entre el render y la consulta.
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
