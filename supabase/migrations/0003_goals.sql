-- =====================================================================
-- Fase 2: caixinhas (metas para guardar). O dinheiro fica no banco da pessoa; o app só registra.
-- =====================================================================

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  -- modelo de origem (viagem, reserva…), ícone e cor da capa
  template      text not null default 'livre' check (char_length(template) <= 20),
  icon          text not null default 'piggy' check (char_length(icon) <= 30),
  color         text not null default '#0B7F5A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  photo_path    text check (char_length(photo_path) <= 200),
  -- data: chegar no valor até a data · mensal: guardar X por mês · livre: sem valor final
  mode          text not null default 'mensal' check (mode in ('data', 'mensal', 'livre')),
  target_cents  bigint check (target_cents between 1 and 100000000000),
  target_month  text check (target_month ~ '^\d{4}-\d{2}$'),
  monthly_cents bigint check (monthly_cents between 0 and 100000000000),
  -- 1 = primeira a receber a sobra do mês
  priority      int not null default 100,
  archived      boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (mode <> 'data' or (target_cents is not null and target_month is not null)),
  check (mode <> 'mensal' or (target_cents is not null and monthly_cents is not null))
);
create index goals_user_idx on public.goals (user_id);

-- Depósitos (+), retiradas (−) e o valor que já existia ao criar (inicial)
create table public.goal_moves (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id       uuid not null references public.goals (id) on delete cascade,
  kind          text not null check (kind in ('deposito', 'retirada', 'inicial')),
  amount_cents  bigint not null check (amount_cents between -100000000000 and 100000000000 and amount_cents <> 0),
  date          date not null,
  note          text check (char_length(note) <= 120),
  created_at    timestamptz not null default now(),
  check ((kind = 'retirada') = (amount_cents < 0))
);
create index goal_moves_goal_idx on public.goal_moves (goal_id, date);
create index goal_moves_user_idx on public.goal_moves (user_id, date);

alter table public.goals      enable row level security;
alter table public.goal_moves enable row level security;
revoke all on public.goals, public.goal_moves from anon, authenticated;
grant select, insert, update, delete on public.goals, public.goal_moves to authenticated;

create policy goals_own on public.goals for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy goal_moves_own on public.goal_moves for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));

-- Movimentação só em caixinha da própria pessoa
create function public.check_goal_ref() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.goals where id = new.goal_id and user_id = new.user_id) then
    raise exception 'Caixinha inválida.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger goal_moves_ref before insert or update on public.goal_moves for each row execute function public.check_goal_ref();
revoke execute on function public.check_goal_ref() from public, anon;

alter publication supabase_realtime add table public.goals, public.goal_moves;
