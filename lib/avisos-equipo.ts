// Avisos al equipo: campana del panel + WhatsApp (bloque 8 del plan).
//
// Cada aviso es una fila por persona del equipo (tabla notificaciones), con
// su propia clave: nada se manda dos veces y cada uno marca leído lo suyo.
//
// WhatsApp: a cada persona con el aviso activado en Equipo, a su teléfono de
// "Mi cuenta". Mientras nadie lo haya activado, sale como hasta ahora a la
// lista fija WHATSAPP_VENDEDORES (así el deploy no cambia nada).

import type { SupabaseClient } from "@supabase/supabase-js";
import { guardarAvisos, actualizarAviso, type AvisoGuardado, type NuevoAviso } from "./avisos";
import { leerUsuarios, listarMiembros, type MiembroEquipo } from "./equipo";
import { isMock, mockListConsultas, mockListOps, mockListUsuarios } from "./mock-db";
import {
  claveAvisoEquipo,
  paraModeradores,
  pendientes,
  resumenPendientes,
  type DatosAvisoEquipo,
  type Pendiente,
  type TipoAvisoEquipo,
} from "./recordatorios";
import { notificarAviso, type WhatsappResult } from "./whatsapp";

export async function equipoActivo(admin: SupabaseClient | null): Promise<MiembroEquipo[]> {
  const usuarios = isMock() || !admin ? mockListUsuarios() : await leerUsuarios(admin);
  return listarMiembros(usuarios).filter((m) => m.activo);
}

const conWhatsapp = (m: MiembroEquipo) => m.avisosWhatsapp && !!m.telefono;

/** Link del aviso para esa persona: el moderador no entra al Panel. */
export function urlPara(m: Pick<MiembroEquipo, "rol">, url: string): string {
  if (m.rol === "moderador" && url.startsWith("/admin") && !url.startsWith("/admin/clientes")) return "/moderador";
  return url;
}

export function destinatariosDe(equipo: MiembroEquipo[], tipo: TipoAvisoEquipo, roles?: MiembroEquipo["rol"][]) {
  return equipo.filter((m) =>
    roles ? roles.includes(m.rol) : m.rol === "administrador" || paraModeradores(tipo)
  );
}

export type ResultadoAviso = { nuevos: number; whatsapp: WhatsappResult | null };

/**
 * Registra un aviso para el equipo y manda el WhatsApp. `enviarWhatsapp`
 * recibe los teléfonos (o undefined = la lista fija de siempre). Nunca tira:
 * quien llama ya registró lo importante (el pedido, la solicitud…).
 */
export async function avisarEquipo(
  admin: SupabaseClient | null,
  aviso: {
    tipo: TipoAvisoEquipo;
    ref: string;
    datos: DatosAvisoEquipo;
    url: string;
    operacion_id?: string | null;
    consulta_id?: string | null;
    // Solo estos roles (para no avisar dos veces lo mismo en un envío mixto).
    roles?: MiembroEquipo["rol"][];
  },
  enviarWhatsapp: ((para?: string[]) => Promise<WhatsappResult>) | null
): Promise<ResultadoAviso> {
  let equipo: MiembroEquipo[];
  try {
    equipo = await equipoActivo(admin);
  } catch (e) {
    // Sin poder leer el equipo, el WhatsApp sale igual a la lista fija.
    console.error(`[avisos] no se pudo leer el equipo: ${(e as Error).message}`);
    return { nuevos: 0, whatsapp: enviarWhatsapp ? await enviarWhatsapp(undefined) : null };
  }
  try {
    const dest = destinatariosDe(equipo, aviso.tipo, aviso.roles);
    const alguienActivo = equipo.some(conWhatsapp);

    const filas = await guardarAvisos(
      admin,
      dest.map((m) => ({
        clave: claveAvisoEquipo(m.id, aviso.tipo, aviso.ref),
        audiencia: "equipo" as const,
        destinatario_id: m.id,
        destinatario_email: m.email,
        tipo: aviso.tipo,
        operacion_id: aviso.operacion_id ?? null,
        consulta_id: aviso.consulta_id ?? null,
        datos: aviso.datos,
        url: urlPara(m, aviso.url),
        email_estado: "no_aplica" as const,
        whatsapp_estado: enviarWhatsapp && conWhatsapp(m) ? ("pendiente" as const) : ("no_aplica" as const),
      }))
    );
    const nuevos = filas.flatMap((fila) => {
      const m = dest.find((d) => d.id === fila.destinatario_id);
      return m ? [{ m, fila }] : [];
    });
    if (!enviarWhatsapp) return { nuevos: nuevos.length, whatsapp: null };
    if (nuevos.length === 0) {
      // Ya avisado (misma clave): nada. Pero si la tabla todavía no existe
      // (migración sin aplicar) no hay filas y el WhatsApp tiene que salir
      // igual, como antes de este cambio.
      if (dest.length === 0 || (await hayTabla(admin))) return { nuevos: 0, whatsapp: null };
      const telefonos = dest.filter(conWhatsapp).map((m) => m.telefono as string);
      if (alguienActivo && telefonos.length === 0) return { nuevos: 0, whatsapp: null };
      return { nuevos: 0, whatsapp: await enviarWhatsapp(alguienActivo ? telefonos : undefined) };
    }

    if (!alguienActivo) {
      return { nuevos: nuevos.length, whatsapp: await enviarWhatsapp(undefined) };
    }
    const resultados = await Promise.all(
      nuevos
        .filter(({ m }) => conWhatsapp(m))
        .map(async ({ m, fila }) => {
          const r = await enviarWhatsapp([m.telefono as string]);
          await actualizarAviso(
            admin,
            fila.id,
            r.ok ? { whatsapp_estado: "enviado" } : { whatsapp_estado: r.noConfigurado ? "sin_configurar" : "error", whatsapp_error: r.error.slice(0, 500) }
          );
          return r;
        })
    );
    return { nuevos: nuevos.length, whatsapp: resumirEnvios(resultados) };
  } catch (e) {
    console.error(`[avisos] aviso al equipo (${aviso.tipo}): ${(e as Error).message}`);
    return { nuevos: 0, whatsapp: null };
  }
}

async function hayTabla(admin: SupabaseClient | null): Promise<boolean> {
  if (isMock() || !admin) return true;
  const { error } = await admin.from("notificaciones").select("id").limit(1);
  return !error;
}

function resumirEnvios(rs: WhatsappResult[]): WhatsappResult | null {
  if (rs.length === 0) return null;
  const ok = rs.filter((r): r is { ok: true; enviados: number } => r.ok);
  if (ok.length > 0) return { ok: true, enviados: ok.reduce((a, r) => a + r.enviados, 0) };
  const err = rs.find((r) => !r.ok) as { ok: false; error: string; noConfigurado?: boolean };
  return err;
}

// ---- recordatorios -----------------------------------------------------------

export type ResumenRecordatorios = { pendientes: number; avisosNuevos: number; whatsapps: number };

/**
 * Lo que quedó esperando, una vez por ítem y por persona. Si en una pasada
 * hay varios, van juntos en UN WhatsApp ("3 pendientes: …") con el link al
 * Panel filtrado. Sin pendientes nuevos no se manda nada (sin resumen diario).
 */
export async function correrRecordatorios(
  admin: SupabaseClient | null,
  ahora: Date,
  baseUrl: string
): Promise<ResumenRecordatorios> {
  let ops;
  let consultas;
  if (isMock() || !admin) {
    ops = mockListOps();
    consultas = mockListConsultas();
  } else {
    const [o, c] = await Promise.all([
      admin
        .from("operaciones")
        .select("id, code, evento, status, tipo, confirmada_at, entrada_recibida_at, pago_confirmado_at, cerrada_at, fecha_evento, created_at")
        .neq("status", "cancelada")
        .is("cerrada_at", null)
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("consultas")
        .select("id, code, evento, estado, vence_at, created_at")
        .in("estado", ["pendiente", "cotizada"])
        .limit(500),
    ]);
    if (o.error) throw new Error(o.error.message);
    if (c.error) throw new Error(c.error.message);
    ops = (o.data ?? []) as Parameters<typeof pendientes>[0];
    consultas = (c.data ?? []) as Parameters<typeof pendientes>[1];
  }
  const ps = pendientes(ops, consultas, ahora);
  if (ps.length === 0) return { pendientes: 0, avisosNuevos: 0, whatsapps: 0 };

  const equipo = await equipoActivo(admin);
  const alguienActivo = equipo.some(conWhatsapp);
  let avisosNuevos = 0;
  let whatsapps = 0;
  const nuevosParaLista = new Map<string, Pendiente>();

  // UNA escritura para todo (persona × pendiente); vuelven solo los nuevos.
  const filas: { m: MiembroEquipo; p: Pendiente; aviso: NuevoAviso }[] = [];
  for (const m of equipo) {
    for (const p of ps) {
      const tipo = `recordatorio_${p.tipo}` as TipoAvisoEquipo;
      if (m.rol !== "administrador" && !paraModeradores(tipo)) continue;
      filas.push({
        m,
        p,
        aviso: {
          clave: claveAvisoEquipo(m.id, tipo, p.ref),
          audiencia: "equipo",
          destinatario_id: m.id,
          destinatario_email: m.email,
          tipo,
          operacion_id: p.clase === "op" ? p.ref : null,
          consulta_id: p.clase === "consulta" ? p.ref : null,
          datos: { code: p.code, evento: p.evento },
          url: urlPara(m, `/admin?q=${encodeURIComponent(p.code)}`),
          email_estado: "no_aplica",
          whatsapp_estado: conWhatsapp(m) ? "pendiente" : "no_aplica",
        },
      });
    }
  }
  const guardados = new Map((await guardarAvisos(admin, filas.map((f) => f.aviso))).map((g) => [g.clave, g]));

  for (const m of equipo) {
    const nuevos: { p: Pendiente; fila: AvisoGuardado }[] = filas
      .filter((f) => f.m.id === m.id && guardados.has(f.aviso.clave))
      .map((f) => ({ p: f.p, fila: guardados.get(f.aviso.clave)! }));
    avisosNuevos += nuevos.length;
    if (nuevos.length === 0) continue;
    if (!alguienActivo) {
      if (m.rol === "administrador") for (const { p } of nuevos) nuevosParaLista.set(`${p.tipo}:${p.ref}`, p);
      continue;
    }
    if (!conWhatsapp(m)) continue;
    const r = await notificarAviso(mensajeRecordatorio(nuevos.map((n) => n.p), baseUrl, m), [m.telefono as string]);
    if (r.ok) whatsapps++;
    for (const { fila } of nuevos) {
      await actualizarAviso(
        admin,
        fila.id,
        r.ok ? { whatsapp_estado: "enviado" } : { whatsapp_estado: r.noConfigurado ? "sin_configurar" : "error", whatsapp_error: r.error.slice(0, 500) }
      );
    }
  }

  // Nadie activó el aviso en Equipo todavía: un solo mensaje a la lista fija.
  if (!alguienActivo && nuevosParaLista.size > 0) {
    const r = await notificarAviso(mensajeRecordatorio(Array.from(nuevosParaLista.values()), baseUrl, { rol: "administrador" }));
    if (r.ok) whatsapps++;
  }
  return { pendientes: ps.length, avisosNuevos, whatsapps };
}

export function mensajeRecordatorio(ps: Pendiente[], baseUrl: string, m: Pick<MiembroEquipo, "rol">) {
  const link = `${baseUrl}${urlPara(m, "/admin?filtro=prioridad")}`;
  const aviso = resumenPendientes(ps);
  return {
    aviso,
    detalle: link,
    texto: `⏰ ${aviso}\n` + ps.map((p) => `· ${p.code} — ${p.evento}`).join("\n") + `\n\n${link}`,
  };
}
