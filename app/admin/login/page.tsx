"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Login del admin con Supabase Auth (email/password).
export default function LoginPage() {
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // El middleware redirige a /admin cuando ya hay sesión.
    router.replace("/admin");
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
            AdminTickets · Custodia
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Panel de administración
          </h1>
        </div>

        <div className="punch-t bg-white">
          <div className="perf-line-light mx-6" />
          <form onSubmit={onSubmit} className="space-y-4 p-6">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-[#4A4E5E]"
              >
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
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-[#4A4E5E]"
              >
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
          </form>
        </div>
      </div>
    </main>
  );
}
