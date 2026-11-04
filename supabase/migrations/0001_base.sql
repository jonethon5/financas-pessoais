-- =====================================================================
-- Base do app (Fase 0): perfis, sugestões do beta, códigos de acesso e fotos.
-- Aplicado pelo workflow .github/workflows/supabase.yml (ou: Supabase > SQL Editor > Run).
-- Não contém nenhum dado pessoal. Dinheiro é sempre CENTAVOS (bigint), nunca float.
-- RLS ligado em TODAS as tabelas: cada pessoa só lê e grava os próprios dados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- Configurações gerais (só o administrador muda; todos leem pelo app_status()).
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('beta_code_required', 'true');

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text not null default '' check (char_length(name) <= 60),
  nickname         text check (char_length(nickname) <= 30),
  avatar_path      text check (char_length(avatar_path) <= 200),
  birthday         date,
  -- Dia do pagamento e salário padrão (o salário entra sozinho todo mês nesse dia)
  payday           smallint check (payday between 1 and 31),
  salary_cents     bigint check (salary_cents between 0 and 100000000000),
  -- Para mostrar preços em horas de trabalho
  work_hours_week  smallint not null default 44 check (work_hours_week between 1 and 100),
  ai_tone          text not null default 'equilibrado' check (ai_tone in ('suave', 'equilibrado', 'agressivo')),
  money_profile    text check (char_length(money_profile) <= 40),
  -- Preferências (avisos ligados/desligados etc.)
  prefs            jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) < 8192),
  onboarded_at     timestamptz,
  -- Só o servidor muda estes:
  is_admin         boolean not null default false,
  beta_code        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.beta_codes (
  code        text primary key check (code ~ '^[A-Z0-9-]{4,32}$'),
  note        text check (char_length(note) <= 80),
  max_uses    int not null default 20 check (max_uses between 1 and 10000),
  uses        int not null default 0 check (uses >= 0),
  expires_at  timestamptz,
  active      boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.feedback (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('sugestao', 'problema', 'elogio')),
  message          text not null check (char_length(message) between 3 and 4000),
  screenshot_path  text check (char_length(screenshot_path) <= 200),
  -- Versão do app, tela e aparelho (ajuda a reproduzir o problema)
  context          jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object' and pg_column_size(context) < 4096),
  status           text not null default 'novo' check (status in ('novo', 'lido', 'resolvido')),
  created_at       timestamptz not null default now()
);
create index feedback_user_idx on public.feedback (user_id, created_at desc);
create index feedback_created_idx on public.feedback (created_at desc);

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- security definer para não cair em recursão no RLS
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create function public.normalize_beta_code(p text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'))
$$;

create function public.beta_code_required() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'beta_code_required'), true)
$$;

-- Estado público do app (tela de login): já tem administrador? Precisa de código do beta?
create function public.app_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'has_admin', exists (select 1 from public.profiles where is_admin),
    'beta_code_required', public.beta_code_required()
  )
$$;

-- Confere o código antes do cadastro (só para mostrar o erro no campo certo; quem barra é o gatilho abaixo).
create function public.check_beta_code(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.beta_codes
     where code = public.normalize_beta_code(p_code)
       and active and uses < max_uses
       and (expires_at is null or expires_at > now())
  )
$$;

-- Cadastro: exige um código válido do beta (gasta um uso) e cria o perfil.
-- Convites enviados pelo painel do Supabase não precisam de código.
-- (A configuração inicial do administrador cria um código de uso único para si mesma.)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := public.normalize_beta_code(new.raw_user_meta_data ->> 'beta_code');
  v_used text;
begin
  if new.invited_at is null then
    if v_code <> '' then
      update public.beta_codes set uses = uses + 1
       where code = v_code and active and uses < max_uses and (expires_at is null or expires_at > now())
      returning code into v_used;
    end if;
    if v_used is null and public.beta_code_required() then
      raise exception 'Código de acesso do beta inválido ou esgotado.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, name, beta_code)
  values (new.id, left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 60), v_used);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Limite de sugestões por pessoa (evita abuso): 20 por dia
create function public.feedback_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Você já enviou muitas mensagens hoje. Tente amanhã.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger feedback_limit before insert on public.feedback
  for each row execute function public.feedback_limit();

-- Painel do beta (só administrador): números gerais, sem dados financeiros de ninguém.
create function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode ver isso.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
    'feedback_new', (select count(*) from public.feedback where status = 'novo')
  );
end $$;

-- Sugestões com nome e e-mail de quem mandou (para o administrador poder responder).
create function public.admin_feedback()
returns table (id uuid, kind text, message text, screenshot_path text, context jsonb, status text, created_at timestamptz, sender_name text, sender_email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode ver isso.' using errcode = '42501';
  end if;
  return query
    select f.id, f.kind, f.message, f.screenshot_path, f.context, f.status, f.created_at, p.name, u.email::text
      from public.feedback f
      left join public.profiles p on p.id = f.user_id
      left join auth.users u on u.id = f.user_id
     order by f.created_at desc
     limit 300;
end $$;

-- Consulta leve usada pelo workflow keepalive (o plano Free pausa projetos parados). Não lê dados.
create function public.ping() returns text
language sql stable set search_path = '' as $$ select 'ok' $$;

-- ---------------------------------------------------------------------
-- Segurança (RLS)
-- ---------------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.profiles     enable row level security;
alter table public.beta_codes   enable row level security;
alter table public.feedback     enable row level security;

revoke all on public.app_settings, public.profiles, public.beta_codes, public.feedback from anon, authenticated;

-- Perfil: cada um lê e altera o próprio. O perfil nasce pelo gatilho; is_admin e beta_code só o servidor muda.
grant select on public.profiles to authenticated;
grant update (name, nickname, avatar_path, birthday, payday, salary_cents, work_hours_week, ai_tone, money_profile, prefs, onboarded_at)
  on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Sugestões: cada um envia e vê as próprias; o administrador vê todas e marca como lida/resolvida.
grant select on public.feedback to authenticated;
grant insert (kind, message, screenshot_path, context) on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;
create policy feedback_select on public.feedback for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy feedback_insert on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy feedback_update on public.feedback for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Códigos do beta e configurações: só o administrador.
grant select, insert, update, delete on public.beta_codes to authenticated;
create policy beta_codes_admin on public.beta_codes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, update on public.app_settings to authenticated;
create policy app_settings_admin on public.app_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Funções: ninguém executa nada por padrão; liberamos só o necessário.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.app_status(), public.check_beta_code(text), public.ping() to anon, authenticated;
grant execute on function public.is_admin(), public.admin_stats(), public.admin_feedback() to authenticated;

-- ---------------------------------------------------------------------
-- Arquivos (Storage): buckets PRIVADOS, cada pessoa só mexe na própria pasta ("<id do usuário>/...")
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('fotos', 'fotos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('feedback', 'feedback', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy fotos_select on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_update on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy feedback_files_select on storage.objects for select to authenticated
  using (bucket_id = 'feedback' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy feedback_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy feedback_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'feedback' and (storage.foldername(name))[1] = (select auth.uid())::text);
