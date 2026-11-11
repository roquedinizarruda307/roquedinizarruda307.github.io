-- =============================================================================
-- 20261111c_membros_dados_ordem_escrita.sql — Dona/admin atualizam situação e anuidade
-- =============================================================================
-- Rode DEPOIS de 20261111_membros_dados_pessoais.sql e 20261111b_membros_escrita.sql.
--
-- O QUE FAZ (idempotente; não altera dados nem estrutura da tabela):
--   * cria public.membros_atualizar_dados_ordem(p_id, p_situacao, p_anuidade_vencimento),
--     SECURITY DEFINER, que grava SÓ situacao e anuidade_vencimento de UM membro.
--   * só dono/admin (public.is_admin()) conseguem usar; os demais recebem erro.
--   * authenticated continua SEM privilégio direto nessas colunas (nada muda na
--     tabela); a única porta de escrita é esta função.
--   * anon e public não executam a função.
--
-- COMO APLICAR: psql com -v ON_ERROR_STOP=1 -f este_arquivo (ou SQL Editor).
-- =============================================================================

begin;

-- ---------- 0) contagem de membros (antes) ----------------------------------
create temp table _contagem_membros_antes (v_total bigint) on commit drop;
insert into _contagem_membros_antes (v_total) select count(*) from public.membros;

-- ---------- 1) função de escrita ---------------------------------------------
create or replace function public.membros_atualizar_dados_ordem(
  p_id uuid,
  p_situacao text,
  p_anuidade_vencimento date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_situacao text;
  v_linhas integer;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para alterar os dados da Ordem.' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'Membro não informado.' using errcode = '22023';
  end if;

  v_situacao := nullif(lower(btrim(p_situacao)), '');
  if v_situacao is not null and v_situacao not in ('regular', 'irregular', 'inativo') then
    raise exception 'Situação inválida: %. Use regular, irregular ou inativo.', p_situacao using errcode = '22023';
  end if;

  update public.membros m
     set situacao = v_situacao,
         anuidade_vencimento = p_anuidade_vencimento
   where m.id = p_id;

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Membro não encontrado.' using errcode = 'P0002';
  end if;
  if v_linhas > 1 then
    -- id é chave primária; nunca deve acontecer. Desfaz por segurança.
    raise exception 'Mais de um membro com o mesmo id (%). Nada foi alterado.', v_linhas;
  end if;
end;
$$;

revoke all on function public.membros_atualizar_dados_ordem(uuid, text, date) from public, anon;
grant execute on function public.membros_atualizar_dados_ordem(uuid, text, date) to authenticated;

-- ---------- 2) verificação (desfaz tudo se algo estiver errado) --------------
do $$
declare
  v_antes bigint;
  v_depois bigint;
begin
  select a.v_total into v_antes from _contagem_membros_antes a;
  select count(*) into v_depois from public.membros;
  if v_antes is distinct from v_depois then
    raise exception 'Contagem de membros mudou: antes %, depois %. Migração desfeita.', v_antes, v_depois;
  end if;
  if has_function_privilege('anon', 'public.membros_atualizar_dados_ordem(uuid, text, date)', 'execute') then
    raise exception 'Função membros_atualizar_dados_ordem executável por anon. Migração desfeita.';
  end if;
  if not has_function_privilege('authenticated', 'public.membros_atualizar_dados_ordem(uuid, text, date)', 'execute') then
    raise exception 'Função membros_atualizar_dados_ordem sem permissão para authenticated. Migração desfeita.';
  end if;
  if has_column_privilege('authenticated', 'public.membros', 'situacao', 'update')
     or has_column_privilege('authenticated', 'public.membros', 'anuidade_vencimento', 'update') then
    raise exception 'authenticated grava situacao/anuidade direto na tabela. Migração desfeita.';
  end if;
  raise notice 'Migração conferida: % membros (sem mudança) e permissões corretas.', v_depois;
end $$;

commit;
