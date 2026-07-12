import { Suspense } from "react";
import { fetchTickets } from "@/lib/supabase/public";
import { StorefrontCatalog } from "@/components/tienda/Storefront";

// Igual que la home: revalidatePath cubre los cambios del panel al instante;
// esto es solo la red de seguridad de fondo.
export const revalidate = 600;

export default async function BuscarPage() {
  let rows: Awaited<ReturnType<typeof fetchTickets>> = [];
  try {
    rows = await fetchTickets();
  } catch {
    return <div className="splash err">No pudimos cargar la cartelera.</div>;
  }
  return (
    // useSearchParams exige Suspense en páginas estáticas.
    <Suspense fallback={<div className="splash">Armando la cartelera…</div>}>
      <StorefrontCatalog rows={rows} />
    </Suspense>
  );
}
