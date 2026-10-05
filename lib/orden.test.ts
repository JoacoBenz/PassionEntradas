import { describe, expect, it } from "vitest";
import { compararAZ, ordenarAZ } from "./orden";

describe("compararAZ", () => {
  it("no distingue mayúsculas ni tildes", () => {
    const l = ["Zona Norte", "Árbitros", "boca", "River", "Ámsterdam"].sort(compararAZ);
    expect(l).toEqual(["Ámsterdam", "Árbitros", "boca", "River", "Zona Norte"]);
  });
  it("ordena los números como números", () => {
    expect(["Fecha 10", "Fecha 2", "Fecha 1"].sort(compararAZ)).toEqual(["Fecha 1", "Fecha 2", "Fecha 10"]);
  });
  it("ordenarAZ no modifica el arreglo original", () => {
    const orig = [{ n: "b" }, { n: "a" }];
    expect(ordenarAZ(orig, (x) => x.n).map((x) => x.n)).toEqual(["a", "b"]);
    expect(orig[0].n).toBe("b");
  });
});

import { waLink, WHATSAPP_TIENDA } from "./tickets";

describe("waLink", () => {
  it("siempre lleva un destinatario (nunca wa.me/ vacío)", () => {
    expect(WHATSAPP_TIENDA).toMatch(/^\d{10,15}$/);
    expect(waLink("Hola")).toBe(`https://wa.me/${WHATSAPP_TIENDA}?text=Hola`);
    expect(waLink("Hola")).not.toMatch(/wa\.me\/\?/);
  });
});

import { mapaPropioValido } from "./tickets";

describe("mapaPropioValido", () => {
  const nuestro = "https://abcd1234.supabase.co/storage/v1/object/public/mapas/propias/x.png";
  it("acepta solo mapas de nuestro bucket", () => {
    expect(mapaPropioValido(nuestro)).toBe(nuestro);
    expect(mapaPropioValido("https://evil.example.com/x.png")).toBeNull();
    expect(mapaPropioValido("https://abcd1234.supabase.co/storage/v1/object/public/otro/x.png")).toBeNull();
    expect(mapaPropioValido("javascript:alert(1)")).toBeNull();
  });
  it("data URL solo en el demo", () => {
    expect(mapaPropioValido("data:image/png;base64,AAA", true)).toBe("data:image/png;base64,AAA");
    expect(mapaPropioValido("data:image/png;base64,AAA", false)).toBeNull();
  });
});
