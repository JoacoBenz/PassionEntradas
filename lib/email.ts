// Envío de email de credenciales, opcional y desacoplado. Usa Resend por
// HTTP (sin dependencia npm nueva): se activa SOLO si están las envs
// RESEND_API_KEY y EMAIL_FROM. Si no están, `emailConfigurado()` devuelve
// false y el panel ofrece únicamente el mensaje para copiar (WhatsApp/texto),
// que siempre funciona. Cuando se conecte un proveedor, el botón de email
// pasa a funcionar sin tocar código.

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// Aviso a los vendedores por email: además de RESEND_API_KEY y EMAIL_FROM,
// necesita EMAIL_VENDEDORES (los destinatarios, separados por coma). Igual que
// el aviso por WhatsApp: si falta algo, se omite y el pedido igual queda
// registrado.
export function emailVendedoresConfigurado(): boolean {
  return emailConfigurado() && Boolean(process.env.EMAIL_VENDEDORES);
}

function vendedoresEmails(): string[] {
  return (process.env.EMAIL_VENDEDORES ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// Envía el aviso de un pedido/consulta a todos los vendedores en un solo mail.
export async function notificarVendedoresEmail(
  subject: string,
  text: string
): Promise<EnvioResult> {
  if (!emailVendedoresConfigurado()) {
    return {
      ok: false,
      noConfigurado: true,
      error: "El aviso por email no está configurado (falta EMAIL_VENDEDORES o el proveedor).",
    };
  }
  const to = vendedoresEmails();
  if (to.length === 0) {
    return { ok: false, error: "No hay vendedores cargados en EMAIL_VENDEDORES." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `El proveedor rechazó el envío (${res.status}). ${detail}`.trim() };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `No se pudo contactar al proveedor de email: ${String(err)}` };
  }
}

export type EnvioResult =
  | { ok: true }
  | { ok: false; error: string; noConfigurado?: boolean };

export async function enviarEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<EnvioResult> {
  if (!emailConfigurado()) {
    return {
      ok: false,
      noConfigurado: true,
      error: "El envío de email no está configurado (falta conectar un proveedor).",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `El proveedor rechazó el envío (${res.status}). ${detail}`.trim() };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `No se pudo contactar al proveedor de email: ${String(err)}` };
  }
}
