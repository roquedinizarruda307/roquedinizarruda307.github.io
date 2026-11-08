-- NÃO EXECUTADO. Rodar no Supabase > SQL Editor só com OK do Humberto.
-- Registra quando um membro deixou de ser 'ativo' (virou 'senior' ou 'afastado').

alter table public.membros add column if not exists data_inativacao date;

create or replace function public.membros_marca_inativacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'ativo' and new.status is distinct from 'ativo' then
    new.data_inativacao := coalesce(new.data_inativacao, current_date);
  elsif new.status = 'ativo' and old.status is distinct from 'ativo' then
    new.data_inativacao := null;   -- voltou a ser ativo
  end if;
  return new;
end;
$$;

revoke all on function public.membros_marca_inativacao() from public, anon, authenticated;

drop trigger if exists trg_membros_inativacao on public.membros;
create trigger trg_membros_inativacao
  before update of status on public.membros
  for each row execute function public.membros_marca_inativacao();

-- Membros que já estão senior/afastado ficam com data_inativacao vazia
-- (a data real de saída não é conhecida). Preencher à mão se souberem.
