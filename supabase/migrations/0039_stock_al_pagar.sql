-- Stock de entradas propias: se descuenta cuando el CLIENTE PAGA, no cuando
-- se entrega, y por la cantidad real de cada línea.
--
-- Antes: marcar "Entrada entregada" descontaba 1 del ticket de la operación,
-- siempre 1 aunque el pedido fuera de 2, y solo el de la primera línea.
--
-- Ahora la operación GUARDA lo que descontó (stock_descontado: lista de
-- {ticket_id, cantidad, pedido}). Devolver stock devuelve exactamente eso y
-- nada más: las operaciones viejas no descontaron nada, así que desmarcar su
-- pago no inventa stock (el pedido de Boca, ya pagado con el stock en 7, queda
-- en 7 como se pidió).
--
-- Todo en una función con bloqueos de fila: dos clics simultáneos (o dos
-- admins) no pueden descontar dos veces. Idempotente: tomar dos veces no
-- descuenta dos veces; devolver sin haber tomado no hace nada.
--
-- Aditiva: aplicarla antes de deployar no cambia nada (el código viejo no la
-- llama).

alter table public.operaciones
  add column if not exists stock_descontado jsonb not null default '[]'::jsonb;

create or replace function public.stock_operacion(p_op uuid, p_tomar boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_tomado jsonb;
  v_res jsonb := '[]'::jsonb;
  v_linea record;
  v_stock integer;
  v_sacar integer;
  v_el jsonb;
begin
  select stock_descontado into v_tomado from public.operaciones where id = p_op for update;
  if not found then
    return null;
  end if;

  if p_tomar then
    if jsonb_array_length(v_tomado) > 0 then
      return v_tomado; -- ya descontado
    end if;
    for v_linea in
      select ticket_id, sum(cantidad)::integer as cant
      from (
        select i.ticket_id, i.cantidad
          from public.operacion_items i
         where i.operacion_id = p_op
        union all
        -- Operaciones viejas o cargadas a mano: sin líneas, el ticket y la
        -- cantidad están en la operación.
        select o.ticket_id, coalesce(o.cantidad, 1)
          from public.operaciones o
         where o.id = p_op
           and not exists (select 1 from public.operacion_items i where i.operacion_id = p_op)
      ) l
      where ticket_id like 'manual::%'
      group by ticket_id
    loop
      select stock into v_stock from public.tickets
       where id = v_linea.ticket_id and source = 'manual'
       for update;
      if not found then
        continue;
      end if;
      -- Nunca negativo: si queda menos de lo pedido se descuenta lo que hay y
      -- se registra lo pedido, para que el panel avise la sobreventa.
      v_sacar := least(greatest(coalesce(v_stock, 0), 0), v_linea.cant);
      update public.tickets
         set stock = coalesce(stock, 0) - v_sacar,
             disponible = (coalesce(stock, 0) - v_sacar) > 0,
             updated_at = now()
       where id = v_linea.ticket_id;
      v_res := v_res || jsonb_build_object(
        'ticket_id', v_linea.ticket_id, 'cantidad', v_sacar, 'pedido', v_linea.cant);
    end loop;
    -- Solo se escribe la operación si hubo algo que registrar: una operación
    -- sin entradas propias (portal) no se toca. Además hay operaciones viejas
    -- con monto 0 que no pasan la regla monto > 0 y no admiten ningún UPDATE.
    if jsonb_array_length(v_res) > 0 then
      update public.operaciones set stock_descontado = v_res where id = p_op;
    end if;
    return v_res;
  end if;

  -- Devolver exactamente lo que se tomó.
  if jsonb_array_length(v_tomado) = 0 then
    return '[]'::jsonb;
  end if;
  for v_el in select * from jsonb_array_elements(v_tomado) loop
    update public.tickets
       set stock = coalesce(stock, 0) + (v_el->>'cantidad')::integer,
           disponible = (coalesce(stock, 0) + (v_el->>'cantidad')::integer) > 0,
           updated_at = now()
     where id = v_el->>'ticket_id' and source = 'manual';
  end loop;
  update public.operaciones set stock_descontado = '[]'::jsonb where id = p_op;
  return '[]'::jsonb;
end;
$$;

revoke all on function public.stock_operacion(uuid, boolean) from public, anon, authenticated;
grant execute on function public.stock_operacion(uuid, boolean) to service_role;
