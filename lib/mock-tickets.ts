import type { Ticket } from "@/lib/tickets";

// Catálogo de muestra para desarrollo sin Supabase (MOCK_DATA=1 o caída).
// Mismo shape que la tabla `tickets`.
const d = (days: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
};

// Mapa de sectores de muestra (SVG inline: funciona sin red en el demo).
// Mapa demo con zonas pintadas de colores planos, como los del portal: las
// entradas de este evento traen el hexa de su zona y la tienda la marca en el
// mapa (lib/mapa-foco.ts).
const MOCK_MAPA =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'><rect width='400' height='240' fill='#ffffff'/><rect x='70' y='20' width='260' height='38' fill='#BF191F'/><rect x='70' y='182' width='260' height='38' fill='#F08A0A'/><rect x='20' y='20' width='42' height='200' fill='#2F7FD1'/><rect x='338' y='20' width='42' height='200' fill='#2F7FD1'/><rect x='120' y='75' width='160' height='90' fill='#3B9C3B'/><text x='200' y='125' font-family='sans-serif' font-size='16' text-anchor='middle' fill='#fff'>CAMPO</text><text x='200' y='44' font-family='sans-serif' font-size='12' text-anchor='middle' fill='#fff'>FONDO NORTE</text><text x='200' y='206' font-family='sans-serif' font-size='12' text-anchor='middle' fill='#fff'>FONDO SUR</text><text x='41' y='125' font-family='sans-serif' font-size='12' text-anchor='middle' fill='#fff' transform='rotate(-90 41 125)'>LATERAL</text></svg>`
  );

export const MOCK_TICKETS: Ticket[] = [
  // Mundial 2026
  { id: "1001::1", evento: "Match 12, Group A - Argentina vs Chile", competicion: "FIFA World Cup 2026", fecha: d(20), ciudad: "Estadio Azteca, Ciudad de México (MEX)", categoria: "Category 1", zona_color: "#E4572E", precio_origen: 576, precio_final: 720, stock: 4, estado: "book", source: "portal" },
  { id: "1001::2", evento: "Match 12, Group A - Argentina vs Chile", competicion: "FIFA World Cup 2026", fecha: d(20), ciudad: "Estadio Azteca, Ciudad de México (MEX)", categoria: "Category 2", zona_color: "Zona Azul", precio_origen: 432, precio_final: 540, stock: 2, estado: "book", source: "portal" },
  { id: "1001::3", evento: "Match 12, Group A - Argentina vs Chile", competicion: "FIFA World Cup 2026", fecha: d(20), ciudad: "Estadio Azteca, Ciudad de México (MEX)", categoria: "Category 3", precio_final: null, stock: 0, estado: "on_request", source: "portal" },
  { id: "1002::1", evento: "Match 30, Group C - Brasil vs Marruecos", competicion: "FIFA World Cup 2026", fecha: d(26), ciudad: "MetLife Stadium, New York (USA)", categoria: "Category 1", precio_origen: 648, precio_final: 810, stock: 6, estado: "book", source: "portal" },
  { id: "1002::2", evento: "Match 30, Group C - Brasil vs Marruecos", competicion: "FIFA World Cup 2026", fecha: d(26), ciudad: "MetLife Stadium, New York (USA)", categoria: "Category 2", precio_origen: 496, precio_final: 620, stock: 0, estado: "book", source: "portal" },
  // F1
  { id: "2001::1", evento: "Formula 1 - Gran Premio de Monza", competicion: "Formula 1", fecha: d(60), ciudad: "Autodromo Nazionale, Monza (ITA)", categoria: "Tribuna Ascari", precio_origen: 312, precio_final: 390, stock: 8, estado: "book", source: "portal" },
  { id: "2001::2", evento: "Formula 1 - Gran Premio de Monza", competicion: "Formula 1", fecha: d(60), ciudad: "Autodromo Nazionale, Monza (ITA)", categoria: "General 3 días", precio_origen: 168, precio_final: 210, stock: 12, estado: "book", source: "portal" },
  // Champions
  { id: "3001::1", evento: "Real Madrid vs Manchester City", competicion: "UEFA Champions League", fecha: d(9), ciudad: "Santiago Bernabéu, Madrid (ESP)", categoria: "Lateral Alto", zona_color: "#2F7FD1", precio_origen: 384, precio_final: 480, stock: 1, estado: "book", source: "portal", imagen_url: MOCK_MAPA },
  { id: "3001::2", evento: "Real Madrid vs Manchester City", competicion: "UEFA Champions League", fecha: d(9), ciudad: "Santiago Bernabéu, Madrid (ESP)", categoria: "Fondo Norte", zona_color: "#BF191F", precio_origen: 236, precio_final: 295, stock: 3, estado: "book", source: "portal" },
  // Color que NO está en el mapa: queda el chip de siempre, sin marca.
  { id: "3001::3", evento: "Real Madrid vs Manchester City", competicion: "UEFA Champions League", fecha: d(9), ciudad: "Santiago Bernabéu, Madrid (ESP)", categoria: "Palco VIP", zona_color: "#7A3DB8", precio_origen: 900, precio_final: 1125, stock: 2, estado: "book", source: "portal" },
  // Sin fecha / a consultar
  { id: "4001::REQ", evento: "Final - FIFA World Cup 2026", competicion: "FIFA World Cup 2026", fecha: d(45), ciudad: "MetLife Stadium, New York (USA)", categoria: null, precio_final: null, stock: 0, estado: "on_request", source: "portal" },
  // Manual (propia)
  { id: "manual::demo-1", evento: "River vs Boca - Superclásico", competicion: "Primera División", fecha: d(15), ciudad: "Estadio Monumental, Buenos Aires (ARG)", categoria: "Platea Alta", precio_costo: 110, precio_final: 150, stock: 2, estado: "book", source: "manual" },
  // Propia cargada en PESOS: el demo tiene que mostrar el caso del pedido de
  // Boca (se cobra en pesos, no se convierte).
  { id: "manual::demo-ars", evento: "Boca vs Vasco da Gama", competicion: "Copa Libertadores", fecha: d(18), ciudad: "La Bombonera, Buenos Aires (ARG)", categoria: "Platea Baja", precio_costo: 390000, precio_final: 600000, moneda_final: "ARS", stock: 7, estado: "book", source: "manual" },
];
