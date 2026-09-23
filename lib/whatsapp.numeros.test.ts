import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { codigoDeError, notificarVendedores, variantesNumero } from "./whatsapp";

describe("variantesNumero", () => {
  it("celular de AMBA: primero tal cual, después las formas equivalentes", () => {
    expect(variantesNumero("5491123885910")).toEqual([
      "5491123885910",
      "54111523885910",
      "541123885910",
    ]);
  });

  it("acepta el número con +, espacios y guiones", () => {
    expect(variantesNumero("+54 9 11 2388-5910")[0]).toBe("5491123885910");
  });

  it("interior: prueba código de área de 3 y de 4 dígitos", () => {
    // 351 = Córdoba (3 dígitos)
    expect(variantesNumero("5493511234567")).toEqual([
      "5493511234567",
      "54351151234567",
      "54351115234567",
      "543511234567",
    ]);
  });

  it("si lo cargaron sin el 9, también prueba con el 9", () => {
    expect(variantesNumero("541123885910")).toContain("5491123885910");
  });

  it("otros países: solo el original", () => {
    expect(variantesNumero("34612345678")).toEqual(["34612345678"]);
    expect(variantesNumero("15551234567")).toEqual(["15551234567"]);
  });
});

describe("codigoDeError", () => {
  it("lee el código del cuerpo de error de Meta", () => {
    expect(
      codigoDeError('{"error":{"message":"(#131030) Recipient phone number not in allowed list","code":131030}}')
    ).toBe(131030);
  });
  it("cuerpo vacío o no JSON: null", () => {
    expect(codigoDeError("")).toBeNull();
    expect(codigoDeError("<html>")).toBeNull();
  });
});

describe("envío con números argentinos", () => {
  const aviso = {
    tipo: "un pedido",
    cliente: "Test",
    entradas: 1,
    detalle: "x",
    total: "USD 1",
    texto: "x",
  };
  const rechazo131030 = () =>
    new Response(
      JSON.stringify({ error: { message: "(#131030) Recipient phone number not in allowed list", code: 131030 } }),
      { status: 400 }
    );

  beforeEach(() => {
    vi.stubEnv("WHATSAPP_TOKEN", "t");
    vi.stubEnv("WHATSAPP_PHONE_ID", "123");
    vi.stubEnv("WHATSAPP_TEMPLATE", "nuevo_pedido");
    vi.stubEnv("WHATSAPP_VENDEDORES", "5491123885910");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function destinos(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).to);
  }

  it("el caso de producción: Meta rechaza 549… y acepta la forma con 15", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rechazo131030())
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await notificarVendedores(aviso);

    expect(r).toEqual({ ok: true, enviados: 1 });
    expect(destinos(fetchMock)).toEqual(["5491123885910", "54111523885910"]);
  });

  it("si Meta acepta el número tal cual, no prueba nada más", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await notificarVendedores(aviso)).toEqual({ ok: true, enviados: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un error que no es 131030 no se reintenta (no es el formato)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: { code: 132001 } }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await notificarVendedores(aviso);
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si ninguna forma está permitida, falla con el error de Meta", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => rechazo131030());
    vi.stubGlobal("fetch", fetchMock);

    const r = await notificarVendedores(aviso);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("131030");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
