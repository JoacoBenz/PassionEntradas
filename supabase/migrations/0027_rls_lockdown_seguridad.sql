-- Blindaje de RLS (seguridad). Estas políticas venían del MVP de custodia,
-- cuando TODOS los usuarios autenticados eran staff. Con el rol `cliente`
-- (también autenticado) quedaban abiertas: cualquier cliente logueado podía,
-- usando la anon key (pública) + su JWT, hablar directo con PostgREST y saltear
-- por completo los guardas de la app.
--
-- La app NUNCA depende de estas políticas: lee/escribe con service role (que
-- saltea RLS) o con la anon key sobre columnas públicas puntuales; la vista
-- pública va por funciones security definer (operacion_publica / factura_publica).
-- Por eso quitarlas/restringirlas no cambia el comportamiento y cierra los
-- agujeros.

-- 1) operaciones: CRÍTICO. `op_auth_read` dejaba leer toda la tabla (comisión,
--    cuenta a debitar, notas, datos de otros clientes) y `op_admin_insert/
--    update/delete` con check/using (true) dejaban a cualquier autenticado
--    crear, modificar o borrar operaciones. Se quitan: RLS queda deny-all para
--    anon y authenticated; solo el service role (servidor) accede.
drop policy if exists "op_auth_read"    on public.operaciones;
drop policy if exists "op_admin_insert" on public.operaciones;
drop policy if exists "op_admin_update" on public.operaciones;
drop policy if exists "op_admin_delete" on public.operaciones;

-- 2) tickets: la tienda lee con la anon key, que solo tiene grant sobre las
--    columnas públicas. Pero la política daba SELECT a `authenticated` sobre la
--    fila completa, así que un cliente logueado podía leer columnas internas
--    (precio_origen, moneda/urL de origen → deducir el markup) con su JWT.
--    Se separa: anon lee (columnas públicas por grant); authenticated solo si
--    es staff (el panel lee tickets con la sesión del admin).
drop policy if exists tickets_select_public on public.tickets;

drop policy if exists tickets_select_anon on public.tickets;
create policy tickets_select_anon
  on public.tickets
  for select
  to anon
  using (true);

drop policy if exists tickets_select_staff on public.tickets;
create policy tickets_select_staff
  on public.tickets
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('administrador', 'moderador')
  );

-- 3) sync_runs: la política se llamaba "_staff" pero usaba using (true), o sea
--    la leía cualquier autenticado (incluido un cliente). Se restringe al staff
--    real por el rol del JWT (solo el panel de admin la lee).
drop policy if exists sync_runs_select_staff on public.sync_runs;
create policy sync_runs_select_staff
  on public.sync_runs
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('administrador', 'moderador')
  );
