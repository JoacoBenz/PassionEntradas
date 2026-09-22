// Aviso a los vendedores por WhatsApp Business API (Meta Cloud API), opcional y
// desacoplado — mismo patrón que lib/email.ts. Se activa SOLO si están las
// envs WHATSAPP_TOKEN, WHATSAPP_PHONE_ID y WHATSAPP_VENDEDORES; si faltan,
// `whatsappConfigurado()` devuelve false y el flujo de pedido/consulta sigue
// funcionando igual (el registro en la app se crea siempre), solo que sin el
// aviso automático. Cuando se conecte el número de WhatsApp Business, los
// avisos empiezan a salir sin tocar código.
//
// WHATSAPP_VENDEDORES: números de los vendedores en formato internacional
// (sin +), separados por coma. Ej: "5491136148053,5492944806666".

// --- plantilla (template) ---------------------------------------------------
// La Cloud API sólo deja mandar texto libre DENTRO de la ventana de 24 h que se
// abre cuando esa persona te escribe. Un aviso de "entró un pedido" casi nunca
// cae adentro de esa ventana, así que fuera de ella Meta lo rechaza con el
// error 131047. Para eso existen las plantillas aprobadas.
//
// Si WHATSAPP_TEMPLATE está seteada se manda la plantilla; si no, se sigue
// mandando texto libre como hasta ahora (sirve para probar rápido con el
// número de test, donde uno mismo le escribió recién).
export function plantillaConfigurada(): boolean {
  return Boolean(process.env.WHATSAPP_TEMPLATE);
}

// Datos del aviso. Se pasan sueltos y no como un texto armado porque los
// parámetros de una plantilla NO pueden tener saltos de línea ni tabs: Meta
// rechaza el envío entero (error 132000 / "invalid parameter"). El texto largo
// se sigue usando para el email y para el fallback sin plantilla.
export type AvisoPedido = {
  cliente: string;
  entradas: number;
  detalle: string;
  total: string;
  /** Mensaje completo, multilínea: email y fallback de texto libre. */
  texto: string;
};

// Meta rechaza parámetros con saltos de línea, tabs o espacios repetidos, y
// corta a 1024 caracteres. Se limpia acá, con tests, porque el error que
// devuelve no dice cuál de los cuatro parámetros estaba mal.
export function limpiarParametro(valor: string, max = 300): string {
  const plano = String(valor ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (plano.length <= max) return plano || "—";
  return plano.slice(0, max - 1).trimEnd() + "…";
}

/** Los cuatro parámetros de la plantilla `nuevo_pedido`, ya saneados. */
export function parametrosPlantilla(aviso: AvisoPedido): string[] {
  return [
    limpiarParametro(aviso.cliente, 120),
    limpiarParametro(String(aviso.entradas), 10),
    limpiarParametro(aviso.detalle, 400),
    limpiarParametro(aviso.total, 60),
  ];
}

export function whatsappConfigurado(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_ID &&
      process.env.WHATSAPP_VENDEDORES
  );
}

// Destinatarios (vendedores) parseados del env. Vacío si no está configurado.
function vendedores(): string[] {
  return (process.env.WHATSAPP_VENDEDORES ?? "")
    .split(",")
    .map((n) => n.replace(/[^\d]/g, "").trim())
    .filter(Boolean);
}

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

export type WhatsappResult =
  | { ok: true; enviados: number }
  | { ok: false; error: string; noConfigurado?: boolean };

// Envía un mensaje de texto a cada vendedor. No lanza: cualquier fallo de un
// destinatario se acumula y se reporta, pero nunca corta el flujo de negocio
// (el pedido ya quedó registrado en la app antes de llamar acá).
export async function notificarVendedores(aviso: AvisoPedido): Promise<WhatsappResult> {
  if (!whatsappConfigurado()) {
    return {
      ok: false,
      noConfigurado: true,
      error: "El aviso por WhatsApp no está configurado (falta conectar el número de WhatsApp Business).",
    };
  }
  const destinos = vendedores();
  if (destinos.length === 0) {
    return { ok: false, error: "No hay vendedores cargados en WHATSAPP_VENDEDORES." };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const errores: string[] = [];
  let enviados = 0;

  const cuerpo = (to: string) => {
    if (!plantillaConfigurada()) {
      return {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: aviso.texto },
      };
    }
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "es_AR" },
        components: [
          {
            type: "body",
            parameters: parametrosPlantilla(aviso).map((text) => ({ type: "text", text })),
          },
        ],
      },
    };
  };

  for (const to of destinos) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpo(to)),
      });
      if (res.ok) {
        enviados++;
      } else {
        const detail = await res.text().catch(() => "");
        errores.push(`${to}: ${res.status} ${detail}`.trim());
      }
    } catch (err) {
      errores.push(`${to}: ${String(err)}`);
    }
  }

  if (enviados === 0) {
    return { ok: false, error: `WhatsApp no aceptó ningún envío. ${errores.join(" · ")}`.trim() };
  }
  return { ok: true, enviados };
}
