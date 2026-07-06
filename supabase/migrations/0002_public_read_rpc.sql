-- Cierra la lectura pública abierta: la política `op_public_read` con
-- using (true) permitía a cualquiera con la anon key (pública, viaja en el
-- bundle JS) listar la tabla completa — incluida la comisión — sin conocer
-- ningún uuid. La vista pública ahora pasa por una función que exige el uuid
-- exacto y devuelve solo los campos seguros.

-- 1) Sin select directo para anon. Los paneles siguen leyendo con sesión.
drop policy if exists "op_public_read" on public.operaciones;
create policy "op_auth_read"
  on public.operaciones
  for select
  to authenticated
  using (true);

-- 2) RPC de lectura pública: solo por uuid, solo campos públicos.
create or replace function public.operacion_publica(op_id uuid)
returns table (
  code text,
  evento text,
  comprador_alias text,
  vendedor_alias text,
  monto integer,
  status operacion_status,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select o.code, o.evento, o.comprador_alias, o.vendedor_alias,
         o.monto, o.status, o.updated_at
  from public.operaciones o
  where o.id = op_id;
$$;

revoke all on function public.operacion_publica(uuid) from public;
grant execute on function public.operacion_publica(uuid) to anon, authenticated;
