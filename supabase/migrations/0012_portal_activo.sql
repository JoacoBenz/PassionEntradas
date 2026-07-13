-- Interruptor de las entradas de Passion en la tienda (1 = visibles, 0 =
-- ocultas; quedan solo las propias). El worker sigue sincronizando igual:
-- esto solo afecta qué se muestra. Editable desde el panel (/api/portal).
insert into public.config (key, value)
values ('portal_activo', 1)
on conflict (key) do nothing;
