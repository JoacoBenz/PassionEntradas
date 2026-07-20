// Geolocalización de ciudades/sedes para el mapa de eventos. El campo
// `ciudad` del catálogo viene en formatos variados ("Anfield, Liverpool",
// "Silverstone (UK)", "Glasgow Hampdenpark"), así que no se parsea: se busca
// por PALABRAS CLAVE (sede o ciudad) dentro del texto normalizado.
//
// El ORDEN importa: gana la primera entrada que matchea. Las sedes con
// nombres "trampa" van antes que las ciudades que podrían confundir (ej:
// "Riyadh Air Metropolitano, Madrid" debe caer en Madrid, no en Riad).

export type Lugar = { label: string; lat: number; lng: number };

type Entrada = { claves: string[]; label: string; lat: number; lng: number };

// Claves ya normalizadas (minúsculas, sin acentos).
const LUGARES: Entrada[] = [
  // --- Reino Unido / Irlanda ---
  { claves: ["london", "wembley", "emirates", "tottenham", "stamford", "wimbledon", "twickenham"], label: "London", lat: 51.51, lng: -0.12 },
  { claves: ["manchester", "old trafford", "etihad"], label: "Manchester", lat: 53.48, lng: -2.24 },
  { claves: ["liverpool", "anfield", "everton"], label: "Liverpool", lat: 53.41, lng: -2.98 },
  { claves: ["birmingham", "villa park"], label: "Birmingham", lat: 52.51, lng: -1.88 },
  { claves: ["newcastle", "james park"], label: "Newcastle", lat: 54.98, lng: -1.62 },
  { claves: ["glasgow", "hampden"], label: "Glasgow", lat: 55.86, lng: -4.25 },
  { claves: ["cardiff"], label: "Cardiff", lat: 51.48, lng: -3.18 },
  { claves: ["dublin"], label: "Dublin", lat: 53.35, lng: -6.26 },
  { claves: ["silverstone"], label: "Silverstone", lat: 52.07, lng: -1.02 },
  // --- España ---
  { claves: ["madrid", "bernabeu", "metropolitano"], label: "Madrid", lat: 40.42, lng: -3.7 },
  { claves: ["barcelona", "camp nou", "montmelo"], label: "Barcelona", lat: 41.38, lng: 2.17 },
  { claves: ["sevilla", "seville"], label: "Sevilla", lat: 37.39, lng: -5.99 },
  { claves: ["valencia"], label: "Valencia", lat: 39.47, lng: -0.38 },
  { claves: ["bilbao", "san mames"], label: "Bilbao", lat: 43.26, lng: -2.93 },
  // --- Resto de Europa ---
  { claves: ["paris", "philippe-chatrier", "roland garros", "saint-denis", "stade de france", "parc des princes"], label: "Paris", lat: 48.85, lng: 2.35 },
  { claves: ["marseille"], label: "Marseille", lat: 43.3, lng: 5.37 },
  { claves: ["lyon"], label: "Lyon", lat: 45.76, lng: 4.84 },
  { claves: ["monza"], label: "Monza", lat: 45.62, lng: 9.29 },
  { claves: ["milan", "san siro"], label: "Milano", lat: 45.48, lng: 9.12 },
  { claves: ["imola"], label: "Imola", lat: 44.34, lng: 11.71 },
  { claves: ["rome", "roma", "olimpico"], label: "Roma", lat: 41.9, lng: 12.5 },
  { claves: ["turin", "torino"], label: "Torino", lat: 45.07, lng: 7.69 },
  { claves: ["naples", "napoli"], label: "Napoli", lat: 40.85, lng: 14.27 },
  { claves: ["monaco", "monte carlo"], label: "Monaco", lat: 43.73, lng: 7.42 },
  { claves: ["frankfurt"], label: "Frankfurt", lat: 50.11, lng: 8.68 },
  { claves: ["munich", "munchen", "allianz"], label: "Munich", lat: 48.14, lng: 11.58 },
  { claves: ["berlin"], label: "Berlin", lat: 52.52, lng: 13.4 },
  { claves: ["dortmund"], label: "Dortmund", lat: 51.49, lng: 7.45 },
  { claves: ["nurburgring"], label: "Nürburgring", lat: 50.34, lng: 6.94 },
  { claves: ["hockenheim"], label: "Hockenheim", lat: 49.33, lng: 8.57 },
  { claves: ["zandvoort"], label: "Zandvoort", lat: 52.39, lng: 4.54 },
  { claves: ["amsterdam", "johan cruijff"], label: "Amsterdam", lat: 52.37, lng: 4.9 },
  { claves: ["rotterdam"], label: "Rotterdam", lat: 51.92, lng: 4.47 },
  { claves: ["brussels", "bruselas"], label: "Brussels", lat: 50.85, lng: 4.35 },
  { claves: ["spa-francorchamps", "spa francorchamps", "stavelot"], label: "Spa-Francorchamps", lat: 50.44, lng: 5.97 },
  { claves: ["lisbon", "lisboa", "da luz"], label: "Lisboa", lat: 38.72, lng: -9.14 },
  { claves: ["porto", "do dragao"], label: "Porto", lat: 41.15, lng: -8.61 },
  { claves: ["vienna", "viena"], label: "Vienna", lat: 48.21, lng: 16.37 },
  { claves: ["spielberg", "red bull ring"], label: "Spielberg", lat: 47.22, lng: 14.76 },
  { claves: ["salzburg"], label: "Salzburg", lat: 47.81, lng: 13.04 },
  { claves: ["budapest", "hungaroring", "puskas"], label: "Budapest", lat: 47.5, lng: 19.05 },
  { claves: ["istanbul", "besiktas"], label: "Istanbul", lat: 41.04, lng: 28.99 },
  { claves: ["baku"], label: "Baku", lat: 40.37, lng: 49.85 },
  // --- Medio Oriente / Asia / Oceanía ---
  { claves: ["losail", "lusail", "doha", "qatar"], label: "Doha", lat: 25.35, lng: 51.45 },
  { claves: ["yas marina", "abu dhabi"], label: "Abu Dhabi", lat: 24.47, lng: 54.6 },
  { claves: ["jeddah"], label: "Jeddah", lat: 21.63, lng: 39.1 },
  { claves: ["riyadh", "riad"], label: "Riyadh", lat: 24.71, lng: 46.68 },
  { claves: ["sakhir", "bahrain", "barein"], label: "Sakhir", lat: 26.03, lng: 50.51 },
  { claves: ["marina bay", "singapore", "singapur"], label: "Singapore", lat: 1.29, lng: 103.86 },
  { claves: ["suzuka"], label: "Suzuka", lat: 34.84, lng: 136.54 },
  { claves: ["tokyo", "tokio"], label: "Tokyo", lat: 35.68, lng: 139.69 },
  { claves: ["shanghai"], label: "Shanghai", lat: 31.34, lng: 121.22 },
  { claves: ["melbourne", "albert park"], label: "Melbourne", lat: -37.81, lng: 144.96 },
  { claves: ["sydney"], label: "Sydney", lat: -33.87, lng: 151.21 },
  // --- Norteamérica (Mundial 2026 + F1) ---
  { claves: ["new york", "east rutherford", "metlife"], label: "New York", lat: 40.81, lng: -74.07 },
  { claves: ["boston", "foxborough"], label: "Boston", lat: 42.09, lng: -71.26 },
  { claves: ["philadelphia"], label: "Philadelphia", lat: 39.95, lng: -75.17 },
  { claves: ["atlanta"], label: "Atlanta", lat: 33.75, lng: -84.39 },
  { claves: ["miami"], label: "Miami", lat: 25.93, lng: -80.24 },
  { claves: ["houston"], label: "Houston", lat: 29.76, lng: -95.37 },
  { claves: ["dallas", "arlington"], label: "Dallas", lat: 32.75, lng: -97.08 },
  { claves: ["kansas city"], label: "Kansas City", lat: 39.1, lng: -94.58 },
  { claves: ["circuit of the americas", "austin"], label: "Austin", lat: 30.13, lng: -97.64 },
  { claves: ["los angeles", "inglewood", "sofi"], label: "Los Angeles", lat: 33.96, lng: -118.34 },
  { claves: ["san francisco", "santa clara"], label: "San Francisco", lat: 37.4, lng: -121.97 },
  { claves: ["seattle"], label: "Seattle", lat: 47.6, lng: -122.33 },
  { claves: ["las vegas"], label: "Las Vegas", lat: 36.17, lng: -115.14 },
  { claves: ["toronto"], label: "Toronto", lat: 43.65, lng: -79.38 },
  { claves: ["vancouver"], label: "Vancouver", lat: 49.28, lng: -123.12 },
  { claves: ["montreal", "villeneuve"], label: "Montreal", lat: 45.5, lng: -73.52 },
  { claves: ["mexico city", "ciudad de mexico", "azteca", "hermanos rodriguez", "cdmx"], label: "Mexico City", lat: 19.4, lng: -99.13 },
  { claves: ["guadalajara"], label: "Guadalajara", lat: 20.67, lng: -103.35 },
  { claves: ["monterrey"], label: "Monterrey", lat: 25.67, lng: -100.31 },
  // --- Sudamérica ---
  { claves: ["jose carlos pace", "interlagos", "sao paulo"], label: "São Paulo", lat: -23.7, lng: -46.7 },
  { claves: ["rio de janeiro", "maracana"], label: "Rio de Janeiro", lat: -22.91, lng: -43.2 },
  { claves: ["buenos aires", "monumental", "bombonera"], label: "Buenos Aires", lat: -34.6, lng: -58.44 },
  { claves: ["santiago"], label: "Santiago", lat: -33.45, lng: -70.66 },
  { claves: ["montevideo", "centenario"], label: "Montevideo", lat: -34.9, lng: -56.16 },
];

// Minúsculas y sin acentos, para que "Autódromo" matchee "autodromo".
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Ubica una ciudad/sede del catálogo. null = sin ubicar (se informa aparte).
export function ubicarCiudad(ciudad: string | null): Lugar | null {
  if (!ciudad) return null;
  const hay = normalizar(ciudad);
  for (const l of LUGARES) {
    if (l.claves.some((c) => hay.includes(c))) {
      return { label: l.label, lat: l.lat, lng: l.lng };
    }
  }
  return null;
}
