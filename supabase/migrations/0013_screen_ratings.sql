-- "Avalie esta tela": nota de 1 a 5 por tela, o que melhorar (opções prontas) e um comentário opcional.
-- Fica separado de "feedback" (sugestões livres) porque aqui o que importa é a média de cada tela.

create table public.screen_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- caminho da tela sem ids (ex.: 'extrato', 'caixinhas/detalhe')
  screen      text not null check (screen ~ '^[a-z0-9/-]{1,60}$'),
  rating      smallint not null check (rating between 1 and 5),
  problems    text[] not null default '{}' check (cardinality(problems) <= 8 and char_length(array_to_string(problems, '|')) <= 400),
  message     text check (char_length(message) between 1 and 1000),
  -- versão do app, tamanho da tela, se está instalado, aba aberta (sem nada pessoal)
  context     jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object' and pg_column_size(context) < 2048),
  created_at  timestamptz not null default now()
);
create index screen_ratings_user_idx on public.screen_ratings (user_id, created_at desc);
create index screen_ratings_created_idx on public.screen_ratings (created_at desc);

-- Limite contra abuso: 40 avaliações por pessoa por dia
create function public.screen_ratings_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.screen_ratings where user_id = new.user_id and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Você já avaliou muitas telas hoje. Obrigado! Tente amanhã.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger screen_ratings_limit before insert on public.screen_ratings
  for each row execute function public.screen_ratings_limit();

alter table public.screen_ratings enable row level security;
revoke all on public.screen_ratings from anon, authenticated;
grant select on public.screen_ratings to authenticated;
grant insert (screen, rating, problems, message, context) on public.screen_ratings to authenticated;
create policy screen_ratings_select on public.screen_ratings for select to authenticated
  using ((select public.owns(user_id)));
create policy screen_ratings_insert on public.screen_ratings for insert to authenticated
  with check ((select public.owns(user_id)));

-- Painel do beta: as últimas avaliações de todo mundo, com nome e e-mail de quem mandou (só administrador).
create function public.admin_screen_ratings()
returns table (id uuid, screen text, rating smallint, problems text[], message text, context jsonb, created_at timestamptz, sender_name text, sender_email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode ver isso.' using errcode = '42501';
  end if;
  return query
    select r.id, r.screen, r.rating, r.problems, r.message, r.context, r.created_at, p.name, u.email::text
      from public.screen_ratings r
      left join public.profiles p on p.id = r.user_id
      left join auth.users u on u.id = r.user_id
     order by r.created_at desc
     limit 1000;
end $$;

revoke execute on function public.screen_ratings_limit(), public.admin_screen_ratings() from public, anon, authenticated;
grant execute on function public.admin_screen_ratings() to authenticated;
