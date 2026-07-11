"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Login de la comunidad. El middleware manda a cada rol a su módulo,
// así que un admin que entre por acá también cae bien parado.
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
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }
    router.replace("/feed");
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls =
    "mb-1 block text-xs font-medium uppercase tracking-wide text-[#6A6E7E]";

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-8">
      <div className="ticket-shadow w-full max-w-sm overflow-hidden rounded-3xl">
        <div className="holo-strip" aria-hidden />
        <div className="surface-ink punch-b px-6 pb-7 pt-6 text-white">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            <span className="inline-block h-2 w-2 rounded-full bg-brand" />
            AdminTickets · Comunidad
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Ingresar
          </h1>
        </div>

        <div className="punch-t bg-white">
          <div className="perf-line-light mx-6" />
          <form onSubmit={onSubmit} className="space-y-4 p-6">
            <div>
              <label htmlFor="email" className={labelCls}>
                Email
              </label>
              <input
                id="email"
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className={labelCls}>
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
            >
              {loading ? "Ingresando…" : "Entrar"}
            </button>

            <p className="text-center text-sm text-muted">
              ¿No tenés cuenta?{" "}
              <Link href="/registro" className="font-medium text-brand hover:underline">
                Registrate
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
