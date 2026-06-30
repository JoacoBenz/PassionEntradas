import { parse } from "node-html-parser";
import { z } from "zod";
import { parseDateIso, parseMoney, type RawTicketInput } from "./types.js";

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  ⚠️  ÚNICO PUNTO DE ACOPLAMIENTO CON EL PORTAL.                            │
 * │                                                                            │
 * │  Toda la lógica/selectores específicos de passioneventsonline.eu viven    │
 * │  ACÁ. Cuando el layout o el endpoint cambien, se arregla SOLO este        │
 * │  archivo (y su fixture en test/fixtures).                                 │
 * │                                                                            │
 * │  Los selectores y la forma del JSON de abajo son REPRESENTATIVOS, basados │
 * │  en patrones típicos de portales de ticketing. Reemplazalos con lo que    │
 * │  capturás vos en DevTools > Network (modo `api`) o inspeccionando el DOM  │
 * │  (modo `playwright`). Los fixtures están hechos a juego para que los      │
 * │  tests validen la MECÁNICA del parser; al cambiar selectores, actualizá   │
 * │  el fixture.                                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Selectores del flujo de login/sesión (modo playwright). TODO: confirmar en el portal. */
export const PORTAL_SELECTORS = {
  loginForm: 'form[action*="login"], #login-form, form#loginForm',
  userInput: 'input[name="email"], input[name="username"], input[type="email"], #username',
  passInput: 'input[name="password"], input[type="password"], #password',
  submit: 'button[type="submit"], input[type="submit"], button#login',
  /** Algo que SOLO existe estando logueado. */
  loggedInMarker: 'a[href*="logout"], .user-menu, [data-logged-in="true"]',
  /** Marcadores de captcha / MFA / verificación. Si aparece -> NO evadir. */
  challengeMarker:
    '.g-recaptcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], #captcha, [data-mfa], input[name="otp"]',
  /** Contenedor de la grilla de eventos (modo playwright). */
  eventCard: ".event-card, article.event",
} as const;

/**
 * Paths a recorrer en modo playwright (relativos a PE_BASE_URL).
 * TODO: ajustar a las categorías/deportes que realmente querés sincronizar.
 */
export const LISTING_PATHS: string[] = ["/events", "/events?sport=football", "/events?sport=f1"];

/** Construye un id estable a partir de evento + categoría/sector. */
export function buildId(eventId: string, categoryId: string): string {
  return `${eventId}::${categoryId}`;
}

/** ¿El HTML corresponde a una sesión logueada? */
export function isLoggedInHtml(html: string): boolean {
  const root = parse(html);
  return root.querySelector(PORTAL_SELECTORS.loggedInMarker) !== null;
}

/** ¿Hay captcha/MFA/verificación en la página? (señal de bloqueo) */
export function isChallengeHtml(html: string): boolean {
  const root = parse(html);
  if (root.querySelector(PORTAL_SELECTORS.challengeMarker)) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes("recaptcha") ||
    lower.includes("hcaptcha") ||
    lower.includes("verifica que no eres un robot") ||
    lower.includes("verify you are human")
  );
}

const txt = (s: string | undefined | null): string => (s ?? "").replace(/\s+/g, " ").trim();

// ──────────────────────────────────────────────────────────────────────────
// CAMINO A (preferido): endpoint JSON interno (XHR/fetch).
// ──────────────────────────────────────────────────────────────────────────

/** Forma laxa del envelope JSON del portal. Ajustar a la real. */
const ApiCategory = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().optional(),
  price: z.unknown().optional(),
  currency: z.string().optional(),
  available: z.unknown().optional(),
  stock: z.unknown().optional(),
  soldOut: z.boolean().optional(),
  url: z.string().optional(),
});

const ApiEvent = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().optional(),
  title: z.string().optional(),
  competition: z.string().optional(),
  startDate: z.union([z.string(), z.number()]).optional(),
  date: z.union([z.string(), z.number()]).optional(),
  city: z.string().optional(),
  venueCity: z.string().optional(),
  url: z.string().optional(),
  categories: z.array(ApiCategory).default([]),
  tickets: z.array(ApiCategory).default([]),
});

const ApiEnvelope = z.union([
  z.object({ events: z.array(ApiEvent) }),
  z.object({ data: z.array(ApiEvent) }),
  z.array(ApiEvent),
]);

function toStockAndAvail(c: z.infer<typeof ApiCategory>): {
  stock: number | null;
  disponible: boolean;
} {
  const rawStock = c.stock ?? c.available;
  let stock: number | null = null;
  if (typeof rawStock === "number" && Number.isFinite(rawStock)) stock = Math.trunc(rawStock);
  else if (typeof rawStock === "string") {
    const n = parseInt(rawStock.replace(/[^\d]/g, ""), 10);
    stock = Number.isFinite(n) ? n : null;
  }
  const disponible = c.soldOut === true ? false : stock == null ? true : stock > 0;
  return { stock, disponible };
}

/**
 * Parsea la respuesta JSON del endpoint interno a RawTicketInput[].
 * Devuelve [] si el envelope no matchea (se loguea aguas arriba como sync vacío).
 */
export function parseApiResponse(raw: unknown): RawTicketInput[] {
  const parsed = ApiEnvelope.safeParse(raw);
  if (!parsed.success) return [];
  const events = Array.isArray(parsed.data)
    ? parsed.data
    : "events" in parsed.data
      ? parsed.data.events
      : parsed.data.data;

  const out: RawTicketInput[] = [];
  for (const ev of events) {
    const evento = txt(ev.name ?? ev.title);
    if (!evento) continue;
    const fecha = parseDateIso(ev.startDate ?? ev.date ?? null);
    const cats = [...ev.categories, ...ev.tickets];
    for (const c of cats) {
      const precio = parseMoney(c.price ?? null);
      const { stock, disponible } = toStockAndAvail(c);
      out.push({
        id: buildId(ev.id, c.id),
        evento,
        competicion: ev.competition ?? null,
        fecha,
        ciudad: ev.city ?? ev.venueCity ?? null,
        categoria: txt(c.name) || null,
        precio_origen: precio,
        moneda_origen: c.currency ?? "EUR",
        stock,
        disponible,
        url_origen: c.url ?? ev.url ?? null,
      });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// CAMINO B (fallback): HTML renderizado (modo playwright -> page.content()).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Parsea el HTML de un listado a RawTicketInput[].
 * Estructura esperada (REEMPLAZAR por la real):
 *
 *   <article class="event-card" data-event-id="evt-1">
 *     <h3 class="event-title">FC Barcelona vs Real Madrid</h3>
 *     <span class="event-competition">LaLiga</span>
 *     <time class="event-date" datetime="2026-04-21T20:00:00Z">...</time>
 *     <span class="event-city">Barcelona</span>
 *     <ul class="ticket-categories">
 *       <li class="ticket-row" data-category-id="cat-A">
 *         <span class="cat-name">Categoría 1</span>
 *         <span class="cat-price">€ 350,00</span>
 *         <span class="cat-stock" data-stock="12">12 disponibles</span>
 *         <a class="cat-link" href="/events/evt-1/cat-A">Ver</a>
 *       </li>
 *     </ul>
 *   </article>
 */
export function parseListingHtml(html: string, baseUrl?: string): RawTicketInput[] {
  const root = parse(html);
  const out: RawTicketInput[] = [];

  for (const card of root.querySelectorAll(".event-card")) {
    const eventId =
      card.getAttribute("data-event-id") ?? card.getAttribute("id") ?? "";
    const evento = txt(card.querySelector(".event-title")?.text);
    if (!eventId || !evento) continue;

    const competicion = txt(card.querySelector(".event-competition")?.text) || null;
    const dateEl = card.querySelector(".event-date");
    const fecha = parseDateIso(dateEl?.getAttribute("datetime") ?? txt(dateEl?.text) ?? null);
    const ciudad = txt(card.querySelector(".event-city")?.text) || null;

    for (const row of card.querySelectorAll(".ticket-row")) {
      const categoryId =
        row.getAttribute("data-category-id") ?? row.getAttribute("id") ?? "";
      if (!categoryId) continue;

      const categoria = txt(row.querySelector(".cat-name")?.text) || null;
      const precio = parseMoney(row.querySelector(".cat-price")?.text ?? null);

      const stockEl = row.querySelector(".cat-stock");
      const stockAttr = stockEl?.getAttribute("data-stock");
      let stock: number | null = null;
      if (stockAttr != null && stockAttr !== "") {
        const n = parseInt(stockAttr, 10);
        stock = Number.isFinite(n) ? n : null;
      }
      const soldOut =
        row.classList.contains("sold-out") ||
        /agotado|sold\s*out/i.test(txt(stockEl?.text));
      const disponible = soldOut ? false : stock == null ? true : stock > 0;

      const href = row.querySelector(".cat-link")?.getAttribute("href") ?? null;
      const url_origen = href && baseUrl ? new URL(href, baseUrl).toString() : href;

      out.push({
        id: buildId(eventId, categoryId),
        evento,
        competicion,
        fecha: fecha || null,
        ciudad,
        categoria,
        precio_origen: precio,
        moneda_origen: "EUR",
        stock,
        disponible,
        url_origen,
      });
    }
  }
  return out;
}
