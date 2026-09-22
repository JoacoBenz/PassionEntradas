-- Una operación termina con los CUATRO hitos, no con la entrega.
--
-- `cerrada_at` es el hito "entrada entregada". El trigger lo trataba como el
-- fin de la operación y congelaba los otros tres, así que marcar la entrega
-- dejaba sin poder tildar cosas que sí habían pasado — y en la práctica se
-- entrega antes de pagarle al proveedor todo el tiempo.
--
-- Lo que se conserva, porque no es orden sino coherencia:
--   - una operación cancelada no puede estar cerrada;
--   - una cancelada no admite cambios de hitos hasta reabrirla;
--   - una operación COMPLETA (los cuatro) se congela: para corregirla hay
--     que desmarcar alguno primero.
create or replace function public.validar_orden_hitos()
returns trigger language plpgsql as $$
declare
  completa_antes boolean;
  completa_ahora boolean;
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

    completa_antes := old.entrada_recibida_at is not null
                  and old.pago_confirmado_at is not null
                  and old.pago_proveedor_at is not null
                  and old.cerrada_at is not null;
    completa_ahora := new.entrada_recibida_at is not null
                  and new.pago_confirmado_at is not null
                  and new.pago_proveedor_at is not null
                  and new.cerrada_at is not null;

    -- Congelada solo si estaba completa y sigue completa: desmarcar un hito
    -- (que la saca de completa) es justamente cómo se corrige.
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
