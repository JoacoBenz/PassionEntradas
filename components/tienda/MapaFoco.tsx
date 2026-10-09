"use client";

// Marca en el mapa la zona de un sector (ver lib/mapa-foco.ts).
//
// El mapa se lee con una copia aparte pedida con CORS (los mapas viven en el
// Storage de Supabase, que lo permite): el <img> que se ve no se toca, así un
// mapa de otro origen sin CORS sigue mostrándose igual y solo se queda sin
// marca. Se analiza una vez por tarjeta abierta y en tamaño reducido.

import { useEffect, useMemo, useRef, useState } from "react";
import { capaDeFoco, colorDeZona, hexARgb, mascaraDeZona, paletaDelMapa, type Rgb } from "@/lib/mapa-foco";

// Ancho máximo al que se analiza: alcanza para marcar zonas y es rápido.
const ANCHO_ANALISIS = 480;

type Analisis = { data: Uint8ClampedArray; ancho: number; alto: number; colores: Map<string, Rgb> };

const clave = (hex: string) => hex.trim().toUpperCase();

/**
 * Qué zonas (hexas) se pueden marcar en este mapa y la capa de cada una.
 * `activo`: la tarjeta está abierta (no se baja nada de las cerradas).
 */
export function useFocoMapa(src: string | null, hexas: string[], activo: boolean) {
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const firma = useMemo(() => Array.from(new Set(hexas.filter((h) => hexARgb(h)).map(clave))).sort().join(","), [hexas]);

  useEffect(() => {
    if (!activo || !src || !firma || analisis) return;
    let vivo = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (!vivo || !img.naturalWidth) return;
      try {
        const escala = Math.min(1, ANCHO_ANALISIS / img.naturalWidth);
        const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
        const alto = Math.max(1, Math.round(img.naturalHeight * escala));
        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, ancho, alto);
        // Tira si el mapa no permite leerse (sin CORS): queda sin marcas.
        const { data } = ctx.getImageData(0, 0, ancho, alto);
        const paleta = paletaDelMapa(data, ancho, alto);
        const colores = new Map<string, Rgb>();
        for (const hex of firma.split(",")) {
          const rgb = colorDeZona(paleta, hex);
          if (rgb) colores.set(hex, rgb);
        }
        setAnalisis({ data, ancho, alto, colores });
      } catch {
        /* sin marca: queda el chip de color */
      }
    };
    img.src = src;
    return () => {
      vivo = false;
    };
  }, [activo, src, firma, analisis]);

  const capas = useRef(new Map<string, ImageData>());
  return {
    puede: (hex: string | null | undefined) => !!hex && !!analisis?.colores.has(clave(hex)),
    capa: (hex: string | null): ImageData | null => {
      if (!hex || !analisis) return null;
      const k = clave(hex);
      const rgb = analisis.colores.get(k);
      if (!rgb) return null;
      let c = capas.current.get(k);
      if (!c) {
        const m = mascaraDeZona(analisis.data, analisis.ancho, analisis.alto, rgb);
        c = new ImageData(analisis.ancho, analisis.alto);
        c.data.set(capaDeFoco(m, analisis.ancho, analisis.alto));
        capas.current.set(k, c);
      }
      return c;
    },
  };
}

/** La capa encima del mapa. Va dentro de un contenedor `position: relative`. */
export function CapaFoco({ capa, className }: { capa: ImageData | null; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !capa) return;
    c.width = capa.width;
    c.height = capa.height;
    c.getContext("2d")?.putImageData(capa, 0, 0);
  }, [capa]);
  if (!capa) return null;
  return <canvas ref={ref} className={className} aria-hidden />;
}
