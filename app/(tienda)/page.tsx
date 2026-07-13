import { fetchConfigTienda, fetchTickets } from "@/lib/supabase/public";
import { normalizarPreciosUsd } from "@/lib/tickets";
import { StorefrontHome } from "@/components/tienda/Storefront";

// Revalidación de fondo cada 10 min como red de seguridad: los cambios desde
// el panel (alta/baja de entradas, márgenes) ya disparan revalidatePath al
// instante, así que la página se sirve cacheada casi siempre.
export const revalidate = 600;

export default async function TiendaHome() {
  let rows: Awaited<ReturnType<typeof fetchTickets>> = [];
  let cfg = { eurUsd: 1.08, portalActivo: true };
  try {
    [rows, cfg] = await Promise.all([fetchTickets(), fetchConfigTienda()]);
  } catch {
    return <div className="splash err">We could not load the listings.</div>;
  }
  // Interruptor del panel: con Passion apagado quedan solo las propias.
  if (!cfg.portalActivo) rows = rows.filter((t) => t.source !== "portal");
  // Todo a USD antes de renderizar: la tienda no vuelve a convertir.
  return <StorefrontHome rows={normalizarPreciosUsd(rows, cfg.eurUsd)} />;
}
