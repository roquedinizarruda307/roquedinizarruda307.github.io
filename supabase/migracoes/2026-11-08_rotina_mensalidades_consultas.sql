-- SÓ LEITURA. Rodar antes de trocar a rotina, para ver o que existe hoje.

-- 1) Código atual da função
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'gerar_mensalidades_pendentes';

-- 2) Agendamentos do pg_cron
select jobid, jobname, schedule, command, active from cron.job order by jobid;

-- 3) Últimas execuções
select jobid, status, start_time, return_message
from cron.job_run_details order by start_time desc limit 20;
