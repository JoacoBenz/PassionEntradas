import { describe, expect, it } from "vitest";
import { fmtArsFactura, parseCotizacion } from "./factura";

describe("parseCotizacion", () => {
  it("entiende las formas en que un admin tipea el dólar", () => {
    expect(parseCotizacion("1465")).toBe(1465);
    expect(parseCotizacion("1465.5")).toBe(1465.5);
    expect(parseCotizacion("1465,50")).toBe(1465.5);
    expect(parseCotizacion("1.465")).toBe(1465); // punto de miles
    expect(parseCotizacion("1.465,50")).toBe(1465.5);
    expect(parseCotizacion("1,465.50")).toBe(1465.5);
    expect(parseCotizacion("$ 1.465,50")).toBe(1465.5);
    expect(parseCotizacion("AR$1465")).toBe(1465);
    expect(parseCotizacion(1465.456)).toBe(1465.46);
  });

  it("rechaza lo que no es una cotización razonable", () => {
    expect(parseCotizacion("")).toBeNull();
    expect(parseCotizacion("abc")).toBeNull();
    expect(parseCotizacion("0")).toBeNull();
    expect(parseCotizacion("-1465")).toBeNull();
    expect(parseCotizacion("1.465.000")).toBeNull(); // un millón: typo
    expect(parseCotizacion("1,2,3")).toBeNull();
    expect(parseCotizacion(null)).toBeNull();
    expect(parseCotizacion(undefined)).toBeNull();
  });
});

describe("fmtArsFactura", () => {
  it("formatea según el idioma de la factura", () => {
    expect(fmtArsFactura(1465.5, "en")).toBe("AR$ 1,465.50");
    expect(fmtArsFactura(1465.5, "es")).toBe("AR$ 1.465,50");
  });
});
