-- Pasos del pedido y cancelación por el cliente.
--
-- 1. Confirmación del pedido. Un pedido de la tienda entra como "Nuevo" y un
--    administrador lo confirma ("Confirmar pedido") antes de trabajarlo. Solo
--    los pedidos (`tipo = 'pedido'`) pasan por este paso: las operaciones que
--    carga el staff y las consultas cotizadas nacen confirmadas.
--    Los pedidos que ya existen se dan por confirmados (ya se estaban
--    trabajando); la fecha es la de creación.
--
-- 2. Cancelación con autor. `cancelada_at` / `cancelada_por` dicen cuándo y
--    quién canceló ('cliente' o el nombre del admin). Reabrir los limpia.
--    El cliente solo puede cancelar ANTES de que se le pida pagar: si ya está
--    la entrada recibida (paso "listo para pagar"), el pago o la entrega, la
--    base lo rechaza aunque la app tenga un bug o dos pedidos se crucen.
--
-- 3. Las consultas también se pueden cancelar (las cancela el cliente).
--
-- 4. Textos de pago por moneda (`textos_config`): lo que ve el cliente cuando
--    su pedido está listo para pagar (alias, CBU, link de pago...). Solo
--    service role: el texto se le muestra al dueño del pedido desde el server.
--
-- 5. (El link público con `tipo` y `confirmada_at` está en 0042: cambia las
--    columnas que devuelve la función, y eso exige recrearla.)
--
-- 6. "En juego" del tablero no cuenta los pedidos sin confirmar: todavía no
--    son plata comprometida.
--
-- Aditiva: aplicarla antes de deployar el código no cambia el comportamiento
-- actual (columnas nuevas nullable, trigger con las mismas reglas + una).

alter table public.operaciones
  add column if not exists confirmada_at timestamptz,
  add column if not exists confirmada_por text,
  add column if not exists cancelada_at timestamptz,
  add column if not exists cancelada_por text;

-- monto > 0: el check NOT VALID operaciones_monto_positivo rechaza cualquier
-- UPDATE de una fila con monto 0 (y esas no son pedidos de la tienda igual).
update public.operaciones
   set confirmada_at = created_at
 where tipo = 'pedido' and confirmada_at is null and monto > 0;

alter table public.consultas drop constraint if exists consultas_estado_check;
alter table public.consultas add constraint consultas_estado_check
  check (estado in ('pendiente', 'convertida', 'descartada', 'cancelada'));

create or replace function public.validar_orden_hitos()
returns trigger language plpgsql as $$
declare
  completa_antes boolean;
  completa_ahora boolean;
begin
  if new.status = 'cancelada' and new.cerrada_at is not null then
    raise exception 'Una operación cancelada no puede estar cerrada' using errcode = 'P0001';
  end if;

  -- El cliente cancela solo antes de que se le pida pagar.
  if new.status = 'cancelada' and new.cancelada_por = 'cliente'
     and (tg_op = 'INSERT' or old.status <> 'cancelada')
     and (new.entrada_recibida_at is not null
          or new.pago_confirmado_at is not null
          or new.cerrada_at is not null) then
    raise exception 'El pedido ya avanzó; para cancelarlo escribinos' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'cancelada' and new.status = 'cancelada'
       and (new.entrada_recibida_at is distinct from old.entrada_recibida_at
            or new.pago_confirmado_at is distinct from old.pago_confirmado_at
            or new.pago_proveedor_at is distinct from old.pago_proveedor_at) then
      raise exception 'La operación está cancelada; reabrila para editar hitos' using errcode = 'P0001';
    end if;

    completa_antes := old.entrada_recibida_at is not null
                  and old.pago_confirmado_at is not null
                  and old.pago_proveedor_at is not null
                  and old.cerrada_at is not null;
    completa_ahora := new.entrada_recibida_at is not null
                  and new.pago_confirmado_at is not null
                  and new.pago_proveedor_at is not null
                  and new.cerrada_at is not null;

    if completa_antes and completa_ahora
       and (new.entrada_recibida_at is distinct from old.entrada_recibida_at
            or new.pago_confirmado_at is distinct from old.pago_confirmado_at
            or new.pago_proveedor_at is distinct from old.pago_proveedor_at) then
      raise exception 'La operación está completa; desmarcá un hito para volver a editarla' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create table if not exists public.textos_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.textos_config enable row level security;
-- Sin policies: deny-all para anon/authenticated. Solo service role.
revoke all on table public.textos_config from anon, authenticated;

drop trigger if exists textos_config_updated_at on public.textos_config;
create trigger textos_config_updated_at
  before update on public.textos_config
  for each row execute function public.set_updated_at();

-- Misma definición que 0035, con "en juego" sin los pedidos por confirmar.
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
      (o.tipo = 'pedido' and o.confirmada_at is null) as por_confirmar,
      (o.pago_confirmado_at at time zone 'America/Argentina/Buenos_Aires')::date as dia_pago
    from public.operaciones o
    where o.status <> 'cancelada'
  ), vendidas as (
    select * from ops
    where pago_confirmado_at is not null
      and (p_desde is null or dia_pago >= p_desde)
      and (p_hasta is null or dia_pago <= p_hasta)
  ), en_juego as (
    select * from ops
    where pago_confirmado_at is null and cerrada_at is null and not por_confirmar
  )
  select
    m.moneda,
    coalesce((select sum(v.monto) from vendidas v where v.moneda = m.moneda), 0),
    coalesce((select sum(v.fee) from vendidas v where v.moneda = m.moneda), 0),
    coalesce((select sum(v.cantidad) from vendidas v where v.moneda = m.moneda), 0)::bigint,
    coalesce((select sum(j.monto) from en_juego j where j.moneda = m.moneda), 0),
    (select count(*) from en_juego j where j.moneda = m.moneda)::bigint
  from (select distinct moneda from ops) m
$$;

revoke all on function public.metricas_operaciones(date, date) from public, anon, authenticated;
grant execute on function public.metricas_operaciones(date, date) to service_role;
