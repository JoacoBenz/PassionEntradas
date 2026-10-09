// Avisos al equipo: campana del panel + WhatsApp (bloque 8 del plan).
//
// Cada aviso es una fila por persona del equipo (tabla notificaciones), con
// su propia clave: nada se manda dos veces y cada uno marca leído lo suyo.
//
// A quién: por rol (lib/recordatorios: paraModeradores). Si la operación tiene
// un vendedor que nombra a alguien del equipo, solo a esa persona (6a).
//
// WhatsApp: a cada persona con el aviso activado en Equipo, a su teléfono de
// "Mi cuenta". Mientras nadie lo haya activado, sale como hasta ahora a la
// lista fija WHATSAPP_VENDEDORES (así el deploy no cambia nada). Cómo salió
// queda en cada fila (whatsapp_estado / _error / _destino) y se ve en la
// campana.

import type { SupabaseClient } from "@supabase/supabase-js";
import { guardarAvisos, actualizarAvisos, patchDeWhatsapp, type AvisoGuardado, type NuevoAviso } from "./avisos";
import { leerUsuarios, listarMiembros, miembroPorAlias, type MiembroEquipo } from "./equipo";
import { isMock, mockListConsultas, mockListOps, mockListUsuarios } from "./mock-db";
import {
  claveAvisoEquipo,
  DESTINO_LISTA_FIJA,
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

/**
 * Quiénes reciben el aviso: los del rol que corresponde. Si `vendedor` (el
 * vendedor_alias de la operación) nombra sin dudas a uno de ellos, solo esa
 * persona. Si nombra a alguien que no puede accionarlo (un moderador en un
 * aviso de admin) o a nadie, a todos los del rol.
 */
export function destinatariosDe(
  equipo: MiembroEquipo[],
  tipo: TipoAvisoEquipo,
  roles?: MiembroEquipo["rol"][],
  vendedor?: string | null
): MiembroEquipo[] {
  const porRol = equipo.filter((m) => (roles ? roles.includes(m.rol) : m.rol === "administrador" || paraModeradores(tipo)));
  const id = miembroPorAlias(equipo, vendedor);
  const suyo = id ? porRol.filter((m) => m.id === id) : [];
  return suyo.length > 0 ? suyo : porRol;
}

export type ResultadoAviso = { nuevos: number; whatsapp: WhatsappResult | null };

/**
 * Manda el WhatsApp: `para` son los teléfonos (undefined = la lista fija de
 * siempre) y `url` el link del aviso para quien lo recibe (sin el dominio).
 */
export type EnviarWhatsapp = (para: string[] | undefined, url: string) => Promise<WhatsappResult>;

/**
 * Registra un aviso para el equipo y manda el WhatsApp. Nunca tira: quien
 * llama ya registró lo importante (el pedido, la solicitud…).
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
    // vendedor_alias de la operación (ver destinatariosDe).
    vendedor?: string | null;
    // false: no mandar a la lista fija (en un envío mixto ya la avisó el
    // otro aviso del mismo envío).
    listaFija?: boolean;
  },
  enviarWhatsapp: EnviarWhatsapp | null
): Promise<ResultadoAviso> {
  const aLaLista = !!enviarWhatsapp && aviso.listaFija !== false;
  let equipo: MiembroEquipo[];
  try {
    equipo = await equipoActivo(admin);
  } catch (e) {
    // Sin poder leer el equipo, el WhatsApp sale igual a la lista fija.
    console.error(`[avisos] no se pudo leer el equipo: ${(e as Error).message}`);
    return { nuevos: 0, whatsapp: aLaLista ? await enviarWhatsapp!(undefined, aviso.url) : null };
  }
  try {
    const dest = destinatariosDe(equipo, aviso.tipo, aviso.roles, aviso.vendedor);
    const alguienActivo = equipo.some(conWhatsapp);
    // Lo que se va a intentar con cada fila: a su teléfono, a la lista fija
    // (nadie lo activó todavía) o nada.
    const intenta = (m: MiembroEquipo) => !!enviarWhatsapp && (alguienActivo ? conWhatsapp(m) : aLaLista);

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
        whatsapp_estado: intenta(m) ? ("pendiente" as const) : ("no_aplica" as const),
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
      if (!alguienActivo) return { nuevos: 0, whatsapp: aLaLista ? await enviarWhatsapp(undefined, aviso.url) : null };
      const rs = await Promise.all(
        dest.filter(conWhatsapp).map((m) => enviarWhatsapp([m.telefono as string], urlPara(m, aviso.url)))
      );
      return { nuevos: 0, whatsapp: resumirEnvios(rs) };
    }

    if (!alguienActivo) {
      if (!aLaLista) return { nuevos: nuevos.length, whatsapp: null };
      const r = await enviarWhatsapp(undefined, aviso.url);
      await actualizarAvisos(admin, nuevos.map((n) => n.fila.id), patchDeWhatsapp(r, DESTINO_LISTA_FIJA));
      return { nuevos: nuevos.length, whatsapp: r };
    }
    const resultados = await Promise.all(
      nuevos
        .filter(({ m }) => conWhatsapp(m))
        .map(async ({ m, fila }) => {
          const r = await enviarWhatsapp([m.telefono as string], urlPara(m, aviso.url));
          await actualizarAvisos(admin, [fila.id], patchDeWhatsapp(r, m.telefono as string));
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
  let ops: (Parameters<typeof pendientes>[0][number] & { vendedor_alias?: string | null })[];
  let consultas: Parameters<typeof pendientes>[1];
  if (isMock() || !admin) {
    ops = mockListOps();
    consultas = mockListConsultas();
  } else {
    const [o, c] = await Promise.all([
      admin
        .from("operaciones")
        .select("id, code, evento, status, tipo, confirmada_at, entrada_recibida_at, pago_confirmado_at, cerrada_at, fecha_evento, created_at, vendedor_alias")
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
    ops = (o.data ?? []) as typeof ops;
    consultas = (c.data ?? []) as typeof consultas;
  }
  const ps = pendientes(ops, consultas, ahora);
  if (ps.length === 0) return { pendientes: 0, avisosNuevos: 0, whatsapps: 0 };

  const equipo = await equipoActivo(admin);
  const alguienActivo = equipo.some(conWhatsapp);
  const vendedorDe = new Map(ops.map((o) => [o.id, o.vendedor_alias ?? null]));
  let avisosNuevos = 0;
  let whatsapps = 0;

  // UNA escritura para todo (persona × pendiente); vuelven solo los nuevos.
  const filas: { m: MiembroEquipo; p: Pendiente; aviso: NuevoAviso }[] = [];
  for (const p of ps) {
    const tipo = `recordatorio_${p.tipo}` as TipoAvisoEquipo;
    // Una cotización que se vuelve a cotizar vence de nuevo: su aviso es otro.
    const ref = p.tipo === "vence" ? `${p.ref}:${p.desde}` : p.ref;
    for (const m of destinatariosDe(equipo, tipo, undefined, p.clase === "op" ? vendedorDe.get(p.ref) : null)) {
      filas.push({
        m,
        p,
        aviso: {
          clave: claveAvisoEquipo(m.id, tipo, ref),
          audiencia: "equipo",
          destinatario_id: m.id,
          destinatario_email: m.email,
          tipo,
          operacion_id: p.clase === "op" ? p.ref : null,
          consulta_id: p.clase === "consulta" ? p.ref : null,
          datos: { code: p.code, evento: p.evento },
          url: urlPara(m, `/admin?q=${encodeURIComponent(p.code)}`),
          email_estado: "no_aplica",
          // Sin nadie activado, todo va a la lista fija.
          whatsapp_estado: !alguienActivo || conWhatsapp(m) ? "pendiente" : "no_aplica",
        },
      });
    }
  }
  const guardados = new Map((await guardarAvisos(admin, filas.map((f) => f.aviso))).map((g) => [g.clave, g]));

  // Nadie activó el aviso en Equipo todavía: un solo mensaje a la lista fija
  // con todo lo nuevo, y su resultado en cada fila. Lo que ya tenía fila de
  // otra persona ya le llegó a la lista: si cambia el equipo (alguien nuevo,
  // un vendedor que deja de coincidir) se agrega a su campana, sin repetir
  // el WhatsApp.
  const claveDe = (p: Pendiente) => `${p.tipo}:${p.ref}:${p.desde}`;
  const yaAvisados = new Set(filas.filter((f) => !guardados.has(f.aviso.clave)).map((f) => claveDe(f.p)));
  const paraLista = new Map<string, Pendiente>();
  const filasLista: string[] = [];
  const filasSinEnvio: string[] = [];
  for (const m of equipo) {
    const nuevos: { p: Pendiente; fila: AvisoGuardado }[] = filas
      .filter((f) => f.m.id === m.id && guardados.has(f.aviso.clave))
      .map((f) => ({ p: f.p, fila: guardados.get(f.aviso.clave)! }));
    avisosNuevos += nuevos.length;
    if (nuevos.length === 0) continue;
    if (!alguienActivo) {
      for (const { p, fila } of nuevos) {
        if (yaAvisados.has(claveDe(p))) {
          filasSinEnvio.push(fila.id);
          continue;
        }
        paraLista.set(claveDe(p), p);
        filasLista.push(fila.id);
      }
      continue;
    }
    if (!conWhatsapp(m)) continue;
    const r = await notificarAviso(mensajeRecordatorio(nuevos.map((n) => n.p), baseUrl, m), [m.telefono as string]);
    if (r.ok) whatsapps++;
    await actualizarAvisos(admin, nuevos.map((n) => n.fila.id), patchDeWhatsapp(r, m.telefono as string));
  }
  if (paraLista.size > 0) {
    const r = await notificarAviso(mensajeRecordatorio(Array.from(paraLista.values()), baseUrl, { rol: "administrador" }));
    if (r.ok) whatsapps++;
    await actualizarAvisos(admin, filasLista, patchDeWhatsapp(r, DESTINO_LISTA_FIJA));
  }
  await actualizarAvisos(admin, filasSinEnvio, { whatsapp_estado: "no_aplica" });
  return { pendientes: ps.length, avisosNuevos, whatsapps };
}

export function mensajeRecordatorio(ps: Pendiente[], baseUrl: string, m: Pick<MiembroEquipo, "rol">) {
  // Uno solo: directo a ese pedido. Varios: el Panel filtrado por prioridad.
  const destino = ps.length === 1 ? `/admin?q=${encodeURIComponent(ps[0].code)}` : "/admin?filtro=prioridad";
  const link = `${baseUrl}${urlPara(m, destino)}`;
  const aviso = resumenPendientes(ps);
  return {
    aviso,
    detalle: link,
    texto: `⏰ ${aviso}\n` + ps.map((p) => `· ${p.code} — ${p.evento}`).join("\n") + `\n\n${link}`,
  };
}
