-- Métricas del tablero: una sola definición, la misma que usa la app.
--
-- 1. "Plata movida", comisión y entradas vendidas cuentan desde que el
--    CLIENTE PAGÓ (pago_confirmado_at). Antes la base contaba recién con la
--    entrada entregada (cerrada_at) y el código de la app con el pago: el
--    tablero de producción y el del modo demo mostraban números distintos.
-- 2. El rango de fechas filtra por el día del pago, en hora argentina (antes
--    filtraba por la fecha de creación de la operación).
-- 3. Entradas vendidas = suma de cantidades (un pedido de 3 son 3 entradas).
-- 4. "En juego": operaciones abiertas que todavía no cobraron ni se
--    entregaron. No depende del rango: es la exposición de hoy.
-- 5. Las canceladas no cuentan nunca.
--
-- Seguridad: la función es security definer y estaba habilitada para
-- `authenticated` (y el linter la marcaba también para anon): cualquier
-- cliente logueado podía llamar /rest/v1/rpc/metricas_operaciones y ver la
-- facturación del negocio. La app la llama solo con service role, así que
-- queda habilitada únicamente para service_role.
--
-- Los parámetros pasan a tener default null: el módulo del moderador la
-- llama sin argumentos.

-- create or replace (sin drop): misma firma y mismo retorno; agregarle
-- defaults a los parámetros se puede sin recrearla.
create or replace function public.metricas_operaciones(p_desde date default null, p_hasta date default null)
returns table (
  moneda text, plata_movida numeric, comision_ganada numeric,
  entradas_vendidas bigint, en_juego_monto numeric, en_juego_ops bigint
)
language sql stable security definer set search_path = public
as $$
  with ops as (
    select
      o.moneda, o.monto, o.fee, coalesce(o.cantidad, 1) as cantidad,
      o.pago_confirmado_at, o.cerrada_at,
      (o.pago_confirmado_at at time zone 'America/Argentina/Buenos_Aires')::date as dia_pago
    from public.operaciones o
    where o.status <> 'cancelada'
  ), vendidas as (
    select * from ops
    where pago_confirmado_at is not null
      and (p_desde is null or dia_pago >= p_desde)
      and (p_hasta is null or dia_pago <= p_hasta)
  )
  select
    m.moneda,
    coalesce((select sum(v.monto) from vendidas v where v.moneda = m.moneda), 0),
    coalesce((select sum(v.fee) from vendidas v where v.moneda = m.moneda), 0),
    coalesce((select sum(v.cantidad) from vendidas v where v.moneda = m.moneda), 0)::bigint,
    coalesce((select sum(o.monto) from ops o
              where o.moneda = m.moneda and o.pago_confirmado_at is null and o.cerrada_at is null), 0),
    (select count(*) from ops o
      where o.moneda = m.moneda and o.pago_confirmado_at is null and o.cerrada_at is null)::bigint
  from (select distinct moneda from ops) m
$$;

revoke all on function public.metricas_operaciones(date, date) from public, anon, authenticated;
grant execute on function public.metricas_operaciones(date, date) to service_role;
