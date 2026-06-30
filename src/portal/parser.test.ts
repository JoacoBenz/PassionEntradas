import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildOnRequestRow,
  parseEventDetail,
  parseEventList,
  parsePortalDate,
} from "./parser.js";
import { RawTicketSchema, type PortalEvent } from "./types.js";

const BASE = "https://passioneventsonline.eu/admin/";
const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url)), "utf8");

describe("parsePortalDate", () => {
  it("parsea formato lista (DD-MM-YYYY) y detalle (DD/MM/YYYY HH:mm)", () => {
    expect(parsePortalDate("Wed, 01-07-2026")).toBe("2026-07-01T00:00:00.000Z");
    expect(parsePortalDate("Sun, 19/07/2026 15:00")).toBe("2026-07-19T15:00:00.000Z");
    expect(parsePortalDate("basura")).toBeNull();
  });
});

describe("parseEventList (event_list.php)", () => {
  const events = parseEventList(fixture("event_list.html"), BASE);

  it("extrae 4 eventos (2 on_request + 2 book)", () => {
    expect(events).toHaveLength(4);
    expect(events.filter((e) => e.estado === "book")).toHaveLength(2);
    expect(events.filter((e) => e.estado === "on_request")).toHaveLength(2);
  });

  it("clasifica book vs on_request por la URL del link", () => {
    const book = events.find((e) => e.eventId === "9044")!;
    expect(book.estado).toBe("book");
    expect(book.titulo).toBe("Match 104 - World Cup Final");
    expect(book.asientos).toBe(34);
    expect(book.fechaLista).toBe("2026-07-19T00:00:00.000Z");
    expect(book.detailUrl).toContain("event_detail.php?event_id=9044");

    const req = events.find((e) => e.eventId === "9022")!;
    expect(req.estado).toBe("on_request");
    expect(req.asientos).toBe(0);
    expect(req.detailUrl).toContain("event_detail_request.php?event_id=9022");
  });
});

describe("parseEventDetail (event_detail.php, Book)", () => {
  const ev: PortalEvent = {
    eventId: "9044",
    titulo: "Match 104 - World Cup Final",
    subCategoria: "World Cup 2026 Canada / Mexico / USA",
    fechaLista: "2026-07-19T00:00:00.000Z",
    ubicacion: "New York New Jersey Stadium, East Rutherford (USA)",
    asientos: 34,
    estado: "book",
    detailUrl: `${BASE}event_detail.php?event_id=9044`,
  };
  const sectors = parseEventDetail(fixture("event_detail.html"), ev);

  it("genera un ticket por sector (3) con id estable evento::catId", () => {
    expect(sectors.map((s) => s.id)).toEqual(["9044::494", "9044::502", "9044::495"]);
  });

  it("toma precio y stock de los inputs hidden", () => {
    expect(sectors.map((s) => s.precio_origen)).toEqual([10000, 11500, 12000]);
    expect(sectors.every((s) => s.stock === 4 && s.disponible === true)).toBe(true);
  });

  it("nombres de sector y fecha/ciudad enriquecidas del detalle", () => {
    expect(sectors[0]!.categoria).toBe("WC Cat 3/4");
    expect(sectors[1]!.categoria).toBe("WC Cat 3/4 (4-pack guarantee)");
    // fecha con hora del detalle (no la de la lista)
    expect(sectors[0]!.fecha).toBe("2026-07-19T15:00:00.000Z");
    expect(sectors[0]!.ciudad).toBe("New York New Jersey Stadium, East Rutherford (USA)");
  });

  it("todo lo extraído pasa la validación zod", () => {
    for (const s of sectors) expect(RawTicketSchema.safeParse(s).success).toBe(true);
  });
});

describe("buildOnRequestRow", () => {
  const row = buildOnRequestRow({
    eventId: "9022",
    titulo: "Match 80, World Cup - Round of 32 - England vs Congo DR",
    subCategoria: "World Cup 2026 Canada / Mexico / USA",
    fechaLista: "2026-07-01T00:00:00.000Z",
    ubicacion: "Atlanta Stadium, Atlanta (USA)",
    asientos: 0,
    estado: "on_request",
    detailUrl: `${BASE}event_detail_request.php?event_id=9022`,
  });

  it("queda sin precio, no disponible y estado on_request", () => {
    expect(row.precio_origen).toBeNull();
    expect(row.disponible).toBe(false);
    expect(row.estado).toBe("on_request");
    expect(row.id).toBe("9022::REQ");
  });

  it("pasa la validación zod (precio null permitido)", () => {
    expect(RawTicketSchema.safeParse(row).success).toBe(true);
  });
});
