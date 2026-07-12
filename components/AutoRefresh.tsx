"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Refresca los datos del Server Component en intervalo, sin recargar la página.
// Así "esta página se actualiza sola" sin que las partes tengan que preguntar.
//
// Con `versionUrl`, en vez de refrescar siempre, cada tick consulta un endpoint
// mínimo que devuelve { v } y solo dispara router.refresh() cuando la versión
// cambió. Eso reduce el tráfico de fondo de re-renderizar toda la página a un
// JSON de pocos bytes por intervalo.
export default function AutoRefresh({
  intervalMs = 12000,
  versionUrl,
}: {
  intervalMs?: number;
  versionUrl?: string;
}) {
  const router = useRouter();
  // Última versión vista. null = todavía no tenemos línea de base.
  const lastVersion = useRef<string | null>(null);

  useEffect(() => {
    let vivo = true;

    const tick = async () => {
      // Solo refrescamos si la pestaña está visible (ahorra requests).
      if (document.visibilityState !== "visible") return;

      if (!versionUrl) {
        router.refresh();
        return;
      }

      try {
        const res = await fetch(versionUrl, { cache: "no-store" });
        if (!res.ok || !vivo) return;
        const data = (await res.json()) as { v?: string };
        const v = typeof data.v === "string" ? data.v : null;
        if (v == null || !vivo) return;
        if (lastVersion.current == null) {
          // Primer fetch: solo fija la línea de base (la página ya está fresca).
          lastVersion.current = v;
          return;
        }
        if (v !== lastVersion.current) {
          lastVersion.current = v;
          router.refresh();
        }
      } catch {
        // Sin red / error transitorio: no refrescar, probamos al próximo tick.
      }
    };

    // Fijar línea de base apenas monta (no refresca: la página recién cargó).
    void tick();

    const id = setInterval(() => void tick(), intervalMs);
    // Al volver a la pestaña, chequear de inmediato.
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs, versionUrl]);

  return null;
}
