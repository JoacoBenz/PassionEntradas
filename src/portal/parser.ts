import { parse, type HTMLElement } from "node-html-parser";
import { parseInt0, parseMoney, type PortalEvent, type RawTicketInput } from "./types.js";

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  ÚNICO PUNTO DE ACOPLAMIENTO CON EL PORTAL (Passion Events Booking System).│
 * │  Adaptado a la estructura REAL capturada del admin:                        │
 * │   - event_list.php      -> tabla de eventos (Title|SubCat|Start|Location|  │
 * │                            Available Seats|Action).                        │
 * │   - event_detail.php    -> "Book" (con precio): tabla de sectores con      │
 * │                            inputs hidden seat_cat_id[]/unit_price[]/        │
 * │                            available_seats[].                              │
 * │   - event_detail_request.php -> "On Request" (sin precio, contacto).       │
 * │  Si cambia el layout, se arregla acá (y en los fixtures de test).          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Selectores del flujo de login/sesión. TODO: confirmar contra la página real de login. */
export const PORTAL_SELECTORS = {
  userInput:
    'input[name="username"], input[name="user"], input[name="login"], input[name="email"], input[type="text"]',
  passInput: 'input[name="password"], input[name="pass"], input[type="password"]',
  submit: '#button, input[type="submit"], button[type="submit"]',
  /** Algo que SOLO existe estando logueado (el menú de agente / logout). */
  loggedInMarker: 'a[href*="logout"], a[href*="event_list.php"]',
  /** Marcadores de captcha / MFA. Si aparece -> NO evadir. */
  challengeMarker:
    '.g-recaptcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], #captcha, [data-mfa], input[name="otp"]',
} as const;

const clean = (s: string | undefined | null): string =>
  (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

/**
 * Normaliza fechas del portal a ISO. Maneja:
 *   "Wed, 01-07-2026"            -> 2026-07-01T00:00:00.000Z
 *   "Sun, 19/07/2026 15:00"      -> 2026-07-19T15:00:00.000Z
 * El portal no expone zona horaria; se interpreta como UTC (determinístico).
 */
export function parsePortalDate(input: unknown): string | null {
  if (input == null) return null;
  const s = String(input)
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[A-Za-z]{2,4},?\s*/, ""); // saca el día de semana ("Sun, ")
  const m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const dd = m[1]!,
    mm = m[2]!,
    yyyy = m[3]!,
    hh = m[4] ?? "0",
    min = m[5] ?? "0";
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ¿El HTML corresponde a una sesión logueada? */
export function isLoggedInHtml(html: string): boolean {
  return parse(html).querySelector(PORTAL_SELECTORS.loggedInMarker) !== null;
}

/** ¿Hay captcha/MFA/verificación? (señal de bloqueo: no se evade) */
export function isChallengeHtml(html: string): boolean {
  if (parse(html).querySelector(PORTAL_SELECTORS.challengeMarker)) return true;
  const lower = html.toLowerCase();
  return lower.includes("recaptcha") || lower.includes("hcaptcha");
}

const absUrl = (href: string, baseUrl: string): string => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

// ──────────────────────────────────────────────────────────────────────────
// LISTA: event_list.php
// ──────────────────────────────────────────────────────────────────────────

/** Encuentra la tabla cuya fila de cabecera contiene los textos dados. */
function findTableByHeader(root: HTMLElement, ...needles: string[]): HTMLElement | null {
  for (const t of root.querySelectorAll("table")) {
    const head = clean(t.querySelector("tr")?.text).toLowerCase();
    if (needles.every((n) => head.includes(n))) return t;
  }
  return null;
}

/**
 * Parsea event_list.php -> eventos. El tipo se infiere de la URL del link:
 *   event_detail.php          -> "book" (tiene precio)
 *   event_detail_request.php  -> "on_request" (sin precio)
 */
export function parseEventList(html: string, baseUrl: string): PortalEvent[] {
  const root = parse(html);
  const table = findTableByHeader(root, "available seats", "action");
  if (!table) return [];

  const out: PortalEvent[] = [];
  for (const tr of table.querySelectorAll("tr")) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 6) continue;

    const hrefs = tr
      .querySelectorAll("a")
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => /event_id=/.test(h));
    if (hrefs.length === 0) continue; // fila de cabecera (links de sort, sin event_id)

    const bookHref = hrefs.find((h) => /event_detail\.php/i.test(h));
    const reqHref = hrefs.find((h) => /event_detail_request\.php/i.test(h));
    const href = bookHref ?? reqHref ?? hrefs[0]!;
    const idMatch = href.match(/event_id=(\d+)/);
    if (!idMatch) continue;

    out.push({
      eventId: idMatch[1]!,
      titulo: clean(tds[0]!.text),
      subCategoria: clean(tds[1]!.text) || null,
      fechaLista: parsePortalDate(tds[2]!.text),
      ubicacion: clean(tds[3]!.text) || null,
      asientos: parseInt0(tds[4]!.text),
      estado: bookHref ? "book" : "on_request",
      detailUrl: absUrl(href, baseUrl),
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// DETALLE: event_detail.php (Book) -> un RawTicketInput por sector.
// ──────────────────────────────────────────────────────────────────────────

function inputByName(row: HTMLElement, prefix: string): HTMLElement | undefined {
  return row.querySelectorAll("input").find((i) => (i.getAttribute("name") ?? "").startsWith(prefix));
}
function inputByClass(row: HTMLElement, cls: string): HTMLElement | undefined {
  return row.querySelectorAll("input").find((i) => (i.getAttribute("class") ?? "").includes(cls));
}

/** Enriquece fecha/ciudad desde la tabla "Event Information". */
function readEventInfo(root: HTMLElement): { fecha: string | null; ciudad: string | null } {
  let fecha: string | null = null;
  let ciudad: string | null = null;
  for (const t of root.querySelectorAll("table")) {
    for (const tr of t.querySelectorAll("tr")) {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 2) continue;
      const label = clean(tds[0]!.text).toLowerCase();
      const val = clean(tds[1]!.text);
      if (label.includes("start date")) {
        const d = parsePortalDate(val);
        if (d) fecha = d;
      } else if (label.includes("venue")) {
        if (val) ciudad = val;
      }
    }
  }
  return { fecha, ciudad };
}

/**
 * Clasifica una página de detalle según lo que devuelve el portal (que NO
 * siempre coincide con el link de la lista: hay "book" que en realidad son
 * On Request, y links que llevan a Servicios Extra):
 *   - "book"       -> tiene tabla de sectores (inputs seat_cat_id[...]).
 *   - "on_request" -> es un evento real (Event Information) pero SIN sectores
 *                     bookeables: solo se puede pedir por consulta.
 *   - "other"      -> ni evento ni sectores (p. ej. Servicios Extra / merch).
 */
export function classifyDetail(html: string): "book" | "on_request" | "other" {
  if (/name=["']?seat_cat_id/i.test(html)) return "book";
  if (/Event Information/i.test(html)) return "on_request";
  return "other";
}

/**
 * Parsea event_detail.php (book) o event_detail_request.php (on_request) -> un
 * RawTicketInput por sector/categoría. Ambas páginas usan la MISMA tabla de
 * sectores con inputs hidden (seat_cat_id[]/unit_price[]/available_seats[]);
 * solo cambia la acción (comprar vs "Request").
 *
 * Estado de cada sector:
 *   - evento On Request (link request)  -> "on_request" SIEMPRE (precio visible,
 *     pero la compra es por consulta).
 *   - evento Book con stock 0           -> "on_request" (agotado: por consulta).
 *   - evento Book con stock > 0         -> "book" (reservable directo).
 * El precio se conserva siempre que el portal lo publique (lo hace en ambas).
 */
export function parseEventDetail(html: string, ev: PortalEvent): RawTicketInput[] {
  const root = parse(html);
  const info = readEventInfo(root);
  const fecha = info.fecha ?? ev.fechaLista;
  const ciudad = info.ciudad ?? ev.ubicacion;

  const table = findTableByHeader(root, "ticket price", "category");
  if (!table) return [];

  const out: RawTicketInput[] = [];
  for (const tr of table.querySelectorAll("tr")) {
    const catIdInput = inputByName(tr, "seat_cat_id");
    if (!catIdInput) continue; // cabecera u otra fila
    const catId = catIdInput.getAttribute("value") ?? "";
    if (!catId) continue;

    const tds = tr.querySelectorAll("td");
    const priceInput = inputByClass(tr, "unit_price") ?? inputByName(tr, "unit_price");
    const seatsInput = inputByClass(tr, "available_qty") ?? inputByName(tr, "available_seats");

    const precio = priceInput
      ? parseMoney(priceInput.getAttribute("value"))
      : parseMoney(tds[2]?.text);
    const stock = seatsInput
      ? parseInt0(seatsInput.getAttribute("value"))
      : parseInt0(tds[3]?.text);

    const sinStock = (stock ?? 0) <= 0;
    const esConsulta = ev.estado === "on_request" || sinStock;
    out.push({
      id: `${ev.eventId}::${catId}`,
      evento: ev.titulo,
      competicion: ev.subCategoria,
      fecha,
      ciudad,
      categoria: clean(tds[0]?.text) || null,
      precio_origen: precio,
      moneda_origen: "EUR",
      stock,
      disponible: !esConsulta,
      url_origen: ev.detailUrl,
      estado: esConsulta ? "on_request" : "book",
    });
  }
  return out;
}

/** Construye la fila de un evento "On Request" (sin precio, contacto). */
export function buildOnRequestRow(ev: PortalEvent): RawTicketInput {
  return {
    id: `${ev.eventId}::REQ`,
    evento: ev.titulo,
    competicion: ev.subCategoria,
    fecha: ev.fechaLista,
    ciudad: ev.ubicacion,
    categoria: null,
    precio_origen: null,
    moneda_origen: "EUR",
    stock: ev.asientos ?? 0,
    disponible: false,
    url_origen: ev.detailUrl,
    estado: "on_request",
  };
}
