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
  whatsapp_destino?: string | null;
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
  "id, clave, audiencia, destinatario_id, destinatario_email, tipo, operacion_id, consulta_id, datos, url, leida_at, email_estado, email_error, whatsapp_estado, whatsapp_error, whatsapp_destino, created_at";

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

/**
 * Varios avisos en UNA escritura. Devuelve solo los nuevos (los que ya
 * existían por clave no vuelven). [] si falló (no se reenvía nada a ciegas).
 */
export async function guardarAvisos(admin: SupabaseClient | null, avisos: NuevoAviso[]): Promise<AvisoGuardado[]> {
  if (avisos.length === 0) return [];
  if (isMock() || !admin) return avisos.map(mockGuardarAviso).filter((a): a is AvisoGuardado => a !== null);
  const { data, error } = await admin
    .from("notificaciones")
    .upsert(avisos, { onConflict: "clave", ignoreDuplicates: true })
    .select(COLUMNAS);
  if (error) {
    console.error(`[avisos] no se pudieron guardar ${avisos.length} avisos: ${error.message}`);
    return [];
  }
  return (data ?? []) as AvisoGuardado[];
}

type PatchAviso = Partial<
  Pick<AvisoGuardado, "email_estado" | "email_error" | "whatsapp_estado" | "whatsapp_error" | "whatsapp_destino">
>;

export async function actualizarAviso(admin: SupabaseClient | null, id: string, patch: PatchAviso): Promise<void> {
  return actualizarAvisos(admin, [id], patch);
}

/** El mismo cambio en varias filas (un envío a la lista fija cubre a todos). */
export async function actualizarAvisos(admin: SupabaseClient | null, ids: string[], patch: PatchAviso): Promise<void> {
  if (ids.length === 0) return;
  if (isMock() || !admin) {
    for (const id of ids) mockActualizarAviso(id, patch);
    return;
  }
  const { error } = await admin.from("notificaciones").update(patch).in("id", ids);
  if (error) console.error(`[avisos] no se pudieron actualizar ${ids.length} avisos: ${error.message}`);
}

/** El resultado de un envío de WhatsApp, como queda registrado en la fila. */
export function patchDeWhatsapp(
  r: { ok: true } | { ok: false; error: string; noConfigurado?: boolean },
  destino: string
): PatchAviso {
  if (r.ok) return { whatsapp_estado: "enviado", whatsapp_error: null, whatsapp_destino: destino };
  return {
    whatsapp_estado: r.noConfigurado ? "sin_configurar" : "error",
    whatsapp_error: r.error.slice(0, 500),
    whatsapp_destino: destino,
  };
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
