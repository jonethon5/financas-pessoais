-- =====================================================================
-- Gasto lançado à mão que o banco também trouxe contava duas vezes.
-- A sincronização agora junta os dois (mesmo valor, até 2 dias de diferença) e, na primeira leitura
-- de cada conexão, arruma os que já estavam repetidos. Por isso as conexões são lidas de novo desde o começo.
-- Não duplica nada: o id que vem do banco é único por pessoa.
-- =====================================================================
update public.bank_connections set last_sync_at = null;
