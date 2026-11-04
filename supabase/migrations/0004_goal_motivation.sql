-- Mensagem motivacional da caixinha: o "porquê" da pessoa, mostrado no cartão e na hora de retirar.
alter table public.goals add column motivation text check (char_length(motivation) <= 200);
