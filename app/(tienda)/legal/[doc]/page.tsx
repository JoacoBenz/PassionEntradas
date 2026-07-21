import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LegalDoc } from "@/components/tienda/LegalDoc";
import { LEGAL_DOCS, type LegalSlug } from "@/lib/legal";

// Documentos legales públicos (marcadores de posición). Pre-renderizados;
// quedan fuera del gating de la tienda (no están en el matcher del middleware).
export const dynamic = "force-static";

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }));
}

const TITULOS: Record<LegalSlug, string> = {
  terminos: "Términos y Condiciones",
  privacidad: "Política de Privacidad",
  cookies: "Política de Cookies",
  reembolsos: "Política de Reembolsos y Cancelaciones",
  aviso: "Aviso Legal",
};

export function generateMetadata({ params }: { params: { doc: string } }): Metadata {
  const slug = params.doc as LegalSlug;
  const titulo = TITULOS[slug];
  return { title: titulo ? `${titulo} — TicketMirror` : "TicketMirror" };
}

export default function LegalPage({ params }: { params: { doc: string } }) {
  if (!LEGAL_DOCS.includes(params.doc as LegalSlug)) notFound();
  return <LegalDoc slug={params.doc as LegalSlug} />;
}
