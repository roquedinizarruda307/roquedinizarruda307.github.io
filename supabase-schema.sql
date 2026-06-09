-- Tabela de membros
create table membros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  telefone text,
  cargo text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  data_entrada date,
  created_at timestamptz default now()
);

-- Tabela de transações financeiras
create table transacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text not null,
  valor numeric(10,2) not null,
  data date not null,
  categoria text,
  membro_id uuid references membros(id),
  created_at timestamptz default now()
);

-- Tabela de mensalidades
create table mensalidades (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references membros(id) on delete cascade,
  mes integer not null check (mes between 1 and 12),
  ano integer not null,
  valor numeric(10,2) not null,
  status text not null default 'nao_pago' check (status in ('pago', 'isento', 'nao_pago')),
  data_pagamento timestamptz,
  created_at timestamptz default now(),
  unique (membro_id, mes, ano)
);

-- Pagamentos de eventos
create table pagamentos_eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data date not null,
  valor numeric(10,2) not null,
  descricao text,
  status text not null default 'pendente' check (status in ('pago', 'pendente', 'atrasado')),
  created_at timestamptz default now()
);

-- Anuidades
create table anuidades (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references membros(id) on delete cascade,
  ano integer not null,
  valor numeric(10,2) not null,
  status text not null default 'pendente' check (status in ('pago', 'pendente', 'atrasado')),
  data_pagamento timestamptz,
  created_at timestamptz default now(),
  unique (membro_id, ano)
);

-- RLS
alter table membros enable row level security;
alter table transacoes enable row level security;
alter table mensalidades enable row level security;
alter table pagamentos_eventos enable row level security;
alter table anuidades enable row level security;

create policy "allow all" on membros for all using (true) with check (true);
create policy "allow all" on transacoes for all using (true) with check (true);
create policy "allow all" on mensalidades for all using (true) with check (true);
create policy "allow all" on pagamentos_eventos for all using (true) with check (true);
create policy "allow all" on anuidades for all using (true) with check (true);
