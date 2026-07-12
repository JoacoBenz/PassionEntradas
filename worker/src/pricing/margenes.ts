/**
 * Resolución del margen por categoría. Función PURA y testeada.
 *
 * Las reglas viven en la tabla `margenes` (las edita el panel admin):
 *   - (categoria)      -> regla específica
 *   - (categoria=null) -> margen general del proveedor
 * Precedencia: específica > general > fallback de config (PRICE_MARKUP).
 *
 * `porcentaje` viene en puntos (20 = +20%); el resultado es fracción (0.20)
 * porque así lo consume computeFinalPrice.
 */

export interface ReglaMargen {
  categoria: string | null;
  porcentaje: number;
}

export function margenPara(
  reglas: ReglaMargen[],
  categoria: string | null,
  fallbackFraccion: number,
): number {
  if (categoria != null) {
    const especifica = reglas.find((r) => r.categoria === categoria);
    if (especifica && Number.isFinite(especifica.porcentaje)) {
      return especifica.porcentaje / 100;
    }
  }
  const general = reglas.find((r) => r.categoria === null);
  if (general && Number.isFinite(general.porcentaje)) {
    return general.porcentaje / 100;
  }
  return fallbackFraccion;
}
