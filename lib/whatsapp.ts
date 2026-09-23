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

export function plantillaAccesoConfigurada(): boolean {
  return Boolean(process.env.WHATSAPP_TEMPLATE_ACCESO);
}

// Datos del aviso. Se pasan sueltos y no como un texto armado porque los
// parámetros de una plantilla NO pueden tener saltos de línea ni tabs: Meta
// rechaza el envío entero (error 132000 / "invalid parameter"). El texto largo
// se sigue usando para el email y para el fallback sin plantilla.
export type AvisoPedido = {
  /** "pedido", "consulta" o "pedido con consultas": lo primero que necesita
   *  saber el vendedor, porque le cambia qué tiene que hacer. */
  tipo: string;
  cliente: string;
  entradas: number;
  detalle: string;
  total: string;
  /** Mensaje completo, multilínea: email y fallback de texto libre. */
  texto: string;
};

/** Datos de una solicitud de acceso nueva desde la landing. */
export type AvisoAcceso = {
  nombre: string;
  email: string;
  telefono: string;
  legajo: string;
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

// Nombres de las variables, EXACTAMENTE como figuran en la plantilla de
// WhatsApp Manager. Meta pasó a parámetros con nombre: si la plantilla usa
// {{cliente}}, el envío tiene que mandar `parameter_name: "cliente"` y no la
// posición. Mandar lo que no corresponde hace fallar el mensaje entero con un
// error que no aclara cuál era el problema.
//
// Si alguna plantilla se creara a la vieja usanza, con {{1}} {{2}}, se pone
// WHATSAPP_TEMPLATE_NUMERICO=1 y se mandan por posición.
export const PARAMS_PEDIDO = ["pedido", "cliente", "entrada", "detalle", "total"] as const;
export const PARAMS_ACCESO = ["nombre", "email", "telefono", "legajo"] as const;

export type ParametroPlantilla =
  | { type: "text"; text: string }
  | { type: "text"; parameter_name: string; text: string };

function porNombre(): boolean {
  return process.env.WHATSAPP_TEMPLATE_NUMERICO !== "1";
}

/** Arma los parámetros del cuerpo, con nombre o por posición. */
export function armarParametros(
  nombres: readonly string[],
  valores: string[]
): ParametroPlantilla[] {
  return valores.map((text, i) =>
    porNombre() ? { type: "text" as const, parameter_name: nombres[i], text } : { type: "text" as const, text }
  );
}

/** Los cinco valores de la plantilla `nuevo_pedido`, ya saneados y en orden. */
export function parametrosPlantilla(aviso: AvisoPedido): string[] {
  return [
    limpiarParametro(aviso.tipo, 40),
    limpiarParametro(aviso.cliente, 120),
    limpiarParametro(String(aviso.entradas), 10),
    limpiarParametro(aviso.detalle, 400),
    limpiarParametro(aviso.total, 60),
  ];
}

/** Los cuatro valores de la plantilla `nuevo_acceso`, ya saneados y en orden. */
export function parametrosAcceso(aviso: AvisoAcceso): string[] {
  return [
    limpiarParametro(aviso.nombre, 120),
    limpiarParametro(aviso.email, 160),
    limpiarParametro(aviso.telefono, 40),
    limpiarParametro(aviso.legajo, 40),
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

// Un mismo celular argentino se escribe de varias formas: 549 11 2388-5910
// (como se marca internacional), 54 11 15 2388-5910 (con el 15 local) o
// 54 11 2388-5910. Meta guarda el número de la lista de permitidos en su
// propia forma normalizada, y si mandamos otra la rechaza con 131030 ("no está
// en la lista") aunque sea el mismo teléfono. Pasó exactamente eso: el widget
// de Meta le mandaba bien y nosotros no, con el mismo número, token y ID.
//
// Devuelve el número tal cual primero y después sus equivalentes. Para otros
// países devuelve solo el original.
export function variantesNumero(numero: string): string[] {
  const n = numero.replace(/[^\d]/g, "");
  const out = [n];
  let resto: string | null = null; // código de área + número, sin 54 ni 9
  if (n.startsWith("549") && n.length === 13) resto = n.slice(3);
  else if (n.startsWith("54") && n.length === 12) resto = n.slice(2);
  if (resto) {
    // El código de área es 11 en AMBA; en el resto del país, 3 o 4 dígitos.
    const largos = resto.startsWith("11") ? [2] : [3, 4];
    for (const l of largos) out.push("54" + resto.slice(0, l) + "15" + resto.slice(l));
    out.push("54" + resto);
    out.push("549" + resto);
  }
  return out.filter((v, i) => out.indexOf(v) === i);
}

/** El código de error de Meta dentro del cuerpo de la respuesta, si hay. */
export function codigoDeError(cuerpo: string): number | null {
  try {
    const c = JSON.parse(cuerpo)?.error?.code;
    return typeof c === "number" ? c : null;
  } catch {
    return null;
  }
}

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

export type WhatsappResult =
  | { ok: true; enviados: number }
  | { ok: false; error: string; noConfigurado?: boolean };

// Manda el mismo aviso a todos los vendedores. No lanza: cualquier fallo de un
// destinatario se acumula y se reporta, pero nunca corta el flujo de negocio
// (el pedido, o la solicitud, ya quedaron registrados antes de llamar acá).
//
// Si hay plantilla configurada se manda como plantilla; si no, texto libre.
async function enviar(
  plantilla: string | undefined,
  idioma: string,
  nombres: readonly string[],
  valores: string[],
  texto: string
): Promise<WhatsappResult> {
  if (!whatsappConfigurado()) {
    return {
      ok: false,
      noConfigurado: true,
      error: "El aviso por WhatsApp no está configurado (falta conectar el número de WhatsApp Business).",
    };
  }
  const destinos = vendedores();
  if (destinos.length === 0) {
    console.error("[whatsapp] WHATSAPP_VENDEDORES está vacío o mal formado, no hay a quién avisar");
    return { ok: false, error: "No hay vendedores cargados en WHATSAPP_VENDEDORES." };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const errores: string[] = [];
  let enviados = 0;

  const cuerpo = (to: string) => {
    if (!plantilla) {
      return {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: texto },
      };
    }
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: plantilla,
        language: { code: idioma },
        components: [
          {
            type: "body",
            parameters: armarParametros(nombres, valores),
          },
        ],
      },
    };
  };

  for (const destino of destinos) {
    // Se prueban las formas equivalentes del número solo si Meta lo rechaza
    // por "no está en la lista de permitidos" (131030): ese rechazo significa
    // que no se mandó nada, así que reintentar no duplica mensajes.
    const variantes = variantesNumero(destino);
    for (let i = 0; i < variantes.length; i++) {
      const to = variantes[i];
      const hayOtra = i < variantes.length - 1;
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
          if (to !== destino) {
            console.warn(
              `[whatsapp] ${destino} solo lo aceptó Meta como ${to}: conviene cargarlo así en WHATSAPP_VENDEDORES`
            );
          }
          break;
        }
        const detail = await res.text().catch(() => "");
        if (hayOtra && codigoDeError(detail) === 131030) continue;
        const linea = `${to}: ${res.status} ${detail}`.trim();
        // Sin esto el motivo real (plantilla no encontrada, número sin
        // permiso, token vencido) se perdía: las rutas que llaman acá lo
        // descartan o solo devuelven un booleano al cliente. Esta línea es la
        // única forma de verlo, en los logs de Vercel (Function Logs).
        console.error(`[whatsapp] envío rechazado — ${linea}`);
        errores.push(linea);
        break;
      } catch (err) {
        const linea = `${to}: ${String(err)}`;
        console.error(`[whatsapp] error de red al enviar — ${linea}`);
        errores.push(linea);
        break;
      }
    }
  }

  if (enviados === 0) {
    return { ok: false, error: `WhatsApp no aceptó ningún envío. ${errores.join(" · ")}`.trim() };
  }
  return { ok: true, enviados };
}

// El idioma es parte de la identidad de la plantilla: `nuevo_pedido` en "es" y
// en "es_AR" son dos plantillas distintas, y pedir la que no es devuelve
// "template not found". Cada una tiene el suyo porque en la práctica quedaron
// creadas en idiomas distintos, y rehacer una cuesta otra aprobación.
export function idiomaPedido(): string {
  return process.env.WHATSAPP_TEMPLATE_LANG || "es_AR";
}

export function idiomaAcceso(): string {
  return (
    process.env.WHATSAPP_TEMPLATE_ACCESO_LANG ||
    process.env.WHATSAPP_TEMPLATE_LANG ||
    "es_AR"
  );
}

/** Entró un pedido o una consulta desde la tienda. */
export function notificarVendedores(aviso: AvisoPedido): Promise<WhatsappResult> {
  return enviar(
    process.env.WHATSAPP_TEMPLATE,
    idiomaPedido(),
    PARAMS_PEDIDO,
    parametrosPlantilla(aviso),
    aviso.texto
  );
}

/** Alguien pidió acceso desde la landing y hay que aprobarlo o rechazarlo. */
export function notificarSolicitudAcceso(aviso: AvisoAcceso): Promise<WhatsappResult> {
  return enviar(
    process.env.WHATSAPP_TEMPLATE_ACCESO,
    idiomaAcceso(),
    PARAMS_ACCESO,
    parametrosAcceso(aviso),
    aviso.texto
  );
}
