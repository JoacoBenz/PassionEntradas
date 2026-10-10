"use client";

// En la tarjeta de la operación: qué se le avisó al cliente (campana y email)
// y si el email salió. Se carga al abrir la tarjeta y cada vez que la
// operación cambia (un cambio de paso puede haber mandado uno nuevo).

import { useEffect, useState } from "react";
import { fechaHora } from "@/lib/fechas";
import { estadoAvisoCliente } from "@/lib/notificaciones";

type Aviso = { id: string; tipo: string; email_estado: string | null; email_error: string | null; leida: boolean; created_at: string };

const TONO = { ok: "text-[#2E7D4F]", error: "text-[#B5304B]", gris: "text-muted" } as const;

export default function AvisosAlCliente({ opId, version }: { opId: string; version: string }) {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/operaciones/${opId}/avisos`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { avisos: [] }))
      .then((d) => vivo && setAvisos(Array.isArray(d.avisos) ? d.avisos : []))
      .catch(() => vivo && setAvisos([]));
    return () => {
      vivo = false;
    };
  }, [opId, version]);

  if (!avisos || avisos.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-line px-3 py-2.5 text-xs">
      <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted">Avisos al cliente</p>
      <ul className="space-y-1.5">
        {avisos.map((a) => {
          const e = estadoAvisoCliente(a);
          return (
            <li key={a.id} className="grid gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-body">{e.titulo}</span>
                <time className="font-mono text-[10px] text-muted" dateTime={a.created_at}>
                  {fechaHora(a.created_at)}
                </time>
                {a.leida && <span className="text-[10px] text-muted">· lo vio en su campana</span>}
              </span>
              <span className={`leading-snug ${TONO[e.tono]}`}>{e.email}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
