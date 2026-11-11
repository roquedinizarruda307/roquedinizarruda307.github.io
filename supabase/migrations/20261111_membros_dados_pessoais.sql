-- =============================================================================
-- 20261111_membros_dados_pessoais.sql — Dados da Ordem dos membros + PRIVACIDADE
-- =============================================================================
-- Substitui a antiga supabase/2026-11-membros-situacao-nascimento.sql (não aplicada).
-- Rode DEPOIS de supabase/migrations/20261110_rls_seguranca.sql (usa public.is_admin()).
--
-- O QUE FAZ (idempotente: pode rodar mais de uma vez)
--   1. Só ADICIONA colunas (add column if not exists). Nada de DROP, RENAME,
--      mudança de tipo, DELETE ou UPDATE de dados existentes.
--        membros: data_nascimento, data_iniciacao, data_elevacao,
--                 situacao (regular / irregular / inativo), anuidade_vencimento
--        evento_participantes: transacao_id (vínculo do pagamento com o caixa)
--   2. PRIVACIDADE (dados de menores):
--        * authenticated (qualquer conta logada, inclusive escrivão) perde o
--          SELECT da tabela inteira e recebe SELECT só nas colunas NÃO sensíveis.
--        * Colunas sensíveis (data_nascimento, data_iniciacao, data_elevacao,
--          situacao, anuidade_vencimento, email, telefone) só saem pela função
--          public.membros_dados_pessoais(), SECURITY DEFINER, que devolve linhas
--          apenas para dono e admin (public.is_admin()). Para os demais, 0 linhas.
--        * Nada é apagado nem escondido de dono/admin: eles leem as colunas comuns
--          na tabela e as sensíveis pela função. O banco (postgres/service_role)
--          continua com acesso total.
--        * Como o filtro WHERE/RETURNING também exige SELECT na coluna, o escrivão
--          não consegue "adivinhar" datas com update ... where data_nascimento ...
--   3. Confere que nenhuma tabela mudou de tamanho; se mudou, raise exception
--      (a transação inteira é desfeita).
--
-- ATENÇÃO para o futuro: coluna NOVA em membros não fica legível para
-- authenticated automaticamente. Se não for sensível, rode de novo o bloco de
-- GRANT (passo 2b) ou faça: grant select (nova_coluna) on public.membros to authenticated;
--
-- COMO APLICAR: psql com -v ON_ERROR_STOP=1 -f este_arquivo (ou SQL Editor).
-- =============================================================================

begin;

-- ---------- 0) contagem de linhas de todas as tabelas (antes) ---------------
create temp table _contagem_antes (tabela text primary key, n bigint) on commit drop;
do $$
declare t record; v_n bigint;
begin
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('select count(*) from public.%I', t.relname) into v_n;
    insert into _contagem_antes (tabela, n) values (t.relname, v_n);
  end loop;
end $$;

-- ---------- 1) colunas novas (só adiciona) ----------------------------------
alter table public.membros add column if not exists data_nascimento     date;
alter table public.membros add column if not exists data_iniciacao      date;
alter table public.membros add column if not exists data_elevacao       date;
alter table public.membros add column if not exists situacao            text;
alter table public.membros add column if not exists anuidade_vencimento date;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'membros_situacao_check' and conrelid = 'public.membros'::regclass) then
    alter table public.membros add constraint membros_situacao_check
      check (situacao is null or situacao in ('regular', 'irregular', 'inativo'));
  end if;
end $$;

-- Vínculo do pagamento de participante de evento com a entrada no caixa
-- (o app já funciona sem esta coluna; com ela, o estorno fica exato)
alter table public.evento_participantes add column if not exists transacao_id uuid
  references public.transacoes(id) on delete set null;

-- ---------- 2a) função que entrega as colunas sensíveis (só dono/admin) -----
create or replace function public.membros_dados_pessoais()
returns table (
  id uuid,
  data_nascimento date,
  data_iniciacao date,
  data_elevacao date,
  situacao text,
  anuidade_vencimento date,
  email text,
  telefone text
)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.data_nascimento, m.data_iniciacao, m.data_elevacao, m.situacao,
         m.anuidade_vencimento, m.email, m.telefone
    from public.membros m
   where public.is_admin()
$$;

revoke all on function public.membros_dados_pessoais() from public, anon;
grant execute on function public.membros_dados_pessoais() to authenticated;

-- ---------- 2b) privilégios por coluna em membros ---------------------------
-- Tira o SELECT da tabela inteira (anon já não lê nada por RLS; aqui também perde o privilégio)
revoke select on public.membros from anon, authenticated;
-- Garante que nenhuma coluna sensível ficou com SELECT por coluna de antes
revoke select (data_nascimento, data_iniciacao, data_elevacao, situacao, anuidade_vencimento, email, telefone)
  on public.membros from anon, authenticated;

-- SELECT em todas as demais colunas que existem hoje (id, nome, matricula, status,
-- data_entrada, cargo, created_at, data_inativacao se existir, ...)
do $$
declare cols text;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
    from pg_attribute a
   where a.attrelid = 'public.membros'::regclass and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('data_nascimento', 'data_iniciacao', 'data_elevacao', 'situacao',
                           'anuidade_vencimento', 'email', 'telefone');
  execute format('grant select (%s) on public.membros to authenticated', cols);
end $$;
-- INSERT / UPDATE / DELETE continuam como estavam (controlados pelas políticas RLS).

-- ---------- 3) verificação: nenhuma tabela mudou de tamanho -----------------
do $$
declare t record; v_n bigint;
begin
  for t in select c.tabela, c.n from _contagem_antes c loop
    execute format('select count(*) from public.%I', t.tabela) into v_n;
    if v_n <> t.n then
      raise exception 'Contagem mudou em %: antes %, depois %. Migração desfeita.', t.tabela, t.n, v_n;
    end if;
  end loop;
  if not has_function_privilege('authenticated', 'public.membros_dados_pessoais()', 'execute') then
    raise exception 'Função membros_dados_pessoais sem permissão para authenticated. Migração desfeita.';
  end if;
  if has_function_privilege('anon', 'public.membros_dados_pessoais()', 'execute') then
    raise exception 'Função membros_dados_pessoais executável por anon. Migração desfeita.';
  end if;
  if has_column_privilege('authenticated', 'public.membros', 'data_nascimento', 'select') then
    raise exception 'data_nascimento ainda legível por authenticated. Migração desfeita.';
  end if;
  if not has_column_privilege('authenticated', 'public.membros', 'nome', 'select') then
    raise exception 'nome ficou ilegível para authenticated. Migração desfeita.';
  end if;
  raise notice 'Migração conferida: contagens iguais e privilégios corretos.';
end $$;

commit;
