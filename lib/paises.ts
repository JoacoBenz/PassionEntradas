// Códigos de país para el selector de teléfono de la landing. `iso` es el
// valor del <select> (único; evita el choque de los que comparten prefijo,
// como +1). `dial` es lo que se antepone al número al enviar la solicitud.
export type Pais = { iso: string; nombre: string; dial: string; flag: string };

// Argentina primero (default) y el resto por nombre. Cubre Latinoamérica,
// Norteamérica, Europa y los mercados más habituales; ampliable a gusto.
export const PAISES: Pais[] = [
  { iso: "AR", nombre: "Argentina", dial: "+54", flag: "🇦🇷" },
  { iso: "BO", nombre: "Bolivia", dial: "+591", flag: "🇧🇴" },
  { iso: "BR", nombre: "Brasil", dial: "+55", flag: "🇧🇷" },
  { iso: "CL", nombre: "Chile", dial: "+56", flag: "🇨🇱" },
  { iso: "CO", nombre: "Colombia", dial: "+57", flag: "🇨🇴" },
  { iso: "CR", nombre: "Costa Rica", dial: "+506", flag: "🇨🇷" },
  { iso: "EC", nombre: "Ecuador", dial: "+593", flag: "🇪🇨" },
  { iso: "SV", nombre: "El Salvador", dial: "+503", flag: "🇸🇻" },
  { iso: "GT", nombre: "Guatemala", dial: "+502", flag: "🇬🇹" },
  { iso: "HN", nombre: "Honduras", dial: "+504", flag: "🇭🇳" },
  { iso: "MX", nombre: "México", dial: "+52", flag: "🇲🇽" },
  { iso: "NI", nombre: "Nicaragua", dial: "+505", flag: "🇳🇮" },
  { iso: "PA", nombre: "Panamá", dial: "+507", flag: "🇵🇦" },
  { iso: "PY", nombre: "Paraguay", dial: "+595", flag: "🇵🇾" },
  { iso: "PE", nombre: "Perú", dial: "+51", flag: "🇵🇪" },
  { iso: "PR", nombre: "Puerto Rico", dial: "+1", flag: "🇵🇷" },
  { iso: "DO", nombre: "República Dominicana", dial: "+1", flag: "🇩🇴" },
  { iso: "UY", nombre: "Uruguay", dial: "+598", flag: "🇺🇾" },
  { iso: "VE", nombre: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { iso: "US", nombre: "Estados Unidos", dial: "+1", flag: "🇺🇸" },
  { iso: "CA", nombre: "Canadá", dial: "+1", flag: "🇨🇦" },
  { iso: "ES", nombre: "España", dial: "+34", flag: "🇪🇸" },
  { iso: "PT", nombre: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso: "FR", nombre: "Francia", dial: "+33", flag: "🇫🇷" },
  { iso: "IT", nombre: "Italia", dial: "+39", flag: "🇮🇹" },
  { iso: "DE", nombre: "Alemania", dial: "+49", flag: "🇩🇪" },
  { iso: "GB", nombre: "Reino Unido", dial: "+44", flag: "🇬🇧" },
  { iso: "IE", nombre: "Irlanda", dial: "+353", flag: "🇮🇪" },
  { iso: "NL", nombre: "Países Bajos", dial: "+31", flag: "🇳🇱" },
  { iso: "BE", nombre: "Bélgica", dial: "+32", flag: "🇧🇪" },
  { iso: "CH", nombre: "Suiza", dial: "+41", flag: "🇨🇭" },
  { iso: "AT", nombre: "Austria", dial: "+43", flag: "🇦🇹" },
  { iso: "PL", nombre: "Polonia", dial: "+48", flag: "🇵🇱" },
  { iso: "SE", nombre: "Suecia", dial: "+46", flag: "🇸🇪" },
  { iso: "NO", nombre: "Noruega", dial: "+47", flag: "🇳🇴" },
  { iso: "DK", nombre: "Dinamarca", dial: "+45", flag: "🇩🇰" },
  { iso: "GR", nombre: "Grecia", dial: "+30", flag: "🇬🇷" },
  { iso: "TR", nombre: "Turquía", dial: "+90", flag: "🇹🇷" },
  { iso: "AE", nombre: "Emiratos Árabes Unidos", dial: "+971", flag: "🇦🇪" },
  { iso: "SA", nombre: "Arabia Saudita", dial: "+966", flag: "🇸🇦" },
  { iso: "QA", nombre: "Catar", dial: "+974", flag: "🇶🇦" },
  { iso: "IL", nombre: "Israel", dial: "+972", flag: "🇮🇱" },
  { iso: "IN", nombre: "India", dial: "+91", flag: "🇮🇳" },
  { iso: "CN", nombre: "China", dial: "+86", flag: "🇨🇳" },
  { iso: "JP", nombre: "Japón", dial: "+81", flag: "🇯🇵" },
  { iso: "KR", nombre: "Corea del Sur", dial: "+82", flag: "🇰🇷" },
  { iso: "AU", nombre: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso: "NZ", nombre: "Nueva Zelanda", dial: "+64", flag: "🇳🇿" },
  { iso: "ZA", nombre: "Sudáfrica", dial: "+27", flag: "🇿🇦" },
  { iso: "MA", nombre: "Marruecos", dial: "+212", flag: "🇲🇦" },
];

export const PAIS_DEFAULT = "AR";

export function dialDe(iso: string): string {
  return PAISES.find((p) => p.iso === iso)?.dial ?? "+54";
}
