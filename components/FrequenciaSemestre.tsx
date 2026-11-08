'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { supabase, type Membro } from '@/lib/supabase'
import { exportarExcel } from '@/lib/excel'
import { CAMPO_FALTA_JUSTIFICADA, FREQUENCIA_MINIMA, naChamada } from '@/lib/escrivao'
import { calcularFrequencia, carregarSemestre, fmtPct, rotuloSemestre, semestreAtual,
  type PresencaFreq, type ReuniaoFreq, type Semestre } from '@/lib/frequencia'

// Frequência por membro no semestre (regra em lib/frequencia.ts).
type Linha = { id: string; nome: string; presencas: number; justificadas: number; consideradas: number; pct: number | null }

export default function FrequenciaSemestre() {
  const atual = semestreAtual()
  const [ano, setAno] = useState(atual.ano)
  const [semestre, setSemestre] = useState<Semestre>(atual.semestre)
  const [reunioes, setReunioes] = useState<ReuniaoFreq[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [presencas, setPresencas] = useState<PresencaFreq[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    Promise.all([carregarSemestre(ano, semestre), supabase.from('membros').select('*')]).then(([sem, { data: m }]) => {
      if (cancelado) return
      setReunioes(sem.reunioes); setPresencas(sem.presencas); setMembros((m ?? []) as Membro[]); setLoading(false)
    })
    return () => { cancelado = true }
  }, [ano, semestre])

  const linhas = useMemo<Linha[]>(() => {
    const porMembro = new Map<string, PresencaFreq[]>()
    for (const p of presencas) (porMembro.get(p.membro_id) ?? porMembro.set(p.membro_id, []).get(p.membro_id)!).push(p)
    const lista: Linha[] = []
    for (const m of membros) {
      const ps = porMembro.get(m.id) ?? []
      // 'ativo' + quem tem presença no período
      if (!naChamada(m) && !ps.some(p => p.presente)) continue
      const f = calcularFrequencia(m, reunioes, ps)
      lista.push({ id: m.id, nome: m.nome, presencas: f.presencas, justificadas: f.justificadas, consideradas: f.consideradas, pct: f.pct })
    }
    // menor % primeiro; sem reuniões consideradas vai para o fim
    return lista.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }, [membros, presencas, reunioes])

  const rotulo = rotuloSemestre(ano, semestre)

  function exportar() {
    const cab = ['Membro', 'Presenças', ...(CAMPO_FALTA_JUSTIFICADA ? ['Faltas justificadas'] : []), 'Reuniões consideradas', 'Frequência (%)']
    const dados: (string | number)[][] = [[`Frequência — ${rotulo}`], [`Reuniões realizadas no semestre: ${reunioes.length}`], [], cab]
    for (const l of linhas) dados.push([l.nome, l.presencas, ...(CAMPO_FALTA_JUSTIFICADA ? [l.justificadas] : []), l.consideradas, l.pct ?? '—'])
    exportarExcel(`frequencia_${ano}_${semestre}sem.xlsx`, dados, 'Frequência')
  }

  const anos = [atual.ano - 1, atual.ano]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([1, 2] as const).map(s => (
          <button key={s} onClick={() => setSemestre(s)}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide"
            style={semestre === s ? { background: '#c0392b', color: '#fff' } : { background: '#fff', color: '#9ca3af', border: '1px solid #f0f0f0' }}>
            {s}º semestre
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {anos.map(a => (
          <button key={a} onClick={() => setAno(a)}
            className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide"
            style={ano === a ? { background: '#111827', color: '#fff' } : { background: '#fff', color: '#9ca3af', border: '1px solid #f0f0f0' }}>
            {a}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-gray-700">Frequência — {rotulo}</p>
            <p className="text-xs text-gray-400">
              {loading ? 'Carregando…' : `${reunioes.length} ${reunioes.length === 1 ? 'reunião realizada' : 'reuniões realizadas'} até hoje · destaque abaixo de ${FREQUENCIA_MINIMA}%`}
            </p>
          </div>
          <button onClick={exportar} disabled={loading} className="text-gray-400 hover:text-emerald-600 disabled:opacity-40" title="Exportar Excel">
            <FileSpreadsheet size={16} />
          </button>
        </div>

        {loading ? null : reunioes.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-300">Nenhuma reunião registrada neste semestre.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-left">
                  <th className="px-5 py-2.5">Membro</th>
                  <th className="px-3 py-2.5 text-right">Presenças</th>
                  {CAMPO_FALTA_JUSTIFICADA && <th className="px-3 py-2.5 text-right">Justificadas</th>}
                  <th className="px-3 py-2.5 text-right">Reuniões</th>
                  <th className="px-5 py-2.5 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {linhas.map(l => {
                  const baixa = l.pct !== null && l.pct < FREQUENCIA_MINIMA
                  return (
                    <tr key={l.id} style={baixa ? { background: '#fef2f2' } : {}}>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{l.nome}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{l.presencas}</td>
                      {CAMPO_FALTA_JUSTIFICADA && <td className="px-3 py-2.5 text-right text-gray-700">{l.justificadas}</td>}
                      <td className="px-3 py-2.5 text-right text-gray-700">{l.consideradas}</td>
                      <td className="px-5 py-2.5 text-right font-bold" style={{ color: baixa ? '#dc2626' : '#16a34a' }}>{fmtPct(l.pct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
