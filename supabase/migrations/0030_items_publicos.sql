-- El ticket público de seguimiento muestra el encabezado de la operación
-- ("River vs Boca +2 más") pero no puede ver las líneas: `operacion_items`
-- es RLS deny-all y el link es anónimo, por UUID.
--
-- Mismo patrón que `operacion_publica`: security definer con un set de
-- columnas acotado. No se expone `ticket_id` ni el id de la línea — al
-- comprador no le dicen nada y son datos internos del catálogo.

drop function if exists public.operacion_items_publicos(uuid);

create function public.operacion_items_publicos(op_id uuid)
returns table (
  evento text,
  sector text,
  fecha_evento date,
  cantidad integer,
  precio_unitario numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select i.evento, i.sector, i.fecha_evento, i.cantidad, i.precio_unitario
  from public.operacion_items i
  where i.operacion_id = op_id
  order by i.created_at asc
$$;

revoke all on function public.operacion_items_publicos(uuid) from public;
grant execute on function public.operacion_items_publicos(uuid) to anon, authenticated;
