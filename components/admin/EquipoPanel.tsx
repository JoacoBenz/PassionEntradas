"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmarBoton from "@/components/ConfirmarBoton";
import { fechaHora } from "@/lib/fechas";
import type { MiembroEquipo, RolEquipo } from "@/lib/equipo";

// Pantalla Equipo (solo administrador): quiénes están en el panel, sumar a
// alguien con contraseña temporal, cambiarle el rol y desactivarlo o
// reactivarlo. Las guardas (no bajarse a uno mismo, no dejar el panel sin
// administradores) las vuelve a chequear el server.

export type CambioRegistrado = {
  id: string;
  email: string | null;
  accion: "alta" | "rol" | "desactivar" | "reactivar";
  rol_antes: string | null;
  rol_despues: string | null;
  por: string;
  created_at: string;
};

type Revelado = { email: string; password: string; mensaje: string; emailEnviado: boolean };

const ROL_LABEL: Record<RolEquipo, string> = { administrador: "Administrador", moderador: "Moderador" };

const btnPrimary =
  "rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-[#4A4E5E] transition-colors hover:bg-canvas disabled:opacity-50";
const btnWarn =
  "rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50";
const btnSiWarn =
  "rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700";
const btnSiBrand =
  "rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep";
const preguntaCls = "text-xs font-semibold text-ink";
const inputCls =
  "w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted";

function textoCambio(c: CambioRegistrado): string {
  const rol = (r: string | null) => (r === "administrador" ? "administrador" : r === "moderador" ? "moderador" : r ?? "—");
  switch (c.accion) {
    case "alta":
      return c.rol_antes === "cliente" ? `pasó de cliente a ${rol(c.rol_despues)}` : `alta como ${rol(c.rol_despues)}`;
    case "rol":
      return `de ${rol(c.rol_antes)} a ${rol(c.rol_despues)}`;
    case "desactivar":
      return "desactivado";
    case "reactivar":
      return "reactivado";
  }
}

export default function EquipoPanel({
  miembros,
  cambios,
  yoId,
}: {
  miembros: MiembroEquipo[];
  cambios: CambioRegistrado[];
  yoId: string;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", rol: "moderador" as RolEquipo });
  const [esCliente, setEsCliente] = useState(false);
  // La cuenta existe pero con el acceso revocado (no es cliente activo).
  const [revocado, setRevocado] = useState(false);
  const [revelado, setRevelado] = useState<Revelado | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  function avisar(tipo: "ok" | "error", msg: string) {
    setAviso({ tipo, msg });
    window.setTimeout(() => setAviso(null), 5000);
  }

  async function copiar(texto: string, etiqueta: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      window.setTimeout(() => setCopiado(null), 1600);
    } catch {
      avisar("error", "No se pudo copiar");
    }
  }

  async function sumar(promover: boolean) {
    if (busy) return;
    setBusy("alta");
    try {
      const res = await fetch("/api/equipo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, promover }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Ya es cliente: se ofrece pasarlo al equipo (sin tocar su clave).
        if (data.esCliente) {
          setEsCliente(true);
          setRevocado(Boolean(data.revocado));
          return;
        }
        avisar("error", typeof data.error === "string" ? data.error : "No se pudo sumar al equipo");
        return;
      }
      setEsCliente(false);
      if (data.credenciales) {
        setRevelado({ ...data.credenciales, mensaje: data.mensaje ?? "", emailEnviado: Boolean(data.emailEnviado) });
      }
      avisar(
        "ok",
        data.aviso ??
          (promover
            ? `${form.email} pasó al equipo como ${ROL_LABEL[form.rol].toLowerCase()}. Entra con su contraseña de siempre.`
            : data.emailEnviado
              ? "Acceso creado y credenciales enviadas por email."
              : "Acceso creado. Enviá las credenciales.")
      );
      setForm({ nombre: "", apellido: "", email: "", rol: form.rol });
      router.refresh();
    } catch {
      avisar("error", "Error de red");
    } finally {
      setBusy(null);
    }
  }

  async function cambiar(m: MiembroEquipo, body: Record<string, unknown>, ok: string) {
    if (busy) return;
    setBusy(m.id);
    try {
      const res = await fetch(`/api/equipo/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        avisar("error", typeof data.error === "string" ? data.error : "No se pudo aplicar el cambio");
        return;
      }
      avisar("ok", data.aviso ?? ok);
      router.refresh();
    } catch {
      avisar("error", "Error de red");
    } finally {
      setBusy(null);
    }
  }

  const adminsActivos = miembros.filter((m) => m.rol === "administrador" && m.activo).length;

  return (
    <section className="card-shadow overflow-hidden rounded-2xl">
      <div className="surface-ink punch-b px-5 py-4 text-white">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">Panel</p>
        <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight">Equipo</h2>
      </div>

      <div className="punch-t bg-white">
        <div className="perf-line-light mx-5" />
        <div className="space-y-6 p-5">
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

          {/* Alta */}
          <form
            className="rounded-xl border border-line p-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void sumar(false);
            }}
          >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sumar al equipo</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label htmlFor="eq-nombre" className={labelCls}>Nombre</label>
                <input
                  id="eq-nombre"
                  required
                  className={inputCls}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="eq-apellido" className={labelCls}>Apellido</label>
                <input
                  id="eq-apellido"
                  className={inputCls}
                  value={form.apellido}
                  onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="eq-email" className={labelCls}>Email</label>
                <input
                  id="eq-email"
                  type="email"
                  required
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setEsCliente(false);
                  }}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="eq-rol" className={labelCls}>Rol</label>
                <select
                  id="eq-rol"
                  className={inputCls}
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as RolEquipo })}
                >
                  <option value="moderador">Moderador (carga)</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {esCliente ? (
                <>
                  <p className="text-xs text-[#4A4E5E]">
                    <b className="[overflow-wrap:anywhere]">{form.email}</b>{" "}
                    {revocado ? "ya tiene cuenta, con el acceso revocado." : "ya tiene cuenta de cliente."}
                  </p>
                  <ConfirmarBoton
                    onConfirm={() => sumar(true)}
                    disabled={busy !== null}
                    className={btnPrimary}
                    pregunta={revocado ? "Pasa al equipo. ¿Seguro?" : "Deja de ser cliente. ¿Seguro?"}
                    si={`Sí, pasar a ${ROL_LABEL[form.rol].toLowerCase()}`}
                    siClassName={btnSiBrand}
                    noClassName={btnGhost}
                    preguntaClassName={preguntaCls}
                  >
                    Pasarlo al equipo
                  </ConfirmarBoton>
                  <button type="button" className={btnGhost} onClick={() => setEsCliente(false)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button type="submit" disabled={busy !== null} className={btnPrimary}>
                  {busy === "alta" ? "Creando…" : "Crear acceso"}
                </button>
              )}
              <p className="text-[11px] text-muted">Se crea con una contraseña temporal que se muestra una sola vez.</p>
            </div>
          </form>

          {revelado && (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Acceso creado — {revelado.email}
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">
                {revelado.emailEnviado
                  ? "Las credenciales ya salieron por email. Guardalas igual: no se vuelven a mostrar."
                  : "Guardá o enviá estas credenciales ahora: no se vuelven a mostrar."}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                {/* En UN renglón: partida no se lee ni se copia bien. */}
                <span className="whitespace-nowrap font-mono text-sm">{revelado.password}</span>
                <button type="button" onClick={() => copiar(revelado.password, "pass")} className={btnGhost}>
                  {copiado === "pass" ? "✓" : "Copiar"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => copiar(revelado.mensaje, "msg")} className={btnPrimary}>
                  {copiado === "msg" ? "✓ Copiado" : "Copiar mensaje (WhatsApp)"}
                </button>
                <button type="button" onClick={() => setRevelado(null)} className={btnGhost}>
                  Listo
                </button>
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              En el equipo ({miembros.filter((m) => m.activo).length})
            </h3>
            {!miembros.some((m) => m.activo && m.avisosWhatsapp && m.telefono) && (
              <p className="rounded-lg bg-canvas px-3 py-2 text-[11px] text-[#4A4E5E]">
                Nadie tiene los avisos por WhatsApp activados: salen a la lista fija de siempre. Al activarlos acá,
                le llegan a cada uno a su teléfono (los pedidos y lo que hay que confirmar o entregar, solo a los
                administradores).
              </p>
            )}
            {miembros.map((m) => {
              const yo = m.id === yoId;
              const ultimoAdmin = m.rol === "administrador" && m.activo && adminsActivos <= 1;
              const otroRol: RolEquipo = m.rol === "administrador" ? "moderador" : "administrador";
              // Se muestran deshabilitadas (con el porqué) en vez de esconderlas.
              const bloqueoRol = yo && m.rol === "administrador" ? "No te podés sacar el rol a vos mismo" : ultimoAdmin ? "Es el único administrador activo" : null;
              const bloqueoBaja = yo ? "No te podés desactivar a vos mismo" : ultimoAdmin ? "Es el único administrador activo" : null;
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border border-line p-3.5 ${m.activo ? "" : "bg-canvas/60"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold [overflow-wrap:anywhere]">
                        {m.nombre ?? m.email}
                        {yo && <span className="ml-1.5 text-xs font-medium text-muted">(vos)</span>}
                      </p>
                      {m.nombre && <p className="break-all text-xs text-muted">{m.email}</p>}
                      <p className="text-[11px] text-muted">
                        {m.ultimoIngreso ? `Último ingreso: ${fechaHora(m.ultimoIngreso)}` : "Todavía no entró"}
                      </p>
                      {/* Avisos por WhatsApp al teléfono de "Mi cuenta". */}
                      {m.activo && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="text-muted">WhatsApp:</span>
                          {m.telefono ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={m.avisosWhatsapp}
                              disabled={busy !== null}
                              onClick={() =>
                                cambiar(
                                  m,
                                  { accion: "whatsapp", activo: !m.avisosWhatsapp },
                                  m.avisosWhatsapp ? "Avisos por WhatsApp desactivados." : `Avisos por WhatsApp a ${m.telefono}.`
                                )
                              }
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold transition-colors disabled:opacity-50 ${
                                m.avisosWhatsapp ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                              }`}
                              title={m.avisosWhatsapp ? "Tocá para dejar de avisarle por WhatsApp" : "Tocá para avisarle por WhatsApp"}
                            >
                              <span className={`h-2 w-2 rounded-full ${m.avisosWhatsapp ? "bg-emerald-600" : "bg-zinc-400"}`} aria-hidden />
                              {m.avisosWhatsapp ? `Avisos a ${m.telefono}` : `Sin avisos (${m.telefono})`}
                            </button>
                          ) : (
                            <span className="text-muted">sin teléfono — se carga en Mi cuenta</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          m.rol === "administrador" ? "bg-indigo-100 text-indigo-800" : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {ROL_LABEL[m.rol]}
                      </span>
                      {!m.activo && (
                        <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
                          Desactivado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {m.activo ? (
                      <>
                        <ConfirmarBoton
                          onConfirm={() =>
                            cambiar(m, { accion: "rol", rol: otroRol }, `${m.nombre ?? m.email} ahora es ${ROL_LABEL[otroRol].toLowerCase()}.`)
                          }
                          disabled={busy !== null || bloqueoRol !== null}
                          title={bloqueoRol ?? undefined}
                          className={btnGhost}
                          pregunta={`¿Pasar a ${ROL_LABEL[otroRol].toLowerCase()}?`}
                          si="Sí, cambiar"
                          siClassName={btnSiBrand}
                          noClassName={btnGhost}
                          preguntaClassName={preguntaCls}
                        >
                          {busy === m.id ? "…" : `Pasar a ${ROL_LABEL[otroRol].toLowerCase()}`}
                        </ConfirmarBoton>
                        <ConfirmarBoton
                          onConfirm={() => cambiar(m, { accion: "desactivar" }, `${m.nombre ?? m.email} quedó desactivado.`)}
                          disabled={busy !== null || bloqueoBaja !== null}
                          title={bloqueoBaja ?? "No puede entrar hasta que lo reactives (conserva el rol)"}
                          className={btnWarn}
                          pregunta="Deja de poder entrar. ¿Seguro?"
                          si="Sí, desactivar"
                          siClassName={btnSiWarn}
                          noClassName={btnGhost}
                          preguntaClassName={preguntaCls}
                        >
                          Desactivar
                        </ConfirmarBoton>
                      </>
                    ) : (
                      <ConfirmarBoton
                        onConfirm={() => cambiar(m, { accion: "reactivar" }, `${m.nombre ?? m.email} puede volver a entrar.`)}
                        disabled={busy !== null}
                        className={btnGhost}
                        pregunta="¿Reactivar?"
                        si="Sí, reactivar"
                        siClassName={btnSiBrand}
                        noClassName={btnGhost}
                        preguntaClassName={preguntaCls}
                      >
                        {busy === m.id ? "…" : "Reactivar"}
                      </ConfirmarBoton>
                    )}
                    {(bloqueoRol || bloqueoBaja) && m.activo && (
                      <span className="text-[11px] text-muted">{bloqueoBaja ?? bloqueoRol}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Registro */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Cambios recientes</h3>
            {cambios.length === 0 ? (
              <p className="rounded-xl bg-canvas px-3 py-4 text-center text-sm text-muted">Sin cambios registrados.</p>
            ) : (
              <ul className="divide-y divide-dashed divide-line rounded-xl border border-line">
                {cambios.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3.5 py-2 text-xs">
                    <span>
                      <b className="font-semibold [overflow-wrap:anywhere]">{c.email ?? "—"}</b> {textoCambio(c)}
                    </span>
                    <span className="text-muted">
                      {c.por} · {fechaHora(c.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
