/**
 * Resolución del margen por evento/competición. Función PURA y testeada.
 *
 * Las reglas viven en la tabla `margenes` (las edita el panel admin):
 *   - (competicion)      -> regla del torneo/evento (ej: "World Cup 2026")
 *   - (competicion=null) -> margen general del proveedor
 * Precedencia: específica > general > fallback de config (PRICE_MARKUP).
 *
 * `porcentaje` viene en puntos (20 = +20%); el resultado es fracción (0.20)
 * porque así lo consume computeFinalPrice.
 */

export interface ReglaMargen {
  competicion: string | null;
  porcentaje: number;
}

export function margenPara(
  reglas: ReglaMargen[],
  competicion: string | null,
  fallbackFraccion: number,
): number {
  if (competicion != null) {
    const especifica = reglas.find((r) => r.competicion === competicion);
    if (especifica && Number.isFinite(especifica.porcentaje)) {
      return especifica.porcentaje / 100;
    }
  }
  const general = reglas.find((r) => r.competicion === null);
  if (general && Number.isFinite(general.porcentaje)) {
    return general.porcentaje / 100;
  }
  return fallbackFraccion;
}
