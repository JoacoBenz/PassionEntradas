import { describe, expect, it } from "vitest";
import { limpiarParametro, parametrosPlantilla } from "./whatsapp";

// Meta rechaza el envío ENTERO si un parámetro trae un salto de línea, un tab
// o espacios repetidos, y el error que devuelve no dice cuál de los cuatro era.
// Por eso se limpia acá y se testea.
describe("limpiarParametro", () => {
  it("aplana los saltos de línea", () => {
    expect(limpiarParametro("River vs Boca\nPlatea Alta")).toBe("River vs Boca Platea Alta");
  });

  it("aplana tabs y retornos de carro", () => {
    expect(limpiarParametro("a\tb\r\nc")).toBe("a b c");
  });

  it("colapsa los espacios repetidos", () => {
    expect(limpiarParametro("River    vs     Boca")).toBe("River vs Boca");
  });

  it("saca los espacios de los extremos", () => {
    expect(limpiarParametro("  River vs Boca  ")).toBe("River vs Boca");
  });

  it("un valor vacío no puede quedar vacío: Meta lo rechaza", () => {
    expect(limpiarParametro("")).toBe("—");
    expect(limpiarParametro("   \n  ")).toBe("—");
  });

  it("corta los largos con puntos suspensivos", () => {
    const largo = "x".repeat(500);
    const out = limpiarParametro(largo, 50);
    expect(out).toHaveLength(50);
    expect(out.endsWith("…")).toBe(true);
  });

  it("no toca los que ya entran", () => {
    expect(limpiarParametro("Diego Sosa (diego@x.com)")).toBe("Diego Sosa (diego@x.com)");
  });
});

describe("parametrosPlantilla", () => {
  const aviso = {
    cliente: "Diego Sosa (diego@x.com)",
    entradas: 3,
    detalle: "River vs Boca — Platea Alta ×2 · Final — Category 1",
    total: "US$ 1.706",
    texto: "un texto\ncon saltos\nde línea",
  };

  it("devuelve los cuatro parámetros en orden", () => {
    expect(parametrosPlantilla(aviso)).toEqual([
      "Diego Sosa (diego@x.com)",
      "3",
      "River vs Boca — Platea Alta ×2 · Final — Category 1",
      "US$ 1.706",
    ]);
  });

  it("ninguno queda con saltos de línea, venga como venga", () => {
    const sucio = { ...aviso, cliente: "Diego\nSosa", detalle: "a\n\nb\tc" };
    for (const p of parametrosPlantilla(sucio)) {
      expect(p).not.toMatch(/[\r\n\t]/);
      expect(p).not.toMatch(/\s{2,}/);
      expect(p.length).toBeGreaterThan(0);
    }
  });

  it("el texto largo NO se usa como parámetro", () => {
    // Es el del email y el del fallback; meterlo en la plantilla la rompería.
    expect(parametrosPlantilla(aviso).join("|")).not.toContain("saltos");
  });
});
