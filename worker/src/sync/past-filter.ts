/**
 * Filtro de eventos pasados: ya no interesan en el catálogo.
 * Función PURA y testeada.
 *
 * Un evento "ya pasó" si su fecha (día calendario, UTC) es anterior a hoy.
 * - Eventos sin fecha ("a confirmar") se conservan.
 * - Eventos del día en curso también: la venta puede seguir hasta que
 *   arranque.
 */
export function isPastEvent(fecha: string | null, nowMs: number): boolean {
  if (!fecha) return false;
  const day = fecha.slice(0, 10);
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return day < today;
}
