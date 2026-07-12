// Dominio del catálogo de entradas (ex PassionEntradas / TicketMirror).
// Tipos de la tabla `tickets`, agrupado por evento, precios multi-moneda
// y links de WhatsApp con mensaje pre-armado.

export type TicketEstado = "book" | "on_request";
export type TicketSource = "portal" | "manual";

export type Ticket = {
  id: string;
  evento: string;
  competicion: string | null;
  fecha: string | null;
  ciudad: string | null;
  categoria: string | null;
  precio_final: number | null;
  stock: number | null;
  estado: TicketEstado;
  source: TicketSource;
};

export type TicketFull = Ticket & {
  precio_origen: number | null;
  moneda_origen: string;
  moneda_final: string | null;
  disponible: boolean;
  url_origen: string | null;
  scraped_at: string;
  updated_at: string;
};

export type SyncRun = {
  id: number;
  status: string;
  reason: string | null;
  scraped_valid: number | null;
  upserted: number | null;
  marked_unavailable: number | null;
  complete: boolean | null;
  duration_ms: number | null;
  created_at: string;
};

// Evento agrupado (varias ubicaciones/sectores del mismo partido).
export type EventoAgrupado = {
  evento: string;
  comp: string;
  ciudad: string | null;
  fecha: string | null;
  lugar: string;
  mes: string;
  mesLabel: string;
  bookable: number;
  bookStock: number;
  propias: boolean;
  minPrice: number | null;
  ubicaciones: Ticket[];
};

// ---- moneda -----------------------------------------------------------------
// La tienda muestra TODO en dólares. El precio base del portal está en EUR;
// se convierte con la cotización EUR->USD editable desde el panel (tabla
// `config`, clave eur_usd). Este default solo cubre el caso de no poder leerla.
export const DEFAULT_EUR_USD = 1.08;

export function fmtPrice(eur: number | null, eurUsd: number): string | null {
  if (eur == null) return null;
  const v = Number(eur) * (eurUsd > 0 ? eurUsd : DEFAULT_EUR_USD);
  return (
    "US$ " +
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(v))
  );
}

// Eventos ya pasados (día calendario UTC, mismo criterio que el worker):
// afuera de la tienda. Los sin fecha y los del día se muestran.
export function sinEventosPasados<T extends { fecha: string | null }>(rows: T[]): T[] {
  const hoy = new Date().toISOString().slice(0, 10);
  return rows.filter((t) => !t.fecha || t.fecha.slice(0, 10) >= hoy);
}

// ---- fechas / texto -----------------------------------------------------------
export function fmtDate(iso: string | null) {
  if (!iso) return { d: "—", m: "", y: "", full: "Fecha a confirmar" };
  const dt = new Date(iso);
  // Fechas sin hora ("2026-07-11") se parsean como medianoche UTC: hay que
  // formatearlas en UTC para que no retrocedan un día en Argentina (UTC-3).
  // Con hora real, se muestra en hora argentina.
  const timeZone = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? "UTC"
    : "America/Argentina/Buenos_Aires";
  return {
    d: dt.toLocaleDateString("es-AR", { day: "2-digit", timeZone }),
    m: dt.toLocaleDateString("es-AR", { month: "short", timeZone }).replace(".", "").toUpperCase(),
    y: dt.toLocaleDateString("es-AR", { year: "numeric", timeZone }),
    full: dt.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone,
    }),
  };
}

// "Match 12, Group A - Argentina vs Chile" -> título + contexto.
export function parseTitle(evento: string, comp: string | null) {
  const s = String(evento || "").replace(/^match\s+\d+\s*[,-]\s*/i, "").trim();
  const segs = s.split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  if (segs.length <= 1) return { title: s || evento, context: "" };
  const title = segs[segs.length - 1];
  let context = segs.slice(0, -1).join(" · ");
  if (comp) context = context.replace(comp, "").replace(/^[\s·]+|[\s·]+$/g, "");
  return { title, context };
}

export const isWC = (comp: string | null) => /world cup/i.test(comp || "");

export function lugarDe(ciudad: string | null): string {
  if (!ciudad) return "Sin sede";
  const m = ciudad.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1].trim();
  return ciudad.split(",")[0].trim();
}

export const mesKey = (iso: string | null) => (iso ? iso.slice(0, 7) : "0000-00");
export const mesLabel = (iso: string | null) =>
  iso
    ? new Date(iso)
        // UTC: las fechas sin hora se parsean como medianoche UTC y en
        // Argentina (UTC-3) el mes podría retroceder en el día 1.
        .toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
        .replace(/^\w/, (c) => c.toUpperCase())
    : "A confirmar";

// ---- WhatsApp -----------------------------------------------------------------
export function waLink(text: string): string {
  const wa = (process.env.NEXT_PUBLIC_WHATSAPP || "").replace(/\D/g, "");
  const base = wa ? `https://wa.me/${wa}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

// ---- agrupado por evento --------------------------------------------------------
export function buildEvents(rows: Ticket[]): EventoAgrupado[] {
  const map = new Map<string, EventoAgrupado>();
  for (const r of rows) {
    const key = `${r.competicion}__${r.evento}`;
    if (!map.has(key)) {
      map.set(key, {
        evento: r.evento,
        comp: r.competicion || "Otros",
        ciudad: r.ciudad,
        fecha: r.fecha,
        lugar: "",
        mes: "",
        mesLabel: "",
        bookable: 0,
        bookStock: 0,
        propias: false,
        minPrice: null,
        ubicaciones: [],
      });
    }
    const ev = map.get(key)!;
    ev.ubicaciones.push(r);
    if (!ev.fecha && r.fecha) ev.fecha = r.fecha;
    if (!ev.ciudad && r.ciudad) ev.ciudad = r.ciudad;
  }
  const evs = Array.from(map.values());
  for (const ev of evs) {
    ev.lugar = lugarDe(ev.ciudad);
    ev.mes = mesKey(ev.fecha);
    ev.mesLabel = mesLabel(ev.fecha);
    const book = ev.ubicaciones.filter((u) => (u.stock ?? 0) > 0 && u.estado === "book");
    ev.bookable = book.length;
    ev.bookStock = book.reduce((a, u) => a + (u.stock ?? 0), 0);
    ev.propias = ev.ubicaciones.some((u) => u.source === "manual");
    // "desde": menor precio real (>0). Prioriza lo reservable.
    const precioPos = (arr: Ticket[]) =>
      arr.map((u) => Number(u.precio_final)).filter((n) => Number.isFinite(n) && n > 0);
    const reservables = precioPos(
      ev.ubicaciones.filter((u) => (u.stock ?? 0) > 0 && u.estado === "book")
    );
    const todos = precioPos(ev.ubicaciones);
    ev.minPrice = reservables.length
      ? Math.min(...reservables)
      : todos.length
        ? Math.min(...todos)
        : null;
    ev.ubicaciones.sort((a, b) => {
      const pa = a.precio_final == null ? Infinity : Number(a.precio_final);
      const pb = b.precio_final == null ? Infinity : Number(b.precio_final);
      return pa - pb;
    });
  }
  return evs;
}
