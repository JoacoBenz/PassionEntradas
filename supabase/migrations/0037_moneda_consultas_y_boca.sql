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
