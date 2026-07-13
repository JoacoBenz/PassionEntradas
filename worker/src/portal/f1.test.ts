import { describe, expect, it } from "vitest";
import { normalizarF1 } from "./parser.js";

// Casos reales capturados de la base: el portal pone la SEDE en la
// subcategoría de los eventos de F1 (en el resto pone el torneo).
describe("normalizarF1", () => {
  it("F1: competición pasa a 'F1' y la sede va al lugar entre paréntesis", () => {
    expect(
      normalizarF1({
        titulo: "F1 Spa, Belgian Grand Prix 2026",
        subCategoria: "Belgium",
        ubicacion: "Spa-Francorchamps, Stavelot",
      })
    ).toEqual({
      competicion: "F1",
      ciudad: "Spa-Francorchamps, Stavelot (Belgium)",
    });
  });

  it("si la ubicación ya termina con la sede, la mueve sin duplicar", () => {
    expect(
      normalizarF1({
        titulo: "F1 Monza, Italian Grand Prix 2026",
        subCategoria: "Monza",
        ubicacion: "Autodromo Nazionale Monza, Monza",
      })
    ).toEqual({
      competicion: "F1",
      ciudad: "Autodromo Nazionale Monza (Monza)",
    });
    expect(
      normalizarF1({
        titulo: "F1 Madrid, Spanish Grand Prix 2026",
        subCategoria: "Madrid",
        ubicacion: "Circuito de Madrid, Madrid",
      })
    ).toEqual({
      competicion: "F1",
      ciudad: "Circuito de Madrid (Madrid)",
    });
  });

  it("ubicación igual a la sede: queda una sola vez", () => {
    expect(
      normalizarF1({
        titulo: "F1 Qatar, Qatar Grand Prix 2026",
        subCategoria: "Qatar",
        ubicacion: "Qatar",
      })
    ).toEqual({ competicion: "F1", ciudad: "Qatar" });
  });

  it("sin ubicación: la sede pasa a ser el lugar", () => {
    expect(
      normalizarF1({
        titulo: "F1 Las Vegas, Las Vegas Grand Prix 2026",
        subCategoria: "Las Vegas",
        ubicacion: null,
      })
    ).toEqual({ competicion: "F1", ciudad: "Las Vegas" });
  });

  it("no-F1 queda intacto (el Mundial ya viene bien)", () => {
    expect(
      normalizarF1({
        titulo: "Match 80, World Cup - Round of 32 - England vs Congo DR",
        subCategoria: "World Cup 2026 Canada / Mexico / USA",
        ubicacion: "MetLife Stadium (USA)",
      })
    ).toEqual({
      competicion: "World Cup 2026 Canada / Mexico / USA",
      ciudad: "MetLife Stadium (USA)",
    });
  });

  it("'F1' tiene que ser palabra inicial del título (no matchea 'F1nal')", () => {
    expect(
      normalizarF1({
        titulo: "F1nal Cup",
        subCategoria: "Torneo X",
        ubicacion: "Cancha",
      })
    ).toEqual({ competicion: "Torneo X", ciudad: "Cancha" });
  });

  it("F1 sin subcategoría: solo cambia la competición", () => {
    expect(
      normalizarF1({
        titulo: "F1 Monza, Italian Grand Prix 2026",
        subCategoria: null,
        ubicacion: "Autodromo Nazionale Monza",
      })
    ).toEqual({ competicion: "F1", ciudad: "Autodromo Nazionale Monza" });
  });
});
