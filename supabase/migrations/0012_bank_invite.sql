-- =====================================================================
-- Convite que libera o banco conectado.
-- No beta, a conexão com o banco usa as chaves da Pluggy do dono do app, então só quem foi liberado usa:
-- o administrador e quem entrou com um código marcado com "libera banco" (ex.: o sócio, para testar).
-- =====================================================================
alter table public.beta_codes add column if not exists bank_access boolean not null default false;

-- Pode conectar banco? (usado pela função bank-sync, que roda com a chave de serviço)
create or replace function public.can_use_bank(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_admin or coalesce(c.bank_access, false)
      from public.profiles p
      left join public.beta_codes c on c.code = p.beta_code
     where p.id = p_user
  ), false)
$$;
revoke execute on function public.can_use_bank(uuid) from public, anon, authenticated;
grant execute on function public.can_use_bank(uuid) to service_role;
