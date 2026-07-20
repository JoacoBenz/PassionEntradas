"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Login del CLIENTE (visitante aprobado desde la landing). Mismo Supabase Auth
// que el staff; el middleware lo manda a /entradas según su rol. Quien todavía
// no tiene acceso, lo pide desde la landing. También ofrece el reset de
// contraseña self-service (envía un link al email vía Supabase Auth).
export default function IngresarPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEnviado, setResetEnviado] = useState(false);

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

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar`,
    });
    setLoading(false);
    // No revelamos si el email existe: siempre mostramos el mismo mensaje.
    if (error && !/rate|limit/i.test(error.message)) {
      setError("No se pudo enviar el link. Probá de nuevo en un momento.");
      return;
    }
    setResetEnviado(true);
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
  const btnCls =
    "w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="ticket-shadow w-full max-w-sm overflow-hidden rounded-3xl">
        <div className="holo-strip" aria-hidden />
        <div className="surface-ink punch-b px-6 pb-7 pt-6 text-white">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            <span className="inline-block h-2 w-2 rounded-full bg-brand" />
            TicketMirror
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
            {modo === "login" ? "Ingresá a la tienda" : "Recuperar contraseña"}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {modo === "login"
              ? "Con el usuario y la contraseña que te enviamos."
              : "Te mandamos un link para crear una nueva."}
          </p>
        </div>

        <div className="punch-t bg-white">
          <div className="perf-line-light mx-6" />

          {modo === "login" ? (
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

              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? "Ingresando…" : "Ingresar"}
              </button>

              <div className="flex items-center justify-between pt-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setModo("reset");
                    setError(null);
                  }}
                  className="font-medium text-brand hover:underline"
                >
                  Olvidé mi contraseña
                </button>
                <Link href="/" className="text-muted hover:underline">
                  Solicitar acceso
                </Link>
              </div>
            </form>
          ) : resetEnviado ? (
            <div className="space-y-4 p-6">
              <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                Si hay una cuenta con ese email, te enviamos un link para crear una
                contraseña nueva. Revisá tu casilla (y el spam).
              </p>
              <button
                type="button"
                onClick={() => {
                  setModo("login");
                  setResetEnviado(false);
                }}
                className={btnCls}
              >
                Volver al ingreso
              </button>
            </div>
          ) : (
            <form onSubmit={onReset} className="space-y-4 p-6">
              <div>
                <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-[#4A4E5E]">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </div>

              {error && (
                <p className="rounded-lg bg-estado-cancelada/10 px-3 py-2 text-sm text-estado-cancelada">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? "Enviando…" : "Enviar link de recuperación"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setModo("login");
                  setError(null);
                }}
                className="w-full pt-1 text-center text-sm text-muted hover:underline"
              >
                ← Volver al ingreso
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
