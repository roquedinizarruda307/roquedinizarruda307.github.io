-- =============================================================================
-- 20261110_rls_seguranca.sql  —  Fecha o banco (RLS) da Tesouraria
-- =============================================================================
-- O QUE FAZ
--   * Habilita RLS em todas as tabelas usadas pelo site.
--   * Apaga TODAS as políticas existentes dessas tabelas (inclusive "allow all").
--   * Cria funções email_atual() / papel_atual() / is_aprovado() / is_admin().
--   * Políticas novas:
--       anon (sem login) ............ nenhum acesso a nada.
--       admin / dono aprovado ....... lê e grava tudo ('dono' = admin).
--       escrivão aprovado ........... lê membros; lê e grava reunioes e
--                                     reuniao_presencas. Nada de finanças.
--       conta não aprovada .......... só lê o próprio registro em perfis.
--   * perfis: cada um lê o próprio; só admin cria/altera/apaga; ninguém se
--     autoaprova nem se promove; impede remover o último admin.
--   * Trigger em auth.users: toda conta nova ganha perfil
--     (papel 'escrivao', aprovado = false) direto no banco.
--   O site público (Início, História, Past MC, Fotos, Eventos) NÃO lê nenhuma
--   tabela do Supabase, então não há leitura pública.
--
-- COMO APLICAR (Supabase > SQL Editor)
--   0. Faça backup: Database > Backups (ou exporte as tabelas em CSV).
--   1. Rode SÓ o bloco "PASSO 1 - CONFERÊNCIA" abaixo (selecione e Run).
--      Confira se o e-mail do admin atual aparece com email_confirmed_at
--      preenchido. Anote contas antigas SEM perfil: elas perderão o acesso
--      (antes, "sem perfil" era tratado como admin).
--   2. Rode o "PASSO 2 - GARANTIR ADMIN" trocando o e-mail pelo do admin
--      atual (e, se quiser, repita para as contas antigas que devem continuar).
--   3. Rode o arquivo inteiro a partir de "PASSO 3". Ele roda numa transação:
--      se não existir nenhum admin aprovado com e-mail confirmado, ele ABORTA
--      sem mudar nada (para não trancar o admin fora).
--   4. Rode o "PASSO 4 - VERIFICAÇÃO" (fim do arquivo).
--   5. Teste: abra o site deslogado (Tesouraria não deve carregar dados);
--      entre como admin (tudo funciona); entre como escrivão (só Escrivão).
--   6. Só então publique o front novo (AuthGuard / PapelContext / Ajustes).
--
-- DESFAZER EM EMERGÊNCIA (reabre o banco; use só se o admin ficar trancado):
--   alter table public.<tabela> disable row level security;
-- =============================================================================


-- =============================================================================
-- PASSO 1 - CONFERÊNCIA (rode sozinho, só lê)
-- =============================================================================
-- Papéis existentes (esperado: dono, admin, escrivao; qualquer outro = sem acesso):
-- select papel, aprovado, count(*) from public.perfis group by 1, 2 order by 1, 2;
--
-- Constraints de perfis e membros (conferir se membros.status aceita 'senior'
-- e 'afastado'; este SQL NÃO altera membros nem suas constraints):
-- select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid in ('public.perfis'::regclass, 'public.membros'::regclass);
--
-- select u.id, lower(u.email) as email, u.email_confirmed_at, p.papel, p.aprovado
--   from auth.users u
--   left join public.perfis p on lower(p.email) = lower(u.email)
--  order by p.papel nulls first, u.email;


-- =============================================================================
-- PASSO 2 - GARANTIR ADMIN (troque o e-mail e rode sozinho)
-- =============================================================================
-- insert into public.perfis (email, papel, aprovado)
-- values (lower(trim('EMAIL_DO_ADMIN@exemplo.com')), 'admin', true)
-- on conflict (email) do update
--   set papel = case when public.perfis.papel = 'dono' then 'dono' else 'admin' end, aprovado = true;
-- (os 3 donos já existentes: só confirme no PASSO 1 que estão com aprovado = true)


-- =============================================================================
-- PASSO 3 - MIGRAÇÃO (rode daqui até o COMMIT)
-- =============================================================================
begin;

-- ---------- perfis: garante estrutura mínima usada pelo código --------------
create table if not exists public.perfis (
  email      text primary key,
  papel      text not null default 'escrivao',
  aprovado   boolean not null default false,
  created_at timestamptz default now()
);
alter table public.perfis add column if not exists aprovado boolean not null default false;
alter table public.perfis alter column aprovado set default false;
alter table public.perfis alter column papel set default 'escrivao';
update public.perfis set email = lower(trim(email)) where email <> lower(trim(email));
-- o código usa upsert onConflict 'email'
create unique index if not exists perfis_email_uniq on public.perfis (email);

-- ---------- funções de acesso (SECURITY DEFINER, search_path fixo) ----------
-- Liga perfis ao usuário pelo e-mail da conta logada (auth.uid() -> auth.users),
-- exigindo e-mail confirmado (evita alguém criar conta com e-mail já liberado).
create or replace function public.email_atual()
returns text language sql stable security definer set search_path = ''
as $$
  select lower(trim(u.email)) from auth.users u
   where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

create or replace function public.papel_atual()
returns text language sql stable security definer set search_path = ''
as $$
  select p.papel from public.perfis p
   where p.email = public.email_atual()
     and p.aprovado = true
     and p.papel in ('dono', 'admin', 'escrivao')
   limit 1
$$;

create or replace function public.is_aprovado()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.papel_atual() is not null $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.papel_atual() in ('dono', 'admin'), false) $$;

revoke all on function public.email_atual(), public.papel_atual(), public.is_aprovado(), public.is_admin() from public, anon;
grant execute on function public.email_atual(), public.papel_atual(), public.is_aprovado(), public.is_admin() to authenticated;

-- ---------- trava anti-lockout: precisa existir um admin válido ------------
do $$
begin
  if not exists (
    select 1 from public.perfis p join auth.users u on lower(trim(u.email)) = p.email
     where p.papel in ('dono', 'admin') and p.aprovado = true and u.email_confirmed_at is not null
  ) then
    raise exception 'ABORTADO: nenhum admin aprovado com e-mail confirmado. Rode o PASSO 2 antes.';
  end if;
end $$;

-- ---------- RLS ligado + derruba TODAS as políticas antigas -----------------
do $$
declare
  t text;
  pol record;
  tabelas text[] := array[
    'perfis','membros','transacoes','mensalidades','anuidades','pagamentos_eventos',
    'evento_itens','evento_pedidos','evento_participantes','reunioes','reuniao_presencas'];
begin
  foreach t in array tabelas loop
    if to_regclass('public.' || t) is null then
      raise exception 'Tabela public.% não existe. Confira antes de seguir.', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- (redundante com o bloco acima; nomes do supabase-schema.sql antigo)
drop policy if exists "allow all" on public.membros;
drop policy if exists "allow all" on public.transacoes;
drop policy if exists "allow all" on public.mensalidades;
drop policy if exists "allow all" on public.pagamentos_eventos;
drop policy if exists "allow all" on public.anuidades;

-- ---------- financeiro e eventos: só admin ----------------------------------
do $$
declare t text;
begin
  foreach t in array array['transacoes','mensalidades','anuidades','pagamentos_eventos',
                           'evento_itens','evento_pedidos','evento_participantes'] loop
    execute format(
      'create policy admin_tudo on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- membros: aprovados leem, só admin grava -------------------------
create policy aprovados_leem on public.membros for select to authenticated using (public.is_aprovado());
create policy admin_insere  on public.membros for insert to authenticated with check (public.is_admin());
create policy admin_altera  on public.membros for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_apaga   on public.membros for delete to authenticated using (public.is_admin());

-- ---------- reuniões / presenças: admin e escrivão --------------------------
create policy admin_escrivao_tudo on public.reunioes for all to authenticated
  using (public.is_aprovado()) with check (public.is_aprovado());
create policy admin_escrivao_tudo on public.reuniao_presencas for all to authenticated
  using (public.is_aprovado()) with check (public.is_aprovado());

-- ---------- perfis ----------------------------------------------------------
create policy le_proprio_ou_admin on public.perfis for select to authenticated
  using (email = public.email_atual() or public.is_admin());
create policy admin_insere on public.perfis for insert to authenticated with check (public.is_admin());
create policy admin_altera on public.perfis for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_apaga  on public.perfis for delete to authenticated using (public.is_admin());

-- Trigger de proteção (vale mesmo se alguém mexer nas políticas depois):
--  * só admin altera perfis pela API; SQL Editor / service_role / trigger de
--    cadastro (sem auth.uid()) passam;
--  * papel só pode ser 'dono', 'admin' ou 'escrivao'; e-mail sempre minúsculo;
--  * admin não mexe no próprio papel/aprovação (não se tranca fora);
--  * perfis de 'dono' só são criados/alterados/apagados por outro dono;
--  * nunca deixa o sistema sem nenhum admin aprovado.
create or replace function public.perfis_proteger()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  via_api boolean := auth.uid() is not null;
  restam int;
begin
  if tg_op in ('INSERT','UPDATE') then
    new.email := lower(trim(new.email));
    if new.papel is null or new.papel not in ('dono','admin','escrivao') then
      raise exception 'papel inválido: %', new.papel;
    end if;
  end if;

  if via_api then
    if not public.is_admin() then
      raise exception 'sem permissão para alterar perfis';
    end if;
    if tg_op = 'UPDATE' and old.email = public.email_atual()
       and (new.papel is distinct from old.papel or new.aprovado is distinct from old.aprovado or new.email <> old.email) then
      raise exception 'você não pode alterar o próprio papel/aprovação';
    end if;
    if tg_op = 'DELETE' and old.email = public.email_atual() then
      raise exception 'você não pode apagar o próprio perfil';
    end if;
    -- só um dono cria, altera ou apaga perfil de dono
    if ((tg_op in ('UPDATE','DELETE') and old.papel = 'dono')
        or (tg_op in ('INSERT','UPDATE') and new.papel = 'dono'))
       and coalesce(public.papel_atual(), '') <> 'dono' then
      raise exception 'só um dono pode alterar perfis de dono';
    end if;
  end if;

  if tg_op in ('UPDATE','DELETE') and old.papel in ('dono','admin') and old.aprovado = true
     and (tg_op = 'DELETE' or new.papel not in ('dono','admin') or new.aprovado is not true) then
    select count(*) into restam from public.perfis
     where papel in ('dono','admin') and aprovado = true and email <> old.email;
    if restam = 0 then
      raise exception 'não é possível remover o último admin';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists perfis_proteger on public.perfis;
create trigger perfis_proteger before insert or update or delete on public.perfis
  for each row execute function public.perfis_proteger();

-- ---------- cadastro: perfil criado pelo banco, pendente e não-admin --------
create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is not null then
    insert into public.perfis (email, papel, aprovado)
    values (lower(trim(new.email)), 'escrivao', false)
    on conflict (email) do nothing;   -- e-mail já liberado pelo admin: mantém
  end if;
  return new;
exception when others then
  raise warning 'criar_perfil_novo_usuario: %', sqlerrm;  -- nunca bloqueia o cadastro
  return new;
end $$;

revoke all on function public.criar_perfil_novo_usuario(), public.perfis_proteger() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_perfil on auth.users;
create trigger on_auth_user_created_perfil after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

commit;


-- =============================================================================
-- PASSO 4 - VERIFICAÇÃO (rode depois; só lê)
-- =============================================================================
-- 4.0 Donos continuam com acesso total (esperado: papel 'dono', aprovado true, confirmado):
-- select p.email, p.papel, p.aprovado, u.email_confirmed_at from public.perfis p
--   left join auth.users u on lower(u.email) = p.email where p.papel = 'dono';
--
-- 4.1 RLS ligado em todas (rowsecurity = true):
-- select tablename, rowsecurity from pg_tables where schemaname = 'public'
--  and tablename in ('perfis','membros','transacoes','mensalidades','anuidades','pagamentos_eventos',
--                    'evento_itens','evento_pedidos','evento_participantes','reunioes','reuniao_presencas');
--
-- 4.2 Nenhuma política "allow all" / using (true):
-- select tablename, policyname, roles, cmd, qual, with_check from pg_policies
--  where schemaname = 'public' order by tablename, policyname;
--
-- 4.3 anon sem privilégio (tudo false):
-- select t, has_table_privilege('anon', 'public.' || t, 'select') as anon_le
--   from unnest(array['perfis','membros','transacoes','mensalidades','anuidades','pagamentos_eventos',
--        'evento_itens','evento_pedidos','evento_participantes','reunioes','reuniao_presencas']) t;
--
-- 4.4 Simular um usuário (troque o UUID por um id de auth.users):
-- begin;
--   select set_config('request.jwt.claims', '{"sub":"UUID-AQUI","role":"authenticated"}', true);
--   set local role authenticated;
--   select public.email_atual(), public.papel_atual(), public.is_admin();
--   select count(*) from public.transacoes;   -- admin: n; escrivão/pendente: 0
--   select count(*) from public.perfis;       -- admin: todos; outros: 1 (o próprio)
-- rollback;
--
-- 4.5 Teste externo (terminal, sem login) — deve voltar [] ou erro 401/permission denied:
-- curl "https://<PROJETO>.supabase.co/rest/v1/transacoes?select=*" -H "apikey: <ANON_KEY>"
