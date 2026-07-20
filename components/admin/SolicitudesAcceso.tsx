"use client";

import { useMemo, useState } from "react";
import type { SolicitudAcceso } from "@/lib/acceso";

// Cola de solicitudes de acceso a la tienda. El admin aprueba (crea el usuario
// cliente y muestra las credenciales UNA vez) o rechaza. Al aprobar se ofrecen
// las DOS vías de entrega: copiar el mensaje (WhatsApp/texto, siempre) y
// enviar por email (si hay proveedor conectado).

type Credenciales = { email: string; password: string };
type Reveal = { creds: Credenciales; mensaje: string; emailConfigurado: boolean };
type EmailEstado =
  | { estado: "idle" }
  | { estado: "sending" }
  | { estado: "sent" }
  | { estado: "error"; msg: string };

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SolicitudesAcceso({ initial }: { initial: SolicitudAcceso[] }) {
  const [items, setItems] = useState<SolicitudAcceso[]>(initial);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [reveal, setReveal] = useState<Record<string, Reveal>>({});
  const [emailEstado, setEmailEstado] = useState<Record<string, EmailEstado>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);

  const pendientes = useMemo(
    () => items.filter((s) => s.estado === "pendiente"),
    [items]
  );
  const resueltas = useMemo(
    () =>
      items
        .filter((s) => s.estado !== "pendiente")
        .sort((a, b) => (b.decidida_at ?? "").localeCompare(a.decidida_at ?? "")),
    [items]
  );

  function avisar(tipo: "ok" | "error", msg: string) {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 4500);
  }

  async function copiar(id: string, texto: string, etiqueta: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(`${id}:${etiqueta}`);
      setTimeout(() => setCopiado(null), 1600);
    } catch {
      avisar("error", "No se pudo copiar");
    }
  }

  async function decidir(id: string, accion: "aprobar" | "rechazar") {
    if (busy[id]) return;
    if (accion === "rechazar" && !confirm("¿Rechazar esta solicitud?")) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/acceso/${id}/decidir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        avisar("error", typeof data?.error === "string" ? data.error : "No se pudo resolver");
        return;
      }
      const ahora = new Date().toISOString();
      setItems((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, estado: accion === "aprobar" ? "aprobada" : "rechazada", decidida_at: ahora }
            : s
        )
      );
      if (accion === "aprobar" && data.credenciales) {
        setReveal((r) => ({
          ...r,
          [id]: {
            creds: data.credenciales,
            mensaje: data.mensaje ?? "",
            emailConfigurado: Boolean(data.emailConfigurado),
          },
        }));
        avisar("ok", "Acceso creado. Enviá las credenciales al cliente.");
      } else {
        avisar("ok", "Solicitud rechazada.");
      }
    } catch {
      avisar("error", "Error de red");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  // Reenviar el acceso de una solicitud ya aprobada desde el historial:
  // regenera la contraseña y muestra las credenciales nuevas para reenviar.
  async function reenviar(id: string) {
    if (busy[id]) return;
    if (!confirm("Reenviar el acceso genera una contraseña nueva (la anterior deja de funcionar). ¿Continuar?"))
      return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/acceso/${id}/reenviar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        avisar("error", typeof data?.error === "string" ? data.error : "No se pudo reenviar");
        return;
      }
      setEmailEstado((e) => ({ ...e, [id]: { estado: "idle" } }));
      setReveal((r) => ({
        ...r,
        [id]: {
          creds: data.credenciales,
          mensaje: data.mensaje ?? "",
          emailConfigurado: Boolean(data.emailConfigurado),
        },
      }));
      avisar("ok", "Acceso regenerado. Copiá o enviá las credenciales nuevas.");
    } catch {
      avisar("error", "Error de red");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  // Revoca / reactiva el acceso de un cliente aprobado.
  async function revocar(id: string, accion: "revocar" | "reactivar") {
    if (busy[id]) return;
    const msg =
      accion === "revocar"
        ? "Revocar el acceso: el cliente deja de poder entrar hasta que lo reactives. ¿Continuar?"
        : "Reactivar el acceso de este cliente?";
    if (!confirm(msg)) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/acceso/${id}/revocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        avisar("error", typeof data?.error === "string" ? data.error : "No se pudo cambiar el acceso");
        return;
      }
      const ahora = new Date().toISOString();
      setItems((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                revocada_at: accion === "revocar" ? ahora : null,
                revocada_por: accion === "revocar" ? "vos" : null,
              }
            : s
        )
      );
      avisar("ok", accion === "revocar" ? "Acceso revocado." : "Acceso reactivado.");
    } catch {
      avisar("error", "Error de red");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function enviarEmail(id: string, password: string) {
    setEmailEstado((e) => ({ ...e, [id]: { estado: "sending" } }));
    try {
      const res = await fetch(`/api/acceso/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailEstado((e) => ({
          ...e,
          [id]: { estado: "error", msg: typeof data?.error === "string" ? data.error : "No se pudo enviar" },
        }));
        return;
      }
      setEmailEstado((e) => ({ ...e, [id]: { estado: "sent" } }));
    } catch {
      setEmailEstado((e) => ({ ...e, [id]: { estado: "error", msg: "Error de red" } }));
    }
  }

  const btnPrimary =
    "rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-50";
  const btnGhost =
    "rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-[#4A4E5E] transition-colors hover:bg-canvas disabled:opacity-50";
  const btnDanger =
    "rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50";
  const btnWarn =
    "rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50";

  return (
    <section className="card-shadow overflow-hidden rounded-2xl">
      <div className="surface-ink punch-b px-5 py-4 text-white">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
          Landing
        </p>
        <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight">
          Solicitudes de acceso
        </h2>
      </div>

      <div className="punch-t bg-white">
        <div className="perf-line-light mx-5" />
        <div className="space-y-5 p-5">
          <p className="text-sm text-[#4A4E5E]">
            Los visitantes de la landing piden acceso a la tienda. Al{" "}
            <b>aprobar</b> se crea un usuario cliente y se generan las
            credenciales: copialas o enviálas por email. Las credenciales se
            muestran una sola vez.
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

          {/* Pendientes */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Pendientes ({pendientes.length})
            </h3>
            {pendientes.length === 0 ? (
              <p className="rounded-xl bg-canvas px-3 py-4 text-center text-sm text-muted">
                No hay solicitudes pendientes.
              </p>
            ) : (
              pendientes.map((s) => (
                <div key={s.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{s.nombre}</p>
                      <p className="break-all text-xs text-muted">{s.email}</p>
                      {s.telefono && (
                        <p className="text-xs text-muted">{s.telefono}</p>
                      )}
                      {s.direccion && (
                        <p className="text-xs text-muted">{s.direccion}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {fmtFecha(s.created_at)}
                    </span>
                  </div>
                  {s.mensaje && (
                    <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-[#4A4E5E]">
                      {s.mensaje}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => decidir(s.id, "aprobar")}
                      disabled={busy[s.id]}
                      className={btnPrimary}
                    >
                      {busy[s.id] ? "…" : "Aprobar y crear acceso"}
                    </button>
                    <button
                      onClick={() => decidir(s.id, "rechazar")}
                      disabled={busy[s.id]}
                      className={btnDanger}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Credenciales recién generadas (una vez por sesión) */}
          {Object.entries(reveal).map(([id, r]) => {
            const est = emailEstado[id] ?? { estado: "idle" };
            return (
              <div
                key={id}
                className="rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-3.5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Acceso generado — {r.creds.email}
                </p>
                <p className="mt-1 text-xs text-emerald-800/80">
                  Guardá o enviá estas credenciales ahora: no se vuelven a mostrar.
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <span className="font-mono text-sm break-all">{r.creds.email}</span>
                    <button
                      onClick={() => copiar(id, r.creds.email, "user")}
                      className={btnGhost}
                    >
                      {copiado === `${id}:user` ? "✓" : "Copiar"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <span className="font-mono text-sm break-all">{r.creds.password}</span>
                    <button
                      onClick={() => copiar(id, r.creds.password, "pass")}
                      className={btnGhost}
                    >
                      {copiado === `${id}:pass` ? "✓" : "Copiar"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => copiar(id, r.mensaje, "msg")}
                    className={btnPrimary}
                  >
                    {copiado === `${id}:msg` ? "✓ Copiado" : "Copiar mensaje (WhatsApp)"}
                  </button>
                  <button
                    onClick={() => enviarEmail(id, r.creds.password)}
                    disabled={est.estado === "sending" || est.estado === "sent"}
                    className={btnGhost}
                  >
                    {est.estado === "sending"
                      ? "Enviando…"
                      : est.estado === "sent"
                        ? "✓ Enviado por email"
                        : "Enviar por email"}
                  </button>
                  <button
                    onClick={() => setReveal((rv) => { const { [id]: _omit, ...rest } = rv; return rest; })}
                    className={btnGhost}
                  >
                    Listo
                  </button>
                </div>
                {est.estado === "error" && (
                  <p className="mt-2 text-xs font-medium text-red-700">{est.msg}</p>
                )}
                {!r.emailConfigurado && est.estado !== "sent" && (
                  <p className="mt-2 text-xs text-emerald-800/70">
                    El envío por email todavía no está configurado; mientras
                    tanto usá el mensaje para WhatsApp.
                  </p>
                )}
              </div>
            );
          })}

          {/* Resueltas */}
          {resueltas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Historial
              </h3>
              {resueltas.map((s) => {
                const revocada = s.estado === "aprobada" && !!s.revocada_at;
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.nombre}</p>
                      <p className="break-all text-xs text-muted">{s.email}</p>
                      {/* Auditoría: quién decidió/revocó y cuándo. */}
                      <p className="text-[11px] text-muted">
                        {s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                        {s.decidida_por ? ` por ${s.decidida_por}` : ""}
                        {s.decidida_at ? ` · ${fmtFecha(s.decidida_at)}` : ""}
                        {revocada
                          ? ` — revocada${s.revocada_por ? ` por ${s.revocada_por}` : ""}${
                              s.revocada_at ? ` · ${fmtFecha(s.revocada_at)}` : ""
                            }`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          revocada
                            ? "bg-amber-100 text-amber-800"
                            : s.estado === "aprobada"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {revocada ? "Revocado" : s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                      </span>
                      {s.estado === "aprobada" && !revocada && (
                        <>
                          <button
                            onClick={() => reenviar(s.id)}
                            disabled={busy[s.id]}
                            className={btnGhost}
                            title="Genera una contraseña nueva y muestra las credenciales para reenviarlas"
                          >
                            {busy[s.id] ? "…" : "Reenviar acceso"}
                          </button>
                          <button
                            onClick={() => revocar(s.id, "revocar")}
                            disabled={busy[s.id]}
                            className={btnWarn}
                            title="El cliente deja de poder entrar hasta que lo reactives"
                          >
                            Revocar
                          </button>
                        </>
                      )}
                      {revocada && (
                        <button
                          onClick={() => revocar(s.id, "reactivar")}
                          disabled={busy[s.id]}
                          className={btnGhost}
                        >
                          {busy[s.id] ? "…" : "Reactivar"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
