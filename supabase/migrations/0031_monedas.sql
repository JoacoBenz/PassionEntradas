-- Monto y comisión pasan a numeric: integer no tiene decimales (USD/EUR
-- tienen centavos) y desborda con pesos. Cada operación y cada entrada
-- propia declara su moneda y se muestra en ella; no hay conversión entre
-- monedas, solo la del portal EUR->USD que ya existía.
alter table public.operaciones
  alter column monto type numeric(14,2) using monto::numeric,
  alter column fee type numeric(14,2) using fee::numeric,
  add column if not exists moneda text not null default 'USD'
    check (moneda in ('ARS', 'USD', 'EUR'));

comment on column public.operaciones.moneda is
  'Moneda en la que está expresada la operación. No se convierte: se muestra en la suya.';

-- Entradas propias: costo y proveedor para poder ver el margen real.
alter table public.tickets
  add column if not exists precio_costo numeric(12,2) check (precio_costo >= 0),
  add column if not exists proveedor text;

grant select (precio_costo, proveedor) on table public.tickets to authenticated;

-- operacion_publica declaraba `monto integer` en su firma: hay que recrearla
-- o queda devolviendo un tipo que ya no coincide con la columna.
drop function if exists public.operacion_publica(uuid);

create function public.operacion_publica(op_id uuid)
returns table (
  code text, evento text, comprador_alias text, vendedor_alias text,
  monto numeric, moneda text, status operacion_status,
  entrada_recibida_at timestamptz, pago_confirmado_at timestamptz,
  cerrada_at timestamptz, fecha_evento date, updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select o.code, o.evento, o.comprador_alias, o.vendedor_alias, o.monto, o.moneda,
         o.status, o.entrada_recibida_at, o.pago_confirmado_at,
         o.cerrada_at, o.fecha_evento, o.updated_at
  from public.operaciones o where o.id = op_id
$$;

revoke all on function public.operacion_publica(uuid) from public;
grant execute on function public.operacion_publica(uuid) to anon, authenticated;

-- metricas_operaciones sumaba todo en un pozo único. Con varias monedas eso
-- deja de significar algo, así que ahora agrupa por moneda.
drop function if exists public.metricas_operaciones(date, date);

create function public.metricas_operaciones(p_desde date, p_hasta date)
returns table (
  moneda text, plata_movida numeric, comision_ganada numeric,
  entradas_vendidas bigint, en_juego_monto numeric, en_juego_ops bigint
)
language sql stable security definer set search_path = public
as $$
  select
    o.moneda,
    coalesce(sum(o.monto) filter (where o.cerrada_at is not null), 0),
    coalesce(sum(o.fee) filter (where o.cerrada_at is not null), 0),
    coalesce(sum(o.cantidad) filter (where o.cerrada_at is not null), 0)::bigint,
    coalesce(sum(o.monto) filter (where o.cerrada_at is null and o.status <> 'cancelada'), 0),
    count(*) filter (where o.cerrada_at is null and o.status <> 'cancelada')::bigint
  from public.operaciones o
  where (p_desde is null or o.created_at >= p_desde)
    and (p_hasta is null or o.created_at < (p_hasta + 1))
  group by o.moneda
$$;

revoke all on function public.metricas_operaciones(date, date) from public;
grant execute on function public.metricas_operaciones(date, date) to authenticated;
