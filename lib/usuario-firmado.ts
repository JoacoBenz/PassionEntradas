// El usuario verificado por el middleware, pasado a la página en un header
// FIRMADO, para no validar la sesión dos veces por navegación.
//
// Antes: el middleware llamaba a supabase.auth.getUser() (ida y vuelta al
// servidor de Auth) y la página volvía a llamarlo. Ahora el middleware lo
// valida una vez y le pasa a la página {id, email, metadata} firmado con HMAC
// (clave del servidor). La página acepta el header solo si la firma es válida
// y no venció; si no, valida como antes. Un header inventado por el cliente no
// sirve: no tiene la clave para firmarlo, y además el middleware lo borra.
//
// Funciona igual en el middleware (edge) y en las páginas (node): Web Crypto.

import type { User } from "@supabase/supabase-js";

export const HDR_USUARIO = "x-tm-usuario";

// Vida corta: el header vive lo que dura UNA request (middleware → página).
const VIDA_MS = 60_000;

type Payload = {
  id: string;
  email: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  exp: number;
};

function clave(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function aBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secreto: string, datos: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", key, enc.encode(datos));
  return aBase64Url(new Uint8Array(firma));
}

function igualesSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function firmarUsuario(
  user: Pick<User, "id" | "email" | "app_metadata" | "user_metadata">,
  ahora: number = Date.now()
): Promise<string | null> {
  const secreto = clave();
  if (!secreto) return null;
  const payload: Payload = {
    id: user.id,
    email: user.email ?? null,
    app_metadata: (user.app_metadata ?? {}) as Record<string, unknown>,
    user_metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    exp: ahora + VIDA_MS,
  };
  const cuerpo = aBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${cuerpo}.${await hmac(secreto, cuerpo)}`;
}

/** El usuario del header si la firma es válida y no venció; si no, null. */
export async function verificarUsuarioFirmado(
  valor: string | null | undefined,
  ahora: number = Date.now()
): Promise<User | null> {
  const secreto = clave();
  if (!secreto || !valor) return null;
  const [cuerpo, firma, ...resto] = valor.split(".");
  if (!cuerpo || !firma || resto.length) return null;
  if (!igualesSeguro(firma, await hmac(secreto, cuerpo))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(deBase64Url(cuerpo))) as Payload;
    if (typeof p.exp !== "number" || p.exp < ahora || typeof p.id !== "string") return null;
    return {
      id: p.id,
      email: p.email ?? undefined,
      app_metadata: p.app_metadata ?? {},
      user_metadata: p.user_metadata ?? {},
    } as unknown as User;
  } catch {
    return null;
  }
}
