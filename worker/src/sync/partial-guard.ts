/**
 * REGLA ANTI-BORRADO (crítica): decide si publicar el resultado de un ciclo.
 * Función PURA y testeada.
 *
 * Aborta (no publica, deja los datos viejos) si:
 *  - el sync trajo 0 ítems válidos, o
 *  - la cantidad cayó más que `dropAbortRatio` respecto del último sync exitoso
 *    (baseline = tickets disponibles actuales en la DB).
 *
 * El primer sync (baseline 0) siempre puede publicar si trajo ítems.
 */
export interface GuardInput {
  scrapedValid: number;
  baselineAvailable: number;
  /** 0.7 => abortar si se cae más del 70%. */
  dropAbortRatio: number;
}

export interface GuardDecision {
  publish: boolean;
  reason: string;
}

export function decidePublish(input: GuardInput): GuardDecision {
  const { scrapedValid, baselineAvailable, dropAbortRatio } = input;

  if (scrapedValid <= 0) {
    return { publish: false, reason: "zero_items" };
  }

  if (baselineAvailable > 0) {
    const minAllowed = baselineAvailable * (1 - dropAbortRatio);
    // Epsilon para no abortar por ruido de coma flotante justo en el borde
    // (p.ej. 100 * (1 - 0.7) = 30.000000000000004). Solo abortamos ante una
    // caída claramente por debajo del mínimo.
    if (scrapedValid < minAllowed - 1e-9) {
      return {
        publish: false,
        reason: `suspicious_drop: ${scrapedValid} < min ${minAllowed.toFixed(1)} (baseline ${baselineAvailable}, ratio ${dropAbortRatio})`,
      };
    }
  }

  return { publish: true, reason: "ok" };
}
