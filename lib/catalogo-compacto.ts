// Empaquetado del catálogo para mandarlo del server al navegador.
//
// Como objetos, cada una de las ~2300 filas repite los nombres de los campos y
// los textos del evento (nombre, competición, ciudad, URL del mapa...): ~900 KB
// que el celular tiene que bajar, parsear e hidratar. Empaquetado por columnas,
// con cada valor distinto guardado UNA vez, pesa una fracción. El navegador lo
// desarma con desempacarCatalogo() y obtiene exactamente las mismas filas
// (mismo contenido; lo cubren los tests).

type Primitivo = string | number | boolean | null;

export type CatalogoCompacto = {
  n: number; // cantidad de filas
  // Por campo: [nombre, valores distintos, índice por fila (-1 = no está)].
  c: [string, Primitivo[], number[]][];
};

export function empacarCatalogo<T extends object>(rows: T[]): CatalogoCompacto {
  const campos: string[] = [];
  const vistos = new Set<string>();
  for (const r of rows)
    for (const k of Object.keys(r))
      if (!vistos.has(k)) {
        vistos.add(k);
        campos.push(k);
      }
  const c: CatalogoCompacto["c"] = campos.map((campo) => {
    const valores: Primitivo[] = [];
    const indice = new Map<Primitivo, number>();
    const idx = rows.map((r) => {
      const v = (r as Record<string, unknown>)[campo];
      if (v === undefined) return -1;
      if (v !== null && typeof v === "object") {
        throw new Error(`empacarCatalogo: el campo ${campo} no es un valor simple`);
      }
      const p = v as Primitivo;
      let i = indice.get(p);
      if (i === undefined) {
        i = valores.length;
        valores.push(p);
        indice.set(p, i);
      }
      return i;
    });
    return [campo, valores, idx];
  });
  return { n: rows.length, c };
}

export function desempacarCatalogo<T>(cat: CatalogoCompacto): T[] {
  const rows: Record<string, Primitivo>[] = Array.from({ length: cat.n }, () => ({}));
  for (const [campo, valores, idx] of cat.c) {
    for (let i = 0; i < cat.n; i++) {
      if (idx[i] !== -1) rows[i][campo] = valores[idx[i]];
    }
  }
  return rows as unknown as T[];
}
