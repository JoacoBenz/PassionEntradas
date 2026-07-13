import { fetchEurUsd, fetchTickets } from "@/lib/supabase/public";
import { normalizarPreciosUsd } from "@/lib/tickets";
import { StorefrontHome } from "@/components/tienda/Storefront";

// Revalidación de fondo cada 10 min como red de seguridad: los cambios desde
// el panel (alta/baja de entradas, márgenes) ya disparan revalidatePath al
// instante, así que la página se sirve cacheada casi siempre.
export const revalidate = 600;

export default async function TiendaHome() {
  let rows: Awaited<ReturnType<typeof fetchTickets>> = [];
  let eurUsd = 1.08;
  try {
    [rows, eurUsd] = await Promise.all([fetchTickets(), fetchEurUsd()]);
  } catch {
    return <div className="splash err">No pudimos cargar la cartelera.</div>;
  }
  // Todo a USD antes de renderizar: la tienda no vuelve a convertir.
  return <StorefrontHome rows={normalizarPreciosUsd(rows, eurUsd)} />;
}
