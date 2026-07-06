"use client";

import { createBrowserClient } from "@supabase/ssr";

// Cliente de navegador (anon). Se usa para Auth en el admin y para
// suscribirse a lectura pública. NUNCA para cambios de estado.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
