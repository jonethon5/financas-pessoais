-- "Dinheiro resgatado" (Nubank) não era reconhecido como dinheiro da caixinha/poupança e aparecia como entrada.
-- A próxima sincronização relê os últimos meses e marca esses lançamentos com o motivo certo.
update public.bank_connections set last_sync_at = null;
