#!/usr/bin/env node
// Gera o SQL de importação de SITUAÇÃO e DATA DE NASCIMENTO dos membros a partir da planilha
// do sistema da Ordem (demolays_completo.xlsx). NÃO grava nada no banco: só escreve um arquivo .sql
// para ser revisado e rodado no SQL Editor do Supabase.
//
// ATENÇÃO: só rode o SQL gerado DEPOIS de corrigir as regras de acesso (RLS) — são dados de menores.
// O arquivo gerado contém dados pessoais: ele é salvo FORA do repositório (pasta DeMolay/Claude/Membros).
//
// Uso:
//   node scripts/gerar-sql-importacao-membros.mjs <planilha.xlsx> [saida.sql]
//   node scripts/gerar-sql-importacao-membros.mjs <planilha.xlsx> --dry-run   (só confere, não escreve)
//
// Casamento planilha <-> site: pela matrícula (coluna ID = membros.matricula).
// Membros do site sem matrícula são casados pelo mapa em DeMolay/Claude/Membros/mapa-nomes.json (fora do repo; confirmar com a cliente).

import { createRequire } from 'node:module'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Matrícula da planilha -> nome como está cadastrado no site (membros sem matrícula no site).
// São dados pessoais de menores: ficam num JSON FORA do repositório, nunca no código.
// Formato: { "<matrícula>": "<nome no site>" }
const ARQ_MAPA = path.resolve(raiz, '../Claude/Membros/mapa-nomes.json')
let NOME_SEM_MATRICULA = {}
if (existsSync(ARQ_MAPA)) {
  try {
    const dados = JSON.parse(readFileSync(ARQ_MAPA, 'utf8'))
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('esperado um objeto { matrícula: nome }')
    for (const [mat, nome] of Object.entries(dados)) {
      if (/^\d+$/.test(mat) && typeof nome === 'string' && nome.trim()) NOME_SEM_MATRICULA[mat] = nome.trim()
      else console.warn(`Aviso: entrada ignorada no mapa de nomes (matrícula "${mat}").`)
    }
  } catch (e) {
    console.error(`Erro ao ler ${ARQ_MAPA}: ${e.message}. Abortado.`); process.exit(1)
  }
} else {
  console.warn(`Aviso: ${ARQ_MAPA} não encontrado. Membros sem matrícula no site serão casados só pela matrícula.`)
}

// Colunas usadas (todas ANTES de "DDD PREFERENCIAL", onde os cabeçalhos estão deslocados).
// O script confere o nome do cabeçalho em cada índice antes de usar.
const COL = { id: [0, 'ID'], nome: [1, 'NOME'], nascimento: [7, 'NASCIMENTO'], situacao: [11, 'SITUAÇÃO'] }
const SITUACOES = { regular: 'regular', irregular: 'irregular', inativo: 'inativo' }

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const [arqPlanilha, arqSaida = path.resolve(raiz, '../Claude/Membros/importacao_membros.sql')] = args.filter(a => a !== '--dry-run')
if (!arqPlanilha) { console.error('Informe o caminho da planilha .xlsx'); process.exit(1) }

const wb = XLSX.readFile(arqPlanilha, { raw: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
const cab = linhas[0].map(c => String(c).trim().toUpperCase())

for (const [idx, nome] of Object.values(COL)) {
  if (cab[idx] !== nome) { console.error(`Cabeçalho inesperado na coluna ${idx}: "${cab[idx]}" (esperado "${nome}"). Abortado.`); process.exit(1) }
}

const sqlStr = s => `'${String(s).replace(/'/g, "''")}'`
function dataISO(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br).trim())
  if (!m) return null
  const [, d, mo, a] = m.map(Number)
  const dt = new Date(a, mo - 1, d)
  if (dt.getFullYear() !== a || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  if (a < 1980 || a > new Date().getFullYear() - 10) return null   // faixa plausível para DeMolay
  return `${a}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const updates = []
const problemas = []
for (const [i, r] of linhas.slice(1).entries()) {
  const id = String(r[COL.id[0]]).trim()
  if (!id) continue
  if (!/^\d+$/.test(id)) { problemas.push(`linha ${i + 2}: ID inválido`); continue }
  const nasc = dataISO(r[COL.nascimento[0]])
  const sitBruta = String(r[COL.situacao[0]]).trim().toLowerCase()
  const sit = SITUACOES[sitBruta] ?? null
  if (!nasc) problemas.push(`ID ${id}: nascimento inválido/vazio`)
  if (!sit) problemas.push(`ID ${id}: situação inválida/vazia`)
  if (!nasc && !sit) continue
  const set = [nasc && `data_nascimento = ${sqlStr(nasc)}`, sit && `situacao = ${sqlStr(sit)}`].filter(Boolean).join(', ')
  const onde = NOME_SEM_MATRICULA[id]
    ? `(matricula = ${sqlStr(id)} or (coalesce(trim(matricula), '') = '' and upper(trim(nome)) = upper(${sqlStr(NOME_SEM_MATRICULA[id])})))`
    : `matricula = ${sqlStr(id)}`
  updates.push(`update membros set ${set} where ${onde};`)
}

console.log(`Linhas na planilha: ${linhas.length - 1} | updates gerados: ${updates.length} | avisos: ${problemas.length}`)
for (const p of problemas) console.log('  aviso:', p)
if (dryRun) { console.log('--dry-run: nenhum arquivo escrito.'); process.exit(0) }

const sql = `-- GERADO por scripts/gerar-sql-importacao-membros.mjs em ${new Date().toLocaleString('pt-BR')}
-- CONTÉM DADOS PESSOAIS (nascimento de menores). Não versionar. Não compartilhar.
-- Rodar SOMENTE depois de: (1) migração supabase/2026-11-membros-situacao-nascimento.sql e
-- (2) correção das regras de acesso (RLS) da tabela membros.
-- Membros da planilha que não estão no site simplesmente não são atualizados (0 linhas).
begin;
${updates.join('\n')}
commit;

-- Conferência: membros do site que ficaram sem data de nascimento ou situação
select nome, matricula, status, situacao, data_nascimento
from membros
where data_nascimento is null or situacao is null
order by nome;
`
writeFileSync(arqSaida, sql, { mode: 0o600 })
console.log('SQL escrito em', arqSaida)
