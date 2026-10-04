import { describe, expect, it } from "vitest";
import { limpiarTextoPago, textoPagoDe, TEXTO_PAGO_MAX } from "./textos";

describe("textos de pago", () => {
  it("recorta y normaliza saltos de línea", () => {
    expect(limpiarTextoPago("  Alias X\r\nCBU 123  ")).toBe("Alias X\nCBU 123");
  });
  it("vacío borra; no-string o demasiado largo se rechaza", () => {
    expect(limpiarTextoPago("   ")).toBe("");
    expect(limpiarTextoPago(3)).toBeNull();
    expect(limpiarTextoPago("x".repeat(TEXTO_PAGO_MAX + 1))).toBeNull();
  });
  it("busca el texto de la moneda del pedido", () => {
    const t = { pago_ARS: "pesos", pago_USD: " " };
    expect(textoPagoDe(t, "ARS")).toBe("pesos");
    expect(textoPagoDe(t, "USD")).toBeNull();
    expect(textoPagoDe(t, null)).toBeNull();
  });
});
