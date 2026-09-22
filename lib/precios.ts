// Cómo se arma el precio de una entrada, en un solo lugar.
//
// El modelo es siempre el mismo: COSTO (lo que nos sale conseguirla) más
// COMISIÓN (lo que ganamos). Lo que se le cobra al cliente es la suma, y eso
// es lo único que ve en la factura: el total ya viene con el markup adentro,
// no se le desglosa un "service fee" aparte.
//
// Vive acá y no en cada formulario porque lo usan tres altas distintas
// (entrada propia, consulta convertida en operación, operación manual) y antes
// cada una lo resolvía a su manera: una pedía el precio de venta ya sumado,
// otra el monto y la comisión por separado sin relación entre sí.

export type Precio = {
  /** Lo que nos costó conseguir la entrada. Puede ser 0 (cortesía, canje). */
  costo: number;
  /** Lo que ganamos. Puede ser 0 (se pasa a precio). */
  comision: number;
  /** Lo que se le cobra al cliente = costo + comisión. Siempre > 0. */
  total: number;
};

export type PrecioInvalido = { ok: false; error: string };
export type PrecioValido = { ok: true } & Precio;

/** Total redondeado a centavos, para no arrastrar sumas tipo 0.1 + 0.2. */
export function totalPrecio(costo: number, comision: number): number {
  return Math.round((costo + comision) * 100) / 100;
}

// Valida y normaliza el par costo/comisión venga de donde venga (input de
// texto, JSON de la API). El sufijo `donde` va al final del mensaje de error
// para poder decir "(sector 2)" sin duplicar los textos.
export function parsePrecio(
  costoRaw: unknown,
  comisionRaw: unknown,
  donde = ""
): PrecioValido | PrecioInvalido {
  const costo = Number(costoRaw);
  const comision = Number(comisionRaw);

  // Vacío cuenta como cero: el form no obliga a escribir un 0 en la comisión
  // cuando se vende al costo.
  const c = costoRaw === "" || costoRaw == null ? 0 : costo;
  const k = comisionRaw === "" || comisionRaw == null ? 0 : comision;

  if (!Number.isFinite(c) || c < 0) {
    return { ok: false, error: `El precio de costo no puede ser negativo${donde}` };
  }
  if (!Number.isFinite(k) || k < 0) {
    return { ok: false, error: `La comisión no puede ser negativa${donde}` };
  }
  const total = totalPrecio(c, k);
  // Lo que importa es que haya algo que cobrar. Cualquiera de los dos puede
  // ser 0; los dos a la vez, no: una entrada gratis no es una operación.
  if (total <= 0) {
    return {
      ok: false,
      error: `Cargá el precio de costo o la comisión: el total tiene que ser mayor a 0${donde}`,
    };
  }
  return { ok: true, costo: c, comision: k, total };
}
