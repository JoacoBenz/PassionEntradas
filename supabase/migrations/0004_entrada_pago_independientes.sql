-- Entrada recibida y pago confirmado pasan a ser hitos INDEPENDIENTES:
-- cada uno se marca/desmarca por separado y la operación queda confirmada
-- cuando están los dos. El enum `status` se conserva solo para cancelada
-- (y compatibilidad); el estado visible se deriva de los timestamps.

alter table public.operaciones
  add column if not exists entrada_recibida_at timestamptz,
  add column if not exists pago_confirmado_at timestamptz;

-- Backfill desde el estado lineal viejo.
update public.operaciones
set entrada_recibida_at = coalesce(entrada_recibida_at, updated_at)
where status in ('entrada_recibida', 'confirmada');

update public.operaciones
set pago_confirmado_at = coalesce(pago_confirmado_at, updated_at)
where status = 'confirmada';

-- RPC público: mismos campos seguros + los dos hitos (cambia el tipo de
-- retorno, hay que recrear la función).
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
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select o.code, o.evento, o.comprador_alias, o.vendedor_alias,
         o.monto, o.status, o.entrada_recibida_at, o.pago_confirmado_at,
         o.updated_at
  from public.operaciones o
  where o.id = op_id;
$$;

revoke all on function public.operacion_publica(uuid) from public;
grant execute on function public.operacion_publica(uuid) to anon, authenticated;
