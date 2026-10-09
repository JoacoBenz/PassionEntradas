import { describe, expect, it } from "vitest";
import { getRol } from "@/lib/auth";
import {
  bloqueoEnAccesos,
  listarMiembros,
  mapaEquipo,
  metadataDeCambio,
  parsearCambio,
  registroDeCambio,
  rolEquipoDeUsuario,
  validarCambioEquipo,
  type MiembroEquipo,
} from "@/lib/equipo";

const u = (id: string, role?: unknown) => ({ id, app_metadata: role === undefined ? {} : { role } });

describe("equipo", () => {
  it("solo administrador y moderador son del equipo", () => {
    expect(rolEquipoDeUsuario(u("a", "administrador"))).toBe("administrador");
    expect(rolEquipoDeUsuario(u("b", "moderador"))).toBe("moderador");
    expect(rolEquipoDeUsuario(u("c", "cliente"))).toBeNull();
    expect(rolEquipoDeUsuario(u("d", null))).toBeNull();
    expect(rolEquipoDeUsuario(u("e"))).toBeNull();
    expect(rolEquipoDeUsuario(u("f", "admin"))).toBeNull();
  });

  it("mapa con los del equipo", () => {
    const m = mapaEquipo([u("a", "administrador"), u("c", "cliente"), u("b", "moderador")]);
    expect(Array.from(m.entries())).toEqual([["a", "administrador"], ["b", "moderador"]]);
  });

  it("Accesos no toca al equipo; a los clientes sí", () => {
    for (const accion of ["revocar", "reactivar", "reenviar"] as const) {
      expect(bloqueoEnAccesos(null, accion)).toBeNull();
      expect(bloqueoEnAccesos("administrador", accion)).toMatch(/equipo \(administrador\)/);
      expect(bloqueoEnAccesos("moderador", accion)).toMatch(/equipo \(moderador\)/);
    }
    expect(bloqueoEnAccesos("administrador", "reenviar")).toMatch(/contraseña/);
  });
});

const m = (id: string, rol: "administrador" | "moderador", activo = true): MiembroEquipo => ({
  id, email: `${id}@x.com`, nombre: id, rol, activo, telefono: null, ultimoIngreso: null, avisosWhatsapp: false,
});

describe("desactivado", () => {
  it("sin acceso para los permisos, pero sigue siendo del equipo", () => {
    const user = { id: "a", app_metadata: { role: "administrador", desactivado: true } };
    expect(getRol(user as any)).toBeNull();
    expect(rolEquipoDeUsuario(user)).toBe("administrador");
    expect(getRol({ id: "b", app_metadata: { role: "moderador", desactivado: false } } as any)).toBe("moderador");
  });
});

describe("listarMiembros", () => {
  it("solo staff; activos primero, admins arriba, por nombre", () => {
    const users = [
      { id: "z", email: "z@x", app_metadata: { role: "moderador" }, user_metadata: { nombre: "Zoe" } },
      { id: "c", email: "c@x", app_metadata: { role: "cliente" }, user_metadata: {} },
      { id: "b", email: "b@x", app_metadata: { role: "administrador", desactivado: true }, user_metadata: { nombre: "Beto" } },
      { id: "a", email: "a@x", app_metadata: { role: "administrador" }, user_metadata: { nombre: "Ana", apellido: "Paz", telefono: " +54 9 " } },
    ];
    const l = listarMiembros(users as any);
    expect(l.map((x) => x.id)).toEqual(["a", "z", "b"]);
    expect(l[0]).toMatchObject({ nombre: "Ana Paz", telefono: "+54 9", activo: true });
    expect(l[2].activo).toBe(false);
  });
});

describe("validarCambioEquipo", () => {
  const equipo = [m("yo", "administrador"), m("otro", "administrador"), m("mod", "moderador")];
  it("nadie se baja ni se desactiva a sí mismo", () => {
    expect(validarCambioEquipo("yo", equipo[0], { accion: "desactivar" }, equipo)).toMatch(/vos mismo/);
    expect(validarCambioEquipo("yo", equipo[0], { accion: "rol", rol: "moderador" }, equipo)).toMatch(/vos mismo/);
  });
  it("siempre queda un administrador activo", () => {
    const solo = [m("yo", "administrador"), m("otro", "administrador", false), m("mod", "moderador")];
    expect(validarCambioEquipo("mod", solo[0], { accion: "desactivar" }, solo)).toMatch(/al menos un administrador/);
    expect(validarCambioEquipo("yo", equipo[1], { accion: "rol", rol: "moderador" }, equipo)).toBeNull();
    expect(validarCambioEquipo("yo", equipo[1], { accion: "desactivar" }, equipo)).toBeNull();
  });
  it("cambios que no cambian nada", () => {
    expect(validarCambioEquipo("yo", equipo[2], { accion: "rol", rol: "moderador" }, equipo)).toMatch(/Ya es/);
    expect(validarCambioEquipo("yo", equipo[2], { accion: "reactivar" }, equipo)).toMatch(/Ya está activo/);
    expect(validarCambioEquipo("yo", m("x", "moderador", false), { accion: "desactivar" }, equipo)).toMatch(/Ya está desactivado/);
  });
  it("subir a un moderador o reactivar está bien", () => {
    expect(validarCambioEquipo("yo", equipo[2], { accion: "rol", rol: "administrador" }, equipo)).toBeNull();
    expect(validarCambioEquipo("yo", m("x", "moderador", false), { accion: "reactivar" }, equipo)).toBeNull();
  });
});

describe("aviso por WhatsApp", () => {
  it("se activa solo con teléfono, y no se registra como cambio de acceso", () => {
    const sin = m("mod", "moderador");
    const con = { ...sin, telefono: "+54 9 11 5555 0000" };
    expect(parsearCambio({ accion: "whatsapp", activo: true })).toEqual({ accion: "whatsapp", activo: true });
    expect(validarCambioEquipo("yo", sin, { accion: "whatsapp", activo: true }, [sin])).toMatch(/teléfono/);
    expect(validarCambioEquipo("yo", con, { accion: "whatsapp", activo: true }, [con])).toBeNull();
    expect(validarCambioEquipo("mod", sin, { accion: "whatsapp", activo: false }, [sin])).toBeNull();
    expect(metadataDeCambio({ accion: "whatsapp", activo: true })).toEqual({ avisos_whatsapp: true });
    expect(registroDeCambio(con, { accion: "whatsapp", activo: true }, "Ana")).toBeNull();
  });
});

describe("parsearCambio / metadata / registro", () => {
  it("solo acciones válidas", () => {
    expect(parsearCambio({ accion: "rol", rol: "moderador" })).toEqual({ accion: "rol", rol: "moderador" });
    expect(parsearCambio({ accion: "rol", rol: "cliente" })).toBeNull();
    expect(parsearCambio({ accion: "borrar" })).toBeNull();
    expect(parsearCambio(null)).toBeNull();
  });
  it("metadata y registro", () => {
    expect(metadataDeCambio({ accion: "rol", rol: "administrador" })).toEqual({ role: "administrador" });
    expect(metadataDeCambio({ accion: "desactivar" })).toEqual({ desactivado: true });
    expect(metadataDeCambio({ accion: "reactivar" })).toEqual({ desactivado: false });
    expect(registroDeCambio(m("mod", "moderador"), { accion: "rol", rol: "administrador" }, "Ana")).toEqual({
      user_id: "mod", email: "mod@x.com", accion: "rol", rol_antes: "moderador", rol_despues: "administrador", por: "Ana",
    });
  });
});

describe("parsearAlta / mensaje", () => {
  it("valida email, nombre y rol", async () => {
    const { parsearAlta, mensajeAltaEquipo } = await import("@/lib/equipo");
    expect(parsearAlta({ email: " Ana@X.com ", nombre: " Ana ", rol: "moderador" })).toEqual({
      email: "ana@x.com", nombre: "Ana", apellido: "", rol: "moderador", promover: false,
    });
    expect(parsearAlta({ email: "ana", nombre: "Ana", rol: "moderador" })).toEqual({ error: "Email inválido" });
    expect(parsearAlta({ email: "a@x.co", nombre: "", rol: "moderador" })).toEqual({ error: "Falta el nombre" });
    expect(parsearAlta({ email: "a@x.co", nombre: "A", rol: "cliente" })).toEqual({ error: "Rol inválido" });
    expect(parsearAlta({ email: "a@x.co", nombre: "A", rol: "administrador", promover: true })).toMatchObject({ promover: true });
    const msg = mensajeAltaEquipo({ nombre: "Ana", email: "a@x.co", password: "p", urlIngreso: "https://x/ingresar", rol: "moderador" });
    expect(msg).toMatch(/módulo de carga/);
    expect(msg).toMatch(/Contraseña temporal: p/);
  });
});
