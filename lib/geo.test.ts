import { describe, expect, it } from "vitest";
import { ubicarCiudad } from "./geo";

// Todas las variantes REALES de `ciudad` vistas en la base (jul 2026): si el
// worker trae estos formatos, el mapa tiene que ubicarlos. Si alguna vuelve
// null, faltan claves en lib/geo.ts.
const CIUDADES_DB: [string, string][] = [
  ["Anfield, Liverpool", "Liverpool"],
  ["Atlanta Stadium, Atlanta (USA)", "Atlanta"],
  ["Autódromo Hermanos Rodríguez (Mexico)", "Mexico City"],
  ["Autódromo José Carlos Pace (Brazil)", "São Paulo"],
  ["Autodromo Nazionale Monza (Monza)", "Monza"],
  ["Baku City Circuit (Azerbaijan)", "Baku"],
  ["BC Place Vancouver, Vancouver (Canada)", "Vancouver"],
  ["Besiktas Stadium, Istanbul", "Istanbul"],
  ["Birmingham, Villa Park", "Birmingham"],
  ["Boston Stadium, Foxborough (USA)", "Boston"],
  ["Cardiff, National Stadium of Wales", "Cardiff"],
  ["Circuit of the Americas (USA)", "Austin"],
  ["Circuit Zandvoort (Zandvoort)", "Zandvoort"],
  ["Circuito de Madrid (Madrid)", "Madrid"],
  ["Court Philippe-Chatrier, Paris", "Paris"],
  ["Dallas Stadium, Arlington (USA)", "Dallas"],
  ["Deutsche Bank Park, Frankfurt", "Frankfurt"],
  ["Dublin, Dublin Arena", "Dublin"],
  ["Emirates Stadium, London", "London"],
  ["Estadio Azteca, Mexico City (Mexico)", "Mexico City"],
  ["Etihad Stadium, Manchester", "Manchester"],
  ["Glasgow Hampdenpark", "Glasgow"],
  ["Houston Stadium, Houston (USA)", "Houston"],
  ["Hungaroring, Budapest (Hungary)", "Budapest"],
  ["Kansas City Stadium, Kansas City (USA)", "Kansas City"],
  ["Liverpool, Everton Stadium", "Liverpool"],
  ["London, Wembley Stadium", "London"],
  ["Los Angeles Stadium, Inglewood (USA)", "Los Angeles"],
  ["Losail Circuit (Qatar)", "Doha"],
  ["Manchester, Manchester City Stadium", "Manchester"],
  ["Marina Bay Street Circuit (Singapore)", "Singapore"],
  ["Miami Stadium, Miami Gardens (USA)", "Miami"],
  ["New York New Jersey Stadium, East Rutherford (USA)", "New York"],
  ["Newcastle, ST.James Park", "Newcastle"],
  ["Old Trafford, Manchester", "Manchester"],
  ["Philadelphia Stadium, Philadelphia (USA)", "Philadelphia"],
  ["Red Bull Arena, Salzburg", "Salzburg"],
  // Trampa: el sponsor "Riyadh Air" no debe mandar el Metropolitano a Riad.
  ["Riyadh Air Metropolitano, Madrid", "Madrid"],
  ["San Francisco Bay Area Stadium, Santa Clara (USA)", "San Francisco"],
  ["Santiago Bernabeu, Madrid", "Madrid"],
  ["Seattle Stadium, Seattle (USA)", "Seattle"],
  ["Silverstone (UK)", "Silverstone"],
  ["Spa-Francorchamps, Stavelot (Belgium)", "Spa-Francorchamps"],
  ["Spotify Camp Nou, Barcelona", "Barcelona"],
  ["Stamford Bridge, London", "London"],
  ["Street Circuit (Las Vegas)", "Las Vegas"],
  ["Toronto Stadium, Toronto (Canada)", "Toronto"],
  ["Yas Marina Circuit (Abu Dhabi)", "Abu Dhabi"],
  ["Estadio Monumental, Buenos Aires (ARG)", "Buenos Aires"],
];

describe("ubicarCiudad", () => {
  it("ubica todas las ciudades reales del catálogo", () => {
    for (const [ciudad, esperado] of CIUDADES_DB) {
      const lugar = ubicarCiudad(ciudad);
      expect(lugar, `sin ubicar: ${ciudad}`).not.toBeNull();
      expect(lugar!.label, ciudad).toBe(esperado);
    }
  });

  it("devuelve null para lo desconocido (se informa como 'sin ubicar')", () => {
    expect(ubicarCiudad(null)).toBeNull();
    expect(ubicarCiudad("Estadio Desconocido, Villa Inexistente")).toBeNull();
  });
});
