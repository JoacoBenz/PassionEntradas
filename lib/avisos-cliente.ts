// Aviso al cliente cuando su pedido cambia de paso (Confirmado, Para pagar,
// Entregada): queda en su campana y, si hay proveedor de email, le llega un
// mail en el idioma en que hizo el pedido. Lo llama el cambio de estado del
// panel; nunca lo traba: cualquier fallo se registra y sigue.

import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoEmailInicial, guardarAviso, mandarEmailDeAviso } from "./avisos";
import { isMock, mockGetTextosPago } from "./mock-db";
import { avisoDeCambio, claveAvisoCliente, emailAviso, idiomaDe } from "./notificaciones";
import { textoPagoDe } from "./textos";
import type { Moneda } from "./operaciones";

type Hitos = Parameters<typeof avisoDeCambio>[0];

export type OpParaAviso = Hitos & {
  id: string;
  code: string;
  evento: string;
  monto: number | null;
  moneda: Moneda | null;
  cliente_id: string | null;
  cliente_email: string | null;
  comprador_alias: string | null;
  idioma?: string | null;
};

// Columnas que hay que leer de la operación para poder avisar. `idioma` NO
// va acá: se lee aparte y solo si hay email que mandar, así el cambio de
// estado no depende de que la migración 0045 ya esté aplicada.
export const COLUMNAS_AVISO =
  "id, code, evento, monto, moneda, cliente_id, cliente_email, comprador_alias, status, tipo, confirmada_at, entrada_recibida_at, pago_confirmado_at, cerrada_at";

export async function avisarCambioAlCliente(
  admin: SupabaseClient | null,
  antes: Hitos,
  despues: OpParaAviso,
  baseUrl: string
): Promise<void> {
  try {
    const tipo = avisoDeCambio(antes, despues);
    // Sin cliente (operación cargada a mano sin vincular) no hay a quién.
    if (!tipo || (!despues.cliente_id && !despues.cliente_email)) return;

    const url = `${baseUrl}/mis-pedidos`;
    const datos = { code: despues.code, evento: despues.evento, monto: despues.monto, moneda: despues.moneda };
    const aviso = await guardarAviso(admin, {
      clave: claveAvisoCliente(despues.id, tipo),
      audiencia: "cliente",
      destinatario_id: despues.cliente_id,
      destinatario_email: despues.cliente_email,
      tipo,
      operacion_id: despues.id,
      datos,
      url,
      email_estado: estadoEmailInicial(despues.cliente_email),
    });
    if (!aviso || aviso.email_estado !== "pendiente") return;

    let idioma = despues.idioma;
    if (idioma === undefined && admin && !isMock()) {
      const { data } = await admin.from("operaciones").select("idioma").eq("id", despues.id).maybeSingle();
      idioma = (data as { idioma?: string | null } | null)?.idioma ?? null;
    }
    // Sin idioma en el pedido (cargado por el staff, o anterior a esto): el
    // que el cliente eligió en su cuenta.
    if (!idioma && despues.cliente_id && admin && !isMock()) {
      const { data } = await admin.auth.admin.getUserById(despues.cliente_id);
      const lang = (data?.user?.user_metadata as Record<string, unknown> | undefined)?.lang;
      if (lang === "en" || lang === "es") idioma = lang;
    }

    let textoPago: string | null = null;
    if (tipo === "para_pagar") {
      const textos: Record<string, string> = {};
      if (isMock() || !admin) Object.assign(textos, mockGetTextosPago());
      else {
        const { data } = await admin.from("textos_config").select("key, value").like("key", "pago_%");
        for (const r of (data ?? []) as { key: string; value: string }[]) textos[r.key] = r.value;
      }
      textoPago = textoPagoDe(textos, despues.moneda);
    }
    const mensaje = emailAviso(
      tipo,
      { ...datos, nombre: despues.comprador_alias, textoPago, url },
      idiomaDe(idioma)
    );
    await mandarEmailDeAviso(admin, aviso, mensaje);
  } catch (e) {
    console.error(`[avisos] aviso al cliente de ${despues.id}: ${(e as Error).message}`);
  }
}
