-- =====================================================================
-- Fase 3: psicologia para guardar
-- Perguntas do primeiro acesso, "isso equivale a…" nas caixinhas, desafios, regras automáticas,
-- lista de desejos (espera de 30 dias) e planos "se… então".
-- =====================================================================

-- Respostas do primeiro acesso (objetivo, faixa de idade, situação…), usadas para adaptar o app
alter table public.profiles add column about jsonb not null default '{}'::jsonb
  check (jsonb_typeof(about) = 'object' and pg_column_size(about) < 4096);
grant update (about) on public.profiles to authenticated;

-- "Esse iFood = 1 diária do hotel": o item concreto de cada caixinha
alter table public.goals add column concrete_name text check (char_length(concrete_name) <= 40);
alter table public.goals add column concrete_cents bigint check (concrete_cents between 1 and 100000000000);

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('sem_delivery', 'sem_shopee', 'sem_impulso', '52_semanas', 'personalizado')),
  title       text not null check (char_length(title) between 1 and 60),
  params      jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object' and pg_column_size(params) < 2048),
  goal_id     uuid references public.goals (id) on delete set null,
  started_on  date not null,
  ends_on     date not null,
  status      text not null default 'ativo' check (status in ('ativo', 'concluido', 'desistiu')),
  created_at  timestamptz not null default now(),
  check (ends_on >= started_on)
);
create index challenges_user_idx on public.challenges (user_id);

create table public.rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('arredondar', 'sobra_limite', 'renda_extra', 'prazer_culpado')),
  goal_id     uuid not null references public.goals (id) on delete cascade,
  params      jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object' and pg_column_size(params) < 2048),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index rules_user_idx on public.rules (user_id);

create table public.wishes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  price_cents  bigint not null check (price_cents between 1 and 100000000000),
  link         text check (char_length(link) <= 400),
  decide_on    date not null,
  status       text not null default 'esperando' check (status in ('esperando', 'comprei', 'desisti')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index wishes_user_idx on public.wishes (user_id);

create table public.if_then_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trigger_text text not null check (char_length(trigger_text) between 1 and 120),
  action_text  text not null check (char_length(action_text) between 1 and 120),
  -- dia da semana para lembrar (0 = domingo … 6 = sábado); null = todo dia
  weekday      smallint check (weekday between 0 and 6),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if_then_user_idx on public.if_then_plans (user_id);

alter table public.challenges    enable row level security;
alter table public.rules         enable row level security;
alter table public.wishes        enable row level security;
alter table public.if_then_plans enable row level security;
revoke all on public.challenges, public.rules, public.wishes, public.if_then_plans from anon, authenticated;
grant select, insert, update, delete on public.challenges, public.rules, public.wishes, public.if_then_plans to authenticated;

create policy challenges_own on public.challenges for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy rules_own on public.rules for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy wishes_own on public.wishes for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy if_then_own on public.if_then_plans for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));

-- Regra e desafio só apontam para caixinha da própria pessoa
create function public.check_optional_goal_ref() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.goal_id is not null and not exists (select 1 from public.goals where id = new.goal_id and user_id = new.user_id) then
    raise exception 'Caixinha inválida.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger challenges_goal_ref before insert or update on public.challenges for each row execute function public.check_optional_goal_ref();
create trigger rules_goal_ref before insert or update on public.rules for each row execute function public.check_optional_goal_ref();
revoke execute on function public.check_optional_goal_ref() from public, anon;

alter publication supabase_realtime add table public.challenges, public.rules, public.wishes, public.if_then_plans;
