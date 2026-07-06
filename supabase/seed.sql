-- Seed opcional: 2-3 operaciones de ejemplo para probar la UI.
-- Ejecutá esto DESPUÉS de la migración 0001_init.sql.

insert into public.operaciones (code, evento, comprador_alias, vendedor_alias, monto, fee, status)
values
  ('BX-7F3K9Q2M', 'River vs Boca — Superclásico', 'compra_marce', 'vende_lucho', 85000, 6000, 'esperando_entrada'),
  ('BX-4H8N2W5P', 'Tan Biónica — Movistar Arena', 'compra_juli', 'vende_dani', 120000, 8000, 'entrada_recibida'),
  ('BX-9K3M6Z1T', 'Duki — Estadio Vélez', 'compra_flor', 'vende_nico', 65000, 5000, 'confirmada')
on conflict (code) do nothing;
