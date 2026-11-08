// Cálculo de frequência em reuniões — usado na aba Escrivão > Frequência e na ficha do membro.
// Regra: presenças / reuniões consideradas. Consideradas = reuniões do semestre já realizadas
// (até hoje), a partir da data de entrada do membro, menos as faltas justificadas (se existir o campo).
import { supabase } from '@/lib/supabase'
import { CAMPO_FALTA_JUSTIFICADA } from '@/lib/escrivao'

export type Semestre = 1 | 2
export type ReuniaoFreq = { id: string; data: string; titulo: string }
export type PresencaFreq = Record<string, any> & { reuniao_id: string; membro_id: string; presente: boolean }
export type MembroFreq = { id: string; nome: string; status?: string | null; data_entrada?: string | null }

export type ResultadoFreq = {
  presencas: number
  justificadas: number
  consideradas: number
  pct: number | null                 // null = nenhuma reunião considerada
  reunioes: (ReuniaoFreq & { situacao: 'presente' | 'ausente' | 'justificada' | 'antes_da_entrada' })[]
}

export const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const semestreAtual = (): { ano: number; semestre: Semestre } => {
  const d = new Date()
  return { ano: d.getFullYear(), semestre: d.getMonth() < 6 ? 1 : 2 }
}

export const rotuloSemestre = (ano: number, s: Semestre) => `${s}º semestre de ${ano}`

/** Intervalo do semestre, cortado em hoje (só reuniões já realizadas). */
export function intervaloSemestre(ano: number, s: Semestre) {
  const inicio = `${ano}-${s === 1 ? '01-01' : '07-01'}`
  const fim = `${ano}-${s === 1 ? '06-30' : '12-31'}`
  const hoje = hojeISO()
  return { inicio, fim: fim < hoje ? fim : hoje }
}

/** Busca reuniões do semestre e as presenças (de todos ou de um membro). */
export async function carregarSemestre(ano: number, s: Semestre, membroId?: string) {
  const { inicio, fim } = intervaloSemestre(ano, s)
  const { data: r } = await supabase.from('reunioes').select('id, data, titulo').gte('data', inicio).lte('data', fim).order('data')
  const reunioes = (r ?? []) as ReuniaoFreq[]
  let presencas: PresencaFreq[] = []
  if (reunioes.length) {
    let q = supabase.from('reuniao_presencas').select('*').in('reuniao_id', reunioes.map(x => x.id))
    if (membroId) q = q.eq('membro_id', membroId)
    const { data: p } = await q
    presencas = (p ?? []) as PresencaFreq[]
  }
  return { reunioes, presencas }
}

/** Frequência de um membro dadas as reuniões do período e as presenças DELE. */
export function calcularFrequencia(m: MembroFreq, reunioes: ReuniaoFreq[], presencasDoMembro: PresencaFreq[]): ResultadoFreq {
  const entrada = m.data_entrada ? String(m.data_entrada).slice(0, 10) : ''
  const porReuniao = new Map(presencasDoMembro.map(p => [p.reuniao_id, p]))
  const campoJ = CAMPO_FALTA_JUSTIFICADA
  let presencas = 0, justificadas = 0, consideradas = 0
  const lista: ResultadoFreq['reunioes'] = []
  for (const r of reunioes) {
    const p = porReuniao.get(r.id)
    if (entrada && r.data < entrada) { lista.push({ ...r, situacao: 'antes_da_entrada' }); continue }
    if (p?.presente) { presencas++; consideradas++; lista.push({ ...r, situacao: 'presente' }) }
    else if (campoJ && p?.[campoJ]) { justificadas++; lista.push({ ...r, situacao: 'justificada' }) }
    else { consideradas++; lista.push({ ...r, situacao: 'ausente' }) }
  }
  return { presencas, justificadas, consideradas, reunioes: lista,
    pct: consideradas > 0 ? Math.round((presencas / consideradas) * 1000) / 10 : null }
}

export const fmtPct = (v: number | null) => v === null ? '—' : `${v.toLocaleString('pt-BR')}%`
