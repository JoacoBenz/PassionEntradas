-- El link público de seguimiento (/op/[id]) muestra los pasos nuevos del
-- pedido (recibido → confirmado → listo para pagar → ...). Para eso
-- operacion_publica tiene que devolver `tipo` y `confirmada_at` (columnas de
-- 0040). Agregar columnas al RETURNS TABLE no se puede con create or replace:
-- hay que recrear la función. Separada de 0040 porque es el único paso que
-- borra algo (la versión vieja de esta función) y conviene aplicarlo a mano.
--
-- Mismo acceso que antes: anon/authenticated (el link es público y exige el
-- uuid exacto).
--
-- Aplicar después de 0040 y antes de deployar el código de PR C.

drop function if exists public.operacion_publica(uuid);

create function public.operacion_publica(op_id uuid)
returns table (
  code text, evento text, comprador_alias text, vendedor_alias text,
  monto numeric, moneda text, status operacion_status,
  entrada_recibida_at timestamptz, pago_confirmado_at timestamptz,
  cerrada_at timestamptz, fecha_evento date, updated_at timestamptz,
  tipo text, confirmada_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select o.code, o.evento, o.comprador_alias, o.vendedor_alias, o.monto, o.moneda,
         o.status, o.entrada_recibida_at, o.pago_confirmado_at,
         o.cerrada_at, o.fecha_evento, o.updated_at, o.tipo, o.confirmada_at
  from public.operaciones o
  where o.id = op_id
$$;

revoke all on function public.operacion_publica(uuid) from public;
grant execute on function public.operacion_publica(uuid) to anon, authenticated, service_role;

