import { fetchConfigTienda, fetchTickets } from "@/lib/supabase/public";
import { normalizarPreciosUsd } from "@/lib/tickets";
import { StorefrontHome } from "@/components/tienda/Storefront";
import { requireAccesoTienda } from "@/lib/tienda-guard";

// Home de la tienda (entradas de Passion). Antes vivía en "/", ahora es la
// zona logueada: la landing pública quedó en "/" y tanto el middleware como
// esta página exigen sesión con acceso (staff o cliente aprobado).
//
// Dinámica: el guard lee la sesión (cookies) para reafirmar el acceso en el
// servidor, así que no se prerenderiza estática.
export const dynamic = "force-dynamic";

export default async function EntradasHome() {
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
  // Todo a USD antes de renderizar: la tienda no vuelve a convertir.
  return <StorefrontHome rows={normalizarPreciosUsd(rows, cfg.eurUsd)} />;
}
