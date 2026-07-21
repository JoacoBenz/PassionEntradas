-- Cantidad de entradas de una operación. El cliente puede pedir más de una
-- entrada de un mismo sector (topeado por el stock disponible en la tienda).
-- `monto` pasa a ser el total de la línea (precio unitario × cantidad); el
-- precio unitario se deriva como monto / cantidad (mismo criterio que la
-- factura). Aditiva: las operaciones existentes quedan con cantidad 1.
alter table public.operaciones
  add column if not exists cantidad integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'operaciones_cantidad_check'
  ) then
    alter table public.operaciones
      add constraint operaciones_cantidad_check check (cantidad >= 1);
  end if;
end$$;
