-- Fecha del evento (para priorizar operaciones urgentes en el panel; se
-- muestra también en el link público) y notas internas (SOLO panel, nunca
-- se exponen en la vista pública).

alter table public.operaciones
  add column if not exists fecha_evento date,
  add column if not exists notas text;

create index if not exists operaciones_fecha_evento_idx
  on public.operaciones (fecha_evento);

-- RPC público: se agrega fecha_evento (cambia el tipo de retorno, se
-- recrea). Las notas quedan afuera a propósito.
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
         o.fecha_evento, o.updated_at
  from public.operaciones o
  where o.id = op_id;
$$;

revoke all on function public.operacion_publica(uuid) from public;
grant execute on function public.operacion_publica(uuid) to anon, authenticated;
