// Marcar en el mapa de sectores la zona de una entrada, por color.
//
// Los mapas no tienen coordenadas: solo la imagen, con cada zona pintada de
// un color, y la entrada trae ese color (`zona_color`, hexa). El navegador lee
// los píxeles del mapa, busca el color de la zona y oscurece el resto.
//
// Solo se marca si el mapa tiene ese color de verdad (decisión 4: coincidencia
// ≥ 90 %). Si el color no está, o está en casi todo el mapa (el fondo), queda
// el chip de color de siempre. Funciones puras sobre RGBA: se testean sin
// navegador.

export type Rgb = [number, number, number];
type Lab = [number, number, number];

/** "#E4572E" / "#e57" → [228, 87, 46]; null si no es un hexa. */
export function hexARgb(hex: string | null | undefined): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// sRGB → CIE Lab (D65). La distancia en Lab se parece a la que ve el ojo, a
// diferencia de la distancia en RGB.
function rgbALab([r, g, b]: Rgb): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Diferencia de color ΔE (CIE76): ~2 apenas se nota, 10 es "parecido". */
export function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = rgbALab(a);
  const [l2, a2, b2] = rgbALab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Parecido 0..1 a partir de ΔE: 0,9 = ΔE 10. */
export function similitud(a: Rgb, b: Rgb): number {
  return Math.max(0, 1 - deltaE(a, b) / 100);
}

export const SIMILITUD_MINIMA = 0.9;
// Un color que ocupa más que esto es fondo o campo, no una zona.
const COBERTURA_MAXIMA = 0.4;
// Un color que ocupa menos que esto es ruido (bordes, texto, compresión).
const COBERTURA_MINIMA = 0.002;
// Qué tan lejos del color de la zona puede estar un píxel para ser parte de
// ella (los JPG ensucian los bordes).
const DELTA_PIXEL = 14;

export type ColorDelMapa = { rgb: Rgb; cobertura: number };

/**
 * Los colores con presencia en el mapa: se agrupan los píxeles en cubos de
 * 16 niveles por canal y se queda el promedio de cada cubo con suficientes
 * píxeles. Los transparentes no cuentan.
 */
export function paletaDelMapa(data: Uint8ClampedArray | Uint8Array, ancho: number, alto: number): ColorDelMapa[] {
  const cubos = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i < ancho * alto; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = cubos.get(k);
    if (c) {
      c.r += r;
      c.g += g;
      c.b += b;
      c.n++;
    } else {
      cubos.set(k, { r, g, b, n: 1 });
    }
    total++;
  }
  if (total === 0) return [];
  const out: ColorDelMapa[] = [];
  for (const c of Array.from(cubos.values())) {
    const cobertura = c.n / total;
    if (cobertura < COBERTURA_MINIMA) continue;
    out.push({ rgb: [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)], cobertura });
  }
  return out.sort((a, b) => b.cobertura - a.cobertura);
}

/**
 * El color del mapa que corresponde a la zona, si lo hay con una coincidencia
 * de al menos 90 %. Se devuelve el color REAL del mapa (no el de la entrada):
 * es el que después se busca píxel por píxel.
 */
export function colorDeZona(paleta: ColorDelMapa[], hex: string | null | undefined): Rgb | null {
  const objetivo = hexARgb(hex);
  if (!objetivo) return null;
  let mejor: { rgb: Rgb; s: number; cobertura: number } | null = null;
  for (const c of paleta) {
    const s = similitud(objetivo, c.rgb);
    if (!mejor || s > mejor.s) mejor = { rgb: c.rgb, s, cobertura: c.cobertura };
  }
  if (!mejor || mejor.s < SIMILITUD_MINIMA) return null;
  // Sumando los cubos vecinos del mismo color (un JPG reparte una zona en
  // varios), ¿es fondo?
  const cobertura = paleta
    .filter((c) => deltaE(c.rgb, mejor!.rgb) <= DELTA_PIXEL)
    .reduce((a, c) => a + c.cobertura, 0);
  if (cobertura > COBERTURA_MAXIMA) return null;
  return mejor.rgb;
}

/**
 * Máscara de la zona: 1 donde el píxel es del color de la zona. Se "engorda"
 * `radio` píxeles para tapar los números y las líneas finas dentro de la zona.
 */
export function mascaraDeZona(
  data: Uint8ClampedArray | Uint8Array,
  ancho: number,
  alto: number,
  color: Rgb,
  radio = 2
): Uint8Array {
  const base = new Uint8Array(ancho * alto);
  // Cache por color exacto: los mapas tienen pocos colores distintos.
  const cache = new Map<number, boolean>();
  for (let i = 0; i < ancho * alto; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const k = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    let es = cache.get(k);
    if (es === undefined) {
      es = deltaE([data[o], data[o + 1], data[o + 2]], color) <= DELTA_PIXEL;
      cache.set(k, es);
    }
    if (es) base[i] = 1;
  }
  if (radio <= 0) return base;
  // Dilatación separable (filas y después columnas): cuadrado de lado 2r+1.
  const filas = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (!base[y * ancho + x]) continue;
      for (let dx = -radio; dx <= radio; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < ancho) filas[y * ancho + nx] = 1;
      }
    }
  }
  const out = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (!filas[y * ancho + x]) continue;
      for (let dy = -radio; dy <= radio; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < alto) out[ny * ancho + x] = 1;
      }
    }
  }
  return out;
}

/**
 * La capa que va sobre el mapa (RGBA): todo oscurecido salvo la zona, y un
 * borde claro alrededor de la zona.
 */
export function capaDeFoco(mascara: Uint8Array, ancho: number, alto: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(ancho * alto * 4);
  const en = (x: number, y: number) => x >= 0 && y >= 0 && x < ancho && y < alto && mascara[y * ancho + x] === 1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const o = i * 4;
      if (mascara[i]) {
        // Borde: píxel de la zona con algún vecino afuera.
        if (!en(x - 1, y) || !en(x + 1, y) || !en(x, y - 1) || !en(x, y + 1)) {
          out[o] = 255;
          out[o + 1] = 255;
          out[o + 2] = 255;
          out[o + 3] = 255;
        }
        continue;
      }
      out[o] = 10;
      out[o + 1] = 12;
      out[o + 2] = 20;
      out[o + 3] = 150;
    }
  }
  return out;
}
