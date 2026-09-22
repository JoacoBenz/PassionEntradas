-- Cuatro hitos internos, sin orden obligatorio.
--
-- El cliente pidió: pago recibido, pago a proveedor entregado, entrada
-- recibida del proveedor, entrada entregada. Existían tres; faltaba el del
-- pago al proveedor.
alter table public.operaciones
  add column if not exists pago_proveedor_at timestamptz,
  add column if not exists pago_proveedor_por text;

comment on column public.operaciones.pago_proveedor_at is
  'Hito interno: se le pagó al proveedor. No se expone en el ticket público.';

-- El orden estaba impuesto acá por validar_orden_hitos: el pago requería la
-- entrada, y el cierre requería los dos. En la práctica la secuencia varía,
-- así que esas dos reglas se van.
--
-- Lo que SÍ se conserva, porque no es orden sino coherencia:
--   - una operación cancelada no puede estar cerrada;
--   - cancelada o cerrada congelan los hitos hasta reabrir.
create or replace function public.validar_orden_hitos()
returns trigger language plpgsql as $$
begin
  if new.status = 'cancelada' and new.cerrada_at is not null then
    raise exception 'Una operación cancelada no puede estar cerrada' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'cancelada' and new.status = 'cancelada'
       and (new.entrada_recibida_at is distinct from old.entrada_recibida_at
            or new.pago_confirmado_at is distinct from old.pago_confirmado_at
            or new.pago_proveedor_at is distinct from old.pago_proveedor_at) then
      raise exception 'La operación está cancelada; reabrila para editar hitos' using errcode = 'P0001';
    end if;

    if old.cerrada_at is not null and new.cerrada_at is not null
       and (new.entrada_recibida_at is distinct from old.entrada_recibida_at
            or new.pago_confirmado_at is distinct from old.pago_confirmado_at
            or new.pago_proveedor_at is distinct from old.pago_proveedor_at) then
      raise exception 'La operación está cerrada; reabrí el cierre para editar hitos' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- Ahora sí: el código dejó de crear consultas con monto 0 (van a su propia
-- tabla), así que el check ya no rompe el alta desde el carrito.
-- NOT VALID: aplica a lo nuevo, no rechaza las filas históricas.
alter table public.operaciones drop constraint if exists operaciones_monto_positivo;
alter table public.operaciones add constraint operaciones_monto_positivo check (monto > 0) not valid;
