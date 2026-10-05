"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Barra fina arriba de todo mientras se navega a otra página.
//
// Sin esto, en el celular tocar un link no mostraba NADA hasta que llegaba la
// página nueva (a veces 1-2 s): parecía que el toque no había entrado y la
// gente volvía a tocar. Arranca apenas se toca un link interno (o cuando el
// código llama a empezarNavegacion() antes de un router.push) y termina cuando
// cambia la URL. Si por algún motivo la URL no cambia, se apaga sola.

const EVENTO = "tm:navegando";

/** Para navegaciones con router.push: mostrar la barra ya. */
export function empezarNavegacion(): void {
  window.dispatchEvent(new Event(EVENTO));
}

function esNavegacionInterna(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !a.href) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  // Mismo lugar (o solo cambia el #): no hay navegación que esperar.
  return url.pathname + url.search !== location.pathname + location.search;
}

function Barra() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [activa, setActiva] = useState(false);
  const seguro = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const empezar = () => {
      setActiva(true);
      clearTimeout(seguro.current);
      seguro.current = setTimeout(() => setActiva(false), 15000);
    };
    const onClick = (e: MouseEvent) => {
      if (esNavegacionInterna(e)) empezar();
    };
    // Captura: corre antes que el onClick del Link (que hace preventDefault).
    document.addEventListener("click", onClick, true);
    window.addEventListener(EVENTO, empezar);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(EVENTO, empezar);
    };
  }, []);

  // Llegó la página nueva.
  useEffect(() => {
    setActiva(false);
    clearTimeout(seguro.current);
  }, [pathname, params]);

  return <div className={`tm-nav-progress${activa ? " is-on" : ""}`} aria-hidden />;
}

export default function NavProgress() {
  // useSearchParams pide Suspense; si suspende, simplemente no hay barra.
  return (
    <Suspense fallback={null}>
      <Barra />
    </Suspense>
  );
}
