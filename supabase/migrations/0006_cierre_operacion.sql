-- Cierre explícito de la operación: con entrada y pago listos, la operación
-- queda "lista para cerrar" y el admin la cierra con una acción propia
-- (tercer hito). Las operaciones viejas con ambos hitos quedan abiertas
-- para que el admin las cierre cuando corresponda.

alter table public.operaciones
  add column if not exists cerrada_at timestamptz;

drop function if exists public.operacion_publica(uuid);

create function public.operacion_publica(op_id uuid)
returns table (
  code text,
  evento text,
  comprador_alias text,
  vendedor_alias text,
  monto integer,
  status operacion_status,
  entrada_recibida_at timestamptz,
  pago_confirmado_at timestamptz,
  cerrada_at timestamptz,
  fecha_evento date,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select o.code, o.evento, o.comprador_alias, o.vendedor_alias,
         o.monto, o.status, o.entrada_recibida_at, o.pago_confirmado_at,
         o.cerrada_at, o.fecha_evento, o.updated_at
  from public.operaciones o
  where o.id = op_id;
$$;

revoke all on function public.operacion_publica(uuid) from public;
grant execute on function public.operacion_publica(uuid) to anon, authenticated;
