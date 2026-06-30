// Edge Function: carga manual de entradas por admin.
// Auth propia por token (sha256 comparado contra admin_auth). Escribe con
// service_role del lado servidor: la clave secreta NUNCA llega al browser.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });

async function validToken(token: string): Promise<boolean> {
  if (!token) return false;
  const r = await rest("admin_auth?select=token_hash&id=eq.1");
  const rows = await r.json();
  const stored = rows?.[0]?.token_hash;
  if (!stored) return false;
  return (await sha256(token)) === stored;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "json invalido" }, 400); }
  const { action, token } = body ?? {};

  if (!(await validToken(token))) return json({ error: "token invalido" }, 401);

  if (action === "list") {
    const r = await rest("tickets?source=eq.manual&select=*&order=fecha.asc.nullslast");
    return json({ ok: true, rows: await r.json() });
  }

  if (action === "create") {
    const t = body.ticket ?? {};
    const precio = t.precio == null || t.precio === "" ? null : Number(t.precio);
    const stock = t.stock == null || t.stock === "" ? 0 : Math.trunc(Number(t.stock));
    if (!t.evento || String(t.evento).trim() === "") return json({ error: "falta el evento" }, 400);
    if (precio != null && (!Number.isFinite(precio) || precio < 0)) return json({ error: "precio invalido" }, 400);
    if (!Number.isFinite(stock) || stock < 0) return json({ error: "stock invalido" }, 400);

    const hayStock = stock > 0 && precio != null;
    const row = {
      id: `manual::${crypto.randomUUID()}`,
      evento: String(t.evento).trim(),
      competicion: t.competicion?.trim() || null,
      fecha: t.fecha || null,
      ciudad: t.ciudad?.trim() || null,
      categoria: t.categoria?.trim() || null,
      precio_origen: precio,
      moneda_origen: "EUR",
      precio_final: precio,
      moneda_final: precio != null ? "EUR" : null,
      stock,
      disponible: hayStock,
      estado: hayStock ? "book" : "on_request",
      url_origen: null,
      source: "manual",
      scraped_at: new Date().toISOString(),
    };
    const r = await rest("tickets", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!r.ok) return json({ error: await r.text() }, 400);
    return json({ ok: true, row: (await r.json())[0] });
  }

  if (action === "delete") {
    const id = body.id;
    if (!id) return json({ error: "falta id" }, 400);
    const r = await rest(`tickets?id=eq.${encodeURIComponent(id)}&source=eq.manual`, { method: "DELETE" });
    if (!r.ok) return json({ error: await r.text() }, 400);
    return json({ ok: true });
  }

  return json({ error: "accion desconocida" }, 400);
});
