import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";

type Props = {
  subtitle: string;
  email?: string | null;
  // Links opcionales para saltar a otros módulos (ej: admin -> carga/entradas).
  actions?: { href: string; label: string }[];
};

export default function AppHeader({ subtitle, email, actions }: Props) {
  return (
    <header className="surface-ink pt-[env(safe-area-inset-top)] text-white">
      {/* flex-wrap: en móvil las acciones bajan a una segunda fila en vez de
          desbordar; la marca empuja el resto a la derecha con mr-auto. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="mr-auto flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold"
            aria-hidden
          >
            A
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            AdminTickets
          </span>
          <span className="hidden text-sm text-white/50 sm:inline">
            · {subtitle}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions?.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              {a.label}
            </Link>
          ))}
          {email && (
            <span className="hidden font-mono text-xs text-white/50 md:inline">
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
