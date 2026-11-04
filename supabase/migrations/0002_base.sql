-- =====================================================================
-- Fase 1 (Base): categorias, gastos fixos, lançamentos, orçamento e plano do mês.
-- Dinheiro em CENTAVOS (bigint). Cada linha tem user_id e o RLS só deixa a dona ou o dono mexer.
-- (Para o "modo casal" no futuro, basta trocar a função public.owns(uuid).)
-- =====================================================================

create function public.owns(p_user uuid) returns boolean
language sql stable set search_path = '' as $$ select p_user = auth.uid() $$;

-- Categorias (as padrão são criadas pelo app no primeiro acesso)
create table public.categories (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 40),
  icon                 text not null default 'receipt' check (char_length(icon) <= 30),
  color                text not null default '#5B6B7A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind                 text not null default 'expense' check (kind in ('expense', 'income')),
  -- Regra 50/30/20: necessidade, desejo (guardar = caixinhas)
  grp                  text not null default 'desejo' check (grp in ('necessidade', 'desejo')),
  monthly_limit_cents  bigint check (monthly_limit_cents between 0 and 100000000000),
  weekly_limit_cents   bigint check (weekly_limit_cents between 0 and 100000000000),
  sort                 int not null default 0,
  archived             boolean not null default false,
  created_at           timestamptz not null default now()
);
create index categories_user_idx on public.categories (user_id);

-- Gastos fixos: viram um lançamento por mês, sozinhos (aluguel, telefone, YouTube…)
create table public.recurrings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description   text not null check (char_length(description) between 1 and 60),
  category_id   uuid references public.categories (id) on delete set null,
  amount_cents  bigint not null check (amount_cents between 1 and 100000000000),
  day           smallint not null check (day between 1 and 31),
  -- Avisar antes do vencimento (o dia é o vencimento)
  remind        boolean not null default true,
  start_month   text not null check (start_month ~ '^\d{4}-\d{2}$'),
  end_month     text check (end_month ~ '^\d{4}-\d{2}$'),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index recurrings_user_idx on public.recurrings (user_id);

-- Lançamentos: rendas e gastos.
--   income:  salario | extra
--   expense: fixo (vem de recurrings) | dia (dia a dia) | parcela (de um parcelamento)
-- Os do salário e dos fixos têm id previsível (gerado pelo app), então criar duas vezes não duplica.
create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind               text not null check (kind in ('income', 'expense')),
  type               text not null check (type in ('salario', 'extra', 'fixo', 'dia', 'parcela')),
  amount_cents       bigint not null check (amount_cents between 1 and 100000000000),
  date               date not null,
  description        text not null check (char_length(description) between 1 and 60),
  category_id        uuid references public.categories (id) on delete set null,
  recurring_id       uuid references public.recurrings (id) on delete set null,
  installment_group  uuid,
  installment_no     smallint check (installment_no between 1 and 120),
  installment_total  smallint check (installment_total between 1 and 120),
  emotion            text check (emotion in ('comemorando', 'estressado', 'entediado', 'cansado')),
  -- Fixo/parcela: já foi pago? (o dia a dia nasce pago)
  paid               boolean not null default true,
  -- Fixo "pulado" neste mês (não conta, e não volta a ser criado)
  skipped            boolean not null default false,
  note               text check (char_length(note) <= 200),
  created_at         timestamptz not null default now(),
  check ((kind = 'income') = (type in ('salario', 'extra')))
);
create index transactions_user_date_idx on public.transactions (user_id, date);
create index transactions_group_idx on public.transactions (installment_group) where installment_group is not null;

-- Orçamento estilo YNAB: tirar de uma categoria para cobrir outra, só naquele mês
create table public.budget_moves (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  from_category uuid not null references public.categories (id) on delete cascade,
  to_category   uuid not null references public.categories (id) on delete cascade,
  amount_cents  bigint not null check (amount_cents between 1 and 100000000000),
  created_at    timestamptz not null default now()
);
create index budget_moves_user_idx on public.budget_moves (user_id, month);

-- Plano do mês: quanto separar para guardar e se o salário já foi "separado" (estilo Monzo)
create table public.month_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  save_cents    bigint not null default 0 check (save_cents between 0 and 100000000000),
  split_done_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, month)
);

-- Segurança: RLS e só as operações necessárias
alter table public.categories   enable row level security;
alter table public.recurrings   enable row level security;
alter table public.transactions enable row level security;
alter table public.budget_moves enable row level security;
alter table public.month_plans  enable row level security;

revoke all on public.categories, public.recurrings, public.transactions, public.budget_moves, public.month_plans from anon, authenticated;
grant select, insert, update, delete on public.categories, public.recurrings, public.transactions, public.budget_moves, public.month_plans to authenticated;

create policy categories_own on public.categories for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy recurrings_own on public.recurrings for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy transactions_own on public.transactions for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy budget_moves_own on public.budget_moves for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy month_plans_own on public.month_plans for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));

-- Ninguém usa categoria, fixo ou lançamento de outra pessoa como referência
create function public.check_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.category_id is not null and not exists (select 1 from public.categories where id = new.category_id and user_id = new.user_id) then
    raise exception 'Categoria inválida.' using errcode = '42501';
  end if;
  if tg_table_name = 'transactions' then
    -- (blocos separados: em recurrings o NEW não tem recurring_id)
    if (to_jsonb(new) ->> 'recurring_id') is not null
       and not exists (select 1 from public.recurrings where id = (to_jsonb(new) ->> 'recurring_id')::uuid and user_id = new.user_id) then
      raise exception 'Gasto fixo inválido.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger categories_ref before insert or update on public.recurrings for each row execute function public.check_refs();
create trigger transactions_ref before insert or update on public.transactions for each row execute function public.check_refs();

create function public.check_move_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.categories where id in (new.from_category, new.to_category) and user_id = new.user_id) <> 2 then
    raise exception 'Categoria inválida.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger budget_moves_ref before insert or update on public.budget_moves for each row execute function public.check_move_refs();

revoke execute on function public.owns(uuid), public.check_refs(), public.check_move_refs() from public, anon;
grant execute on function public.owns(uuid) to authenticated;

-- Tempo real: outro aparelho da mesma pessoa vê as mudanças na hora
alter publication supabase_realtime add table public.categories, public.recurrings, public.transactions, public.budget_moves, public.month_plans;
