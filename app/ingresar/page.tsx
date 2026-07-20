"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Login del CLIENTE (visitante aprobado desde la landing). Mismo Supabase Auth
// que el staff; el middleware lo manda a /entradas según su rol. Quien todavía
// no tiene acceso, lo pide desde la landing.
export default function IngresarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    // El middleware ajusta el destino según el rol (staff -> su panel).
    router.replace("/entradas");
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="ticket-shadow w-full max-w-sm overflow-hidden rounded-3xl">
        <div className="holo-strip" aria-hidden />
        {/* Banda oscura estilo talón */}
        <div className="surface-ink punch-b px-6 pb-7 pt-6 text-white">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            <span className="inline-block h-2 w-2 rounded-full bg-brand" />
            TicketMirror
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Ingresá a la tienda
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Con el usuario y la contraseña que te enviamos.
          </p>
        </div>

        <div className="punch-t bg-white">
          <div className="perf-line-light mx-6" />
          <form onSubmit={onSubmit} className="space-y-4 p-6">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#4A4E5E]">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#4A4E5E]">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-estado-cancelada/10 px-3 py-2 text-sm text-estado-cancelada">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>

            <p className="pt-1 text-center text-sm text-muted">
              ¿Todavía no tenés acceso?{" "}
              <Link href="/" className="font-semibold text-brand hover:underline">
                Solicitalo acá
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
