-- El cliente acepta la cotización antes de que sea un pedido.
--
-- Antes: el staff le cargaba precio a una consulta y nacía la operación, sin
-- que el cliente dijera que sí. Ahora:
--
--   pendiente --(staff cotiza)--> cotizada --(cliente acepta)--> convertida
--                                     |--(cliente rechaza)--> rechazada
--                                     |--(pasa el plazo)----> vencida (derivado de vence_at)
--                                     |--(staff re-cotiza)--> cotizada, versión + 1
--
-- - La cotización vive en la consulta (monto, comisión, moneda, versión,
--   vencimiento). Re-cotizar sube la versión: el cliente acepta LA versión que
--   vio, y si el staff cambió el precio mientras tanto, la aceptación falla en
--   vez de convertirse a un precio que nunca vio.
-- - "Vencida" no es un estado guardado: es cotizada con vence_at pasado. Así
--   no hace falta un cron, y re-cotizar la revive.
-- - El plazo (horas) es configurable: config.cotizacion_vence_horas (48).
-- - Aceptar es UNA función en la base (aceptar_cotizacion): bloquea la fila,
--   valida estado/versión/vencimiento/dueño, crea la operación con su línea y
--   marca la consulta, todo en la misma transacción. Dos clicks, o el cliente y
--   el staff a la vez, no pueden crear dos operaciones.
-- - Queda registrado cómo se aceptó: 'web' (el cliente, logueado, con el botón)
--   o 'whatsapp' (un miembro del staff, con su nombre).

alter table public.consultas
  add column if not exists cotizacion_monto numeric(14,2),
  add column if not exists cotizacion_fee numeric(14,2),
  add column if not exists cotizacion_version integer not null default 0,
  add column if not exists cotizada_at timestamptz,
  add column if not exists cotizada_por text,
  add column if not exists cotizada_por_admin boolean not null default false,
  add column if not exists vence_at timestamptz,
  add column if not exists aceptada_at timestamptz,
  add column if not exists aceptada_por text,
  add column if not exists aceptada_via text check (aceptada_via is null or aceptada_via in ('web', 'whatsapp'));

alter table public.consultas drop constraint if exists consultas_estado_check;
alter table public.consultas add constraint consultas_estado_check
  check (estado in ('pendiente', 'cotizada', 'convertida', 'descartada', 'cancelada', 'rechazada'));

alter table public.consultas drop constraint if exists consultas_cotizacion_check;
alter table public.consultas add constraint consultas_cotizacion_check
  -- coalesce: un check con NULL "pasa"; una cotizada sin monto tiene que fallar.
  check (estado <> 'cotizada'
         or (coalesce(cotizacion_monto, 0) > 0
             and coalesce(cotizacion_fee, -1) >= 0
             and coalesce(moneda, '') in ('ARS', 'USD')
             and vence_at is not null));

insert into public.config (key, value)
values ('cotizacion_vence_horas', 48)
on conflict (key) do nothing;

create or replace function public.aceptar_cotizacion(
  p_consulta uuid,
  p_version integer,
  p_cliente uuid,     -- el cliente que acepta (web); null si acepta el staff
  p_via text,         -- 'web' | 'whatsapp'
  p_quien text        -- quién: el email del cliente o el nombre del staff
)
returns table (op_id uuid, op_code text)
language plpgsql security definer set search_path = public
as $$
declare
  c public.consultas%rowtype;
  v_code text;
  v_id uuid;
  v_cant integer;
  i integer;
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if p_via not in ('web', 'whatsapp') then
    raise exception 'Vía inválida' using errcode = 'P0001';
  end if;

  select * into c from public.consultas where id = p_consulta for update;
  if not found or (p_cliente is not null and c.cliente_id is distinct from p_cliente) then
    raise exception 'Cotización no encontrada' using errcode = 'P0002';
  end if;
  if c.estado <> 'cotizada' then
    raise exception 'Esta cotización ya no está disponible' using errcode = 'P0001';
  end if;
  if c.cotizacion_version <> p_version then
    raise exception 'La cotización cambió: revisá el precio nuevo' using errcode = 'P0001';
  end if;
  if c.vence_at < now() then
    raise exception 'La cotización venció' using errcode = 'P0001';
  end if;

  v_cant := greatest(1, coalesce(c.cantidad, 1));

  -- Mismo formato que generateCode() de la app; reintenta si choca.
  for intento in 1..5 loop
    v_code := 'BX-';
    for i in 1..8 loop
      v_code := v_code || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.operaciones where code = v_code);
  end loop;

  insert into public.operaciones (
    code, evento, comprador_alias, monto, fee, cantidad, moneda, ticket_id, sector,
    fecha_evento, notas, tipo, cliente_id, cliente_email, envio_id,
    confirmada_at, confirmada_por
  ) values (
    v_code, c.evento, c.comprador_alias, c.cotizacion_monto, c.cotizacion_fee, v_cant, c.moneda,
    c.ticket_id, c.sector, c.fecha_evento,
    concat_ws(E'\n', nullif(trim(c.notas), ''),
      'Cotizada por ' || coalesce(c.cotizada_por, 'staff') || '. ' ||
      case when p_via = 'web' then 'Aceptada por el cliente en la web.'
           else 'Aceptada por WhatsApp (registró ' || coalesce(p_quien, 'staff') || ').' end),
    'pedido', c.cliente_id, c.cliente_email, c.envio_id,
    -- Solo un administrador confirma pedidos: si cotizó un admin, el pedido
    -- nace confirmado; si cotizó un moderador, entra como "Nuevo".
    case when c.cotizada_por_admin then now() end,
    case when c.cotizada_por_admin then c.cotizada_por end
  )
  returning id into v_id;

  insert into public.operacion_items (operacion_id, ticket_id, evento, sector, fecha_evento, cantidad, precio_unitario)
  values (v_id, c.ticket_id, c.evento, c.sector, c.fecha_evento, v_cant, round(c.cotizacion_monto / v_cant, 2));

  update public.consultas
     set estado = 'convertida', operacion_id = v_id,
         aceptada_at = now(), aceptada_por = p_quien, aceptada_via = p_via,
         resuelta_at = now(), resuelta_por = p_quien
   where id = p_consulta;

  return query select v_id, v_code;
end;
$$;

revoke all on function public.aceptar_cotizacion(uuid, integer, uuid, text, text) from public, anon, authenticated;
grant execute on function public.aceptar_cotizacion(uuid, integer, uuid, text, text) to service_role;

-- El panel se refresca solo cuando cambia esta "versión". Antes miraba solo
-- operaciones: un cliente que rechazaba (o cancelaba) una cotización no movía
-- nada y el admin seguía viendo "Esperando cliente". Ahora suma las consultas.
create or replace function public.version_operaciones()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*)::text || ':' || coalesce(max(updated_at)::text, '') from public.operaciones)
      || '|' ||
         (select count(*)::text || ':' || coalesce(max(updated_at)::text, '') from public.consultas);
$$;

revoke execute on function public.version_operaciones() from public, anon, authenticated;
grant execute on function public.version_operaciones() to service_role;
