import { estadoCotizacion } from "./cotizaciones";
import { pendienteDeConsulta, pendienteDeOp } from "./recordatorios";
import { diaAr } from "./metrics";
import { estadoDe, necesitaConfirmar, type Consulta, type Moneda, type Operacion } from "./operaciones";

// Filtros de la lista del Panel. Los seis primeros son las pestañas; los
// demás se activan solo desde las tarjetas (las del Panel y las de plata de
// Métricas) y se muestran como un chip para sacarlos.
export type Filtro =
  | "todas"
  | "nuevos"
  | "en_curso"
  | "para_cerrar"
  | "cerradas"
  | "canceladas"
  // Consultas sin cotizar / cotizadas sin respuesta (incluye vencidas).
  | "a_cotizar"
  | "esperando"
  // Mismas reglas que las métricas de plata (ver computeMetrics).
  | "cobradas"
  | "sin_cobrar"
  // Lo que lleva rato esperando (lib/recordatorios): el link de los
  // recordatorios por WhatsApp abre el Panel acá.
  | "prioridad";

export const PESTANAS: { key: Filtro; label: string }[] = [
  { key: "todas", label: "Todas" },
  // Pedidos de la tienda que esperan "Confirmar pedido".
  { key: "nuevos", label: "Nuevos" },
  { key: "en_curso", label: "En curso" },
  { key: "para_cerrar", label: "Para entregar" },
  { key: "cerradas", label: "Entregadas" },
  { key: "canceladas", label: "Canceladas" },
];

const ETIQUETA_TARJETA: Partial<Record<Filtro, string>> = {
  prioridad: "Con prioridad",
  a_cotizar: "A cotizar",
  esperando: "Esperando cliente",
  cobradas: "Con pago confirmado",
  sin_cobrar: "Capital comprometido",
};

// El filtro completo: además del estado, las tarjetas de plata traen la
// moneda y el período que mostraba el tablero, así la lista suma lo mismo.
export type FiltroPanel = {
  filtro: Filtro;
  moneda?: Moneda;
  desde?: string; // YYYY-MM-DD, día del pago en hora argentina
  hasta?: string;
  // Solo los pedidos de UN cliente ("Ver sus pedidos" en Clientes): por su
  // cuenta, o por su email EXACTO para lo cargado a mano sin vincular. Antes
  // era la búsqueda de texto y ana@gmail.com traía también a mariana@gmail.com.
  cliente?: { id: string; email: string; nombre?: string };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FILTROS = new Set<Filtro>([
  ...PESTANAS.map((p) => p.key),
  "a_cotizar",
  "esperando",
  "cobradas",
  "sin_cobrar",
  "prioridad",
]);
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Un link al Panel desde la campana, estando ya en el Panel: si la URL es la
 * misma que la actual, Next no cambia nada y el filtro no se volvía a
 * aplicar. La campana avisa con este evento (detail = el link) y el Panel lo
 * aplica igual.
 */
export const EVENTO_IR_AL_PANEL = "panel:ir";

/** El filtro y la búsqueda de un link del Panel ("/admin?filtro=…&q=…"). */
export function filtroDeLink(url: string): { filtro: FiltroPanel; q: string } | null {
  const i = url.indexOf("?");
  if (!url.startsWith("/admin") || (i !== -1 && url.slice(0, i) !== "/admin") || (i === -1 && url !== "/admin")) return null;
  const params = Object.fromEntries(new URLSearchParams(i === -1 ? "" : url.slice(i + 1)));
  return { filtro: filtroDeParams(params), q: (params.q ?? "").slice(0, 120) };
}

/** Lee el filtro de la URL (?filtro=&moneda=&desde=&hasta=). Lo inválido se ignora. */
export function filtroDeParams(p: Record<string, string | string[] | undefined> | undefined): FiltroPanel {
  const uno = (k: string) => {
    const v = p?.[k];
    return typeof v === "string" ? v : undefined;
  };
  const f = uno("filtro");
  const out: FiltroPanel = { filtro: f && FILTROS.has(f as Filtro) ? (f as Filtro) : "todas" };
  const cid = uno("cliente");
  if (cid && UUID.test(cid)) {
    out.cliente = {
      id: cid.toLowerCase(),
      email: (uno("email") ?? "").trim().toLowerCase().slice(0, 200),
      ...(uno("nombre") ? { nombre: (uno("nombre") as string).slice(0, 80) } : {}),
    };
  }
  if (f === "cobradas" || f === "sin_cobrar") {
    const m = uno("moneda");
    if (m === "USD" || m === "ARS") out.moneda = m;
  }
  // El período solo aplica a lo cobrado (las métricas lo filtran por el día
  // del pago); "capital comprometido" es exposición actual.
  if (f === "cobradas") {
    const d = uno("desde");
    const h = uno("hasta");
    if (d && DIA.test(d)) out.desde = d;
    if (h && DIA.test(h)) out.hasta = h;
  }
  return out;
}

/** URL del Panel con ese filtro (para las tarjetas de Métricas). */
export function urlPanel(f: FiltroPanel): string {
  const qs = new URLSearchParams(f.filtro !== "todas" || !f.cliente ? { filtro: f.filtro } : {});
  if (f.cliente) {
    qs.set("cliente", f.cliente.id);
    if (f.cliente.email) qs.set("email", f.cliente.email);
    if (f.cliente.nombre) qs.set("nombre", f.cliente.nombre);
  }
  if (f.moneda) qs.set("moneda", f.moneda);
  if (f.desde) qs.set("desde", f.desde);
  if (f.hasta) qs.set("hasta", f.hasta);
  return `/admin?${qs.toString()}`;
}

/** Texto del chip de un filtro que no es pestaña ("Con pago confirmado · USD · 01/10 → 09/10"). */
export function etiquetaFiltro(f: FiltroPanel): string | null {
  const base = ETIQUETA_TARJETA[f.filtro];
  if (!base) return null;
  const partes = [base];
  if (f.moneda) partes.push(f.moneda);
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  if (f.desde && f.hasta) partes.push(`${dm(f.desde)} → ${dm(f.hasta)}`);
  else if (f.desde) partes.push(`desde ${dm(f.desde)}`);
  else if (f.hasta) partes.push(`hasta ${dm(f.hasta)}`);
  return partes.join(" · ");
}

type OpFiltrable = Pick<
  Operacion,
  | "cliente_id"
  | "cliente_email"
  | "id"
  | "code"
  | "evento"
  | "fecha_evento"
  | "created_at"
  | "status"
  | "tipo"
  | "moneda"
  | "confirmada_at"
  | "entrada_recibida_at"
  | "pago_confirmado_at"
  | "pago_proveedor_at"
  | "cerrada_at"
>;

/** ¿Es de ese cliente? Por su cuenta, o por su email exacto si no se vinculó. */
export function esDelCliente(
  x: { cliente_id?: string | null; cliente_email?: string | null },
  c: NonNullable<FiltroPanel["cliente"]>
): boolean {
  if (x.cliente_id) return x.cliente_id.toLowerCase() === c.id;
  return !!c.email && (x.cliente_email ?? "").trim().toLowerCase() === c.email;
}

export function opCoincide(op: OpFiltrable, f: FiltroPanel, ahora: Date = new Date()): boolean {
  if (f.cliente && !esDelCliente(op, f.cliente)) return false;
  const estado = estadoDe(op);
  const moneda = op.moneda ?? "USD";
  switch (f.filtro) {
    case "todas":
      return true;
    case "nuevos":
      return necesitaConfirmar(op);
    case "en_curso":
      return estado !== "cerrada" && estado !== "cancelada" && estado !== "lista_para_cerrar";
    case "para_cerrar":
      return estado === "lista_para_cerrar";
    case "cerradas":
      return estado === "cerrada";
    case "canceladas":
      return estado === "cancelada";
    case "a_cotizar":
    case "esperando":
      return false;
    case "prioridad":
      return pendienteDeOp(op, ahora) !== null;
    case "cobradas": {
      if (op.status === "cancelada" || !op.pago_confirmado_at) return false;
      if (f.moneda && moneda !== f.moneda) return false;
      const dia = diaAr(op.pago_confirmado_at);
      if (f.desde && dia < f.desde) return false;
      if (f.hasta && dia > f.hasta) return false;
      return true;
    }
    case "sin_cobrar":
      // Un pedido de la tienda sin confirmar todavía no es plata comprometida.
      return (
        op.status !== "cancelada" &&
        !op.pago_confirmado_at &&
        !op.cerrada_at &&
        !(op.tipo === "pedido" && !op.confirmada_at) &&
        (!f.moneda || moneda === f.moneda)
      );
  }
}

export function consultaCoincide(
  c: Pick<Consulta, "id" | "code" | "evento" | "estado" | "vence_at" | "created_at"> &
    Partial<Pick<Consulta, "cliente_id" | "cliente_email">>,
  f: FiltroPanel,
  ahora: Date = new Date()
): boolean {
  if (f.cliente && !esDelCliente(c, f.cliente)) return false;
  switch (f.filtro) {
    // Trabajo pendiente: va donde se mira lo que falta hacer.
    case "todas":
    case "en_curso":
      return true;
    case "a_cotizar":
      return estadoCotizacion(c, ahora) === "a_cotizar";
    case "esperando": {
      const e = estadoCotizacion(c, ahora);
      return e === "esperando" || e === "vencida";
    }
    case "prioridad":
      return pendienteDeConsulta(c, ahora) !== null;
    default:
      return false;
  }
}
