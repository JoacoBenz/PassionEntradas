import { describe, expect, it } from "vitest";
import { decidePublish } from "./partial-guard.js";

describe("decidePublish (regla anti-borrado)", () => {
  it("aborta si no hay ítems válidos", () => {
    expect(decidePublish({ scrapedValid: 0, baselineAvailable: 100, dropAbortRatio: 0.7 })).toEqual({
      publish: false,
      reason: "zero_items",
    });
  });

  it("primer sync (baseline 0) publica si trajo ítems", () => {
    expect(
      decidePublish({ scrapedValid: 120, baselineAvailable: 0, dropAbortRatio: 0.7 }).publish,
    ).toBe(true);
  });

  it("publica cuando la cantidad se mantiene", () => {
    expect(
      decidePublish({ scrapedValid: 100, baselineAvailable: 100, dropAbortRatio: 0.7 }).publish,
    ).toBe(true);
  });

  it("publica si la caída está dentro del umbral", () => {
    // baseline 100, ratio 0.7 => min permitido 30
    expect(
      decidePublish({ scrapedValid: 35, baselineAvailable: 100, dropAbortRatio: 0.7 }).publish,
    ).toBe(true);
  });

  it("aborta si la caída supera el umbral", () => {
    const d = decidePublish({ scrapedValid: 25, baselineAvailable: 100, dropAbortRatio: 0.7 });
    expect(d.publish).toBe(false);
    expect(d.reason).toContain("suspicious_drop");
  });

  it("es exacto en el borde (no aborta si iguala el mínimo)", () => {
    // min permitido = 30; 30 no es < 30 => publica
    expect(
      decidePublish({ scrapedValid: 30, baselineAvailable: 100, dropAbortRatio: 0.7 }).publish,
    ).toBe(true);
  });

  it("funciona con otros ratios", () => {
    expect(
      decidePublish({ scrapedValid: 4, baselineAvailable: 10, dropAbortRatio: 0.5 }).publish,
    ).toBe(false); // min 5
    expect(
      decidePublish({ scrapedValid: 5, baselineAvailable: 10, dropAbortRatio: 0.5 }).publish,
    ).toBe(true);
  });
});
