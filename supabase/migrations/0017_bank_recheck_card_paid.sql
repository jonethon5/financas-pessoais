-- Boleto/Pix pago com o limite do cartão aparecia na conta como entrada (+) e como gasto (−), além da compra no cartão.
-- A próxima sincronização relê os últimos meses e marca o par como "pago no cartão" (não conta).
update public.bank_connections set last_sync_at = null;
