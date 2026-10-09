// Guardar y mandar avisos (tabla notificaciones). Lo que dice cada aviso está
// en lib/notificaciones.ts; acá está el registro y el envío.
//
// El aviso se GUARDA siempre (es lo que muestra la campana) y la clave lo
// deduplica: si ya existía, no se manda nada de nuevo. El email sale solo si
// hay proveedor configurado; si no, la fila queda "sin_configurar" para que se
// vea por qué no llegó (y no se mande tarde el día que se configure).

import type { SupabaseClient } from "@supabase/supabase-js";
import { emailConfigurado, enviarEmail } from "./email";
import { isMock, mockActualizarAviso, mockGuardarAviso } from "./mock-db";

export type EstadoEnvio = "no_aplica" | "pendiente" | "enviado" | "error" | "sin_configurar";

export type NuevoAviso = {
  clave: string;
  audiencia: "cliente" | "equipo";
  destinatario_id: string | null;
  destinatario_email: string | null;
  tipo: string;
  operacion_id: string | null;
  consulta_id?: string | null;
  datos: Record<string, unknown>;
  url: string | null;
  email_estado: EstadoEnvio;
  whatsapp_estado?: EstadoEnvio;
};

export type AvisoGuardado = NuevoAviso & {
  id: string;
  leida_at: string | null;
  email_error: string | null;
  whatsapp_estado: EstadoEnvio;
  whatsapp_error: string | null;
  created_at: string;
};

const COLUMNAS =
  "id, clave, audiencia, destinatario_id, destinatario_email, tipo, operacion_id, consulta_id, datos, url, leida_at, email_estado, email_error, whatsapp_estado, whatsapp_error, created_at";

/** Guarda el aviso. null si la clave ya existía (ya se avisó) o si falló. */
export async function guardarAviso(admin: SupabaseClient | null, a: NuevoAviso): Promise<AvisoGuardado | null> {
  if (isMock() || !admin) return mockGuardarAviso(a);
  const { data, error } = await admin
    .from("notificaciones")
    .upsert(a, { onConflict: "clave", ignoreDuplicates: true })
    .select(COLUMNAS);
  if (error) {
    console.error(`[avisos] no se pudo guardar ${a.clave}: ${error.message}`);
    return null;
  }
  return ((data ?? [])[0] as AvisoGuardado | undefined) ?? null;
}

export async function actualizarAviso(
  admin: SupabaseClient | null,
  id: string,
  patch: Partial<Pick<AvisoGuardado, "email_estado" | "email_error" | "whatsapp_estado" | "whatsapp_error">>
): Promise<void> {
  if (isMock() || !admin) return mockActualizarAviso(id, patch);
  const { error } = await admin.from("notificaciones").update(patch).eq("id", id);
  if (error) console.error(`[avisos] no se pudo actualizar ${id}: ${error.message}`);
}

/** Estado inicial del email de un aviso que lo lleva. */
export function estadoEmailInicial(destinatario: string | null): EstadoEnvio {
  if (!destinatario) return "no_aplica";
  return emailConfigurado() ? "pendiente" : "sin_configurar";
}

/** Manda el email de un aviso recién guardado y registra cómo salió. */
export async function mandarEmailDeAviso(
  admin: SupabaseClient | null,
  aviso: AvisoGuardado,
  mensaje: { subject: string; text: string }
): Promise<void> {
  if (aviso.email_estado !== "pendiente" || !aviso.destinatario_email) return;
  const r = await enviarEmail({ to: aviso.destinatario_email, ...mensaje });
  await actualizarAviso(
    admin,
    aviso.id,
    r.ok ? { email_estado: "enviado", email_error: null } : { email_estado: "error", email_error: r.error.slice(0, 500) }
  );
}
