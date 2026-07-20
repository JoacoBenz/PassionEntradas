import { fetchConfigTienda, fetchTickets } from "@/lib/supabase/public";
import { normalizarPreciosUsd } from "@/lib/tickets";
import { MapaEventos } from "@/components/tienda/MapaEventos";
import { requireAccesoTienda } from "@/lib/tienda-guard";

// Mapa mundial del catálogo: zona logueada, mismo gating que /entradas y
// /buscar (staff o cliente aprobado).
export const dynamic = "force-dynamic";

export default async function MapaPage() {
  await requireAccesoTienda();

  let rows: Awaited<ReturnType<typeof fetchTickets>> = [];
  let cfg = { eurUsd: 1.08, portalActivo: true };
  try {
    [rows, cfg] = await Promise.all([fetchTickets(), fetchConfigTienda()]);
  } catch {
    return <div className="splash err">We could not load the listings.</div>;
  }
  // Interruptor del panel: con Passion apagado quedan solo las propias.
  if (!cfg.portalActivo) rows = rows.filter((t) => t.source !== "portal");
  return <MapaEventos rows={normalizarPreciosUsd(rows, cfg.eurUsd)} />;
}
