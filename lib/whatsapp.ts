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
export async function notificarVendedores(text: string): Promise<WhatsappResult> {
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

  for (const to of destinos) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { preview_url: false, body: text },
        }),
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
