import {
  STATUS_COLOR,
  STATUS_LABEL,
  formatARS,
  type OperacionPublica,
} from "@/lib/operaciones";
import ProgressSteps from "./ProgressSteps";

// Código de barras decorativo, derivado determinísticamente del code de la
// operación (cada char define anchos de barra). Refuerza el motivo "entrada".
function Barcode({ code }: { code: string }) {
  const chars = Array.from(code.replace(/-/g, ""));
  return (
    <div className="flex h-10 items-stretch justify-center gap-[3px]" aria-hidden>
      {chars.flatMap((ch, i) => {
        const n = ch.charCodeAt(0);
        const widths = [2, 1 + (n % 3), 2 + ((n >> 1) % 3), 1 + ((n >> 2) % 2)];
        return widths.map((w, j) => (
          <span
            key={`${i}-${j}`}
            className="inline-block rounded-[1px] bg-ink"
            style={{ width: w }}
          />
        ));
      })}
    </div>
  );
}

// Microtexto de seguridad repetido (como en un billete o entrada real).
function Microtext({ dark = false }: { dark?: boolean }) {
  return (
    <p
      className={`microtext text-center ${dark ? "text-white/25" : "text-ink/20"}`}
      aria-hidden
    >
      {"ADMINTICKETS·CUSTODIA·VERIFICADO·".repeat(6)}
    </p>
  );
}

// Talón / stub de entrada. El contenedor no pinta fondo: cada sección pinta
// el suyo y enmascara medio círculo en sus juntas (.punch-*), así el
// troquelado son agujeros de verdad a través de los que se ve la página.
export default function StatusStub({ op }: { op: OperacionPublica }) {
  const color = STATUS_COLOR[op.status];
  const actualizado = new Date(op.updated_at).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="ticket-shadow overflow-hidden rounded-3xl">
        {/* Franja holográfica de seguridad */}
        <div className="holo-strip" aria-hidden />

        {/* Cabecera oscura: marca, code y evento */}
        <div className="surface-ink punch-b text-white">
          <div className="relative px-6 pb-8 pt-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-brand"
                  aria-hidden
                />
                AdminTickets · Custodia
              </div>
              <span className="whitespace-nowrap rounded-md border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/75">
                {op.code}
              </span>
            </div>
            <h1 className="mt-4 font-display text-[1.7rem] font-bold leading-tight tracking-tight">
              {op.evento}
            </h1>
          </div>
        </div>

        {/* Sección oscura del sello, separada por troquel real */}
        <div className="punch-t bg-ink text-white">
          <div className="perf-line mx-6" />
          <div className="flex justify-center px-6 pb-7 pt-9">
            <div
              className="stamp stamp-animate w-full max-w-[330px] px-6 py-3.5 text-center"
              style={{ color }}
            >
              <span className="block text-[10px] font-semibold tracking-[0.3em] opacity-70">
                Estado
              </span>
              <span
                className="mt-0.5 block font-display text-xl font-bold leading-tight tracking-wide sm:text-2xl"
                style={{ textWrap: "balance" }}
              >
                {STATUS_LABEL[op.status]}
              </span>
            </div>
          </div>
          <div className="px-6 pb-4">
            <Microtext dark />
          </div>
        </div>

        {/* Cuerpo blanco */}
        <div className="punch-b bg-white">
          <div className="space-y-6 px-6 py-7">
            <ProgressSteps status={op.status} />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  Monto
                </dt>
                <dd className="mt-0.5 font-display text-3xl font-bold tabular-nums tracking-tight">
                  {formatARS(op.monto)}
                </dd>
              </div>
              {op.comprador_alias && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                    Comprador
                  </dt>
                  <dd className="mt-0.5 font-medium">{op.comprador_alias}</dd>
                </div>
              )}
              {op.vendedor_alias && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                    Vendedor
                  </dt>
                  <dd className="mt-0.5 font-medium">{op.vendedor_alias}</dd>
                </div>
              )}
            </dl>

            <div className="rounded-xl bg-canvas px-4 py-3">
              <p className="flex items-center gap-2 text-sm text-[#4A4E5E]">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                Esta página se actualiza sola. No hace falta que preguntes.
              </p>
            </div>

            <p className="text-center text-xs text-muted">
              Última actualización: {actualizado}
            </p>
          </div>
        </div>

        {/* Pie con troquel real + barcode */}
        <div className="punch-t bg-white">
          <div className="perf-line-light mx-6" />
          <div className="px-6 pb-6 pt-5">
            <Barcode code={op.code} />
            <p className="mt-2 text-center font-mono text-[11px] tracking-[0.35em] text-muted">
              {op.code}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
