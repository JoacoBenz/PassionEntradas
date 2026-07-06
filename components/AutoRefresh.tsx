"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresca los datos del Server Component en intervalo, sin recargar la página.
// Así "esta página se actualiza sola" sin que las partes tengan que preguntar.
export default function AutoRefresh({ intervalMs = 12000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      // Solo refrescamos si la pestaña está visible (ahorra requests).
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const id = setInterval(tick, intervalMs);
    // Al volver a la pestaña, refrescar de inmediato.
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
