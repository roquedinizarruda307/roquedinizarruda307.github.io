#!/usr/bin/env node
// Gera o SQL de importação dos DADOS DA ORDEM dos membros a partir da planilha do sistema da Ordem
// (demolays_completo.xlsx): nascimento, iniciação, elevação, situação e vencimento da anuidade.
// NÃO grava nada no banco: só escreve um arquivo .sql para ser revisado e rodado com psql.
//
// Regra "não perder dados":
//   * só UPDATE das 5 colunas novas, e só quando estiverem vazias (coalesce(coluna, valor_novo));
//   * nunca altera nome, status, matrícula ou data_entrada; nunca faz INSERT nem DELETE;
//   * tudo numa transação que confere a contagem de linhas de todas as tabelas antes e depois
//     e dá raise exception (desfaz tudo) se alguma mudar.
//
// ATENÇÃO: rode o SQL gerado só DEPOIS da migração supabase/migrations/20261111_membros_dados_pessoais.sql.
// O arquivo gerado contém dados pessoais de menores: é salvo FORA do repositório
// (pasta DeMolay/Claude/Membros), com chmod 600.
//
// Uso:
//   node scripts/gerar-sql-importacao-membros.mjs <planilha.xlsx> [saida.sql]
//   node scripts/gerar-sql-importacao-membros.mjs <planilha.xlsx> --dry-run   (só confere, não escreve)
//
// Casamento planilha <-> site: pela matrícula (coluna ID = membros.matricula).
// Membros do site sem matrícula são casados pelo mapa DeMolay/Claude/Membros/mapa-nomes.json
// (fora do repo; formato { "<matrícula>": "<nome no site>" }).

import { createRequire } from 'node:module'
import { writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Pasta DeMolay/Claude/Membros (fora do repo): sobe a partir do repositório até achá-la
// (funciona também a partir de uma cópia do repositório em subpasta).
function pastaMembros() {
  for (let d = raiz; ; d = path.dirname(d)) {
    const alvo = path.join(d, '..', 'Claude', 'Membros')
    if (existsSync(alvo)) return path.resolve(alvo)
    if (path.dirname(d) === d) return path.resolve(raiz, '../Claude/Membros')
  }
}
const DIR_MEMBROS = pastaMembros()

// ── Mapa matrícula -> nome no site (dados pessoais: fica num JSON fora do repositório)
const ARQ_MAPA = path.join(DIR_MEMBROS, 'mapa-nomes.json')
const NOME_SEM_MATRICULA = {}
if (existsSync(ARQ_MAPA)) {
  try {
    const dados = JSON.parse(readFileSync(ARQ_MAPA, 'utf8'))
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('esperado um objeto { matrícula: nome }')
    for (const [mat, nome] of Object.entries(dados)) {
      if (/^\d+$/.test(mat) && typeof nome === 'string' && nome.trim() && nome.length <= 200) NOME_SEM_MATRICULA[mat] = nome.trim()
      else console.warn(`Aviso: entrada ignorada no mapa de nomes (matrícula "${mat}").`)
    }
  } catch (e) {
    console.error(`Erro ao ler ${ARQ_MAPA}: ${e.message}. Abortado.`); process.exit(1)
  }
} else {
  console.warn(`Aviso: ${ARQ_MAPA} não encontrado. Membros sem matrícula no site serão casados só pela matrícula.`)
}

// ── Colunas usadas: todas ANTES de "DDD PREFERENCIAL" (a partir dela os cabeçalhos estão deslocados).
// O script confere o nome do cabeçalho em cada índice antes de usar.
//   INICIAÇÃO = data de iniciação; DEMOLAY = data de elevação ao grau DeMolay; ANUIDADE = vencimento da anuidade.
const COL = {
  id:         [0,  'ID'],
  nome:       [1,  'NOME'],
  nascimento: [7,  'NASCIMENTO'],
  anuidade:   [8,  'ANUIDADE'],
  situacao:   [11, 'SITUAÇÃO'],
  iniciacao:  [17, 'INICIAÇÃO'],
  elevacao:   [18, 'DEMOLAY'],
}
const SITUACOES = { regular: 'regular', irregular: 'irregular', inativo: 'inativo' }

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const [arqPlanilha, arqSaida = path.join(DIR_MEMBROS, 'importacao_membros.sql')] = args.filter(a => a !== '--dry-run')
if (!arqPlanilha) { console.error('Informe o caminho da planilha .xlsx'); process.exit(1) }
if (!existsSync(arqPlanilha)) { console.error(`Planilha não encontrada: ${arqPlanilha}`); process.exit(1) }

const wb = XLSX.readFile(arqPlanilha, { raw: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
const cab = (linhas[0] ?? []).map(c => String(c).trim().toUpperCase())

const idxDDD = cab.indexOf('DDD PREFERENCIAL')
for (const [chave, [idx, nome]] of Object.entries(COL)) {
  if (cab[idx] !== nome) { console.error(`Cabeçalho inesperado na coluna ${idx} (${chave}): "${cab[idx]}" (esperado "${nome}"). Abortado.`); process.exit(1) }
  if (idxDDD >= 0 && idx >= idxDDD) { console.error(`Coluna ${nome} está depois de "DDD PREFERENCIAL" (cabeçalhos deslocados). Abortado.`); process.exit(1) }
}

const sqlStr = s => `'${String(s).replace(/'/g, "''")}'`
const anoAtual = new Date().getFullYear()

/** dd/mm/aaaa -> aaaa-mm-dd, só se for data real e dentro da faixa [min, max] de anos. */
function dataISO(br, min, max) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br).trim())
  if (!m) return null
  const [, d, mo, a] = m.map(Number)
  const dt = new Date(a, mo - 1, d)
  if (dt.getFullYear() !== a || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  if (a < min || a > max) return null
  return `${a}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const updates = []
const problemas = []
const vistos = new Set()
for (const [i, r] of linhas.slice(1).entries()) {
  const id = String(r[COL.id[0]]).trim()
  if (!id) continue
  if (!/^\d{1,10}$/.test(id)) { problemas.push(`linha ${i + 2}: ID inválido`); continue }
  if (vistos.has(id)) { problemas.push(`ID ${id}: repetido na planilha (ignorado)`); continue }
  vistos.add(id)

  const campos = {
    data_nascimento:     dataISO(r[COL.nascimento[0]], 1980, anoAtual - 10),   // faixa plausível para DeMolay
    data_iniciacao:      dataISO(r[COL.iniciacao[0]], 1980, anoAtual),
    data_elevacao:       dataISO(r[COL.elevacao[0]], 1980, anoAtual),
    situacao:            SITUACOES[String(r[COL.situacao[0]]).trim().toLowerCase()] ?? null,
    anuidade_vencimento: dataISO(r[COL.anuidade[0]], 1980, anoAtual + 5),
  }
  for (const [c, v] of Object.entries(campos)) {
    // elevação vazia é normal (ainda não foi elevado ao grau DeMolay)
    if (v === null && !(c === 'data_elevacao' && !String(r[COL.elevacao[0]]).trim())) problemas.push(`ID ${id}: ${c} inválido/vazio`)
  }
  if (campos.data_iniciacao && campos.data_elevacao && campos.data_elevacao < campos.data_iniciacao) {
    problemas.push(`ID ${id}: elevação antes da iniciação (elevação ignorada)`); campos.data_elevacao = null
  }
  // Só preenche coluna vazia: coalesce(coluna_atual, valor_novo). Campo sem valor na planilha não entra.
  const preenchidos = Object.entries(campos).filter(([, v]) => v !== null)
  if (preenchidos.length === 0) continue
  const tipo = c => (c === 'situacao' ? '' : '::date')
  const set = preenchidos.map(([c, v]) => `${c} = coalesce(${c}, ${sqlStr(v)}${tipo(c)})`).join(', ')
  const nomeSite = NOME_SEM_MATRICULA[id]
  const onde = nomeSite
    ? `(matricula = ${sqlStr(id)} or (coalesce(trim(matricula), '') = '' and upper(trim(nome)) = upper(${sqlStr(nomeSite)})))`
    : `matricula = ${sqlStr(id)}`
  // matrícula não é UNIQUE no banco: cada UPDATE confere quantas linhas pegou.
  // > 1 linha = ambiguidade -> raise exception (desfaz tudo); 0 linha = só aviso no fim.
  updates.push([
    `  update public.membros set ${set} where ${onde};`,
    `  get diagnostics n = row_count;`,
    `  if n > 1 then raise exception 'Matrícula % casou % membros (esperado no máximo 1). Importação desfeita.', ${sqlStr(id)}, n; end if;`,
    `  if n = 0 then sem_par := sem_par || ${sqlStr(id)}::text; end if;`,
  ].join('\n'))
}

console.log(`Linhas na planilha: ${linhas.length - 1} | updates gerados: ${updates.length} | via mapa de nomes: ${Object.keys(NOME_SEM_MATRICULA).filter(k => vistos.has(k)).length} | avisos: ${problemas.length}`)
for (const p of problemas) console.log('  aviso:', p)
if (dryRun) { console.log('--dry-run: nenhum arquivo escrito.'); process.exit(0) }

const sql = `-- GERADO por scripts/gerar-sql-importacao-membros.mjs em ${new Date().toLocaleString('pt-BR')}
-- CONTÉM DADOS PESSOAIS (nascimento de menores). Não versionar. Não compartilhar.
-- Rodar SOMENTE depois da migração supabase/migrations/20261111_membros_dados_pessoais.sql.
-- Só preenche colunas novas que estão vazias (coalesce). Não altera nome, status, matrícula
-- nem data_entrada; não insere nem apaga linhas. Se a contagem de linhas de qualquer tabela
-- mudar, a transação é desfeita (raise exception).
\\set ON_ERROR_STOP 1
begin;

-- Contagem de linhas de todas as tabelas do schema public ANTES
create temp table _contagem_antes (tabela text primary key, n bigint) on commit drop;
do $$
declare t record; n bigint;
begin
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('select count(*) from public.%I', t.relname) into n;
    insert into _contagem_antes values (t.relname, n);
  end loop;
end $$;

-- Atualizações (uma por membro da planilha)
do $$
declare n bigint; sem_par text[] := '{}';
begin
${updates.join('\n')}
  if cardinality(sem_par) > 0 then
    raise notice 'Aviso: % matrícula(s) da planilha sem membro no site (0 linhas): %', cardinality(sem_par), array_to_string(sem_par, ', ');
  end if;
end $$;

-- Verificação: contagens iguais antes e depois (senão desfaz tudo)
do $$
declare t record; n bigint;
begin
  for t in select tabela, n from _contagem_antes loop
    execute format('select count(*) from public.%I', t.tabela) into n;
    if n <> t.n then
      raise exception 'Contagem mudou em %: antes %, depois %. Importação desfeita.', t.tabela, t.n, n;
    end if;
  end loop;
  raise notice 'Contagens conferidas: nenhuma tabela mudou de tamanho.';
end $$;

commit;

-- Conferência (sem dados pessoais): quantos membros do site têm cada campo
select count(*) as membros_no_site,
       count(data_nascimento) as com_nascimento,
       count(data_iniciacao) as com_iniciacao,
       count(data_elevacao) as com_elevacao,
       count(situacao) as com_situacao,
       count(anuidade_vencimento) as com_anuidade
from public.membros;
`
writeFileSync(arqSaida, sql, { mode: 0o600 })
chmodSync(arqSaida, 0o600)   // garante 600 mesmo se o arquivo já existia
console.log('SQL escrito em', arqSaida)
