"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Margen = {
  id: string;
  source: string;
  categoria: string | null;
  porcentaje: number;
};

// Márgenes de precio del portal: el % que se le suma al precio de origen.
// El margen general aplica a toda categoría sin regla propia; al guardar se
// recalculan los precios ya publicados y el worker usa las reglas en cada
// corrida.
export default function MargenesPanel() {
  const [margenes, setMargenes] = useState<Margen[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [nuevaCat, setNuevaCat] = useState("");
  const [nuevoPct, setNuevoPct] = useState("");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const enviando = useRef(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/margenes")
      .then((r) => r.json())
      .then((data) => {
        if (!vivo) return;
        setMargenes(data.margenes ?? []);
        setCategorias(data.categorias ?? []);
      })
      .catch(() => vivo && setAviso({ tipo: "error", msg: "No se pudieron cargar los márgenes" }))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  function avisar(tipo: "ok" | "error", msg: string) {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 4500);
  }

  async function guardar(categoria: string | null, valor: string) {
    if (enviando.current) return;
    const pct = Number(valor);
    if (!Number.isFinite(pct) || pct < 0 || pct > 500) {
      avisar("error", "Porcentaje inválido (0 a 500)");
      return;
    }
    enviando.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/margenes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria, porcentaje: pct }),
      });
      const data = await res.json();
      if (!res.ok) {
        avisar("error", data.error ?? "No se pudo guardar");
        return;
      }
      setMargenes((prev) => {
        const sin = prev.filter((m) => m.categoria !== categoria);
        return [...sin, data.margen];
      });
      setDrafts((d) => {
        const { [keyDe(categoria)]: _, ...resto } = d;
        return resto;
      });
      setNuevaCat("");
      setNuevoPct("");
      avisar("ok", `Margen guardado — ${data.recalculadas} precios recalculados`);
    } catch {
      avisar("error", "Error de red al guardar");
    } finally {
      enviando.current = false;
      setBusy(false);
    }
  }

  async function borrar(categoria: string) {
    if (enviando.current) return;
    enviando.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/margenes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria }),
      });
      const data = await res.json();
      if (!res.ok) {
        avisar("error", data.error ?? "No se pudo borrar");
        return;
      }
      setMargenes((prev) => prev.filter((m) => m.categoria !== categoria));
      avisar("ok", `Regla borrada — ${data.recalculadas} precios recalculados con el margen general`);
    } catch {
      avisar("error", "Error de red al borrar");
    } finally {
      enviando.current = false;
      setBusy(false);
    }
  }

  const keyDe = (categoria: string | null) => categoria ?? "__general__";
  const general = margenes.find((m) => m.categoria === null);
  const reglas = useMemo(
    () =>
      margenes
        .filter((m) => m.categoria !== null)
        .sort((a, b) => (a.categoria as string).localeCompare(b.categoria as string)),
    [margenes]
  );
  const sinRegla = useMemo(
    () => categorias.filter((c) => !margenes.some((m) => m.categoria === c)),
    [categorias, margenes]
  );

  const inputPctCls =
    "w-20 rounded-lg border border-line bg-white px-2.5 py-1.5 text-right font-mono text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
  const btnCls =
    "rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-50";

  return (
    <section className="card-shadow overflow-hidden rounded-2xl">
      <div className="surface-ink punch-b px-5 py-4 text-white">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
          Precios del portal
        </p>
        <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight">
          Margen por categoría
        </h2>
      </div>

      <div className="punch-t bg-white">
        <div className="perf-line-light mx-5" />
        <div className="space-y-4 p-5">
          <p className="text-sm text-[#4A4E5E]">
            El porcentaje que se le suma al precio de origen. Al guardar se
            recalculan los precios ya publicados y el worker usa estas reglas
            en cada sincronización.
          </p>

          {aviso && (
            <p
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {aviso.msg}
            </p>
          )}

          {cargando ? (
            <p className="py-4 text-center text-sm text-muted">Cargando…</p>
          ) : (
            <>
              {/* Margen general */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">Margen general</p>
                  <p className="text-xs text-muted">
                    Toda categoría sin regla propia
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Porcentaje del margen general"
                    className={inputPctCls}
                    inputMode="decimal"
                    value={drafts.__general__ ?? String(general?.porcentaje ?? 20)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, __general__: e.target.value }))
                    }
                  />
                  <span className="text-sm text-muted">%</span>
                  <button
                    onClick={() =>
                      guardar(null, drafts.__general__ ?? String(general?.porcentaje ?? 20))
                    }
                    disabled={busy || drafts.__general__ === undefined}
                    className={btnCls}
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {/* Reglas por categoría */}
              {reglas.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {m.categoria}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Porcentaje de ${m.categoria}`}
                      className={inputPctCls}
                      inputMode="decimal"
                      value={drafts[keyDe(m.categoria)] ?? String(m.porcentaje)}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [keyDe(m.categoria)]: e.target.value }))
                      }
                    />
                    <span className="text-sm text-muted">%</span>
                    <button
                      onClick={() =>
                        guardar(m.categoria, drafts[keyDe(m.categoria)] ?? String(m.porcentaje))
                      }
                      disabled={busy || drafts[keyDe(m.categoria)] === undefined}
                      className={btnCls}
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => borrar(m.categoria as string)}
                      disabled={busy}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}

              {/* Agregar regla */}
              <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-4">
                <select
                  aria-label="Categoría para la nueva regla"
                  value={nuevaCat}
                  onChange={(e) => setNuevaCat(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                >
                  <option value="">Elegir categoría…</option>
                  {sinRegla.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Porcentaje de la nueva regla"
                  className={inputPctCls}
                  inputMode="decimal"
                  placeholder="25"
                  value={nuevoPct}
                  onChange={(e) => setNuevoPct(e.target.value)}
                />
                <span className="text-sm text-muted">%</span>
                <button
                  onClick={() => guardar(nuevaCat, nuevoPct)}
                  disabled={busy || !nuevaCat || !nuevoPct}
                  className={btnCls}
                >
                  Agregar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
