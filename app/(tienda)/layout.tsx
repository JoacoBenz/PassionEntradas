import type { Metadata } from "next";
import { Spline_Sans } from "next/font/google";
import "./tienda.css";

const spline = Spline_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-spline",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TickerMirror — entradas para los eventos que importan",
  description:
    "Mundial 2026, Euro 2028, Fórmula 1 y los partidos más buscados, con disponibilidad real y precio claro.",
};

// Layout de la tienda pública. El wrapper .tienda scopea todos los estilos
// portados de PassionEntradas para no interferir con el panel (Tailwind).
export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`tienda ${spline.variable}`}>
      <div className="tienda-app">{children}</div>
    </div>
  );
}
