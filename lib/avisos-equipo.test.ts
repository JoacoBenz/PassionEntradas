import { beforeEach, describe, expect, it, vi } from "vitest";
import { avisarEquipo, correrRecordatorios, destinatariosDe, mensajeRecordatorio } from "./avisos-equipo";
import type { MiembroEquipo } from "./equipo";
import { mockListAvisos, mockListUsuarios } from "./mock-db";
import { DESTINO_LISTA_FIJA } from "./recordatorios";

const miembro = (id: string, rol: MiembroEquipo["rol"], nombre: string, extra: Partial<MiembroEquipo> = {}): MiembroEquipo => ({
  id,
  email: `${nombre.toLowerCase().split(" ")[0]}@example.com`,
  nombre,
  rol,
  activo: true,
  telefono: null,
  ultimoIngreso: null,
  avisosWhatsapp: false,
  ...extra,
});

describe("destinatariosDe (decisión 6a)", () => {
  const equipo = [
    miembro("a1", "administrador", "Nacho Pérez"),
    miembro("a2", "administrador", "Emilia Demo"),
    miembro("m1", "moderador", "Lucho"),
  ];
  const ids = (ms: MiembroEquipo[]) => ms.map((m) => m.id);

  it("sin vendedor: por rol", () => {
    expect(ids(destinatariosDe(equipo, "nuevo_pedido"))).toEqual(["a1", "a2"]);
    expect(ids(destinatariosDe(equipo, "nueva_consulta"))).toEqual(["a1", "a2", "m1"]);
  });

  it("el vendedor nombra a alguien del equipo: solo esa persona", () => {
    expect(ids(destinatariosDe(equipo, "recordatorio_confirmar", undefined, "Nacho"))).toEqual(["a1"]);
    expect(ids(destinatariosDe(equipo, "cancelado_cliente", undefined, "emilia@example.com"))).toEqual(["a2"]);
  });

  it("el vendedor no es del equipo, o no puede accionarlo: por rol", () => {
    expect(ids(destinatariosDe(equipo, "recordatorio_confirmar", undefined, "scuderia_ar"))).toEqual(["a1", "a2"]);
    // Lucho es moderador: un recordatorio de confirmar no es suyo.
    expect(ids(destinatariosDe(equipo, "recordatorio_confirmar", undefined, "Lucho"))).toEqual(["a1", "a2"]);
  });
});

describe("mensajeRecordatorio", () => {
  const p = (code: string) => ({ tipo: "confirmar" as const, clase: "op" as const, ref: code, code, evento: "River", desde: "" });
  it("uno solo: el link va a ese pedido; varios: al filtro de prioridad", () => {
    expect(mensajeRecordatorio([p("BX-1")], "https://x", { rol: "administrador" }).detalle).toBe("https://x/admin?q=BX-1");
    expect(mensajeRecordatorio([p("BX-1"), p("BX-2")], "https://x", { rol: "administrador" }).detalle).toBe(
      "https://x/admin?filtro=prioridad"
    );
    expect(mensajeRecordatorio([p("BX-1")], "https://x", { rol: "moderador" }).detalle).toBe("https://x/moderador");
  });
});

// avisarEquipo contra la base de prueba (mock-db): 2 admins (Demo y Emilia,
// con teléfono) y un moderador (Lucho).
describe("avisarEquipo", () => {
  const EMILIA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  let ref = 0;
  beforeEach(() => {
    process.env.MOCK_DATA = "1";
    (globalThis as { __passionMockDb?: unknown }).__passionMockDb = undefined;
    ref++;
  });
  const filas = () => mockListAvisos((a) => a.audiencia === "equipo", 100);
  const ok = async (_para?: string[], _url?: string) => ({ ok: true as const, enviados: 1 });

  it("nadie activó WhatsApp: UN envío a la lista fija y el resultado queda en cada fila", async () => {
    const enviar = vi.fn(async () => ({ ok: false as const, error: 'x: 400 {"error":{"code":131030}}' }));
    const r = await avisarEquipo(null, { tipo: "nuevo_pedido", ref: `r${ref}`, datos: {}, url: "/admin?q=BX-1" }, enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith(undefined, "/admin?q=BX-1");
    expect(r.nuevos).toBe(2);
    for (const f of filas()) {
      expect(f.whatsapp_estado).toBe("error");
      expect(f.whatsapp_destino).toBe(DESTINO_LISTA_FIJA);
      expect(f.whatsapp_error).toContain("131030");
    }
  });

  it("listaFija: false y nadie activado: no manda nada y no queda pendiente", async () => {
    const enviar = vi.fn(ok);
    await avisarEquipo(null, { tipo: "nueva_consulta", ref: `r${ref}`, datos: {}, url: "/admin", listaFija: false }, enviar);
    expect(enviar).not.toHaveBeenCalled();
    expect(filas().every((f) => f.whatsapp_estado === "no_aplica")).toBe(true);
  });

  it("con el aviso activado: a su teléfono, con su link, y queda registrado", async () => {
    const emilia = mockListUsuarios().find((u) => u.id === EMILIA)!;
    emilia.app_metadata = { ...emilia.app_metadata, avisos_whatsapp: true };
    const enviar = vi.fn(ok);
    await avisarEquipo(null, { tipo: "nuevo_pedido", ref: `r${ref}`, datos: {}, url: "/admin?q=BX-2" }, enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0]).toEqual([["+54 9 351 555 0000"], "/admin?q=BX-2"]);
    const suya = filas().find((f) => f.destinatario_id === EMILIA)!;
    expect(suya.whatsapp_estado).toBe("enviado");
    expect(suya.whatsapp_destino).toBe("+54 9 351 555 0000");
    expect(filas().find((f) => f.destinatario_id !== EMILIA)!.whatsapp_estado).toBe("no_aplica");
  });

  it("vendedor del equipo: el aviso es solo suyo", async () => {
    await avisarEquipo(null, { tipo: "cancelado_cliente", ref: `r${ref}`, datos: {}, url: "/admin", vendedor: "emilia" }, null);
    expect(filas().map((f) => f.destinatario_id)).toEqual([EMILIA]);
  });

  it("consulta cancelada por el cliente: también al moderador", async () => {
    await avisarEquipo(
      null,
      { tipo: "cancelado_cliente", ref: `r${ref}`, datos: {}, url: "/admin?q=BX-C", roles: ["administrador", "moderador"] },
      null
    );
    const fs = filas();
    expect(fs).toHaveLength(3);
    expect(fs.find((f) => f.destinatario_id === "ffffffff-ffff-4fff-8fff-ffffffffffff")!.url).toBe("/moderador");
  });

  it("el mismo aviso dos veces: un solo envío", async () => {
    const enviar = vi.fn(ok);
    const a = { tipo: "nuevo_pedido" as const, ref: `r${ref}`, datos: {}, url: "/admin" };
    await avisarEquipo(null, a, enviar);
    await avisarEquipo(null, a, enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});

describe("correrRecordatorios", () => {
  beforeEach(() => {
    process.env.MOCK_DATA = "1";
    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_PHONE_ID;
    delete process.env.WHATSAPP_VENDEDORES;
    (globalThis as { __passionMockDb?: unknown }).__passionMockDb = undefined;
  });

  it("sin nadie activado: va a la lista fija y cada fila dice cómo salió; la segunda pasada no repite", async () => {
    const ahora = new Date(Date.now() + 3 * 3_600_000);
    const r = await correrRecordatorios(null, ahora, "https://x");
    expect(r.pendientes).toBeGreaterThan(0);
    expect(r.avisosNuevos).toBeGreaterThan(0);
    const fs = mockListAvisos((a) => a.tipo.startsWith("recordatorio_"), 100);
    expect(fs.length).toBe(r.avisosNuevos);
    for (const f of fs) {
      expect(f.whatsapp_estado).toBe("sin_configurar");
      expect(f.whatsapp_destino).toBe(DESTINO_LISTA_FIJA);
    }
    const otra = await correrRecordatorios(null, ahora, "https://x");
    expect(otra.avisosNuevos).toBe(0);
  });
});
