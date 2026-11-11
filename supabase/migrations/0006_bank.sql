-- =====================================================================
-- Conexão com o banco (Open Finance via Pluggy, só leitura).
-- Quem grava aqui é a Edge Function "bank-sync" (chave de serviço); o app só lê e apaga.
-- =====================================================================

create table public.bank_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id       text not null check (char_length(item_id) between 10 and 80),
  label         text not null default 'Banco' check (char_length(label) between 1 and 40),
  status        text not null default 'ok' check (status in ('ok', 'erro', 'expirado')),
  last_sync_at  timestamptz,
  last_error    text check (char_length(last_error) <= 300),
  created_at    timestamptz not null default now(),
  unique (user_id, item_id)
);

create table public.bank_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  connection_id       uuid not null references public.bank_connections (id) on delete cascade,
  external_id         text not null,
  type                text not null check (type in ('BANK', 'CREDIT')),
  subtype             text,
  name                text not null,
  balance_cents       bigint,
  credit_limit_cents  bigint,
  available_cents     bigint,
  due_date            date,
  close_date          date,
  updated_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (user_id, external_id)
);

-- Lançamentos que vieram do banco: id de lá (não duplica) e de qual conta
alter table public.transactions add column source text not null default 'manual' check (source in ('manual', 'banco'));
alter table public.transactions add column external_id text check (char_length(external_id) <= 120);
alter table public.transactions add column bank_account_id uuid references public.bank_accounts (id) on delete set null;
alter table public.transactions add constraint transactions_external_unique unique (user_id, external_id);

-- O app aprende: "UBER *TRIP" → Transporte, depois que a pessoa corrige uma vez
create table public.category_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern      text not null check (char_length(pattern) between 2 and 80),
  category_id  uuid not null references public.categories (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, pattern)
);

alter table public.bank_connections enable row level security;
alter table public.bank_accounts    enable row level security;
alter table public.category_rules   enable row level security;
revoke all on public.bank_connections, public.bank_accounts, public.category_rules from anon, authenticated;

-- Conexões e contas: a pessoa vê e pode desconectar; criar/atualizar só pela Edge Function
grant select, delete on public.bank_connections to authenticated;
grant update (label) on public.bank_connections to authenticated;
grant select on public.bank_accounts to authenticated;
grant select, insert, update, delete on public.category_rules to authenticated;

create policy bank_connections_own on public.bank_connections for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));
create policy bank_accounts_own on public.bank_accounts for select to authenticated
  using ((select public.owns(user_id)));
create policy category_rules_own on public.category_rules for all to authenticated
  using ((select public.owns(user_id))) with check ((select public.owns(user_id)));

create trigger category_rules_ref before insert or update on public.category_rules for each row execute function public.check_refs();

alter publication supabase_realtime add table public.bank_connections, public.bank_accounts;
