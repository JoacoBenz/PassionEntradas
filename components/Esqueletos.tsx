// Pantallas de "cargando" (app/**/loading.tsx). Aparecen al instante al tocar
// un link mientras el server arma la página nueva, en vez de dejar la página
// vieja congelada. Son estáticas: Next las precarga junto con el link.

export function EsqueletoTienda({ tarjetas = 4 }: { tarjetas?: number }) {
  return (
    <div className="sk-tienda" role="status" aria-label="Cargando">
      <div className="sk-row">
        <span className="sk sk-logo" />
        <span className="sk sk-pill" />
      </div>
      <span className="sk sk-title" />
      <span className="sk sk-line" />
      {Array.from({ length: tarjetas }, (_, i) => (
        <span key={i} className="sk sk-card" />
      ))}
    </div>
  );
}

export function EsqueletoPanel() {
  return (
    <div className="min-h-screen" role="status" aria-label="Cargando">
      <div className="surface-ink h-14 pt-[env(safe-area-inset-top)]" />
      <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-5">
        <div className="h-7 w-48 animate-pulse rounded-md bg-black/10" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-black/[0.07]" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-black/[0.07]" />
        ))}
      </div>
    </div>
  );
}
