-- ============================================================================
-- ATENÇÃO (integração de 10/11/2026): NÃO REAPLICAR SEM REVISÃO.
-- A migração supabase/migrations/20261110_rls_seguranca.sql JÁ FOI APLICADA no
-- banco e pode sobrepor/conflitar com este arquivo (políticas RLS, perfis,
-- triggers). Antes de rodar, o dev-seguranca deve comparar os dois e o CEO
-- (Humberto) precisa aprovar.
-- ============================================================================

-- NÃO EXECUTADO. Rodar no Supabase > SQL Editor só com OK do Humberto.
-- Garante no banco que cada mensalidade tenha no máximo UMA entrada própria no caixa
-- (o site já evita, mas isto impede duplicação por clique duplo/duas abas abertas).
-- Conferido em 08/11: hoje não há mensalidade_id repetido em transacoes.
-- Lançamentos agrupados (mensalidade_id nulo, ex.: R$ 240 de Carlos Heitor e Jorge Miguel) não são afetados.

-- 1) conferir antes (deve voltar vazio):
select mensalidade_id, count(*) from public.transacoes
where mensalidade_id is not null group by 1 having count(*) > 1;

-- 2) índice único parcial:
create unique index if not exists transacoes_mensalidade_id_unico
  on public.transacoes (mensalidade_id) where mensalidade_id is not null;

-- ─── Pedidos de evento: no máximo um pedido por lançamento do caixa ─────────
-- Conferido em 08/11: 208 pedidos com transacao_id, nenhum repetido.
-- 3) conferir antes (deve voltar vazio):
select transacao_id, count(*) from public.evento_pedidos
where transacao_id is not null group by 1 having count(*) > 1;

-- 4) índice único parcial:
create unique index if not exists evento_pedidos_transacao_id_unico
  on public.evento_pedidos (transacao_id) where transacao_id is not null;
