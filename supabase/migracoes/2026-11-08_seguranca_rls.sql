-- ============================================================================
-- ATENÇÃO (integração de 10/11/2026): NÃO REAPLICAR SEM REVISÃO.
-- A migração supabase/migrations/20261110_rls_seguranca.sql JÁ FOI APLICADA no
-- banco e pode sobrepor/conflitar com este arquivo (políticas RLS, perfis,
-- triggers). Antes de rodar, o dev-seguranca deve comparar os dois e o CEO
-- (Humberto) precisa aprovar.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
--  SEGURANÇA (RLS) — Capítulo Roque Diniz Arruda 307 — 2026-11-08
--  NÃO EXECUTADO. Rodar no Supabase > SQL Editor só com OK do Humberto.
--  Pode ser rodado mais de uma vez (idempotente). Tudo numa transação:
--  se algo falhar, nada é aplicado.
--
--  Antes: qualquer pessoa com a chave anon (que está no site) lia e gravava
--  todas as tabelas, inclusive perfis (dava para se colocar como "dono").
--  Depois:
--    * anon (sem login) não acessa nenhuma tabela;
--    * só usuário logado COM perfil aprovado lê os dados;
--    * dono/admin gravam tudo; escrivão grava membros, reuniões e presenças
--      (e cria a mensalidade do membro novo, como a tela Membros já faz);
--    * perfis: cada um lê a própria linha; dono/admin leem todas;
--      só DONO cria/aprova/muda nível/remove (igual à tela Ajustes, que só o dono vê);
--    * conta nova (cadastro no site) ganha perfil pendente pelo próprio banco.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ─── 1) Função de checagem de acesso ────────────────────────────────────────
-- true se o usuário logado tem perfil aprovado (e, se informado, um dos papéis).
-- SECURITY DEFINER: lê perfis sem passar pelo RLS (evita recursão nas policies).
create or replace function public.eh_aprovado(papeis text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis p
    where p.email = lower(auth.jwt() ->> 'email')
      and p.aprovado = true
      and (papeis is null or p.papel = any(papeis))
  );
$$;

revoke all on function public.eh_aprovado(text[]) from public, anon;
grant execute on function public.eh_aprovado(text[]) to authenticated;

-- ─── 2) Policies ─────────────────────────────────────────────────────────────
-- 2a) apaga TODAS as policies atuais dessas tabelas (inclusive "allow all")
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('anuidades','evento_itens','evento_participantes','evento_pedidos',
                        'membros','mensalidades','pagamentos_eventos','perfis',
                        'reuniao_presencas','reunioes','transacoes')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2b) liga o RLS e cria as policies novas das tabelas de dados
do $$
declare
  t text;
  escritores text[];
  apagadores text[];
begin
  foreach t in array array['anuidades','evento_itens','evento_participantes','evento_pedidos',
                           'membros','mensalidades','pagamentos_eventos',
                           'reuniao_presencas','reunioes','transacoes']
  loop
    -- quem grava: dono/admin; + escrivão nas abas dele (Escrivão e Membros)
    if t in ('membros','reunioes','reuniao_presencas') then
      escritores := array['dono','admin','escrivao'];
    else
      escritores := array['dono','admin'];
    end if;
    -- apagar: escrivão só apaga reuniões/presenças. Membro NÃO (o cascade
    -- apagaria mensalidades e anuidades dele) — só dono/admin.
    if t in ('reunioes','reuniao_presencas') then
      apagadores := array['dono','admin','escrivao'];
    else
      apagadores := array['dono','admin'];
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format('create policy "ler_aprovados" on public.%I for select to authenticated using (public.eh_aprovado())', t);
    execute format('create policy "inserir" on public.%I for insert to authenticated with check (public.eh_aprovado(%L))', t, escritores);
    execute format('create policy "alterar" on public.%I for update to authenticated using (public.eh_aprovado(%L)) with check (public.eh_aprovado(%L))', t, escritores, escritores);
    execute format('create policy "apagar" on public.%I for delete to authenticated using (public.eh_aprovado(%L))', t, apagadores);
  end loop;
end $$;

-- 2c) escrivão cadastra membro novo na tela Membros, que já cria a mensalidade
--     do mês de entrada (R$ 20, não paga). Só INSERT, só nesse formato e só
--     para membro cadastrado nas últimas 24 h.
create policy "escrivao_cria_mensalidade_membro_novo" on public.mensalidades
  for insert to authenticated
  with check (
    public.eh_aprovado(array['escrivao'])
    and status = 'nao_pago'
    and data_pagamento is null
    and valor = 20
    and exists (select 1 from public.membros m
                where m.id = membro_id and m.created_at > now() - interval '1 day')
  );

-- 2d) perfis
alter table public.perfis enable row level security;

create policy "ler_proprio_perfil" on public.perfis
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

create policy "dono_admin_leem_todos" on public.perfis
  for select to authenticated
  using (public.eh_aprovado(array['dono','admin']));

-- Escrita só do DONO (a tela Ajustes só aparece para o dono). Se quiserem que admin
-- também aprove, troque array['dono'] por array['dono','admin'] nas 3 abaixo —
-- mas aí um admin poderia se promover a dono.
create policy "dono_cria_perfil" on public.perfis
  for insert to authenticated
  with check (public.eh_aprovado(array['dono']));

create policy "dono_altera_perfil" on public.perfis
  for update to authenticated
  using (public.eh_aprovado(array['dono']))
  with check (public.eh_aprovado(array['dono']));

create policy "dono_remove_perfil" on public.perfis
  for delete to authenticated
  using (public.eh_aprovado(array['dono']));

-- ─── 3) Sem login, nada ──────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- tabelas criadas no futuro também não ficam abertas para anon
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
-- funções criadas no futuro não ficam executáveis por public/anon (M2)
alter default privileges in schema public revoke execute on functions from public, anon;

-- ─── 4) Perfil pendente automático para conta nova ──────────────────────────
-- Substitui o insert que o site fazia no cadastro. Papel mínimo (escrivao) e
-- aprovado = false. ON CONFLICT DO NOTHING: não mexe em linhas já cadastradas
-- (ex.: contas pré-aprovadas pelo dono, como a do Eduardo).
create or replace function public.cria_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    insert into public.perfis (email, papel, aprovado)
    values (lower(new.email), 'escrivao', false)
    on conflict (email) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.cria_perfil_novo_usuario() from public, anon, authenticated;

drop trigger if exists trg_cria_perfil_novo_usuario on auth.users;
create trigger trg_cria_perfil_novo_usuario
  after insert on auth.users
  for each row execute function public.cria_perfil_novo_usuario();

-- ─── 5) Rotina de mensalidades: ninguém de fora chama (A2) ───────────────────
-- (qualquer assinatura que a função tenha hoje; o pg_cron roda como postgres)
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gerar_mensalidades_pendentes'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════════
--  VERIFICAÇÃO (só leitura) — rodar depois do commit
-- ════════════════════════════════════════════════════════════════════════════

-- a) policies por tabela (não pode sobrar "allow all" nem role "public")
select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public'
order by tablename, policyname;

-- b) RLS ligado em todas (rowsecurity = true)
select tablename, rowsecurity
from pg_tables where schemaname = 'public'
order by tablename;

-- c) anon sem acesso (tudo false)
select t.tablename,
       has_table_privilege('anon', format('public.%I', t.tablename), 'select') as anon_le,
       has_table_privilege('anon', format('public.%I', t.tablename), 'insert') as anon_grava
from pg_tables t where t.schemaname = 'public'
order by 1;

-- d) as 6 contas atuais continuam aprovadas
select email, papel, aprovado from public.perfis order by papel, email;

-- e) trigger em auth.users instalado
select tgname, tgenabled from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- f) rotina sem execute para anon/authenticated (tudo false)
select p.oid::regprocedure,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'gerar_mensalidades_pendentes';

-- g) funções de public que anon consegue executar (ideal: nenhuma)
select p.oid::regprocedure as funcao
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
order by 1;

-- h) tabelas/views de public com RLS DESLIGADO (views não têm RLS: confira se anon
--    tem acesso a elas na consulta c)
select c.relname, case c.relkind when 'r' then 'tabela' when 'p' then 'tabela particionada'
                                 when 'v' then 'view' when 'm' then 'view materializada' end as tipo,
       c.relrowsecurity as rls_ligado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v','m') and not c.relrowsecurity
order by 1;

-- i) policies "abertas" (qual ou with check = true) — ideal: nenhuma
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true')
order by 1, 2;
