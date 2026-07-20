import type { Metadata } from "next";
import { Landing } from "@/components/tienda/Landing";

// Landing pública (/): la cara nueva del sitio para captar clientes. La tienda
// de entradas pasó a ser privada (/entradas, /buscar) y sólo se ve con una
// cuenta aprobada; desde acá se solicita el acceso.
export const metadata: Metadata = {
  title: "TicketMirror — acceso a las entradas de los eventos que importan",
  description:
    "Pedí acceso a TicketMirror y mirá el catálogo completo: Mundial 2026, Euro 2028, Fórmula 1 y los partidos más buscados, con disponibilidad real y precio claro.",
};

// Página estática (sin datos dinámicos): el formulario postea a la API.
export const dynamic = "force-static";

export default function LandingPage() {
  return <Landing />;
}
