// Cálculo ÚNICO de pendências (mensalidades, anuidades, eventos).
// Usado no Painel (Início), Membros, Pagamentos (cards e aba Pendências) e Indicadores —
// não duplique essa regra nas telas.
//
// Critérios (alinhados com lib/mensalidades.ts, a regra oficial do remoto):
// - Mensalidade: só é dívida a linha LANÇADA com status 'nao_pago', fora de jan/jul (ehPendencia).
//   Mês sem lançamento NÃO é dívida (as linhas são geradas pela rotina mensal do banco,
//   só para membros 'ativo' que já tinham entrado). O que já está lançado continua valendo
//   mesmo que o membro vire sênior/afastado.
// - Anuidade: tudo que não está 'pago' ('pendente' e 'atrasado') conta.
// - Eventos: participantes e pedidos com pago = false (não usa pagamentos_eventos.status).
//   Pedidos sem membro vinculado entram no total do evento, mas não na dívida de um membro.

import { supabase } from '@/lib/supabase'
import { ehPendencia, ehMesCobrado, aparecaNoMes, MESES_COBRADOS } from '@/lib/mensalidades'

export const VALOR_MENSALIDADE = 20

export type MembroP = { id: string; nome?: string; status: string; data_entrada?: string | null }
export type MensP = { id?: string; membro_id: string; mes: number; ano: number; valor: number | string; status: string }
export type AnuP = { id?: string; membro_id: string; ano: number; valor: number | string; status: string }
export type EvP = { id: string; nome?: string; valor: number | string; tipo?: string | null; data?: string | null }
export type PartP = { id?: string; evento_id: string; membro_id: string | null; qtd?: number | null; pago: boolean; transacao_id?: string | null }
export type PedP = { id?: string; evento_id: string; membro_id: string | null; valor: number | string; pago: boolean; nome?: string }

export type Competencia = { ano: number; mes: number }
export type ItemMens = { id?: string; membro_id: string; ano: number; mes: number; valor: number }

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

const valorMens = (r: MensP) => +r.valor || VALOR_MENSALIDADE

/**
 * Situação de um mês (Indicadores). Entram os membros que aparecem na tela Pagamentos
 * naquele mês (aparecaNoMes). Em aberto = só linha 'nao_pago'. Sem lançamento é contado
 * à parte e não é dívida.
 */
export function resumoMes(membros: MembroP[], idx: Map<string, MensP>, ano: number, mes: number) {
  let pagos = 0, isentos = 0, semLancamento = 0, valorAberto = 0
  const abertos: ItemMens[] = []
  let total = 0
  if (!ehMesCobrado(mes)) return { ano, mes, total, pagos, isentos, semLancamento, abertos, valorAberto, pct: 0 }
  for (const m of membros) {
    const r = idx.get(chave(m.id, ano, mes))
    if (!aparecaNoMes(m, !!r, mes, ano)) continue
    total++
    if (!r) { semLancamento++; continue }
    if (r.status === 'pago') pagos++
    else if (r.status === 'isento') isentos++
    else if (ehPendencia(r)) {
      const valor = valorMens(r)
      abertos.push({ id: r.id, membro_id: m.id, ano, mes, valor })
      valorAberto += valor
    }
  }
  const pct = total ? (pagos + isentos) / total : 0
  return { ano, mes, total, pagos, isentos, semLancamento, abertos, valorAberto, pct }
}
export type ResumoMes = ReturnType<typeof resumoMes>

/** Resumo mês a mês de um ano (só meses cobrados, até a competência atual). */
export function resumoAno(membros: MembroP[], mens: MensP[], ano: number, ate = competenciaAtual()): ResumoMes[] {
  const idx = indexarMensalidades(mens)
  if (ano > ate.ano) return []
  const ultimo = ano === ate.ano ? ate.mes : 12
  return MESES_COBRADOS.filter(m => m <= ultimo).map(m => resumoMes(membros, idx, ano, m))
}

/** Todas as mensalidades em aberto (linhas 'nao_pago' fora de jan/jul), de qualquer mês lançado. */
export function mensalidadesEmAberto(mens: MensP[]) {
  const itens: ItemMens[] = mens.filter(ehPendencia)
    .map(r => ({ id: r.id, membro_id: r.membro_id, ano: r.ano, mes: r.mes, valor: valorMens(r) }))
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
  const porMembro: Record<string, ItemMens[]> = {}
  for (const it of itens) (porMembro[it.membro_id] ??= []).push(it)
  return { itens, porMembro, total: itens.reduce((s, i) => s + i.valor, 0) }
}

/** Total em aberto de mensalidades de um conjunto de linhas (ex.: um mês). */
export const totalMensalidadesMes = (mens: MensP[]) => mensalidadesEmAberto(mens).total

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

export const valorParticipacao = (ev: { valor: number | string; tipo?: string | null }, p: { qtd?: number | null }) =>
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buscarTodas<T>(tabela: string, colunas: string, filtro?: (q: any) => any): Promise<T[]> {
  const passo = 1000
  const out: T[] = []
  for (let de = 0; ; de += passo) {
    let q = supabase.from(tabela).select(colunas)
    if (filtro) q = filtro(q)
    const { data, error } = await q.range(de, de + passo - 1)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < passo) break
  }
  return out
}

/** Carrega do banco só o que está em aberto (base de todas as telas de pendência). */
export async function carregarDadosPendencias() {
  const [membros, mens, anu, evs, parts, peds] = await Promise.all([
    buscarTodas<MembroP>('membros', 'id, nome, status, data_entrada'),
    buscarTodas<MensP>('mensalidades', 'id, membro_id, mes, ano, valor, status',
      q => q.eq('status', 'nao_pago').in('mes', [...MESES_COBRADOS])),
    buscarTodas<AnuP>('anuidades', 'id, membro_id, ano, valor, status', q => q.neq('status', 'pago')),
    buscarTodas<EvP>('pagamentos_eventos', 'id, nome, valor, tipo, data'),
    buscarTodas<PartP>('evento_participantes', '*', q => q.eq('pago', false)),
    buscarTodas<PedP>('evento_pedidos', '*', q => q.eq('pago', false)),
  ])
  return { membros, mens, anu, evs, parts, peds }
}
export type DadosPendencias = Awaited<ReturnType<typeof carregarDadosPendencias>>

/** Item de pendência por membro (aba Pendências). */
export type ItemPendencia =
  | { tipo: 'mensalidade'; membro_id: string; id?: string; ano: number; mes: number; valor: number }
  | { tipo: 'anuidade'; membro_id: string; id?: string; ano: number; valor: number }
  | { tipo: 'participante'; membro_id: string; id?: string; evento: EvP; part: PartP; valor: number }
  | { tipo: 'pedido'; membro_id: string; id?: string; evento?: EvP; pedido: PedP; valor: number }

/** Lista item a item, por membro, com o mesmo critério dos totais. */
export function listarPendencias(d: DadosPendencias): Record<string, ItemPendencia[]> {
  const out: Record<string, ItemPendencia[]> = {}
  const add = (it: ItemPendencia) => { (out[it.membro_id] ??= []).push(it) }
  for (const it of mensalidadesEmAberto(d.mens).itens) add({ tipo: 'mensalidade', ...it })
  for (const a of d.anu) if (a.status !== 'pago') add({ tipo: 'anuidade', membro_id: a.membro_id, id: a.id, ano: a.ano, valor: +a.valor })
  const evMap = new Map(d.evs.map(e => [e.id, e]))
  for (const p of d.parts) {
    const ev = evMap.get(p.evento_id)
    if (p.pago || !ev || !p.membro_id) continue
    add({ tipo: 'participante', membro_id: p.membro_id, id: p.id, evento: ev, part: p, valor: valorParticipacao(ev, p) })
  }
  for (const pd of d.peds) {
    if (pd.pago || !pd.membro_id || !evMap.has(pd.evento_id)) continue
    add({ tipo: 'pedido', membro_id: pd.membro_id, id: pd.id, evento: evMap.get(pd.evento_id), pedido: pd, valor: +pd.valor })
  }
  return out
}

/** Carrega tudo e calcula as pendências gerais (Painel e Membros). */
export async function carregarPendencias() {
  const d = await carregarDadosPendencias()
  const mensalidades = mensalidadesEmAberto(d.mens)
  const anuidades = anuidadesEmAberto(d.anu)
  const eventos = eventosEmAberto(d.evs, d.parts, d.peds)

  const porMembro: Record<string, number> = {}
  const somar = (id: string, v: number) => { porMembro[id] = (porMembro[id] ?? 0) + v }
  for (const it of mensalidades.itens) somar(it.membro_id, it.valor)
  for (const [id, v] of Object.entries(anuidades.porMembro)) somar(id, v)
  for (const [id, v] of Object.entries(eventos.porMembro)) somar(id, v)

  return {
    membros: d.membros, evs: d.evs, mensalidades, anuidades, eventos, porMembro,
    total: mensalidades.total + anuidades.total + eventos.total,
  }
}
