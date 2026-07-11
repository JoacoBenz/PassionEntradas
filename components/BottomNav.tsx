"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, activeHref } from "@/components/nav-items";

// Barra de navegación fija abajo (tipo app nativa), SOLO móvil: en md+ las
// secciones viven en el TopNav del header. La tab activa se resalta según
// la ruta. Se renderiza solo para administradores.
export default function BottomNav() {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <nav
      aria-label="Secciones"
      className="surface-ink fixed inset-x-0 bottom-0 z-40 border-t border-white/10 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex w-full max-w-5xl items-stretch gap-1 px-3 py-1.5">
        {NAV_ITEMS.map((item) => {
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
