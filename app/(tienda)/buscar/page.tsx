import { Suspense } from "react";
import { fetchConfigTienda, fetchTickets } from "@/lib/supabase/public";
import { normalizarPreciosUsd } from "@/lib/tickets";
import { StorefrontCatalog } from "@/components/tienda/Storefront";

// Igual que la home: revalidatePath cubre los cambios del panel al instante;
// esto es solo la red de seguridad de fondo.
export const revalidate = 600;

export default async function BuscarPage() {
  let rows: Awaited<ReturnType<typeof fetchTickets>> = [];
  let cfg = { eurUsd: 1.08, portalActivo: true };
  try {
    [rows, cfg] = await Promise.all([fetchTickets(), fetchConfigTienda()]);
  } catch {
    return <div className="splash err">No pudimos cargar la cartelera.</div>;
  }
  // Interruptor del panel: con Passion apagado quedan solo las propias.
  if (!cfg.portalActivo) rows = rows.filter((t) => t.source !== "portal");
  return (
    // useSearchParams exige Suspense en páginas estáticas.
    <Suspense fallback={<div className="splash">Armando la cartelera…</div>}>
      {/* Todo a USD antes de renderizar: la tienda no vuelve a convertir. */}
      <StorefrontCatalog rows={normalizarPreciosUsd(rows, cfg.eurUsd)} />
    </Suspense>
  );
}
