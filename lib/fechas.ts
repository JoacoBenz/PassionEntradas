// Fechas con zona horaria EXPLÍCITA.
//
// Sin zona, `toLocaleString` usa la del entorno: el servidor renderiza en UTC
// y el navegador en la del cliente. Cuando el texto no coincide, React tira el
// HTML del servidor y vuelve a renderizar todo en el cliente (errores de
// hidratación #418/#423/#425) — se veía en "Mis pedidos" y en "Accesos".
//
// Los timestamps (cuándo pasó algo) van en hora de Argentina, que es la del
// negocio. Las fechas sin hora (el día del evento) siguen en UTC, donde ya
// estaban: ver fmtDate en lib/tickets.ts.
export const TZ_AR = "America/Argentina/Buenos_Aires";

/** "22 de sept de 2026, 01:52" — para "creado el", "actualizado el". */
export function fechaHora(iso: string | null | undefined, locale = "es-AR"): string {
  const d = parse(iso);
  if (!d) return "—";
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    // 24 horas: es lo que se usa acá, y evita el "01:52 a. m." que venía
    // mostrando es-AR por defecto.
    hour12: false,
    timeZone: TZ_AR,
  });
}

/** "22 de sept de 2026" — el mismo día, sin la hora. */
export function fechaDia(iso: string | null | undefined, locale = "es-AR"): string {
  const d = parse(iso);
  if (!d) return "—";
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ_AR,
  });
}

/** "01:52" — solo la hora. */
export function horaAr(iso: string | null | undefined, locale = "es-AR"): string {
  const d = parse(iso);
  if (!d) return "—";
  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_AR,
  });
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
