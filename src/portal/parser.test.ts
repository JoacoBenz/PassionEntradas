import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseApiResponse, parseListingHtml, buildId } from "./parser.js";
import { RawTicketSchema } from "./types.js";

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url)), "utf8");

describe("parseApiResponse (camino A: JSON interno)", () => {
  const items = parseApiResponse(JSON.parse(fixture("portal-api.json")));

  it("aplana eventos x categorías a 3 tickets", () => {
    expect(items).toHaveLength(3);
  });

  it("mapea precios, stock y disponibilidad (incluye soldOut y precio string)", () => {
    const a = items.find((t) => t.id === buildId("evt-1", "cat-A"));
    expect(a).toMatchObject({
      evento: "FC Barcelona vs Real Madrid",
      competicion: "LaLiga",
      ciudad: "Barcelona",
      precio_origen: 350,
      stock: 12,
      disponible: true,
    });

    const b = items.find((t) => t.id === buildId("evt-1", "cat-B"));
    expect(b).toMatchObject({ precio_origen: 220, stock: 0, disponible: false });

    // evt-2 usa title/date/venueCity/tickets y price string "€ 480,00", stock "5 disponibles"
    const g = items.find((t) => t.id === buildId("evt-2", "cat-G"));
    expect(g).toMatchObject({
      evento: "Gran Premio de España F1",
      precio_origen: 480,
      stock: 5,
      disponible: true,
    });
    expect(g?.fecha).toBe("2026-06-14T13:00:00.000Z");
  });

  it("todo lo extraído pasa la validación zod", () => {
    for (const it of items) expect(RawTicketSchema.safeParse(it).success).toBe(true);
  });

  it("devuelve [] ante un envelope desconocido", () => {
    expect(parseApiResponse({ nope: true })).toEqual([]);
    expect(parseApiResponse(null)).toEqual([]);
  });
});

describe("parseListingHtml (camino B: HTML renderizado)", () => {
  const items = parseListingHtml(fixture("portal-list.html"), "https://passioneventsonline.eu/");

  it("extrae 3 tickets de 2 eventos", () => {
    expect(items).toHaveLength(3);
  });

  it("parsea precio europeo, stock y URL absoluta", () => {
    const a = items.find((t) => t.id === buildId("evt-1", "cat-A"));
    expect(a).toMatchObject({
      evento: "FC Barcelona vs Real Madrid",
      precio_origen: 350,
      stock: 12,
      disponible: true,
      url_origen: "https://passioneventsonline.eu/events/evt-1/cat-A",
    });
    expect(a?.fecha).toBe("2026-04-21T20:00:00.000Z");
  });

  it("marca no disponible la fila sold-out", () => {
    const b = items.find((t) => t.id === buildId("evt-1", "cat-B"));
    expect(b?.disponible).toBe(false);
    expect(b?.precio_origen).toBe(220);
  });

  it("todo lo extraído pasa la validación zod", () => {
    for (const it of items) expect(RawTicketSchema.safeParse(it).success).toBe(true);
  });
});
