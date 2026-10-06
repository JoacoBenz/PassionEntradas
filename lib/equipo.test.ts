import { describe, expect, it } from "vitest";
import { bloqueoEnAccesos, mapaEquipo, rolEquipoDeUsuario } from "@/lib/equipo";

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
