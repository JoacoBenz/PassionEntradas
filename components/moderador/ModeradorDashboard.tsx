"use client";

import { useState } from "react";
import { whatsappMessage, type Operacion } from "@/lib/operaciones";
import NewOperacionForm from "@/components/admin/NewOperacionForm";
import OperacionCard from "@/components/admin/OperacionCard";
import { ToastViewport, useToast } from "@/components/admin/Toast";

type Props = {
  initial: Operacion[];
  baseUrl: string;
  prefill?: { evento?: string; ticketId?: string };
};

// Módulo del moderador: carga la entrada a vender con los datos de
// comprador y vendedor, y comparte el link. Los estados los maneja el admin.
export default function ModeradorDashboard({ initial, baseUrl, prefill }: Props) {
  const [ops, setOps] = useState<Operacion[]>(initial);
  const [lastCreated, setLastCreated] = useState<Operacion | null>(null);
  const { toasts, push } = useToast();

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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,380px)_1fr]">
        {/* Columna izquierda: carga */}
        <div className="min-w-0 md:sticky md:top-6 md:self-start">
          <NewOperacionForm
            prefill={prefill}
            onCreated={(op) => {
              setOps((prev) => [op, ...prev]);
              setLastCreated(op);
              push("success", `Operación ${op.code} creada`);
            }}
            onError={(m) => push("error", m)}
          />
        </div>

        {/* Columna derecha: link para compartir + cargadas recientes */}
        <div className="space-y-3">
          {lastCreated && (
            <div className="card-shadow overflow-hidden rounded-2xl bg-white">
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

          <h2 className="pt-2 text-xs font-medium uppercase tracking-widest text-muted">
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
        </div>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
