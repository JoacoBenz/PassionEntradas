import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "../config/index.js";

/**
 * Cliente de Supabase con la service_role key. SOLO en el worker.
 * La service_role saltea RLS: jamás debe estar en el front ni en NEXT_PUBLIC_*.
 */
export function createSupabase(cfg: Config): SupabaseClient {
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "passion-entradas-worker" } },
  });
}
