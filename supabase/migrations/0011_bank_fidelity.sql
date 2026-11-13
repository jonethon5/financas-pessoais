-- =====================================================================
-- Extrato igual ao do banco
--  - a descrição que vem do banco fica como o banco mandou (ex.: "Transferência enviada pelo Pix|MARIA SOUZA"),
--    por isso cabe mais texto (o que a pessoa digita continua limitado a 60 na tela);
--  - dinheiro guardado e investido (caixinhas, CDB, poupança) vira uma "conta" do tipo INVESTMENT;
--  - da conta corrente: dinheiro guardado automaticamente e o cheque especial (contratado e usado).
-- Depois, cada conexão é lida de novo desde o começo, já com as regras novas (não duplica).
-- =====================================================================

alter table public.transactions drop constraint if exists transactions_description_check;
alter table public.transactions add constraint transactions_description_check check (char_length(description) between 1 and 140);

alter table public.bank_accounts drop constraint if exists bank_accounts_type_check;
alter table public.bank_accounts add constraint bank_accounts_type_check check (type in ('BANK', 'CREDIT', 'INVESTMENT'));
alter table public.bank_accounts add column if not exists invested_cents bigint;
alter table public.bank_accounts add column if not exists overdraft_limit_cents bigint;
alter table public.bank_accounts add column if not exists overdraft_used_cents bigint;

update public.bank_connections set last_sync_at = null;
