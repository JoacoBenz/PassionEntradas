import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseEventDetail } from "./parser.js";
import { extraerMapaUrl } from "./imagen.js";
import type { PortalEvent } from "./types.js";

// Página REAL capturada de un evento agotado (Manchester United vs Manchester
// City) servida por event_detail_request.php: la tabla de sectores usa la
// MISMA estructura que el book (Category | Zone | Ticket Price | …) y el mapa
// vive en "Ground Pictures". Regresión del bug donde estos eventos quedaban
// como un stub "::REQ" sin categorías ni mapa.
const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, "../../test/fixtures/event_detail_request.html"), "utf8");

const ev: PortalEvent = {
  eventId: "9618",
  titulo: "Manchester United vs Manchester City",
  subCategoria: "English Premier League",
  fechaLista: "2026-09-12T00:00:00.000Z",
  ubicacion: "Old Trafford, Manchester",
  asientos: 0,
  estado: "on_request",
  detailUrl: "https://passioneventsonline.eu/admin/event_detail_request.php?event_id=9618",
};

describe("event_detail_request.php (evento agotado con sectores y mapa)", () => {
  it("parsea las 5 categorías reales, todas on_request sin stock", () => {
    const rows = parseEventDetail(html, ev);
    expect(rows.map((r) => r.categoria)).toEqual(["B", "A", "A Low", "A Low Central", "VIP"]);
    expect(rows.every((r) => r.estado === "on_request")).toBe(true);
    expect(rows.every((r) => (r.stock ?? 0) === 0)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual([
      "9618::33",
      "9618::26",
      "9618::76",
      "9618::373",
      "9618::34",
    ]);
  });

  it("extrae el SVG del mapa de sectores (no un logo ni una foto de tribuna)", () => {
    expect(extraerMapaUrl(html, ev.detailUrl)).toBe(
      "https://passioneventsonline.eu/uploads/seatings/1644587795-old_trafford.svg",
    );
  });
});
