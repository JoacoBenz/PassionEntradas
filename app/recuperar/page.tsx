"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Destino del link de recuperación de contraseña. Supabase deja una sesión de
// recuperación al abrir el link (PKCE: ?code=... que se canjea acá); con esa
// sesión el cliente setea una contraseña nueva y entra a la tienda.
// Fuera del matcher del middleware (público): la sesión la trae el propio link.
type Fase = "verificando" | "listo" | "invalido" | "guardando" | "ok";

export default function RecuperarPage() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("verificando");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let vivo = true;

    async function preparar() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      // Flujo PKCE (@supabase/ssr): el link trae ?code=... para canjear.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!vivo) return;
        setFase(error ? "invalido" : "listo");
        return;
      }
      // Fallback: el link ya dejó una sesión (flujo con hash) o expiró.
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      setFase(data.session ? "listo" : "invalido");
    }

    preparar();
    return () => {
      vivo = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setFase("guardando");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("No se pudo guardar la contraseña. Pedí un link nuevo.");
      setFase("listo");
      return;
    }
    setFase("ok");
    setTimeout(() => {
      router.replace("/entradas");
      router.refresh();
    }, 1200);
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
            Nueva contraseña
          </h1>
        </div>

        <div className="punch-t bg-white">
          <div className="perf-line-light mx-6" />
          <div className="p-6">
            {fase === "verificando" && (
              <p className="py-4 text-center text-sm text-muted">Verificando el link…</p>
            )}

            {fase === "invalido" && (
              <div className="space-y-4">
                <p className="rounded-lg bg-estado-cancelada/10 px-3 py-3 text-sm text-estado-cancelada">
                  El link no es válido o venció. Pedí uno nuevo desde el ingreso.
                </p>
                <Link href="/ingresar" className={`${btnCls} block text-center`}>
                  Ir al ingreso
                </Link>
              </div>
            )}

            {fase === "ok" && (
              <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                ¡Listo! Entrando a la tienda…
              </p>
            )}

            {(fase === "listo" || fase === "guardando") && (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label htmlFor="p1" className="mb-1 block text-sm font-medium text-[#4A4E5E]">
                    Nueva contraseña
                  </label>
                  <input
                    id="p1"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="p2" className="mb-1 block text-sm font-medium text-[#4A4E5E]">
                    Repetir contraseña
                  </label>
                  <input
                    id="p2"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-estado-cancelada/10 px-3 py-2 text-sm text-estado-cancelada">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={fase === "guardando"} className={btnCls}>
                  {fase === "guardando" ? "Guardando…" : "Guardar y entrar"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
