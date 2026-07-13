-- Performance del panel (hallazgos de la revisión de eficiencia):
-- 1) Índice para el poll de versión: /api/operaciones/version ordena por
--    updated_at cada 15s por admin conectado y no había índice.
-- 2) RPC de métricas agregadas: el módulo del moderador bajaba TODAS las
--    filas de operaciones para sumar en JS (la única query sin tope).
-- 3) RPC de versión en un solo valor (menos payload por poll).
-- 4) recalcular_precios_portal acotado: repreciaba TODA la tabla tickets
--    (incluidas filas históricas que nunca se borran) en cada cambio de
--    margen; ahora solo el catálogo vigente y, si se pasa, solo la
--    competición afectada.

-- 1) --------------------------------------------------------------------
create index if not exists operaciones_updated_at_idx
  on public.operaciones (updated_at desc);

-- 2) --------------------------------------------------------------------
-- Mismo criterio que lib/metrics.ts: canceladas nunca cuentan; "movida" =
-- pago confirmado (incluye cerradas); "en juego" = abiertas sin pago.
create or replace function public.metricas_operaciones()
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
    coalesce(sum(monto) filter (where pago_confirmado_at is not null), 0),
    coalesce(sum(fee) filter (where pago_confirmado_at is not null), 0),
    count(*) filter (where pago_confirmado_at is not null),
    coalesce(sum(monto) filter (where pago_confirmado_at is null and cerrada_at is null), 0),
    count(*) filter (where pago_confirmado_at is null and cerrada_at is null)
  from public.operaciones
  where status <> 'cancelada';
$$;

revoke execute on function public.metricas_operaciones() from public, anon, authenticated;
grant execute on function public.metricas_operaciones() to service_role;

-- 3) --------------------------------------------------------------------
create or replace function public.version_operaciones()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::text || ':' || coalesce(max(updated_at)::text, '')
  from public.operaciones;
$$;

revoke execute on function public.version_operaciones() from public, anon, authenticated;
grant execute on function public.version_operaciones() to service_role;

-- 4) --------------------------------------------------------------------
-- Cambia la firma (parámetro opcional): hay que dropear la versión sin
-- argumentos para que rpc("recalcular_precios_portal") no sea ambiguo,
-- y re-aplicar los grants (una función nueva vuelve a ser ejecutable por
-- PUBLIC por default — ver 0015).
drop function if exists public.recalcular_precios_portal();

create or replace function public.recalcular_precios_portal(p_competicion text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.tickets t
  set precio_final = round(
        t.precio_origen * (1 + coalesce(
          (select m.porcentaje from public.margenes m
            where m.source = t.source and m.competicion = t.competicion),
          (select m.porcentaje from public.margenes m
            where m.source = t.source and m.competicion is null),
          20) / 100.0), 2),
      updated_at = now()
  where t.source = 'portal'
    and t.precio_origen is not null
    -- Solo el catálogo vigente: las filas de eventos pasados no se muestran
    -- ni se venden; repreciarlas era puro costo (y crecía sin tope).
    and (t.fecha is null or t.fecha >= now() - interval '1 day')
    -- Editar/borrar una regla específica repreciá solo esa competición.
    and (p_competicion is null or t.competicion = p_competicion);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.recalcular_precios_portal(text) from public, anon, authenticated;
grant execute on function public.recalcular_precios_portal(text) to service_role;
