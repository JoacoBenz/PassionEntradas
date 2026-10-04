// Orden alfabético de los menús (filtros de la tienda, listas del panel).
//
// En español y sin distinguir mayúsculas ni tildes: con el orden por defecto
// de JavaScript "Árbitros" iba después de "Zona" y "boca" después de "River".
// `numeric` ordena "Fecha 2" antes que "Fecha 10".
export function compararAZ(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

export function ordenarAZ<T>(items: T[], clave: (x: T) => string): T[] {
  return [...items].sort((x, y) => compararAZ(clave(x), clave(y)));
}
