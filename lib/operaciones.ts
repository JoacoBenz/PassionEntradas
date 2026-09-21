// Lógica de dominio de las operaciones: tipos, estado derivado, etiquetas
// para la UI, colores por estado y helpers (code, WhatsApp).
//
// Modelo: "entrada recibida" y "pago confirmado" son hitos INDEPENDIENTES
// (timestamps nullable); cada uno se marca/desmarca por separado. La
// operación está confirmada cuando están los dos. El enum `status` de la
// base solo se usa para cancelada / reabrir.

export type Status =
  | "esperando_entrada"
  | "entrada_recibida"
  | "confirmada"
  | "cancelada";

// Origen de la operación: carga interna del staff, o pedido/consulta hecho por
// un cliente desde la tienda sobre una entrada del catálogo.
export type Moneda = "ARS" | "USD" | "EUR";

// Símbolo/prefijo por moneda para mostrar montos sin ambigüedad.
export const MONEDA_LABEL: Record<Moneda, string> = {
  ARS: "$",
  USD: "US$",
  EUR: "€",
};

export type TipoOperacion = "operacion" | "pedido" | "consulta";

export type Operacion = {
  id: string;
  code: string;
  evento: string;
  comprador_alias: string | null;
  vendedor_alias: string | null;
  // Total de la línea (precio unitario × cantidad). El unitario se deriva
  // como monto / cantidad.
  monto: number;
  // Moneda de la operación. No se convierte: se muestra en la suya.
  moneda: Moneda;
  // Cantidad de entradas del sector (>= 1). Topeada por el stock en la tienda.
  cantidad: number;
  fee: number;
  // Cuenta (alias/CBU) de la que se debita la plata. Dato interno del
  // panel — nunca se muestra en el link público.
  cuenta_debitar: string | null;
  status: Status;
  entrada_recibida_at: string | null;
  pago_confirmado_at: string | null;
  // Hito interno: se le pagó al proveedor. Nunca se muestra en el ticket.
  pago_proveedor_at: string | null;
  // Cierre explícito: con los dos hitos listos, el admin cierra la operación.
  cerrada_at: string | null;
  // Auditoría: email del admin que marcó cada paso (se limpia al desmarcar).
  // Dato interno del panel — nunca va al link público.
  entrada_recibida_por: string | null;
  pago_confirmado_por: string | null;
  pago_proveedor_por: string | null;
  cerrada_por: string | null;
  // Fecha del evento (date, sin hora): prioriza lo urgente en el panel.
  fecha_evento: string | null;
  // Notas internas del panel. NUNCA se exponen en la vista pública.
  notas: string | null;
  // Entrada del catálogo de la tienda que originó la operación (opcional).
  ticket_id: string | null;
  // Origen: 'operacion' (staff) | 'pedido' | 'consulta' (cliente en la tienda).
  tipo: TipoOperacion;
  // Cliente que originó el pedido/consulta (null en cargas internas del staff).
  cliente_id: string | null;
  cliente_email: string | null;
  // Sector/categoría de la entrada pedida, tal como se ve en la tienda.
  sector: string | null;
  created_at: string;
  updated_at: string;
};

// Etiquetas del origen para el panel.
export const TIPO_LABEL: Record<TipoOperacion, string> = {
  operacion: "Operación",
  pedido: "Pedido",
  consulta: "Consulta",
};

// Vista pública: subconjunto seguro de campos (sin datos de contacto y sin
// la comisión, que es un dato interno entre el admin y las partes).
export type OperacionPublica = Pick<
  Operacion,
  | "code"
  | "evento"
  | "comprador_alias"
  | "vendedor_alias"
  | "monto"
  // El comprador tiene que ver en qué moneda está su operación.
  | "moneda"
  | "status"
  | "entrada_recibida_at"
  | "pago_confirmado_at"
  | "cerrada_at"
  | "fecha_evento"
  | "updated_at"
>;

// Estado visible, derivado de cancelada + los hitos + el cierre.
export type Estado =
  | "esperando"
  | "entrada_recibida"
  | "pago_confirmado"
  | "lista_para_cerrar"
  | "cerrada"
  | "cancelada";

type Hitos = Pick<
  Operacion,
  | "status"
  | "entrada_recibida_at"
  | "pago_confirmado_at"
  | "pago_proveedor_at"
  | "cerrada_at"
>;

// Los hitos ya NO tienen orden: pueden marcarse en cualquier secuencia. El
// estado es una lectura de cuántos están hechos, no una posición en una fila.
export function estadoDe(op: Hitos): Estado {
  if (op.status === "cancelada") return "cancelada";
  if (op.cerrada_at) return "cerrada";
  const entrada = !!op.entrada_recibida_at;
  const pago = !!op.pago_confirmado_at;
  const proveedor = !!op.pago_proveedor_at;
  // Con los tres internos hechos solo falta entregar.
  if (entrada && pago && proveedor) return "lista_para_cerrar";
  // Con alguno hecho, gana el que más habla del avance hacia la entrega:
  // tener la entrada en mano pesa más que haber cobrado.
  if (entrada) return "entrada_recibida";
  if (pago || proveedor) return "pago_confirmado";
  return "esperando";
}

// --- vocabulario PÚBLICO --------------------------------------------------
// Lo que ve el comprador en su ticket es otra cosa que lo que ve el panel: de
// los cuatro hitos internos, dos (entrada recibida del proveedor y pago al
// proveedor) son asunto nuestro y no se muestran. Por eso es un tipo aparte y
// no una traducción de `Estado`: si fuera lo mismo con otras etiquetas, el día
// que se agregue un hito interno se filtraría solo al ticket.
export type EstadoPublico = "pedido_recibido" | "pago_recibido" | "entregada" | "cancelada";

type HitosPublicos = {
  status: Status;
  pago_confirmado_at: string | null;
  cerrada_at: string | null;
};

export function estadoPublicoDe(op: HitosPublicos): EstadoPublico {
  if (op.status === "cancelada") return "cancelada";
  if (op.cerrada_at) return "entregada";
  if (op.pago_confirmado_at) return "pago_recibido";
  return "pedido_recibido";
}

export const ESTADO_PUBLICO_LABEL: Record<EstadoPublico, string> = {
  pedido_recibido: "Pedido recibido",
  pago_recibido: "Pago recibido",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

export const ESTADO_PUBLICO_COLOR: Record<EstadoPublico, string> = {
  pedido_recibido: "#5F6577",
  pago_recibido: "#6C5BF2",
  entregada: "#171B2B",
  cancelada: "#D14D68",
};

// --- semáforo -----------------------------------------------------------
// Verde: entregada. Rojo: sin entregar y el evento ya pasó o está encima.
// Amarillo: sin entregar, sin urgencia de fecha, con el pago hecho.
// Gris: el resto (y las canceladas, que quedan fuera del semáforo).
export type Semaforo = "verde" | "amarillo" | "rojo" | "gris";

// Días de antelación con los que una operación pasa a roja. Es lo único
// configurable del semáforo; 7 por defecto.
export const SEMAFORO_DIAS_AVISO = 7;

export function semaforoDe(
  op: Hitos & { fecha_evento: string | null },
  diasAviso: number = SEMAFORO_DIAS_AVISO
): Semaforo {
  if (op.status === "cancelada") return "gris";
  // Entregada gana siempre: una vez entregada no vuelve a ser urgente
  // aunque el evento ya haya pasado.
  if (op.cerrada_at) return "verde";
  const dias = diasHastaEvento(op.fecha_evento);
  // Sin fecha no hay contra qué medir la urgencia: nunca es roja.
  if (dias != null && dias <= diasAviso) return "rojo";
  if (op.pago_confirmado_at) return "amarillo";
  return "gris";
}

export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: "Entregada",
  amarillo: "Pago hecho, falta entregar",
  rojo: "Vencida o próxima a entregar",
  gris: "Sin novedad",
};

export const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: "#0D9377",
  amarillo: "#B07A14",
  rojo: "#D14D68",
  gris: "#98A0B3",
};

// Etiquetas del panel.
export const ESTADO_LABEL: Record<Estado, string> = {
  esperando: "En espera",
  entrada_recibida: "Entrada recibida",
  pago_confirmado: "Pago confirmado",
  lista_para_cerrar: "Lista para entregar",
  cerrada: "Entregada",
  cancelada: "Cancelada",
};

// Etiquetas del link público, siguiendo la secuencia del proceso: con
// entrada y pago listos, el administrador está entregando las entradas
// al comprador; el cierre es la entrega hecha.
export const ESTADO_LABEL_PUBLICO: Record<Estado, string> = {
  ...ESTADO_LABEL,
  lista_para_cerrar: "En entrega",
  cerrada: "Entradas entregadas",
};

// Colores por estado (NO semáforo). Se usan tanto en talón como en chips.
export const ESTADO_COLOR: Record<Estado, string> = {
  esperando: "#5F6577", // pizarra
  entrada_recibida: "#B07A14", // ámbar
  pago_confirmado: "#6C5BF2", // violeta marca
  lista_para_cerrar: "#0D9377", // verde-teal (todo listo, falta cerrar)
  cerrada: "#171B2B", // tinta: sello final, tipo "CANJEADO"
  cancelada: "#D14D68", // rosa
};

// Grupo de estado para leer de un vistazo (el punto de cada operación):
// ABIERTA (recién entra) · EN CURSO (con hitos, sin cerrar) · CERRADA ·
// CANCELADA. Los seis estados finos se agrupan en estos colores.
export type EstadoGrupo = "abierta" | "en_curso" | "cerrada" | "cancelada";

export function estadoGrupo(estado: Estado): EstadoGrupo {
  if (estado === "cancelada") return "cancelada";
  if (estado === "cerrada") return "cerrada";
  if (estado === "esperando") return "abierta";
  return "en_curso";
}

export const ESTADO_GRUPO_COLOR: Record<EstadoGrupo, string> = {
  abierta: "#E0A100", // amarillo: abierta, falta todo
  en_curso: "#1F33E0", // cobalto: en progreso
  cerrada: "#1F8A4C", // verde: cerrada / entregada
  cancelada: "#9AA0AE", // gris: cancelada
};

export const ESTADO_GRUPO_LABEL: Record<EstadoGrupo, string> = {
  abierta: "Abierta",
  en_curso: "En curso",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

// Color del punto de la operación, según el grupo.
export function estadoDotColor(estado: Estado): string {
  return ESTADO_GRUPO_COLOR[estadoGrupo(estado)];
}

// Colores de cada hito individual (botones y pasos).
export const HITO_COLOR = {
  entrada: "#B07A14",
  pago: "#6C5BF2",
  listo: "#0D9377",
} as const;

// Acciones que acepta la API de estado.
export type StatusAction =
  | { action: "entrada"; done: boolean }
  | { action: "pago"; done: boolean }
  | { action: "proveedor"; done: boolean }
  | { action: "cerrar"; done: boolean }
  | { action: "cancelar" }
  | { action: "reabrir" };

// Días que faltan hasta la fecha del evento (0 = hoy, negativo = ya pasó).
// null si la operación no tiene fecha cargada.
export function diasHastaEvento(fecha_evento: string | null): number | null {
  if (!fecha_evento) return null;
  const [y, m, d] = fecha_evento.split("-").map(Number);
  if (!y || !m || !d) return null;
  const evento = new Date(y, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((evento.getTime() - hoy.getTime()) / 86_400_000);
}

// Fecha del evento formateada corta, ej "12 ago 2026".
export function formatFecha(fecha_evento: string): string {
  const [y, m, d] = fecha_evento.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Genera el code legible para el admin, ej "BX-7F3K9Q2M".
// Sin caracteres ambiguos (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCode(): string {
  let body = "";
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    body += CODE_ALPHABET[idx];
  }
  return `BX-${body}`;
}

// Nombre corto para mostrar quién hizo un paso. El registro guarda
// "Nombre Apellido" (si el usuario cargó sus datos) o el email como
// fallback; los emails se acortan ("kiru@adminticker.test" -> "kiru").
export function quienDe(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (!valor.includes("@")) return valor;
  return valor.split("@")[0] || valor;
}

// Formato de moneda USD sin decimales ("US$ 1.234"): las operaciones se
// manejan en dólares.
// Formatea en la moneda de la operación. ARS sin decimales (los centavos no
// existen en la práctica); USD y EUR con 2, que es lo contable.
export function formatMonto(n: number, moneda: Moneda = "USD"): string {
  const dec = moneda === "ARS" ? 0 : 2;
  return (
    MONEDA_LABEL[moneda] +
    " " +
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(n)
  );
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// Mensaje de WhatsApp ya armado para pegar en el chat.
export function whatsappMessage(evento: string, link: string): string {
  return `Hola 👋 Soy del equipo de AdminTickets (${evento}). Seguí el estado de tu operación acá: ${link}. Se actualiza solo, no hace falta que preguntes.`;
}

// --- líneas de la operación --------------------------------------------------
// Un pedido del carrito es UNA operación con N líneas. La operación guarda un
// resumen (evento, sector, cantidad, monto) para que el panel y el ticket
// tengan encabezado sin leer las líneas; el detalle real vive acá.
export type OperacionItem = {
  id: string;
  operacion_id: string;
  ticket_id: string | null;
  evento: string;
  sector: string | null;
  fecha_evento: string | null;
  cantidad: number;
  precio_unitario: number;
  created_at: string;
};

// Total de una línea. La operación es la suma de todas.
export function totalItem(i: Pick<OperacionItem, "cantidad" | "precio_unitario">): number {
  return i.cantidad * i.precio_unitario;
}

// --- consultas ---------------------------------------------------------------
// Una consulta NO es una operación: es una entrada pedida sin precio cerrado.
// Cuando se arregla el precio, se convierte en operación y queda apuntando a
// ella por `operacion_id`.
export type EstadoConsulta = "pendiente" | "convertida" | "descartada";

export type Consulta = {
  id: string;
  code: string;
  // Comparte valor con la operación creada en el mismo envío del carrito.
  envio_id: string | null;
  cliente_id: string | null;
  cliente_email: string | null;
  comprador_alias: string | null;
  ticket_id: string | null;
  evento: string;
  sector: string | null;
  fecha_evento: string | null;
  cantidad: number;
  notas: string | null;
  estado: EstadoConsulta;
  operacion_id: string | null;
  resuelta_por: string | null;
  resuelta_at: string | null;
  created_at: string;
  updated_at: string;
};

export const ESTADO_CONSULTA_LABEL: Record<EstadoConsulta, string> = {
  pendiente: "Pendiente",
  convertida: "Convertida en operación",
  descartada: "Descartada",
};

// Línea tal como la ve el comprador en el link público: sin ticket_id ni ids
// internos, que no le dicen nada y son del catálogo.
export type ItemPublico = {
  evento: string;
  sector: string | null;
  fecha_evento: string | null;
  cantidad: number;
  precio_unitario: number;
};
