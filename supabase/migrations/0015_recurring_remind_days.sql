-- Gasto fixo: com quantos dias de antecedência avisar (0 = no dia). A conta aparece em "Contas a pagar"
-- no Início a partir desse dia (antes, aparecia sempre 7 dias antes e o "avisar" não fazia diferença).
alter table public.recurrings
  add column remind_days smallint not null default 3 check (remind_days between 0 and 15);
