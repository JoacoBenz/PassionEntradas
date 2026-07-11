"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Barra de navegación fija abajo (tipo app nativa): las secciones del admin
// siempre al alcance del pulgar. La tab activa se resalta según la ruta.
// Se renderiza solo para administradores (el moderador tiene una única
// sección y no la necesita).

type Item = { href: string; label: string; icon: React.ReactNode };

const ICON_CLS = "h-[18px] w-[18px]";

const ITEMS: Item[] = [
  {
    href: "/admin",
    label: "Panel",
    icon: (
      <svg className={ICON_CLS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/moderador",
    label: "Cargar",
    icon: (
      <svg className={ICON_CLS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    href: "/admin/entradas",
    label: "Entradas",
    icon: (
      <svg className={ICON_CLS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4Z" />
        <path d="M13 7v2m0 6v2" strokeDasharray="1.5 2.5" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  // La más específica gana: /admin/entradas no debe activar también /admin.
  const active =
    [...ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) =>
      pathname === i.href || pathname.startsWith(`${i.href}/`)
    )?.href ?? null;

  return (
    <nav
      aria-label="Secciones"
      className="surface-ink fixed inset-x-0 bottom-0 z-40 border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-5xl items-stretch gap-1 px-3 py-1.5">
        {ITEMS.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition-colors ${
                isActive ? "text-white" : "text-white/45 hover:text-white/75"
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  isActive ? "bg-brand" : "bg-transparent"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
