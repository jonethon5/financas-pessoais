-- Avisos no celular (push). Quem manda é a Edge Function notify (de hora em hora, chamada pelo GitHub Actions).
-- A pessoa liga os avisos em Ajustes › Notificações; o navegador entrega um "endereço" (inscrição) por aparelho.

-- Inscrições: uma por aparelho. Só o servidor grava (a função notify), porque um aparelho que troca de conta
-- passa a inscrição para a conta nova. A pessoa só vê as dela.
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) between 10 and 1000),
  p256dh      text not null check (char_length(p256dh) between 20 and 200),
  auth        text not null check (char_length(auth) between 8 and 100),
  user_agent  text check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

-- O que já foi mandado (cada aviso tem uma referência, ex.: "vencimentos:<conta>:2026-11-22:dia").
-- Garante que o mesmo aviso nunca sai duas vezes, mesmo se a função rodar de novo. Só o servidor usa.
create table public.notification_log (
  user_id  uuid not null references auth.users (id) on delete cascade,
  ref      text not null check (char_length(ref) <= 200),
  kind     text not null check (char_length(kind) <= 20),
  sent_at  timestamptz not null default now(),
  primary key (user_id, ref)
);
create index notification_log_sent_idx on public.notification_log (sent_at);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

-- Último dia em que a pessoa abriu o app (o lembrete do dia só sai se ela não abriu hoje)
alter table public.profiles add column last_seen_on date;
grant update (last_seen_on) on public.profiles to authenticated;
