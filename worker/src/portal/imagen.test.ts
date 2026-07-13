import { describe, expect, it } from "vitest";
import { extensionDe, extraerMapaUrl } from "./imagen.js";

const BASE = "https://portal.example/admin/event_detail.php?event_id=1";

describe("extraerMapaUrl", () => {
  it("elige la imagen con pinta de mapa aunque haya chrome", () => {
    const html = `
      <img src="/assets/logo.png" alt="Passion Events">
      <img src="/uploads/venue_map_3001.jpg" alt="Seating plan">
      <img src="/assets/icons/arrow.gif" width="16" height="16">`;
    expect(extraerMapaUrl(html, BASE)).toBe(
      "https://portal.example/uploads/venue_map_3001.jpg"
    );
  });

  it("resuelve rutas relativas contra la URL del detalle", () => {
    const html = `<img src="images/stadium_plan.png">`;
    expect(extraerMapaUrl(html, BASE)).toBe(
      "https://portal.example/admin/images/stadium_plan.png"
    );
  });

  it("única imagen neutra: la toma (admin viejo con solo el mapa)", () => {
    const html = `<img src="/uploads/ev_3001.jpg">`;
    expect(extraerMapaUrl(html, BASE)).toBe("https://portal.example/uploads/ev_3001.jpg");
  });

  it("varias imágenes neutras sin señal: no adivina", () => {
    const html = `<img src="/uploads/a.jpg"><img src="/uploads/b.jpg">`;
    expect(extraerMapaUrl(html, BASE)).toBeNull();
  });

  it("solo chrome: null", () => {
    const html = `
      <img src="/assets/logo.png">
      <img src="/assets/icons/flag_uk.gif" width="20" height="12">`;
    expect(extraerMapaUrl(html, BASE)).toBeNull();
  });

  it("ignora data-uris y también íconos chicos con nombre de mapa", () => {
    const html = `
      <img src="data:image/gif;base64,AAAA">
      <img src="/icons/map_pin.png" width="24" height="24">`;
    expect(extraerMapaUrl(html, BASE)).toBeNull();
  });

  it("sin imágenes: null", () => {
    expect(extraerMapaUrl("<table><tr><td>Event Information</td></tr></table>", BASE)).toBeNull();
  });
});

describe("extensionDe", () => {
  it("mapea content-types de imagen", () => {
    expect(extensionDe("image/jpeg")).toBe("jpg");
    expect(extensionDe("image/png; charset=binary")).toBe("png");
    expect(extensionDe("image/webp")).toBe("webp");
  });
  it("rechaza lo que no es imagen conocida", () => {
    expect(extensionDe("text/html")).toBeNull();
    expect(extensionDe(undefined)).toBeNull();
  });
});
