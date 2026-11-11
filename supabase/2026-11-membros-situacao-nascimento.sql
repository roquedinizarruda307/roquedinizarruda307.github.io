-- ============================================================================
-- MIGRAÇÃO PENDENTE — RODE SÓ DEPOIS DE supabase/migrations/20261110_rls_seguranca.sql.
-- Essa migração troca o antigo "allow all" de membros por políticas que exigem
-- login (leitura só para aprovados; escrita só para admin). data_nascimento é
-- dado pessoal de menores: confirme no Supabase que essas políticas estão ativas.
--
-- Rodar no SQL Editor do Supabase. É idempotente (pode rodar mais de uma vez).
-- ============================================================================

-- 1) Situação na Ordem (Regular / Irregular / Inativo) e data de nascimento
alter table membros add column if not exists situacao text;
alter table membros add column if not exists data_nascimento date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'membros_situacao_check') then
    alter table membros add constraint membros_situacao_check
      check (situacao is null or situacao in ('regular', 'irregular', 'inativo'));
  end if;
end $$;

-- 2) Vínculo do pagamento de participante de evento com a entrada no caixa
--    (o app já funciona sem esta coluna; com ela, o estorno fica exato)
alter table evento_participantes add column if not exists transacao_id uuid
  references transacoes(id) on delete set null;

-- 3) Conferência: o status 'senior' precisa ser aceito em membros.status
--    (o botão "Transferir para Sênior DeMolay" grava status = 'senior').
--    Veja a regra atual:
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'membros'::regclass and contype = 'c';
-- Se a regra de status não aceitar 'senior', ajuste (confira antes!):
-- alter table membros drop constraint membros_status_check;
-- alter table membros add constraint membros_status_check
--   check (status in ('ativo', 'senior', 'afastado'));
