import { beforeAll, describe, expect, it } from "vitest";
import { firmarUsuario, verificarUsuarioFirmado } from "./usuario-firmado";

const U = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "nacho@test",
  app_metadata: { role: "administrador" },
  user_metadata: { nombre: "Ignacio", apellido: "da Silva Ñandú" },
} as any;

describe("usuario firmado (middleware → página)", () => {
  beforeAll(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-prueba";
  });

  it("ida y vuelta: la página recibe el mismo usuario (con acentos)", async () => {
    const h = await firmarUsuario(U);
    const u = await verificarUsuarioFirmado(h);
    expect(u?.id).toBe(U.id);
    expect(u?.email).toBe("nacho@test");
    expect(u?.app_metadata).toEqual({ role: "administrador" });
    expect((u?.user_metadata as any).apellido).toBe("da Silva Ñandú");
  });

  it("un header modificado no vale (ej. cambiar el rol a administrador)", async () => {
    const h = (await firmarUsuario({ ...U, app_metadata: { role: "cliente" } }))!;
    const [cuerpo, firma] = h.split(".");
    const json = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    json.app_metadata.role = "administrador";
    const falso = Buffer.from(JSON.stringify(json)).toString("base64url") + "." + firma;
    expect(await verificarUsuarioFirmado(falso)).toBeNull();
  });

  it("inventado sin la clave, vacío o con basura: no vale", async () => {
    expect(await verificarUsuarioFirmado(null)).toBeNull();
    expect(await verificarUsuarioFirmado("abc.def")).toBeNull();
    expect(await verificarUsuarioFirmado("a.b.c")).toBeNull();
    const otra = await (async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "otra-clave";
      const h = await firmarUsuario(U);
      process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-prueba";
      return h;
    })();
    expect(await verificarUsuarioFirmado(otra)).toBeNull();
  });

  it("vence: no se puede reusar más tarde", async () => {
    const h = await firmarUsuario(U, Date.now() - 120_000);
    expect(await verificarUsuarioFirmado(h)).toBeNull();
  });
});
