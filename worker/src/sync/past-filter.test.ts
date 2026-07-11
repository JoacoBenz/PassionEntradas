import { describe, expect, it } from "vitest";
import { isPastEvent } from "./past-filter.js";

// now fijo: 2026-07-11T15:00:00Z
const NOW = Date.parse("2026-07-11T15:00:00Z");

describe("isPastEvent", () => {
  it("filtra eventos de días anteriores", () => {
    expect(isPastEvent("2026-07-10T20:00:00Z", NOW)).toBe(true);
    expect(isPastEvent("2025-12-01T00:00:00Z", NOW)).toBe(true);
  });

  it("conserva eventos de hoy (la venta puede seguir hasta que arranque)", () => {
    expect(isPastEvent("2026-07-11T00:00:00Z", NOW)).toBe(false);
    expect(isPastEvent("2026-07-11T23:59:00Z", NOW)).toBe(false);
  });

  it("conserva eventos futuros", () => {
    expect(isPastEvent("2026-07-12T00:00:00Z", NOW)).toBe(false);
    expect(isPastEvent("2027-01-01T00:00:00Z", NOW)).toBe(false);
  });

  it("conserva eventos sin fecha (a confirmar)", () => {
    expect(isPastEvent(null, NOW)).toBe(false);
  });
});
