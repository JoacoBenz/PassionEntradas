// Dominio de las facturas/recibos: el snapshot que se guarda al emitir
// (inmutable: si la operación cambia después, el invoice emitido no cambia)
// y los textos EN/ES de la vista pública.

export type FacturaIdioma = "en" | "es";

export type FacturaDatos = {
  idioma: FacturaIdioma;
  // Datos del comprador. Cuando la operación salió de un pedido de la tienda,
  // `email` y `legajo` se copian de la CUENTA que lo pidió, no de lo que tipeó
  // el admin: así el mismo legajo que cargó al pedir acceso llega hasta la
  // factura. En operaciones cargadas a mano quedan en null.
  comprador: {
    nombre: string;
    contacto: string | null;
    email?: string | null;
    legajo?: string | null;
  };
  // Quién manejó la venta (auditoría de la operación) — "Handled by Kiru".
  agente: string | null;
  operacion: { id: string; code: string };
  evento: {
    titulo: string;
    competicion: string | null;
    fecha: string | null; // YYYY-MM-DD
    sede: string | null;
    sector: string | null;
  };
  // Entradas de la operación. Un pedido del carrito puede traer varias de
  // sectores o eventos distintos, y la factura tiene que mostrarlas todas.
  // Opcional: las facturas emitidas antes del modelo multi-línea no la
  // tienen y se siguen renderizando con los campos sueltos de abajo.
  items?: {
    evento: string;
    sector: string | null;
    fecha: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
  // Resumen (y compatibilidad con las facturas viejas de una sola línea).
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  fee: number;
  total: number;
  metodo_pago: string;
  pago_confirmado_at: string | null;
};

export type Factura = {
  id: string;
  numero: number;
  datos: FacturaDatos;
  created_at: string;
};

// "TM-2026-00042": prefijo + año de emisión + correlativo.
export function numeroFactura(numero: number, createdAt: string): string {
  return `TM-${createdAt.slice(0, 4)}-${String(numero).padStart(5, "0")}`;
}

// Monto USD con decimales contables ("US$ 2,592.00" / "US$ 2.592,00").
export function fmtMontoFactura(n: number, idioma: FacturaIdioma): string {
  return (
    "US$ " +
    new Intl.NumberFormat(idioma === "en" ? "en-US" : "es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  );
}

export const FACTURA_TX = {
  en: {
    docKind: "Invoice / Receipt",
    paid: "Paid",
    billedTo: "Billed to",
    legajo: "Tax ID",
    issued: "Issued",
    handledBy: "Handled by",
    team: "TicketMirror team",
    operacion: "Operation",
    ticketPurchased: "Ticket purchased",
    // Varias líneas: el encabezado de la sección va en plural y la columna
    // tiene su propio título (repetir "Ticket purchased" en las dos leía mal).
    ticketsPurchased: "Tickets purchased",
    lineCol: "Detail",
    date: "Date",
    venue: "Venue",
    section: "Section",
    qty: "Qty",
    unitPrice: "Unit price",
    subtotal: (q: number, unit: string) =>
      unit ? `Subtotal (${q} × ${unit})` : `Subtotal (${q})`,
    fee: "Service & escrow fee",
    total: "Total",
    usdNote: "All amounts in US dollars (USD).",
    payMethod: "Payment method",
    payConfirmed: "Payment confirmed",
    track: "Track your operation",
    terms:
      "Tickets are delivered after payment confirmation, through our escrow process. Keep this receipt and your operation code for any inquiry — reply to your WhatsApp thread and we'll pick it up from there.",
    print: "Download PDF / Print",
    venueTBC: "Venue TBC",
    dateTBC: "Date TBC",
  },
  es: {
    docKind: "Factura / Recibo",
    paid: "Pagado",
    billedTo: "Facturado a",
    legajo: "Legajo/CUIT",
    issued: "Emitido",
    handledBy: "Atendió",
    team: "equipo TicketMirror",
    operacion: "Operación",
    ticketPurchased: "Entrada comprada",
    ticketsPurchased: "Entradas compradas",
    lineCol: "Detalle",
    date: "Fecha",
    venue: "Sede",
    section: "Sector",
    qty: "Cant.",
    unitPrice: "Precio unitario",
    subtotal: (q: number, unit: string) =>
      unit ? `Subtotal (${q} × ${unit})` : `Subtotal (${q})`,
    fee: "Servicio y custodia",
    total: "Total",
    usdNote: "Todos los montos en dólares estadounidenses (USD).",
    payMethod: "Método de pago",
    payConfirmed: "Pago confirmado",
    track: "Seguimiento de tu operación",
    terms:
      "Las entradas se entregan después de confirmar el pago, con nuestro proceso de custodia. Guardá este recibo y tu código de operación para cualquier consulta — respondé en tu hilo de WhatsApp y seguimos desde ahí.",
    print: "Descargar PDF / Imprimir",
    venueTBC: "Sede a confirmar",
    dateTBC: "Fecha a confirmar",
  },
} as const;
