-- NÃO EXECUTADO. Rodar no Supabase > SQL Editor só com OK do Humberto,
-- depois de conferir o resultado de 2026-11-08_rotina_mensalidades_consultas.sql.
-- ATENÇÃO: confira se a função atual tem parâmetros. Se tiver, ajuste a assinatura
-- abaixo (ou faça DROP FUNCTION da versão antiga) para o cron chamar esta.
--
-- Gera a mensalidade do mês corrente (R$ 20, 'nao_pago'):
--   * só para membros com status 'ativo'
--   * só para quem já tinha entrado até este mês
--   * pula janeiro e julho
--   * não duplica (unique membro_id, mes, ano + ON CONFLICT DO NOTHING)

create or replace function public.gerar_mensalidades_pendentes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes int := extract(month from (now() at time zone 'America/Sao_Paulo'))::int;
  v_ano int := extract(year  from (now() at time zone 'America/Sao_Paulo'))::int;
  v_inseridas int := 0;
begin
  if v_mes not in (2, 3, 4, 5, 6, 8, 9, 10, 11, 12) then
    return 0;   -- janeiro e julho não têm mensalidade
  end if;

  insert into public.mensalidades (membro_id, mes, ano, valor, status)
  select m.id, v_mes, v_ano, 20, 'nao_pago'
  from public.membros m
  where m.status = 'ativo'
    and (m.data_entrada is null
         or (extract(year from m.data_entrada)::int * 100 + extract(month from m.data_entrada)::int)
            <= v_ano * 100 + v_mes)
  on conflict (membro_id, mes, ano) do nothing;

  get diagnostics v_inseridas = row_count;
  return v_inseridas;
end;
$$;

-- Só o banco (pg_cron, como postgres) executa; ninguém pela API.
revoke execute on function public.gerar_mensalidades_pendentes() from public, anon, authenticated;

-- Agendamento (só se ainda não existir um job chamando a função; veja cron.job):
-- select cron.schedule('gerar-mensalidades-dia-1', '5 3 1 * *', 'select public.gerar_mensalidades_pendentes()');
-- (03:05 UTC = 00:05 em Brasília, todo dia 1)
