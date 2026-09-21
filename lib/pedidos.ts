// Reglas puras del endpoint de pedidos (app/api/pedidos/route.ts).
//
// Viven acá y no en el route por dos motivos: son las decisiones que protegen
// la plata (qué monto se guarda) y el teléfono de los vendedores (cuántos
// avisos se disparan), y así se pueden testear sin levantar Next ni Supabase.
// El route se queda con lo que no es puro: leer la base y responder HTTP.

import { DEFAULT_EUR_USD, type TicketSource } from "@/lib/tickets";
import type { TipoOperacion } from "@/lib/operaciones";

// La fila real de `tickets` contra la que se reconcilia un item del carrito.
export type TicketRef = {
  evento: string;
  categoria: string | null;
  precio_final: number | null;
  stock: number | null;
  fecha: string | null;
  // Define la moneda: el portal guarda EUR, las entradas propias ya USD.
  source: TicketSource;
};

// Un item del carrito ya validado/normalizado por el route.
export type ItemPedido = {
  tipo: TipoOperacion;
  evento: string;
  sector: string | null;
  ticket_id: string | null;
  monto: number; // total de la línea (unitario × cantidad)
  cantidad: number;
  fecha_evento: string | null;
};

// --- precio ------------------------------------------------------------------
// Pasa a USD el precio crudo de `tickets`, con el mismo criterio que la tienda
// (ver normalizarPreciosUsd): las filas del portal están en EUR y se convierten
// con la cotización del panel; las propias ya vienen en USD.
export function precioUsd(t: TicketRef, tasa: number): number | null {
  if (t.precio_final == null) return null;
  const bruto = Number(t.precio_final);
  if (!Number.isFinite(bruto)) return null;
  const factor = t.source === "portal" ? (tasa > 0 ? tasa : DEFAULT_EUR_USD) : 1;
  const usd = bruto * factor;
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

// --- reconciliación ----------------------------------------------------------
// El cliente manda evento/sector/monto/cantidad, pero son datos suyos: no se
// guardan a ciegas. Cuando el item trae `ticket_id` y esa fila existe, los
// campos se toman de la base. Si la entrada ya no está (el catálogo rota en
// cada sync), se respeta lo que mandó el cliente para no perder el pedido.
export function reconciliarItem(p: ItemPedido, t: TicketRef | undefined, tasa: number): ItemPedido {
  if (!t) return p;
  const out: ItemPedido = { ...p };

  if (t.evento) out.evento = t.evento;
  if (t.categoria) out.sector = t.categoria;
  if (t.fecha) {
    const f = String(t.fecha).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) out.fecha_evento = f;
  }
  // La tienda ya topea por stock; un desvío acá significa carrito viejo o
  // manipulación. stock 0/null = sin dato confiable, se deja lo pedido.
  if (out.tipo === "pedido" && typeof t.stock === "number" && t.stock > 0) {
    out.cantidad = Math.min(out.cantidad, t.stock);
  }
  // Mismo redondeo que muestra la tienda (fmtPrice usa Math.round), para que el
  // monto guardado coincida con el precio que vio el cliente. La consulta queda
  // en 0: es "a confirmar", no una compra.
  const usd = precioUsd(t, tasa);
  const unit = out.tipo === "pedido" && usd != null ? Math.round(usd) : 0;
  out.monto = unit * out.cantidad;
  return out;
}

// --- anti-flood --------------------------------------------------------------
// Cada envío dispara UN aviso a los vendedores (WhatsApp + email), así que un
// cliente que spamea les inunda el teléfono. Topes deliberadamente holgados: un
// carrito real (hasta 50 entradas) entra sin rozarlos. El intervalo mínimo,
// además, mata el pedido duplicado por doble click.
export const RL_VENTANA_MS = 10 * 60_000;
export const RL_MAX_VENTANA = 200; // filas por cliente en esa ventana
export const RL_MIN_INTERVALO_MS = 5_000;

// Decide sobre los `created_at` de las operaciones del cliente en la ventana,
// ordenados del más nuevo al más viejo. Devuelve el mensaje a mostrar, o null
// si puede seguir.
export function evaluarLimite(createdAt: string[], ahora: number): string | null {
  if (createdAt.length > RL_MAX_VENTANA) {
    return "Hiciste muchos pedidos en poco tiempo. Esperá unos minutos y volvé a intentar.";
  }
  const ultima = createdAt[0];
  if (!ultima) return null;
  const ts = Date.parse(ultima);
  // Fecha ilegible: no se bloquea (perder un pedido legítimo es peor).
  if (!Number.isFinite(ts)) return null;
  if (ahora - ts < RL_MIN_INTERVALO_MS) {
    return "Esperá unos segundos antes de enviar otro pedido.";
  }
  return null;
}

// --- agrupado del carrito ---------------------------------------------------
// Un envío del carrito es UNA operación, no una por entrada. Las líneas van a
// `operacion_items`; la operación guarda un resumen para que el panel, el
// ticket público y el CSV sigan teniendo un encabezado legible sin leer las
// líneas.
export type ResumenOperacion = {
  evento: string;
  sector: string | null;
  ticket_id: string | null;
  cantidad: number;
  fecha_evento: string | null;
  monto: number;
};

export function resumenOperacion(lineas: ItemPedido[]): ResumenOperacion {
  const primera = lineas[0];
  const unica = lineas.length === 1;

  // Con una sola línea el encabezado es la línea. Con varias, el evento de la
  // primera + cuántas más, para que la tarjeta del panel no mienta mostrando
  // solo una de tres.
  const otras = lineas.length - 1;
  const evento = unica ? primera.evento : `${primera.evento} +${otras} más`;

  // Sector y ticket solo tienen sentido si hay una sola línea: con varias
  // pertenecen a las líneas, no a la operación.
  const sector = unica ? primera.sector : null;
  const ticket_id = unica ? primera.ticket_id : null;

  // Total de entradas del pedido, no de líneas.
  const cantidad = lineas.reduce((a, l) => a + l.cantidad, 0);

  // La fecha más próxima: es la que marca la urgencia de la operación.
  const fechas = lineas.map((l) => l.fecha_evento).filter((f): f is string => !!f).sort();
  const fecha_evento = fechas[0] ?? null;

  // `monto` de cada línea ya es el total de esa línea (unitario × cantidad).
  const monto = lineas.reduce((a, l) => a + l.monto, 0);

  return { evento, sector, ticket_id, cantidad, fecha_evento, monto };
}

// Separa lo que se reserva de lo que se consulta: la operación se arma solo
// con lo que tiene precio, y las consultas van a su propia tabla.
export function separarPorTipo(items: ItemPedido[]): {
  pedidos: ItemPedido[];
  consultas: ItemPedido[];
} {
  return {
    pedidos: items.filter((i) => i.tipo === "pedido"),
    consultas: items.filter((i) => i.tipo === "consulta"),
  };
}
