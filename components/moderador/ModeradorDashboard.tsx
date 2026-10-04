"use client";

import { useEffect, useState } from "react";
import { whatsappMessage, type Consulta, type Moneda, type Operacion } from "@/lib/operaciones";
import ConsultaCard from "@/components/admin/ConsultaCard";
import NewOperacionForm from "@/components/admin/NewOperacionForm";
import OperacionCard from "@/components/admin/OperacionCard";
import MetricsBoard from "@/components/moderador/MetricsBoard";
import { ToastViewport, useToast } from "@/components/admin/Toast";
import type { Metrics } from "@/lib/metrics";

type Props = {
  initial: Operacion[];
  consultas: Consulta[];
  metrics: Metrics;
  baseUrl: string;
  prefill?: { evento?: string; ticketId?: string };
};

// Módulo del moderador: carga la entrada a vender con los datos de
// comprador y vendedor, y comparte el link. Los estados los maneja el admin.
export default function ModeradorDashboard({
  initial,
  consultas: consultasIniciales,
  metrics,
  baseUrl,
  prefill,
}: Props) {
  const [ops, setOps] = useState<Operacion[]>(initial);
  // Lista viva: AutoRefresh vuelve a pedir la página cada tanto y `initial`
  // llega con los datos nuevos (cambios de estado que hace el admin). Sin esto
  // la lista quedaba congelada en lo que había al abrir la página.
  useEffect(() => {
    setOps(initial);
  }, [initial]);
  const [lastCreated, setLastCreated] = useState<Operacion | null>(null);
  const { toasts, push } = useToast();

  // Consultas de la tienda sin cotizar. El moderador las cotiza igual que el
  // admin (misma tarjeta, mismo endpoint): al ponerle costo y comisión, la
  // consulta se convierte en una operación.
  const [consultas, setConsultas] = useState<Consulta[]>(consultasIniciales);
  const [cotizando, setCotizando] = useState<string | null>(null);
  useEffect(() => {
    setConsultas(consultasIniciales);
  }, [consultasIniciales]);

  async function cotizar(
    c: Consulta,
    valores: { costo: number; comision: number; moneda: Moneda }
  ): Promise<string | null> {
    setCotizando(c.id);
    try {
      const res = await fetch(`/api/consultas/${c.id}/convertir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error ?? "No se pudo cargar la operación";
        push("error", msg);
        return msg;
      }
      setConsultas((prev) => prev.filter((x) => x.id !== c.id));
      push("success", `Consulta cotizada: operación ${data.operacion?.code ?? ""} creada`);
      return null;
    } catch {
      push("error", "Error de red al cotizar");
      return "Error de red al cotizar";
    } finally {
      setCotizando(null);
    }
  }

  // Consulta sin entrada: se cierra y el cliente la ve como "No disponible".
  async function descartar(c: Consulta) {
    setCotizando(c.id);
    try {
      const res = await fetch(`/api/consultas/${c.id}/descartar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        push("error", data.error ?? "No se pudo descartar la consulta");
        return;
      }
      setConsultas((prev) => prev.filter((x) => x.id !== c.id));
      push("success", `Consulta ${c.code} marcada como no disponible`);
    } catch {
      push("error", "Error de red. Reintentá.");
    } finally {
      setCotizando(null);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      push("success", label);
    } catch {
      push("error", "No se pudo copiar");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Resumen */}
      <MetricsBoard metrics={metrics} />

      {/* Módulo de carga: el foco de esta página, a lo ancho y arriba de todo. */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-tight">
          Módulo de carga
        </h2>
        <NewOperacionForm
          prefill={prefill}
          onCreated={(op) => {
            setOps((prev) => [op, ...prev]);
            setLastCreated(op);
            push("success", `Operación ${op.code} creada`);
          }}
          onError={(m) => push("error", m)}
        />

        {lastCreated && (
          <div className="card-shadow mt-3 overflow-hidden rounded-2xl bg-white">
            <div className="border-l-4 border-estado-confirmada px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Lista para compartir
              </p>
              <p className="mt-1 font-mono text-sm">{lastCreated.code}</p>
              <p className="truncate font-display font-semibold">
                {lastCreated.evento}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    copy(`${baseUrl}/op/${lastCreated.id}`, "Link copiado")
                  }
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep"
                >
                  Copiar link
                </button>
                <button
                  onClick={() =>
                    copy(
                      whatsappMessage(
                        lastCreated.evento,
                        `${baseUrl}/op/${lastCreated.id}`
                      ),
                      "Mensaje de WhatsApp copiado"
                    )
                  }
                  className="rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  Copiar WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Consultas a cotizar */}
      {consultas.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
            Consultas a cotizar ({consultas.length})
          </h2>
          {consultas.map((c) => (
            <ConsultaCard
              key={c.id}
              consulta={c}
              busy={cotizando === c.id}
              onCargar={cotizar}
              onDescartar={descartar}
              onError={(m) => push("error", m)}
            />
          ))}
        </section>
      )}

      {/* Cargadas recientemente */}
      <section className="mt-8 space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
          Cargadas recientemente
        </h2>
        {ops.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C5C9D6] bg-white/50 px-4 py-10 text-center text-sm text-muted">
            Todavía no hay operaciones. Cargá la primera desde el formulario.
          </div>
        ) : (
          ops.map((op) => (
            <OperacionCard
              key={op.id}
              op={op}
              baseUrl={baseUrl}
              readOnly
              onCopied={(m) => push("success", m)}
            />
          ))
        )}
      </section>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
