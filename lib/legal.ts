// Documentos legales disponibles (marcadores de posición hasta tener el texto
// final). En un módulo neutro (no "use client") para que lo puedan importar
// tanto el server component (generateStaticParams) como los componentes cliente.

export const LEGAL_DOCS = [
  "terminos",
  "privacidad",
  "cookies",
  "reembolsos",
  "aviso",
] as const;

export type LegalSlug = (typeof LEGAL_DOCS)[number];
