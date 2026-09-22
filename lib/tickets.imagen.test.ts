import { describe, expect, it } from "vitest";
import { buildEvents, imagenSegura, type Ticket } from "./tickets";

// `imagen_url` sale de la base (bucket `mapas`) y termina en un <img src> del
// detalle del evento. Un src con esquema raro es ejecutable, así que se filtra
// acá: lo que no es http(s) ni data:image no se renderiza.

describe("imagenSegura — pasa", () => {
  it("una URL del bucket de mapas", () => {
    const url = "https://vcovindqjrzpkoxandnv.supabase.co/storage/v1/object/public/mapas/bernabeu.png";
    expect(imagenSegura(url)).toBe(url);
  });

  it("http y mayúsculas en el esquema", () => {
    expect(imagenSegura("http://ejemplo.com/mapa.png")).toBe("http://ejemplo.com/mapa.png");
    expect(imagenSegura("HTTPS://ejemplo.com/mapa.png")).toBe("HTTPS://ejemplo.com/mapa.png");
  });

  // El catálogo demo (MOCK_TICKETS) trae el mapa como SVG inline: si esto se
  // filtrara, la demo quedaría sin mapa de sectores.
  it("un data:image inline (SVG del catálogo demo)", () => {
    const svg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>";
    expect(imagenSegura(svg)).toBe(svg);
  });

  it("un data:image en base64", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(imagenSegura(png)).toBe(png);
  });
});

describe("imagenSegura — descarta", () => {
  it("javascript:", () => {
    expect(imagenSegura("javascript:alert(1)")).toBeNull();
    expect(imagenSegura("  JaVaScRiPt:alert(1)  ")).toBeNull();
  });

  it("un data: que no es imagen", () => {
    expect(imagenSegura("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(imagenSegura("data:image")).toBeNull(); // sin tipo ni separador
  });

  it("otros esquemas", () => {
    expect(imagenSegura("vbscript:msgbox(1)")).toBeNull();
    expect(imagenSegura("file:///etc/passwd")).toBeNull();
    expect(imagenSegura("//ejemplo.com/mapa.png")).toBeNull();
  });

  it("vacío, null y undefined", () => {
    expect(imagenSegura(null)).toBeNull();
    expect(imagenSegura(undefined)).toBeNull();
    expect(imagenSegura("")).toBeNull();
    expect(imagenSegura("   ")).toBeNull();
  });
});

// El filtro tiene que aplicarse donde la card toma la imagen, no solo existir.
describe("buildEvents aplica el filtro", () => {
  const base: Ticket = {
    id: "x::1",
    evento: "Real Madrid vs Manchester City",
    competicion: "UEFA Champions League",
    fecha: "2026-09-27T12:00:00.000Z",
    ciudad: "Santiago Bernabéu, Madrid (ESP)",
    categoria: "Lateral Alto",
    precio_final: 480,
    stock: 1,
    estado: "book",
    source: "portal",
  };

  it("descarta el mapa con esquema peligroso", () => {
    const [ev] = buildEvents([{ ...base, imagen_url: "javascript:alert(1)" }]);
    expect(ev.imagen).toBeNull();
  });

  it("conserva el mapa legítimo", () => {
    const url = "https://cdn.ejemplo.com/mapas/bernabeu.png";
    const [ev] = buildEvents([{ ...base, imagen_url: url }]);
    expect(ev.imagen).toBe(url);
  });

  // Gana el primer mapa USABLE, no el primero a secas: una URL inválida en un
  // sector no puede dejar al evento sin el mapa bueno de otro sector.
  it("se queda con la válida aunque venga después de una peligrosa", () => {
    const url = "https://cdn.ejemplo.com/mapas/bernabeu.png";
    const [ev] = buildEvents([
      { ...base, id: "x::1", imagen_url: "javascript:alert(1)" },
      { ...base, id: "x::2", categoria: "Fondo Norte", imagen_url: url },
    ]);
    expect(ev.imagen).toBe(url);
  });

  it("sin ningún mapa queda en null", () => {
    const [ev] = buildEvents([{ ...base, imagen_url: null }]);
    expect(ev.imagen).toBeNull();
  });
});

// En la tarjeta de un evento, el que entra quiere ver qué puede comprar. Si
// los sectores sin cupo van primero, lo primero que lee es "consultar".
describe("orden de los sectores", () => {
  const u = (o: Partial<Ticket>): Ticket => ({
    id: Math.random().toString(),
    evento: "River vs Boca",
    competicion: "Liga",
    fecha: "2026-07-18T12:00:00Z",
    ciudad: "Buenos Aires",
    categoria: "S",
    precio_final: 100,
    stock: 3,
    estado: "book",
    source: "portal",
    ...o,
  });

  const orden = (us: Ticket[]) =>
    buildEvents(us)[0].ubicaciones.map((x) => `${x.categoria}:${x.precio_final ?? "-"}`);

  it("los comprables van antes que los de consultar", () => {
    expect(
      orden([
        u({ categoria: "SinCupo", stock: 0, precio_final: 50 }),
        u({ categoria: "Disponible", stock: 2, precio_final: 300 }),
      ])
    ).toEqual(["Disponible:300", "SinCupo:50"]);
  });

  it("dentro de cada grupo, del más barato al más caro", () => {
    expect(
      orden([
        u({ categoria: "CaroOk", precio_final: 900 }),
        u({ categoria: "BaratoOk", precio_final: 100 }),
        u({ categoria: "CaroReq", precio_final: 800, stock: 0 }),
        u({ categoria: "BaratoReq", precio_final: 200, stock: 0 }),
      ])
    ).toEqual(["BaratoOk:100", "CaroOk:900", "BaratoReq:200", "CaroReq:800"]);
  });

  it("un sector sin precio cuenta como a consultar", () => {
    expect(
      orden([
        u({ categoria: "SinPrecio", precio_final: null }),
        u({ categoria: "ConPrecio", precio_final: 500 }),
      ])
    ).toEqual(["ConPrecio:500", "SinPrecio:-"]);
  });

  it("un sector on_request no es comprable aunque tenga stock", () => {
    expect(
      orden([
        u({ categoria: "OnRequest", estado: "on_request", stock: 5, precio_final: 50 }),
        u({ categoria: "Book", precio_final: 400 }),
      ])
    ).toEqual(["Book:400", "OnRequest:50"]);
  });
});
