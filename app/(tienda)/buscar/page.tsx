import { Suspense } from "react";
import { fetchConfigTienda, fetchTickets } from "@/lib/supabase/public";
import { normalizarPreciosUsd } from "@/lib/tickets";
import { StorefrontCatalog } from "@/components/tienda/Storefront";
import { requireAccesoTienda } from "@/lib/tienda-guard";

// Catálogo de la tienda: zona logueada. Igual que /entradas, el acceso se
// reafirma en el servidor (staff o cliente aprobado), así que es dinámica.
export const dynamic = "force-dynamic";

export default async function BuscarPage() {
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
  return (
    // useSearchParams exige Suspense en páginas estáticas.
    <Suspense fallback={<div className="splash">Loading the listings…</div>}>
      {/* Todo a USD antes de renderizar: la tienda no vuelve a convertir. */}
      <StorefrontCatalog rows={normalizarPreciosUsd(rows, cfg.eurUsd)} />
    </Suspense>
  );
}
