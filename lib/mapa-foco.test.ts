import { describe, expect, it } from "vitest";
import { capaDeFoco, colorDeZona, deltaE, hexARgb, mascaraDeZona, paletaDelMapa, similitud, type Rgb } from "./mapa-foco";

// Mapa sintético: fondo blanco (60 %), una zona roja (20 %) y una azul (20 %),
// con un "número" blanco adentro de la roja.
function mapa(ancho = 50, alto = 20, ruido = 0) {
  const data = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const o = (y * ancho + x) * 4;
      let c: Rgb = [255, 255, 255];
      if (x < 10) c = [191, 25, 31]; // rojo
      else if (x < 20) c = [31, 95, 191]; // azul
      if (x === 4 && y === 10) c = [255, 255, 255]; // número adentro de la zona
      const n = ruido ? ((x * 7 + y * 13) % (2 * ruido + 1)) - ruido : 0;
      data[o] = c[0] + n;
      data[o + 1] = c[1] + n;
      data[o + 2] = c[2] + n;
      data[o + 3] = 255;
    }
  }
  return { data, ancho, alto };
}

describe("colores", () => {
  it("hexa a RGB", () => {
    expect(hexARgb("#BF191F")).toEqual([191, 25, 31]);
    expect(hexARgb("e57")).toEqual([238, 85, 119]);
    expect(hexARgb("Zona Roja")).toBeNull();
    expect(hexARgb(null)).toBeNull();
  });
  it("ΔE: igual es 0, parecido es poco, distinto es mucho", () => {
    expect(deltaE([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(deltaE([191, 25, 31], [195, 28, 33])).toBeLessThan(3);
    expect(deltaE([191, 25, 31], [31, 95, 191])).toBeGreaterThan(50);
    expect(similitud([191, 25, 31], [191, 25, 31])).toBe(1);
  });
});

describe("colorDeZona", () => {
  const { data, ancho, alto } = mapa();
  const paleta = paletaDelMapa(data, ancho, alto);
  it("encuentra la zona cuando el color coincide ≥ 90 %", () => {
    expect(colorDeZona(paleta, "#BF191F")).toEqual([191, 25, 31]);
    // Un poco distinto (el portal y el dibujo no siempre son idénticos).
    expect(colorDeZona(paleta, "#C21C22")).toEqual([191, 25, 31]);
  });
  it("no marca nada si el color no está en el mapa", () => {
    expect(colorDeZona(paleta, "#F2B705")).toBeNull();
    expect(colorDeZona(paleta, "verde")).toBeNull();
  });
  it("no marca el fondo aunque coincida", () => {
    expect(colorDeZona(paleta, "#FFFFFF")).toBeNull();
  });
  it("aguanta el ruido de un JPG", () => {
    const sucio = mapa(50, 20, 4);
    expect(colorDeZona(paletaDelMapa(sucio.data, sucio.ancho, sucio.alto), "#1F5FBF")).not.toBeNull();
  });
});

describe("mascaraDeZona / capaDeFoco", () => {
  const { data, ancho, alto } = mapa();
  it("marca la zona y tapa el número de adentro", () => {
    const sinEngordar = mascaraDeZona(data, ancho, alto, [191, 25, 31], 0);
    expect(sinEngordar[10 * ancho + 4]).toBe(0);
    const m = mascaraDeZona(data, ancho, alto, [191, 25, 31], 1);
    expect(m[10 * ancho + 4]).toBe(1);
    expect(m[10 * ancho + 2]).toBe(1);
    expect(m[10 * ancho + 30]).toBe(0);
  });
  it("oscurece afuera, deja la zona limpia y le pone borde", () => {
    const m = mascaraDeZona(data, ancho, alto, [191, 25, 31], 0);
    const capa = capaDeFoco(m, ancho, alto);
    const px = (x: number, y: number) => Array.from(capa.slice((y * ancho + x) * 4, (y * ancho + x) * 4 + 4));
    expect(px(30, 10)[3]).toBeGreaterThan(100); // afuera: oscuro
    expect(px(2, 10)).toEqual([0, 0, 0, 0]); // adentro: transparente
    expect(px(9, 10)).toEqual([255, 255, 255, 255]); // borde
  });
});
