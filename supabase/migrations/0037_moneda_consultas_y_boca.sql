-- Monedas: las entradas propias cargadas en pesos se cobran en pesos.
--
-- 1. consultas.moneda: la moneda en que se cobraría la entrada consultada
--    (ARS para una propia en pesos, USD para el resto). La cotización del
--    panel arranca en esa moneda. Aditiva y nullable: las consultas viejas
--    quedan en null y se cotizan en USD por defecto, como hasta ahora.
alter table public.consultas add column if not exists moneda text
  check (moneda is null or moneda in ('ARS', 'USD', 'EUR'));

-- 2. Pedido de Boca (BX-3RDHY6FK): se creó desde la tienda sin moneda y la
--    base le puso el default 'USD', pero los montos son PESOS (2 × $ 600.000
--    de una entrada propia cargada en ARS; comisión 2 × $ 210.000). El cliente
--    veía una deuda de US$ 1.200.000. Solo se corrige la etiqueta de moneda:
--    los montos ya están en pesos. Guardado: solo si sigue como se creó.
update public.operaciones
   set moneda = 'ARS'
 where code = 'BX-3RDHY6FK'
   and moneda = 'USD'
   and monto = 1200000
   and fee = 420000;

-- 3. La factura de ese pedido (#11) es una foto tomada al emitirla: no trae
--    la moneda (es anterior a guardarla) y salió con "Bank transfer (USD)".
--    Sin esto, la factura seguiría mostrando US$ 1.200.000 aunque la
--    operación ya diga pesos. Se le estampa ARS y el método equivalente en
--    pesos. Guardado: solo esa factura, solo si sigue como se emitió.
update public.facturas f
   set datos = f.datos
             || jsonb_build_object('moneda', 'ARS')
             || case when f.datos->>'metodo_pago' = 'Bank transfer (USD)'
                     then jsonb_build_object('metodo_pago', 'Transferencia (ARS)')
                     else '{}'::jsonb end
  from public.operaciones o
 where o.id = f.operacion_id
   and o.code = 'BX-3RDHY6FK'
   and not (f.datos ? 'moneda')
   and (f.datos->>'total')::numeric = 1200000;
