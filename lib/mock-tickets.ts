import type { Ticket } from "@/lib/tickets";

// Catálogo de muestra para desarrollo sin Supabase (MOCK_DATA=1 o caída).
// Mismo shape que la tabla `tickets`.
const d = (days: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
};

export const MOCK_TICKETS: Ticket[] = [
  // Mundial 2026
  { id: "1001::1", evento: "Match 12, Group A - Argentina vs Chile", competicion: "FIFA World Cup 2026", fecha: d(20), ciudad: "Estadio Azteca, Ciudad de México (MEX)", categoria: "Category 1", precio_final: 720, stock: 4, estado: "book", source: "portal" },
  { id: "1001::2", evento: "Match 12, Group A - Argentina vs Chile", competicion: "FIFA World Cup 2026", fecha: d(20), ciudad: "Estadio Azteca, Ciudad de México (MEX)", categoria: "Category 2", precio_final: 540, stock: 2, estado: "book", source: "portal" },
  { id: "1001::3", evento: "Match 12, Group A - Argentina vs Chile", competicion: "FIFA World Cup 2026", fecha: d(20), ciudad: "Estadio Azteca, Ciudad de México (MEX)", categoria: "Category 3", precio_final: null, stock: 0, estado: "on_request", source: "portal" },
  { id: "1002::1", evento: "Match 30, Group C - Brasil vs Marruecos", competicion: "FIFA World Cup 2026", fecha: d(26), ciudad: "MetLife Stadium, New York (USA)", categoria: "Category 1", precio_final: 810, stock: 6, estado: "book", source: "portal" },
  { id: "1002::2", evento: "Match 30, Group C - Brasil vs Marruecos", competicion: "FIFA World Cup 2026", fecha: d(26), ciudad: "MetLife Stadium, New York (USA)", categoria: "Category 2", precio_final: 620, stock: 0, estado: "book", source: "portal" },
  // F1
  { id: "2001::1", evento: "Formula 1 - Gran Premio de Monza", competicion: "Formula 1", fecha: d(60), ciudad: "Autodromo Nazionale, Monza (ITA)", categoria: "Tribuna Ascari", precio_final: 390, stock: 8, estado: "book", source: "portal" },
  { id: "2001::2", evento: "Formula 1 - Gran Premio de Monza", competicion: "Formula 1", fecha: d(60), ciudad: "Autodromo Nazionale, Monza (ITA)", categoria: "General 3 días", precio_final: 210, stock: 12, estado: "book", source: "portal" },
  // Champions
  { id: "3001::1", evento: "Real Madrid vs Manchester City", competicion: "UEFA Champions League", fecha: d(9), ciudad: "Santiago Bernabéu, Madrid (ESP)", categoria: "Lateral Alto", precio_final: 480, stock: 1, estado: "book", source: "portal" },
  { id: "3001::2", evento: "Real Madrid vs Manchester City", competicion: "UEFA Champions League", fecha: d(9), ciudad: "Santiago Bernabéu, Madrid (ESP)", categoria: "Fondo Norte", precio_final: 295, stock: 3, estado: "book", source: "portal" },
  // Sin fecha / a consultar
  { id: "4001::REQ", evento: "Final - FIFA World Cup 2026", competicion: "FIFA World Cup 2026", fecha: d(45), ciudad: "MetLife Stadium, New York (USA)", categoria: null, precio_final: null, stock: 0, estado: "on_request", source: "portal" },
  // Manual (propia)
  { id: "manual::demo-1", evento: "River vs Boca - Superclásico", competicion: "Primera División", fecha: d(15), ciudad: "Estadio Monumental, Buenos Aires (ARG)", categoria: "Platea Alta", precio_final: 150, stock: 2, estado: "book", source: "manual" },
];
