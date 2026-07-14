"use client";

// El "Descargar PDF" es el diálogo de imprimir del navegador: la hoja tiene
// CSS de impresión (fondo blanco, sin sombras) y sale un PDF limpio.
export default function BotonImprimir({ label }: { label: string }) {
  return (
    <button className="fac-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
