// Séries por semestre para o gráfico "Evolução semestral" (Indicadores).
// S1 = jan–jun, S2 = jul–dez. Rótulo "2024/1".
import { resumoAno, type MembroP, type MensP, type Competencia } from '@/lib/pendencias'

export type ChaveSem = { ano: number; s: 1 | 2 }
export type PontoSem = ChaveSem & { label: string; valor: number | null; parcial: boolean }

export const semDe = (iso: string | null | undefined): ChaveSem | null => {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return null
  return { ano: +m[1], s: +m[2] <= 6 ? 1 : 2 }
}
const idx = (k: ChaveSem) => k.ano * 2 + (k.s - 1)
const deIdx = (i: number): ChaveSem => ({ ano: Math.floor(i / 2), s: ((i % 2) + 1) as 1 | 2 })
export const rotuloSem = (k: ChaveSem) => `${k.ano}/${k.s}`

/** Lista contínua de semestres do primeiro até o atual (inclusive). */
function faixa(primeiro: ChaveSem, atual: ChaveSem): ChaveSem[] {
  const out: ChaveSem[] = []
  for (let i = idx(primeiro); i <= idx(atual); i++) out.push(deIdx(i))
  return out
}

function montar(valores: Map<number, number>, atual: ChaveSem): PontoSem[] {
  const chaves = [...valores.keys()].filter(i => i <= idx(atual))
  if (chaves.length === 0) return []
  return faixa(deIdx(Math.min(...chaves)), atual).map(k => ({
    ...k, label: rotuloSem(k), valor: valores.get(idx(k)) ?? 0, parcial: idx(k) === idx(atual),
  }))
}

/** (a) Iniciações por semestre, pela data_iniciacao. */
export function serieIniciacoes(datas: (string | null | undefined)[], atual: ChaveSem): PontoSem[] {
  const v = new Map<number, number>()
  for (const d of datas) { const k = semDe(d); if (k) v.set(idx(k), (v.get(idx(k)) ?? 0) + 1) }
  return montar(v, atual)
}

/** (b) Arrecadação por semestre: soma das entradas em transacoes. */
export function serieArrecadacao(trans: { tipo: string; valor: number | string; data: string }[], atual: ChaveSem): PontoSem[] {
  const v = new Map<number, number>()
  for (const t of trans) {
    if (t.tipo !== 'entrada') continue
    const k = semDe(t.data); if (!k) continue
    v.set(idx(k), (v.get(idx(k)) ?? 0) + (+t.valor || 0))
  }
  return montar(v, atual)
}

/**
 * (c) % de mensalidades em dia por semestre, com a mesma regra do remoto (resumoMes):
 * (pagas + isentas) / membros do mês, somando os meses cobrados do semestre (sem jan/jul),
 * até a competência atual. Semestre sem mensalidade devida fica null.
 */
export function serieEmDia(membros: MembroP[], mens: MensP[], ate: Competencia): PontoSem[] {
  const atual: ChaveSem = { ano: ate.ano, s: ate.mes <= 6 ? 1 : 2 }
  if (mens.length === 0) return []
  const primeiroAno = Math.min(...mens.map(r => r.ano))
  const tot = new Map<number, { ok: number; total: number }>()
  for (let ano = primeiroAno; ano <= ate.ano; ano++) {
    for (const r of resumoAno(membros, mens, ano, ate)) {
      const k = idx({ ano, s: r.mes <= 6 ? 1 : 2 })
      const a = tot.get(k) ?? { ok: 0, total: 0 }
      a.ok += r.pagos + r.isentos; a.total += r.total
      tot.set(k, a)
    }
  }
  const comDado = [...tot.entries()].filter(([, a]) => a.total > 0).map(([k]) => k)
  if (comDado.length === 0) return []
  return faixa(deIdx(Math.min(...comDado)), atual).map(k => {
    const a = tot.get(idx(k))
    return { ...k, label: rotuloSem(k), valor: a && a.total > 0 ? a.ok / a.total : null, parcial: idx(k) === idx(atual) }
  })
}

export type Variacao = { tipo: 'primeiro' | 'novo' | 'sem_base' | 'igual' | 'subiu' | 'caiu'; texto: string }

/**
 * Variação em relação ao semestre anterior.
 * modo 'relativa' (contagens e R$): (atual − anterior) / anterior, "novo" quando a base é zero.
 * modo 'pontos' (métrica que já é %): diferença em pontos percentuais.
 */
export function variacao(atual: number | null, anterior: number | null | undefined, modo: 'relativa' | 'pontos', primeiro: boolean): Variacao {
  if (primeiro) return { tipo: 'primeiro', texto: '—' }
  if (atual === null || anterior === null || anterior === undefined) return { tipo: 'sem_base', texto: '—' }
  if (modo === 'pontos') {
    const pp = Math.round((atual - anterior) * 100)
    if (pp === 0) return { tipo: 'igual', texto: '0 p.p.' }
    return { tipo: pp > 0 ? 'subiu' : 'caiu', texto: `${pp > 0 ? '+' : '−'}${Math.abs(pp)} p.p.` }
  }
  if (anterior === 0) return atual > 0 ? { tipo: 'novo', texto: 'novo' } : { tipo: 'igual', texto: '0%' }
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  if (pct === 0) return { tipo: 'igual', texto: '0%' }
  return { tipo: pct > 0 ? 'subiu' : 'caiu', texto: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%` }
}
