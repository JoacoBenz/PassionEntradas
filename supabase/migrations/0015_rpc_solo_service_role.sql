-- Hallazgo del linter de seguridad de Supabase: las funciones SECURITY
-- DEFINER quedan ejecutables por anon/authenticated vía PostgREST salvo que
-- se revoque explícitamente.
--
-- - recalcular_precios_portal: la llama SOLO la API con service role
--   (guardar márgenes). Expuesta, cualquiera con la anon key podía forzar
--   reprecios del catálogo. Se revoca.
-- - validar_orden_hitos: es una función de trigger, no un RPC; se revoca
--   por higiene.
-- - operacion_publica queda ejecutable por anon A PROPÓSITO: es el link
--   público de seguimiento (exige el uuid exacto y devuelve solo campos
--   seguros).

-- OJO: revocar de anon/authenticated no alcanza — EXECUTE está otorgado a
-- PUBLIC por default en las funciones y anon lo hereda de ahí. Hay que
-- revocar de PUBLIC y re-otorgar solo a service_role.
revoke execute on function public.recalcular_precios_portal() from public, anon, authenticated;
revoke execute on function public.validar_orden_hitos() from public, anon, authenticated;
grant execute on function public.recalcular_precios_portal() to service_role;
