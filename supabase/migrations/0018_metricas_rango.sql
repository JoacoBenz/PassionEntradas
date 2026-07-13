-- Métricas por rango de fechas: el tablero del moderador puede filtrar
-- "plata movida / comisión / vendidas" por CUÁNDO se confirmó el pago
-- (criterio contable: la venta cuenta en el período en que se cobró).
-- "En juego" es exposición ACTUAL: no depende del rango.
--
-- Cambia la firma => drop de la versión sin parámetros para que
-- rpc("metricas_operaciones") no sea ambiguo, y grants de nuevo (una
-- función nueva vuelve a ser ejecutable por PUBLIC por default).

drop function if exists public.metricas_operaciones();

create or replace function public.metricas_operaciones(
  p_desde date default null,
  p_hasta date default null
)
returns table (
  plata_movida bigint,
  comision_ganada bigint,
  entradas_vendidas bigint,
  en_juego_monto bigint,
  en_juego_ops bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(monto) filter (where pagada_en_rango), 0),
    coalesce(sum(fee) filter (where pagada_en_rango), 0),
    count(*) filter (where pagada_en_rango),
    coalesce(sum(monto) filter (where abierta_sin_pago), 0),
    count(*) filter (where abierta_sin_pago)
  from (
    select
      monto,
      fee,
      pago_confirmado_at is not null
        and (p_desde is null or pago_confirmado_at >= p_desde)
        and (p_hasta is null or pago_confirmado_at < p_hasta + 1) as pagada_en_rango,
      pago_confirmado_at is null and cerrada_at is null as abierta_sin_pago
    from public.operaciones
    where status <> 'cancelada'
  ) s;
$$;

revoke execute on function public.metricas_operaciones(date, date) from public, anon, authenticated;
grant execute on function public.metricas_operaciones(date, date) to service_role;
