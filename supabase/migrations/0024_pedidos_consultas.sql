-- Portal de venta de entradas: los clientes hacen PEDIDOS y CONSULTAS sobre
-- una entrada del catálogo. Cada uno se registra como una operación (misma
-- tabla, mismo tracking de estado que usa el panel) y además dispara un aviso
-- por WhatsApp a los vendedores. Esta migración solo AGREGA columnas a
-- `operaciones` para distinguir el origen y linkear al cliente; es aditiva y
-- no toca las operaciones ya cargadas por el staff.

-- Origen de la operación:
--   'operacion' -> carga interna del staff (comportamiento histórico, default)
--   'pedido'    -> el cliente pidió reservar una entrada del catálogo
--   'consulta'  -> el cliente consultó por disponibilidad de una entrada
alter table public.operaciones
  add column if not exists tipo text not null default 'operacion';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'operaciones_tipo_check'
  ) then
    alter table public.operaciones
      add constraint operaciones_tipo_check
      check (tipo in ('operacion', 'pedido', 'consulta'));
  end if;
end$$;

-- Cliente que originó el pedido/consulta (usuario de Auth). Null para las
-- operaciones internas del staff. Se guarda también el email para mostrarlo
-- en el panel sin tener que resolver el usuario.
alter table public.operaciones
  add column if not exists cliente_id uuid;

alter table public.operaciones
  add column if not exists cliente_email text;

-- Sector/categoría de la entrada pedida (ej "Platea Norte"), tal como se ve
-- en la tienda. Dato de contexto para el vendedor.
alter table public.operaciones
  add column if not exists sector text;

-- "Mis pedidos": el cliente ve sus propios pedidos/consultas por cliente_id.
create index if not exists operaciones_cliente_id_idx
  on public.operaciones (cliente_id, created_at desc);
