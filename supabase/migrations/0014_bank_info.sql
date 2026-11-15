-- Detalhes do banco em cada lançamento, como no app do banco: nome original (não se perde se a pessoa renomear),
-- hora em Brasília, Pix/TED/boleto/cartão, se o dinheiro saiu ou entrou e a outra ponta (para quem / de quem).
alter table public.transactions
  add column bank_info jsonb check (bank_info is null or (jsonb_typeof(bank_info) = 'object' and pg_column_size(bank_info) < 2048));

-- A próxima sincronização relê os últimos meses: preenche os detalhes dos lançamentos que já estão no app
-- e acerta o dia dos Pix feitos tarde da noite (o banco manda em UTC; o app agora usa o horário de Brasília).
update public.bank_connections set last_sync_at = null;
