"use client";

// Enlaces a los documentos legales (marcadores de posición). Se reusa en los
// pies de página de la landing, la tienda y las propias páginas legales.

import Link from "next/link";
import { TX, type Lang } from "@/lib/tienda-i18n";
import { LEGAL_DOCS } from "@/lib/legal";

export function LegalLinks({ lang, className }: { lang: Lang; className?: string }) {
  const l = TX[lang].legal;
  return (
    <nav className={`legal-links ${className ?? ""}`} aria-label={l.footerHeading}>
      {LEGAL_DOCS.map((slug) => (
        <Link key={slug} href={`/legal/${slug}`}>
          {l.docs[slug]}
        </Link>
      ))}
    </nav>
  );
}
