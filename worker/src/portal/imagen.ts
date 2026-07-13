import { parse } from "node-html-parser";

/**
 * Extrae la URL del mapa de sectores del detalle de un evento.
 *
 * No tenemos garantía del markup exacto del portal (los fixtures son
 * mínimos), así que se usa una heurística por puntaje sobre los <img> de la
 * página, pensada para fallar en null antes que traer la imagen equivocada:
 *  - Suma: src/alt/id/class con pinta de mapa (map, plan, seat, sector,
 *    venue, stadium, layout, distribution, grada, circuit).
 *  - Resta: pinta de chrome (logo, icon, flag, banner, button, arrow,
 *    header, footer, avatar, captcha).
 *  - Si ningún candidato puntúa positivo pero hay UN solo <img> "neutro"
 *    en la página, se toma ese (los admin PHP viejos suelen tener solo el
 *    mapa como imagen de contenido).
 * Función PURA y testeada. El ciclo la trata como opcional: sin imagen no
 * pasa nada.
 */

const PISTAS_MAPA =
  /(map|plan|seat|sector|venue|stadium|layout|distrib|grada|circuit|arena)/i;
const PISTAS_CHROME =
  /(logo|icon|favicon|flag|banner|button|btn|arrow|spinner|loading|header|footer|avatar|captcha|pixel|spacer|bullet)/i;

export function extraerMapaUrl(html: string, baseUrl: string): string | null {
  const root = parse(html);
  const candidatos: { src: string; puntaje: number }[] = [];

  for (const img of root.querySelectorAll("img")) {
    const src = (img.getAttribute("src") ?? "").trim();
    if (!src || src.startsWith("data:")) continue;

    const señales = [
      src,
      img.getAttribute("alt") ?? "",
      img.getAttribute("id") ?? "",
      img.getAttribute("class") ?? "",
      img.getAttribute("title") ?? "",
    ].join(" ");

    let puntaje = 0;
    if (PISTAS_MAPA.test(señales)) puntaje += 3;
    if (PISTAS_CHROME.test(señales)) puntaje -= 3;

    // Dimensiones declaradas chicas = ícono, no un mapa.
    const w = Number(img.getAttribute("width"));
    const h = Number(img.getAttribute("height"));
    if ((Number.isFinite(w) && w > 0 && w < 100) || (Number.isFinite(h) && h > 0 && h < 100)) {
      puntaje -= 3;
    }

    candidatos.push({ src, puntaje });
  }

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => b.puntaje - a.puntaje);
  const mejor = candidatos[0]!;

  // Con señal positiva, ese. Sin señal, solo si es la ÚNICA imagen neutra.
  const elegido =
    mejor.puntaje > 0
      ? mejor
      : candidatos.length === 1 && mejor.puntaje === 0
        ? mejor
        : null;
  if (!elegido) return null;

  try {
    return new URL(elegido.src, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Content-type -> extensión del archivo en el bucket. */
export function extensionDe(contentType: string | undefined): string | null {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return "jpg";
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/webp")) return "webp";
  if (ct.includes("image/gif")) return "gif";
  if (ct.includes("image/svg")) return "svg";
  return null; // no es una imagen que sepamos servir
}
