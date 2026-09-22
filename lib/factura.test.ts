import { describe, expect, it } from "vitest";
import { FACTURA_TX } from "./factura";

// Regresión: con varias líneas no hay UN precio unitario, y la etiqueta quedaba
// con el "×" colgando ("Subtotal (6 × )") porque el parche que lo sacaba era un
// replace con ancla al final que nunca matcheaba (el texto termina en ")").
describe("FACTURA_TX.subtotal — con y sin precio unitario", () => {
  it("una sola línea: muestra el unitario", () => {
    expect(FACTURA_TX.es.subtotal(2, "US$ 100,00")).toBe("Subtotal (2 × US$ 100,00)");
    expect(FACTURA_TX.en.subtotal(2, "US$ 100.00")).toBe("Subtotal (2 × US$ 100.00)");
  });

  it("varias líneas: sin unitario y sin el × colgando", () => {
    expect(FACTURA_TX.es.subtotal(6, "")).toBe("Subtotal (6)");
    expect(FACTURA_TX.en.subtotal(6, "")).toBe("Subtotal (6)");
    expect(FACTURA_TX.es.subtotal(6, "")).not.toContain("×");
  });

  it("el encabezado plural existe en los dos idiomas", () => {
    // El título de la sección y el de la columna tienen que ser distintos: si
    // no, la factura multi-línea repite "Entrada comprada" dos veces seguidas.
    expect(FACTURA_TX.es.ticketsPurchased).not.toBe(FACTURA_TX.es.ticketPurchased);
    expect(FACTURA_TX.en.ticketsPurchased).not.toBe(FACTURA_TX.en.ticketPurchased);
    expect(FACTURA_TX.es.lineCol).not.toBe(FACTURA_TX.es.ticketPurchased);
    expect(FACTURA_TX.en.lineCol).not.toBe(FACTURA_TX.en.ticketPurchased);
  });
});
