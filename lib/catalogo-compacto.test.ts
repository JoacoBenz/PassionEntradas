import { describe, expect, it } from "vitest";
import { desempacarCatalogo, empacarCatalogo } from "@/lib/catalogo-compacto";
import { MOCK_TICKETS } from "@/lib/mock-tickets";
import { normalizarPrecios } from "@/lib/tickets";

describe("catálogo compacto", () => {
  it("ida y vuelta: las mismas filas, exactas", () => {
    const rows = normalizarPrecios(MOCK_TICKETS, { eurUsd: 1.1, arsPorUsd: 1200 });
    const vuelta = desempacarCatalogo(JSON.parse(JSON.stringify(empacarCatalogo(rows))));
    expect(vuelta).toEqual(rows);
  });

  it("respeta null, 0, false, '' y campos ausentes", () => {
    const rows = [
      { id: "a", precio: 0, ok: false, txt: "", z: null },
      { id: "b", precio: null, ok: true, txt: "x" },
      { id: "c", extra: "solo-acá" },
    ];
    const vuelta = desempacarCatalogo<Record<string, unknown>>(
      JSON.parse(JSON.stringify(empacarCatalogo(rows)))
    );
    expect(vuelta).toEqual(rows);
    expect("z" in vuelta[1]).toBe(false);
    expect("extra" in vuelta[0]).toBe(false);
  });

  it("no confunde el número 1 con el texto '1'", () => {
    const rows = [{ v: 1 }, { v: "1" }];
    expect(desempacarCatalogo(empacarCatalogo(rows))).toEqual(rows);
  });

  it("vacío", () => {
    expect(desempacarCatalogo(empacarCatalogo([]))).toEqual([]);
  });

  it("con un catálogo realista (varios sectores por evento) pesa menos de la mitad", () => {
    // 60 eventos x 6 sectores, como el portal: cada sector repite el evento.
    const base = MOCK_TICKETS[0];
    const filas = Array.from({ length: 60 * 6 }, (_, i) => ({
      ...base,
      id: `p-${i}`,
      evento: `Equipo Local ${Math.floor(i / 6)} vs Equipo Visitante ${Math.floor(i / 6)}`,
      categoria: `Sector ${i % 6}`,
      precio_final: 100 + i,
      stock: i % 9,
      imagen_url: `https://example.supabase.co/storage/v1/object/public/mapas/estadio-${Math.floor(i / 6)}.webp`,
    }));
    const rows = normalizarPrecios(filas, { eurUsd: 1.1, arsPorUsd: 1200 });
    expect(desempacarCatalogo(JSON.parse(JSON.stringify(empacarCatalogo(rows))))).toEqual(rows);
    const crudo = JSON.stringify(rows).length;
    const compacto = JSON.stringify(empacarCatalogo(rows)).length;
    expect(compacto).toBeLessThan(crudo * 0.5);
  });
});
