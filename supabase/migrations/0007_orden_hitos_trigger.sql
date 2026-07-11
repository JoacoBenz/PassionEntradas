-- Blindaje a nivel base del orden del proceso. La API ya lo valida, pero
-- un escrito directo con service role podía saltárselo; con este trigger
-- las invariantes viven en Postgres y no dependen de quién escribe.
--
-- Invariantes:
--   1. El pago confirmado requiere la entrada recibida.
--   2. El cierre (entrega) requiere entrada y pago.
--   3. Una operación cancelada no puede quedar cerrada.
--   4. Mientras está cancelada no se tocan hitos ni cierre (hay que reabrir).
--   5. Mientras está cerrada no se tocan los hitos (hay que reabrir el cierre).

create or replace function public.validar_orden_hitos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pago_confirmado_at is not null and new.entrada_recibida_at is null then
    raise exception 'El pago confirmado requiere la entrada recibida'
      using errcode = 'P0001';
  end if;

  if new.cerrada_at is not null
     and (new.entrada_recibida_at is null or new.pago_confirmado_at is null) then
    raise exception 'El cierre requiere entrada recibida y pago confirmado'
      using errcode = 'P0001';
  end if;

  if new.status = 'cancelada' and new.cerrada_at is not null then
    raise exception 'Una operación cancelada no puede estar cerrada'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'cancelada' and new.status = 'cancelada'
       and (new.entrada_recibida_at is distinct from old.entrada_recibida_at
            or new.pago_confirmado_at is distinct from old.pago_confirmado_at
            or new.cerrada_at is distinct from old.cerrada_at) then
      raise exception 'La operación está cancelada; reabrila para editar hitos'
        using errcode = 'P0001';
    end if;

    if old.cerrada_at is not null and new.cerrada_at is not null
       and (new.entrada_recibida_at is distinct from old.entrada_recibida_at
            or new.pago_confirmado_at is distinct from old.pago_confirmado_at) then
      raise exception 'La operación está cerrada; reabrí el cierre para editar hitos'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_orden_hitos on public.operaciones;
create trigger validar_orden_hitos
  before insert or update on public.operaciones
  for each row execute function public.validar_orden_hitos();
