"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatARS, formatFecha } from "@/lib/operaciones";
import {
  PUBLICACION_COLOR,
  PUBLICACION_LABEL,
  SOLICITUD_COLOR,
  SOLICITUD_LABEL,
  type Publicacion,
  type Solicitud,
} from "@/lib/comunidad";

type Props = { alias: string; staff: boolean; mock: boolean };

const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelCls =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-[#6A6E7E]";

// Feed de la comunidad: publicar, mirar y pedir comprar. Toda compra se
// concreta por medio del administrador (custodia), nunca entre privados.
export default function Feed({ alias, staff, mock }: Props) {
  const [pubs, setPubs] = useState<Publicacion[]>([]);
  const [misSolicitudes, setMisSolicitudes] = useState<Solicitud[]>([]);
  const [yoId, setYoId] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [form, setForm] = useState({ evento: "", fecha_evento: "", precio: "", cantidad: "1", descripcion: "" });
  const [solicitando, setSolicitando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/publicaciones")
      .then((r) => r.json())
      .then((data) => {
        if (!vivo) return;
        setPubs(data.publicaciones ?? []);
        setMisSolicitudes(data.mis_solicitudes ?? []);
        setYoId(data.yo?.id ?? "");
      })
      .catch(() => vivo && setAviso({ tipo: "error", msg: "No se pudo cargar el feed" }))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  function avisar(tipo: "ok" | "error", msg: string) {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 4000);
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    setPublicando(true);
    try {
      const res = await fetch("/api/publicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: form.evento,
          fecha_evento: form.fecha_evento || null,
          precio: Number(form.precio || 0),
          cantidad: Number(form.cantidad || 1),
          descripcion: form.descripcion || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        avisar("error", data.error ?? "No se pudo publicar");
        return;
      }
      setPubs((prev) => [data, ...prev]);
      setForm({ evento: "", fecha_evento: "", precio: "", cantidad: "1", descripcion: "" });
      setFormAbierto(false);
      avisar("ok", "Entrada publicada en el feed");
    } catch {
      avisar("error", "Error de red al publicar");
    } finally {
      setPublicando(false);
    }
  }

  async function solicitar(pub: Publicacion) {
    setSolicitando(pub.id);
    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicacion_id: pub.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        avisar("error", data.error ?? "No se pudo enviar la solicitud");
        return;
      }
      setMisSolicitudes((prev) => [...prev, data]);
      avisar("ok", "Solicitud enviada: el administrador arma la operación y te contacta");
    } catch {
      avisar("error", "Error de red al solicitar");
    } finally {
      setSolicitando(null);
    }
  }

  async function cambiarEstado(pub: Publicacion, estado: Publicacion["estado"]) {
    try {
      const res = await fetch(`/api/publicaciones/${pub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) {
        avisar("error", data.error ?? "No se pudo actualizar");
        return;
      }
      setPubs((prev) => prev.map((p) => (p.id === pub.id ? data : p)));
      avisar("ok", estado === "retirada" ? "Publicación retirada" : "Publicación activa de nuevo");
    } catch {
      avisar("error", "Error de red");
    }
  }

  async function salir() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/ingresar";
  }

  // Una rechazada no bloquea: el usuario puede volver a pedir la entrada.
  const solicitudPor = useMemo(() => {
    const map = new Map<string, Solicitud>();
    for (const s of misSolicitudes) {
      if (s.estado === "rechazada") continue;
      map.set(s.publicacion_id, s);
    }
    return map;
  }, [misSolicitudes]);

  // En el feed general no aparecen las retiradas ajenas ni las vendidas
  // viejas de otros; las propias se ven todas para poder gestionarlas.
  const visibles = pubs.filter(
    (p) => p.user_id === yoId || p.estado === "activa" || p.estado === "en_proceso"
  );

  return (
    <main className="min-h-svh pb-12">
      <header className="surface-ink pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold"
              aria-hidden
            >
              A
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold leading-tight">
                AdminTickets
              </p>
              <p className="text-[11px] leading-tight text-white/55">Comunidad</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {staff && (
              <Link
                href="/admin"
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
              >
                Ir al panel
              </Link>
            )}
            <span className="max-w-[9rem] truncate rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-xs text-white/75">
              {alias}
            </span>
            {!mock && (
              <button
                onClick={salir}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
              >
                Salir
              </button>
            )}
          </div>
        </div>
        <div className="holo-strip" aria-hidden />
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-5">
        {/* Cómo funciona: la custodia siempre en el medio */}
        <div className="card-shadow mb-5 rounded-2xl bg-white px-4 py-3 text-sm text-[#4A4E5E]">
          <span className="font-semibold text-ink">Comprá y vendé sin riesgo:</span>{" "}
          acá nadie se transfiere nada entre privados. Cuando alguien quiere tu
          entrada, el administrador arma una operación en custodia y los guía
          paso a paso.
        </div>

        {aviso && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
              aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
            }`}
            role="status"
          >
            {aviso.msg}
          </div>
        )}

        {/* Publicar */}
        <section className="mb-6">
          {!formAbierto ? (
            <button
              onClick={() => setFormAbierto(true)}
              className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep"
            >
              + Publicar una entrada
            </button>
          ) : (
            <form onSubmit={publicar} className="card-shadow space-y-3 rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold tracking-tight">
                  Publicar una entrada
                </h2>
                <button
                  type="button"
                  onClick={() => setFormAbierto(false)}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-[#4A4E5E]"
                >
                  Cerrar
                </button>
              </div>
              <div>
                <label htmlFor="evento" className={labelCls}>
                  Evento
                </label>
                <input
                  id="evento"
                  className={inputCls}
                  value={form.evento}
                  onChange={(e) => setForm((f) => ({ ...f, evento: e.target.value }))}
                  placeholder="Coldplay en River — Campo"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="fecha" className={labelCls}>
                    Fecha
                  </label>
                  <input
                    id="fecha"
                    type="date"
                    className={inputCls}
                    value={form.fecha_evento}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_evento: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="precio" className={labelCls}>
                    Precio (ARS)
                  </label>
                  <input
                    id="precio"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className={`${inputCls} font-mono`}
                    value={form.precio}
                    onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    placeholder="120000"
                  />
                </div>
                <div>
                  <label htmlFor="cantidad" className={labelCls}>
                    Cantidad
                  </label>
                  <input
                    id="cantidad"
                    type="number"
                    min={1}
                    max={10}
                    inputMode="numeric"
                    className={`${inputCls} font-mono`}
                    value={form.cantidad}
                    onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="descripcion" className={labelCls}>
                  Detalle (opcional)
                </label>
                <textarea
                  id="descripcion"
                  rows={2}
                  maxLength={1000}
                  className={`${inputCls} resize-y`}
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Sector, fila, si van juntas…"
                />
              </div>
              <button
                type="submit"
                disabled={publicando}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
              >
                {publicando ? "Publicando…" : "Publicar"}
              </button>
            </form>
          )}
        </section>

        {/* Feed */}
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Entradas de la comunidad
        </h2>

        {cargando ? (
          <p className="py-10 text-center text-sm text-muted">Cargando el feed…</p>
        ) : visibles.length === 0 ? (
          <p className="card-shadow rounded-2xl bg-white px-4 py-10 text-center text-sm text-muted">
            Todavía no hay entradas publicadas. Sé el primero.
          </p>
        ) : (
          <ul className="space-y-3">
            {visibles.map((pub) => {
              const esMia = pub.user_id === yoId;
              const sol = solicitudPor.get(pub.id);
              const color = PUBLICACION_COLOR[pub.estado];
              return (
                <li key={pub.id} className="card-shadow overflow-hidden rounded-2xl bg-white">
                  <div className="border-l-4 p-4" style={{ borderColor: color }}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold leading-tight tracking-tight">
                          {pub.evento}
                        </h3>
                        <p className="mt-0.5 text-sm text-muted">
                          {pub.fecha_evento ? formatFecha(pub.fecha_evento) : "Fecha a confirmar"}
                          {" · "}
                          {pub.cantidad} {pub.cantidad === 1 ? "entrada" : "entradas"}
                          {" · "}
                          vende <span className="font-mono">{esMia ? "vos" : pub.vendedor_alias}</span>
                        </p>
                      </div>
                      <span
                        className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: `${color}1a`, color }}
                      >
                        {PUBLICACION_LABEL[pub.estado]}
                      </span>
                    </div>

                    {pub.descripcion && (
                      <p className="mt-2 text-sm text-[#4A4E5E]">{pub.descripcion}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-2xl font-bold tabular-nums tracking-tight">
                        {formatARS(pub.precio)}
                      </p>

                      {esMia ? (
                        pub.estado === "activa" ? (
                          <button
                            onClick={() => cambiarEstado(pub, "retirada")}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-[#4A4E5E] transition-colors hover:bg-canvas"
                          >
                            Retirar publicación
                          </button>
                        ) : pub.estado === "retirada" ? (
                          <button
                            onClick={() => cambiarEstado(pub, "activa")}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-[#4A4E5E] transition-colors hover:bg-canvas"
                          >
                            Publicar de nuevo
                          </button>
                        ) : null
                      ) : sol ? (
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: `${SOLICITUD_COLOR[sol.estado]}1a`,
                            color: SOLICITUD_COLOR[sol.estado],
                          }}
                        >
                          Tu solicitud: {SOLICITUD_LABEL[sol.estado]}
                        </span>
                      ) : pub.estado === "activa" ? (
                        <button
                          onClick={() => solicitar(pub)}
                          disabled={solicitando === pub.id}
                          className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {solicitando === pub.id ? "Enviando…" : "Quiero comprarla"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
