-- =====================================================================
-- Porquinho: moedas ganhas com as metas do dia e itens comprados na loja.
-- As moedas só valem dentro do app (sem valor em dinheiro).
-- =====================================================================

-- Moedas ganhas. Cada meta rende uma vez por dia (único por pessoa + dia + tipo + referência).
create table public.pig_coins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  kind        text not null check (kind in ('lancou', 'no_limite', 'sem_gastar', 'guardou', 'semana', 'marco')),
  ref         text not null default '' check (char_length(ref) <= 80),
  coins       int not null,
  created_at  timestamptz not null default now(),
  unique (user_id, day, kind, ref),
  -- valor fixo por tipo: ninguém se dá 1.000 moedas pela API
  check (coins = case kind when 'semana' then 10 when 'marco' then 5 else 1 end)
);

-- Não vale moeda para o futuro nem para muito tempo atrás (gatilho: o CHECK não pode depender da data de hoje)
create function public.pig_check_day()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.day > (now() at time zone 'America/Sao_Paulo')::date or new.day < (now() at time zone 'America/Sao_Paulo')::date - 40 then
    raise exception 'Data fora do período' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger pig_coins_day before insert on public.pig_coins for each row execute function public.pig_check_day();

-- Itens comprados na loja (roupas e acessórios do porquinho)
create table public.pig_purchases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item        text not null check (item ~ '^[a-z0-9_]{2,40}$'),
  price       int not null check (price between 1 and 1000),
  created_at  timestamptz not null default now(),
  unique (user_id, item)
);

-- Só compra se tiver moedas suficientes (conferido no banco, não só na tela)
create function public.pig_check_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  earned int;
  spent int;
begin
  select coalesce(sum(coins), 0) into earned from public.pig_coins where user_id = new.user_id;
  select coalesce(sum(price), 0) into spent from public.pig_purchases where user_id = new.user_id;
  if earned - spent < new.price then
    raise exception 'Moedas insuficientes' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger pig_purchases_balance before insert on public.pig_purchases for each row execute function public.pig_check_balance();

alter table public.pig_coins enable row level security;
alter table public.pig_purchases enable row level security;
revoke all on public.pig_coins, public.pig_purchases from anon, authenticated;
grant select, insert on public.pig_coins to authenticated;
grant select, insert on public.pig_purchases to authenticated;

create policy pig_coins_own on public.pig_coins for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy pig_purchases_own on public.pig_purchases for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
