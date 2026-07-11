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
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
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
              className="whitespace-nowrap text-xs font-medium text-white/60 underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              {action.label}
            </Link>
          )}
          {email && (
            <span className="hidden font-mono text-xs text-white/50 lg:inline">
              {email}
            </span>
          )}
          <LogoutButton />
        </div>
      </div>
      <div className="holo-strip" aria-hidden />
    </header>
  );
}
