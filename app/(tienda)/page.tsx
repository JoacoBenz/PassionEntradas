import { fetchTickets } from "@/lib/supabase/public";
import { StorefrontHome } from "@/components/tienda/Storefront";

// La tienda se revalida cada minuto (el worker sincroniza cada pocos minutos).
export const revalidate = 60;

export default async function TiendaHome() {
  let rows: Awaited<ReturnType<typeof fetchTickets>> = [];
  try {
    rows = await fetchTickets();
  } catch {
    return <div className="splash err">No pudimos cargar la cartelera.</div>;
  }
  return <StorefrontHome rows={rows} />;
}
