import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import TopNav from "@/components/TopNav";

type Props = {
  subtitle: string;
  email?: string | null;
  // Muestra las tabs de sección en desktop (md+). En móvil la navegación
  // vive en la BottomNav; el moderador puro no lleva navegación.
  nav?: boolean;
  // Link liviano opcional (ej: "Ver tienda ↗").
  action?: { href: string; label: string };
};

// Header mínimo: identidad y sesión. En desktop, si nav está activo, las
// secciones aparecen como tabs junto a la marca.
export default function AppHeader({ subtitle, email, nav = false, action }: Props) {
  return (
    <header className="surface-ink pt-[env(safe-area-inset-top)] text-white">
      {/* flex-wrap: si la marca + acciones no entran (Safari mide las fuentes
          más anchas que Chromium), la fila de acciones baja completa en vez
          de cortarse en el borde. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold"
              aria-hidden
            >
              A
            </span>
            <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight">
              AdminTickets
            </span>
            {/* Con tabs en desktop, el subtítulo sobra ahí (la tab activa ya
                dice dónde estás); se muestra solo en el rango sm–md. */}
            <span
              className={`hidden truncate text-sm text-white/50 sm:inline ${
                nav ? "md:hidden" : ""
              }`}
            >
              · {subtitle}
            </span>
          </div>
          {nav && <TopNav />}
        </div>
        <div className="flex items-center gap-2.5">
          {action && (
            <Link
              href={action.href}
              className="whitespace-nowrap rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
            >
              {action.label}
            </Link>
          )}
          {email && (
            <span className="hidden font-mono text-xs text-white/50 lg:inline">
              {email}
            </span>
          )}
          <Link
            href="/admin/cuenta"
            title="Mi cuenta"
            aria-label="Mi cuenta"
            className="rounded-lg border border-white/25 px-2.5 py-1.5 text-white/85 transition-colors hover:bg-white/10"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 20.5c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
            </svg>
          </Link>
          <LogoutButton />
        </div>
      </div>
      <div className="holo-strip" aria-hidden />
    </header>
  );
}
