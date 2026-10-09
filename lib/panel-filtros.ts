import { estadoCotizacion } from "./cotizaciones";
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
  | "sin_cobrar";

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
};

const FILTROS = new Set<Filtro>([
  ...PESTANAS.map((p) => p.key),
  "a_cotizar",
  "esperando",
  "cobradas",
  "sin_cobrar",
]);
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Lee el filtro de la URL (?filtro=&moneda=&desde=&hasta=). Lo inválido se ignora. */
export function filtroDeParams(p: Record<string, string | string[] | undefined> | undefined): FiltroPanel {
  const uno = (k: string) => {
    const v = p?.[k];
    return typeof v === "string" ? v : undefined;
  };
  const f = uno("filtro");
  if (!f || !FILTROS.has(f as Filtro)) return { filtro: "todas" };
  const out: FiltroPanel = { filtro: f as Filtro };
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
  const qs = new URLSearchParams({ filtro: f.filtro });
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
  | "status"
  | "tipo"
  | "moneda"
  | "confirmada_at"
  | "entrada_recibida_at"
  | "pago_confirmado_at"
  | "pago_proveedor_at"
  | "cerrada_at"
>;

export function opCoincide(op: OpFiltrable, f: FiltroPanel): boolean {
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
  c: Pick<Consulta, "estado" | "vence_at">,
  f: FiltroPanel,
  ahora: Date = new Date()
): boolean {
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
    default:
      return false;
  }
}
