import { compararAZ } from "@/lib/orden";
import { buildEvents, type EventoAgrupado, type Ticket } from "@/lib/tickets";

// Lo que muestra la home de la tienda (/entradas), calculado en el SERVER.
// Antes la página mandaba el catálogo entero (~2300 filas, ~900 KB) al
// navegador para mostrar dos números, 6 eventos y 8 categorías; ahora viaja
// solo esto. Las reglas son las mismas que tenía el componente.
export type EventoHome = Omit<EventoAgrupado, "ubicaciones">;

export type ResumenHome = {
  totalEv: number;
  totalStock: number;
  populares: EventoHome[];
  topCats: [string, number][];
};

export function resumenHome(rows: Ticket[]): ResumenHome {
  const events = buildEvents(rows);
  const totalStock = events.reduce((a, e) => a + e.bookStock, 0);
  // Los 6 más próximos por fecha, tengan stock de compra o sean "a pedido":
  // un partidazo On Request (ej: una semi del Mundial) también va en la
  // vidriera — cambia la acción (Consultar en vez de Reservar), no el lugar.
  const populares = [...events]
    .sort((a, b) => {
      const da = a.fecha ? Date.parse(a.fecha) : Infinity;
      const db = b.fecha ? Date.parse(b.fecha) : Infinity;
      return da - db;
    })
    .slice(0, 6)
    // Sin los sectores: la home no los usa y son lo que más pesa.
    .map(({ ubicaciones: _u, ...ev }) => ev);
  const catCounts = new Map<string, number>();
  for (const e of events) catCounts.set(e.comp, (catCounts.get(e.comp) || 0) + 1);
  // Las 8 categorías con más eventos, mostradas en orden alfabético.
  const topCats = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .sort((a, b) => compararAZ(a[0], b[0]));
  return { totalEv: events.length, totalStock, populares, topCats };
}
