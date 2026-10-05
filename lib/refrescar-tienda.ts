import { revalidatePath, revalidateTag } from "next/cache";

// Tag del catálogo y la config de la tienda en la caché de Next
// (lib/supabase/public.ts). Vive acá, sin dependencias, para que lo puedan
// importar tanto la lectura como las rutas que escriben.
export const TAG_CATALOGO = "catalogo";

// Después de cualquier cambio que se vea en la tienda (stock, precios,
// entradas, config): invalida el catálogo cacheado y las páginas de la tienda.
export function refrescarTienda(): void {
  revalidateTag(TAG_CATALOGO);
  // "layout" porque revalidatePath("/") a secas no invalida las páginas hijas.
  revalidatePath("/(tienda)", "layout");
}
