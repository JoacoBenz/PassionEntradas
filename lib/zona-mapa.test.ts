import { describe, expect, it } from "vitest";
import { zonaDelMapa } from "./tickets";

// La columna "Zone" del portal llega sin formato garantizado: puede ser un hex,
// un color en inglés o castellano, o el nombre de la zona. El agente tiene que
// poder mirar el mapa (que ya viene pintado) y saber cuál es su sector, así que
// el texto SIEMPRE se conserva; el color es un extra cuando se puede deducir.
describe("zonaDelMapa", () => {
  it("sin valor no hay chip", () => {
    expect(zonaDelMapa(null)).toBeNull();
    expect(zonaDelMapa(undefined)).toBeNull();
    expect(zonaDelMapa("")).toBeNull();
    expect(zonaDelMapa("   ")).toBeNull();
  });

  it("un hex se pinta y NO se muestra como texto", () => {
    // "#E4572E" no le dice nada a nadie: el agente mira el círculo y lo busca
    // en el mapa. El valor crudo queda para el title.
    expect(zonaDelMapa("#e4572e")).toEqual({ texto: null, color: "#e4572e", crudo: "#E4572E" });
    expect(zonaDelMapa("#abc")).toEqual({ texto: null, color: "#abc", crudo: "#ABC" });
  });

  it("un color en inglés se pinta tal cual", () => {
    expect(zonaDelMapa("red")).toEqual({ texto: "red", color: "red", crudo: "red" });
  });

  it("un color en castellano se traduce a CSS pero conserva el texto original", () => {
    // CSS no entiende "verde": si no se tradujera, el punto quedaría sin color.
    expect(zonaDelMapa("verde")).toEqual({ texto: "verde", color: "green", crudo: "verde" });
    expect(zonaDelMapa("Azul")).toEqual({ texto: "Azul", color: "blue", crudo: "Azul" });
  });

  it("un nombre con el color adentro también se pinta", () => {
    expect(zonaDelMapa("Zona Roja")).toEqual({ texto: "Zona Roja", color: "red", crudo: "Zona Roja" });
    expect(zonaDelMapa("Sector Azul")).toEqual({ texto: "Sector Azul", color: "blue", crudo: "Sector Azul" });
  });

  it("un nombre sin color se muestra sin punto", () => {
    expect(zonaDelMapa("Tribuna Alta")).toEqual({
      texto: "Tribuna Alta",
      color: null,
      crudo: "Tribuna Alta",
    });
  });

  it("los espacios sobrantes no cuentan", () => {
    expect(zonaDelMapa("  Tribuna Alta  ")).toEqual({
      texto: "Tribuna Alta",
      color: null,
      crudo: "Tribuna Alta",
    });
  });

  it("un hex inválido no se pinta, pero el texto sigue estando", () => {
    // Un valor raro no puede romper la fila: peor que un punto sin color es
    // que el agente no sepa qué zona mirar.
    expect(zonaDelMapa("#zzzz")).toEqual({ texto: "#zzzz", color: null, crudo: "#zzzz" });
  });
});

// Regresión: la lista tenía "rojo" pero no "roja", así que "Zona Roja" —el
// caso que el propio comentario del código ponía de ejemplo— quedaba sin
// pintar. Los colores que concuerdan en género van en las dos formas.
describe("zonaDelMapa — género del color", () => {
  const casos: [string, string][] = [
    ["Zona Roja", "red"],
    ["Sector Rojo", "red"],
    ["Zona Amarilla", "yellow"],
    ["Sector Amarillo", "yellow"],
    ["Zona Blanca", "white"],
    ["Sector Blanco", "white"],
    ["Zona Negra", "black"],
    ["Sector Negro", "black"],
    ["Zona Gris", "gray"],
  ];
  for (const [texto, color] of casos) {
    it(`"${texto}" se pinta ${color}`, () => {
      expect(zonaDelMapa(texto)).toEqual({ texto, color, crudo: texto });
    });
  }
});
