import type { Lang } from "@/lib/tienda-i18n";

// Códigos de país para el selector de teléfono de la landing. `iso` es el
// valor del <select> (único; evita el choque de los que comparten prefijo,
// como +1). `dial` es lo que se antepone al número al enviar la solicitud.
// El nombre viene en inglés y español (sigue el idioma de la tienda).
export type Pais = { iso: string; dial: string; en: string; es: string };

// Argentina primero (default). Cubre Latinoamérica, Norteamérica, Europa y los
// mercados más habituales; ampliable a gusto.
export const PAISES: Pais[] = [
  { iso: "AR", dial: "+54", en: "Argentina", es: "Argentina" },
  { iso: "BO", dial: "+591", en: "Bolivia", es: "Bolivia" },
  { iso: "BR", dial: "+55", en: "Brazil", es: "Brasil" },
  { iso: "CL", dial: "+56", en: "Chile", es: "Chile" },
  { iso: "CO", dial: "+57", en: "Colombia", es: "Colombia" },
  { iso: "CR", dial: "+506", en: "Costa Rica", es: "Costa Rica" },
  { iso: "EC", dial: "+593", en: "Ecuador", es: "Ecuador" },
  { iso: "SV", dial: "+503", en: "El Salvador", es: "El Salvador" },
  { iso: "GT", dial: "+502", en: "Guatemala", es: "Guatemala" },
  { iso: "HN", dial: "+504", en: "Honduras", es: "Honduras" },
  { iso: "MX", dial: "+52", en: "Mexico", es: "México" },
  { iso: "NI", dial: "+505", en: "Nicaragua", es: "Nicaragua" },
  { iso: "PA", dial: "+507", en: "Panama", es: "Panamá" },
  { iso: "PY", dial: "+595", en: "Paraguay", es: "Paraguay" },
  { iso: "PE", dial: "+51", en: "Peru", es: "Perú" },
  { iso: "PR", dial: "+1", en: "Puerto Rico", es: "Puerto Rico" },
  { iso: "DO", dial: "+1", en: "Dominican Republic", es: "República Dominicana" },
  { iso: "UY", dial: "+598", en: "Uruguay", es: "Uruguay" },
  { iso: "VE", dial: "+58", en: "Venezuela", es: "Venezuela" },
  { iso: "US", dial: "+1", en: "United States", es: "Estados Unidos" },
  { iso: "CA", dial: "+1", en: "Canada", es: "Canadá" },
  { iso: "ES", dial: "+34", en: "Spain", es: "España" },
  { iso: "PT", dial: "+351", en: "Portugal", es: "Portugal" },
  { iso: "FR", dial: "+33", en: "France", es: "Francia" },
  { iso: "IT", dial: "+39", en: "Italy", es: "Italia" },
  { iso: "DE", dial: "+49", en: "Germany", es: "Alemania" },
  { iso: "GB", dial: "+44", en: "United Kingdom", es: "Reino Unido" },
  { iso: "IE", dial: "+353", en: "Ireland", es: "Irlanda" },
  { iso: "NL", dial: "+31", en: "Netherlands", es: "Países Bajos" },
  { iso: "BE", dial: "+32", en: "Belgium", es: "Bélgica" },
  { iso: "CH", dial: "+41", en: "Switzerland", es: "Suiza" },
  { iso: "AT", dial: "+43", en: "Austria", es: "Austria" },
  { iso: "PL", dial: "+48", en: "Poland", es: "Polonia" },
  { iso: "SE", dial: "+46", en: "Sweden", es: "Suecia" },
  { iso: "NO", dial: "+47", en: "Norway", es: "Noruega" },
  { iso: "DK", dial: "+45", en: "Denmark", es: "Dinamarca" },
  { iso: "GR", dial: "+30", en: "Greece", es: "Grecia" },
  { iso: "TR", dial: "+90", en: "Turkey", es: "Turquía" },
  { iso: "AE", dial: "+971", en: "United Arab Emirates", es: "Emiratos Árabes Unidos" },
  { iso: "SA", dial: "+966", en: "Saudi Arabia", es: "Arabia Saudita" },
  { iso: "QA", dial: "+974", en: "Qatar", es: "Catar" },
  { iso: "IL", dial: "+972", en: "Israel", es: "Israel" },
  { iso: "IN", dial: "+91", en: "India", es: "India" },
  { iso: "CN", dial: "+86", en: "China", es: "China" },
  { iso: "JP", dial: "+81", en: "Japan", es: "Japón" },
  { iso: "KR", dial: "+82", en: "South Korea", es: "Corea del Sur" },
  { iso: "AU", dial: "+61", en: "Australia", es: "Australia" },
  { iso: "NZ", dial: "+64", en: "New Zealand", es: "Nueva Zelanda" },
  { iso: "ZA", dial: "+27", en: "South Africa", es: "Sudáfrica" },
  { iso: "MA", dial: "+212", en: "Morocco", es: "Marruecos" },
];

export const PAIS_DEFAULT = "AR";

export function dialDe(iso: string): string {
  return PAISES.find((p) => p.iso === iso)?.dial ?? "+54";
}

// Nombre del país en el idioma de la tienda.
export function nombrePais(p: Pais, lang: Lang): string {
  return lang === "es" ? p.es : p.en;
}
