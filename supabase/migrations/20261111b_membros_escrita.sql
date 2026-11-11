-- =============================================================================
-- 20261111b_membros_escrita.sql — Escrita por coluna em membros
-- =============================================================================
-- Rode DEPOIS de 20261111_membros_dados_pessoais.sql.
--
-- O QUE FAZ (idempotente; não altera dados nem estrutura):
--   * contas logadas (authenticated, inclusive escrivão) só gravam as colunas
--     comuns: nome, matricula, status, data_entrada, cargo.
--   * as colunas sensíveis (nascimento, iniciação, elevação, situação, anuidade,
--     e-mail, telefone) só são gravadas pelo banco (postgres / importação).
--   * tira TRUNCATE, REFERENCES e TRIGGER de authenticated.
--   * DELETE continua como estava (política RLS admin_apaga).
--
-- Conferido no código (local e remoto): o site só grava em membros
--   insert: nome, matricula, status, data_entrada
--   update: nome, matricula, status
-- O trigger de inativação (data_inativacao, se existir) roda como dono da
-- tabela e não depende deste privilégio.
-- =============================================================================

begin;

revoke insert, update on public.membros from authenticated;
grant insert (nome, matricula, status, data_entrada, cargo) on public.membros to authenticated;
grant update (nome, matricula, status, data_entrada, cargo) on public.membros to authenticated;
revoke truncate, references, trigger on public.membros from authenticated;

-- Verificação (desfaz tudo se algo estiver errado)
do $$
begin
  if not has_column_privilege('authenticated', 'public.membros', 'nome', 'update')
     or not has_column_privilege('authenticated', 'public.membros', 'status', 'update')
     or not has_column_privilege('authenticated', 'public.membros', 'data_entrada', 'insert') then
    raise exception 'authenticated perdeu escrita em coluna comum. Migração desfeita.';
  end if;
  if has_column_privilege('authenticated', 'public.membros', 'data_nascimento', 'update')
     or has_column_privilege('authenticated', 'public.membros', 'situacao', 'insert') then
    raise exception 'authenticated ainda grava coluna sensível. Migração desfeita.';
  end if;
  if has_table_privilege('authenticated', 'public.membros', 'truncate') then
    raise exception 'authenticated ainda tem TRUNCATE. Migração desfeita.';
  end if;
  raise notice 'Escrita por coluna em membros conferida.';
end $$;

commit;
