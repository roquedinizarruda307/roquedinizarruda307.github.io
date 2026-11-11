// Cálculo ÚNICO de pendências (mensalidades, anuidades, eventos).
// Usado no Painel (Início), Membros, Pagamentos e Indicadores — não duplique essa regra nas telas.
//
// Critérios:
// - Mensalidade: só deve quem está com status 'ativo' (sênior e afastado/inativo não devem).
//   Para cada membro ativo, até o mês atual: registro 'pago'/'isento' = quitado; registro 'nao_pago' = em aberto;
//   mês SEM registro = em aberto só a partir do mês de data_entrada (mesma regra visual da tela Pagamentos,
//   sem cobrar meses anteriores à entrada de quem chegou no meio do ano).
// - Anuidade: tudo que não está 'pago' ('pendente' e 'atrasado') conta.
// - Eventos: calculado pelos participantes/pedidos não pagos (não usa pagamentos_eventos.status).

import { supabase } from '@/lib/supabase'
import { parseDataLocal } from '@/lib/datas'

export const VALOR_MENSALIDADE = 20

export type MembroP = { id: string; nome?: string; status: string; data_entrada?: string | null }
export type MensP = { membro_id: string; mes: number; ano: number; valor: number | string; status: string }
export type AnuP = { membro_id: string; ano: number; valor: number | string; status: string }
export type EvP = { id: string; nome?: string; valor: number | string; tipo?: string | null; data?: string | null }
export type PartP = { evento_id: string; membro_id: string | null; qtd?: number | null; pago: boolean }
export type PedP = { evento_id: string; membro_id: string | null; valor: number | string; pago: boolean }

export type Competencia = { ano: number; mes: number }
export type ItemMens = { membro_id: string; ano: number; mes: number; valor: number }

export const deveMensalidade = (m: { status: string }) => m.status === 'ativo'

export function competenciaAtual(d = new Date()): Competencia {
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

const chave = (membroId: string, ano: number, mes: number) => `${membroId}:${ano}:${mes}`

export function indexarMensalidades(mens: MensP[]) {
  const idx = new Map<string, MensP>()
  for (const r of mens) idx.set(chave(r.membro_id, r.ano, r.mes), r)
  return idx
}

/** Primeiro ano com mensalidades registradas (ou o ano atual se não houver). */
export function primeiroAnoMens(mens: MensP[], ate = competenciaAtual()): number {
  let min = ate.ano
  for (const r of mens) if (r.ano < min) min = r.ano
  return min
}

/** O membro já devia mensalidade nesta competência? (a partir do mês de data_entrada) */
function cobradoEm(m: MembroP, ano: number, mes: number) {
  const d = parseDataLocal(m.data_entrada ?? null)
  if (!d) return true
  return ano * 12 + mes >= d.getFullYear() * 12 + d.getMonth() + 1
}

/** Situação de um mês específico (só membros que devem mensalidade). */
export function resumoMes(membros: MembroP[], idx: Map<string, MensP>, ano: number, mes: number) {
  let pagos = 0, isentos = 0, valorAberto = 0
  const abertos: ItemMens[] = []
  let total = 0
  for (const m of membros) {
    if (!deveMensalidade(m)) continue
    const r = idx.get(chave(m.id, ano, mes))
    if (!r && !cobradoEm(m, ano, mes)) continue
    total++
    if (r?.status === 'pago') pagos++
    else if (r?.status === 'isento') isentos++
    else {
      const valor = r ? +r.valor || VALOR_MENSALIDADE : VALOR_MENSALIDADE
      abertos.push({ membro_id: m.id, ano, mes, valor })
      valorAberto += valor
    }
  }
  const pct = total ? (pagos + isentos) / total : 0
  return { ano, mes, total, pagos, isentos, abertos, valorAberto, pct }
}
export type ResumoMes = ReturnType<typeof resumoMes>

/** Resumo mês a mês de um ano, só até a competência atual (meses futuros não são devidos). */
export function resumoAno(membros: MembroP[], mens: MensP[], ano: number, ate = competenciaAtual()): ResumoMes[] {
  const idx = indexarMensalidades(mens)
  if (ano > ate.ano) return []
  const ultimo = ano === ate.ano ? ate.mes : 12
  return Array.from({ length: ultimo }, (_, i) => resumoMes(membros, idx, ano, i + 1))
}

/** Todas as mensalidades em aberto até a competência atual. */
export function mensalidadesEmAberto(membros: MembroP[], mens: MensP[], ate = competenciaAtual()) {
  const anoBase = primeiroAnoMens(mens, ate)
  const itens: ItemMens[] = []
  for (let ano = anoBase; ano <= ate.ano; ano++) {
    for (const r of resumoAno(membros, mens, ano, ate)) itens.push(...r.abertos)
  }
  const porMembro: Record<string, ItemMens[]> = {}
  for (const it of itens) (porMembro[it.membro_id] ??= []).push(it)
  return { itens, porMembro, total: itens.reduce((s, i) => s + i.valor, 0) }
}

export function anuidadesEmAberto(anu: AnuP[], ano?: number) {
  const porMembro: Record<string, number> = {}
  let total = 0
  for (const r of anu) {
    if (r.status === 'pago') continue
    if (ano !== undefined && r.ano !== ano) continue
    porMembro[r.membro_id] = (porMembro[r.membro_id] ?? 0) + +r.valor
    total += +r.valor
  }
  return { porMembro, total }
}

export const valorParticipacao = (ev: EvP, p: { qtd?: number | null }) =>
  ev.tipo === 'ingresso' ? +ev.valor * (p.qtd || 1) : +ev.valor

/** Eventos em aberto pelos participantes e pedidos não pagos. Se `eventoIds` vier, limita a esses eventos. */
export function eventosEmAberto(evs: EvP[], parts: PartP[], peds: PedP[], eventoIds?: Set<string>) {
  const evMap = new Map(evs.map(e => [e.id, e]))
  const porMembro: Record<string, number> = {}
  const porEvento: Record<string, number> = {}
  let total = 0
  const add = (evId: string, membroId: string | null, v: number) => {
    if (!v) return
    total += v
    porEvento[evId] = (porEvento[evId] ?? 0) + v
    if (membroId) porMembro[membroId] = (porMembro[membroId] ?? 0) + v
  }
  for (const p of parts) {
    if (p.pago || (eventoIds && !eventoIds.has(p.evento_id))) continue
    const ev = evMap.get(p.evento_id)
    if (ev) add(ev.id, p.membro_id, valorParticipacao(ev, p))
  }
  for (const pd of peds) {
    if (pd.pago || (eventoIds && !eventoIds.has(pd.evento_id))) continue
    if (!evMap.has(pd.evento_id)) continue
    add(pd.evento_id, pd.membro_id, +pd.valor)
  }
  return { porMembro, porEvento, total }
}

/** Busca todas as linhas de uma tabela, paginando (o Supabase devolve no máximo 1000 por vez). */
export async function buscarTodas<T>(tabela: string, colunas: string): Promise<T[]> {
  const passo = 1000
  const out: T[] = []
  for (let de = 0; ; de += passo) {
    const { data, error } = await supabase.from(tabela).select(colunas).range(de, de + passo - 1)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < passo) break
  }
  return out
}

/** Carrega tudo e calcula as pendências gerais (Painel e Membros). */
export async function carregarPendencias() {
  const [membros, mens, anu, evs, parts, peds] = await Promise.all([
    buscarTodas<MembroP>('membros', 'id, nome, status, data_entrada'),
    buscarTodas<MensP>('mensalidades', 'membro_id, mes, ano, valor, status'),
    buscarTodas<AnuP>('anuidades', 'membro_id, ano, valor, status'),
    buscarTodas<EvP>('pagamentos_eventos', 'id, nome, valor, tipo, data'),
    buscarTodas<PartP>('evento_participantes', 'evento_id, membro_id, qtd, pago'),
    buscarTodas<PedP>('evento_pedidos', 'evento_id, membro_id, valor, pago'),
  ])
  const mensalidades = mensalidadesEmAberto(membros, mens)
  const anuidades = anuidadesEmAberto(anu)
  const eventos = eventosEmAberto(evs, parts, peds)

  const porMembro: Record<string, number> = {}
  const somar = (id: string, v: number) => { porMembro[id] = (porMembro[id] ?? 0) + v }
  for (const it of mensalidades.itens) somar(it.membro_id, it.valor)
  for (const [id, v] of Object.entries(anuidades.porMembro)) somar(id, v)
  for (const [id, v] of Object.entries(eventos.porMembro)) somar(id, v)

  return {
    membros, evs, mensalidades, anuidades, eventos, porMembro,
    total: mensalidades.total + anuidades.total + eventos.total,
  }
}
