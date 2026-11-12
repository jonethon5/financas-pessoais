-- =====================================================================
-- Renda do mês = salário do cadastro (Você › Salário) + o que a pessoa lança à mão.
-- O dinheiro que entra na conta do banco (Pix recebido etc.) continua aparecendo no extrato,
-- mas deixa de contar como renda sozinho. Esta migration arruma o que já tinha entrado antes da regra.
-- (transactions.skipped = "não conta": já era usado para o gasto fixo pulado no mês.)
-- =====================================================================

-- 1. Entradas que vieram do banco deixam de contar (a pessoa pode voltar a contar uma a uma)
update public.transactions
   set skipped = true
 where source = 'banco' and type = 'extra' and not skipped;

-- 2. O salário do mês atual volta a ser o do cadastro
--    (a conexão com o banco trocava o valor pelo do depósito)
update public.transactions t
   set amount_cents = p.salary_cents
  from public.profiles p
 where p.id = t.user_id
   and t.type = 'salario' and t.source = 'banco' and t.description = 'Salário'
   and p.salary_cents > 0 and t.amount_cents <> p.salary_cents
   and t.date >= date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;

-- 3. Na próxima atualização, cada conexão é lida de novo desde o começo, já com as regras novas
--    (transferência entre contas próprias, um salário por mês). Não duplica: o id do banco é único.
update public.bank_connections set last_sync_at = null;
