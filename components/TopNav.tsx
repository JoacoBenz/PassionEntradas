"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, activeHref } from "@/components/nav-items";

// Tabs de sección en el header, SOLO desktop (md+): en móvil la navegación
// vive en la BottomNav. Mismo lenguaje visual: píldora violeta en la activa.
export default function TopNav() {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-brand text-white"
                : "text-white/50 hover:bg-white/10 hover:text-white/85"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
