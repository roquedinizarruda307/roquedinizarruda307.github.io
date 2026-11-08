'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FREQUENCIA_MINIMA } from '@/lib/escrivao'
import { calcularFrequencia, carregarSemestre, fmtPct, rotuloSemestre, semestreAtual,
  type MembroFreq, type ResultadoFreq, type Semestre } from '@/lib/frequencia'

const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const SITUACAO = {
  presente:         { label: 'Presente',        color: '#16a34a', bg: '#f0fdf4' },
  ausente:          { label: 'Ausente',         color: '#dc2626', bg: '#fef2f2' },
  justificada:      { label: 'Justificada',     color: '#a16207', bg: '#fefce8' },
  antes_da_entrada: { label: 'Antes da entrada', color: '#9ca3af', bg: '#f9fafb' },
} as const

// Bloco "Presença" da ficha do membro: frequência do semestre + lista de reuniões.
export default function PresencaMembro({ membro }: { membro: MembroFreq }) {
  const [{ ano, semestre }, setSem] = useState(semestreAtual())
  const [res, setRes] = useState<ResultadoFreq | null>(null)

  useEffect(() => {
    let cancelado = false
    setRes(null)
    carregarSemestre(ano, semestre, membro.id).then(({ reunioes, presencas }) => {
      if (!cancelado) setRes(calcularFrequencia(membro, reunioes, presencas))
    })
    return () => { cancelado = true }
  }, [ano, semestre, membro])

  const atual = semestreAtual()
  const ehAtual = ano === atual.ano && semestre === atual.semestre
  const mover = (d: -1 | 1) => setSem(({ ano, semestre }) => {
    const idx = ano * 2 + (semestre - 1) + d
    return { ano: Math.floor(idx / 2), semestre: ((idx % 2) + 1) as Semestre }
  })
  const baixa = res?.pct !== null && res?.pct !== undefined && res.pct < FREQUENCIA_MINIMA

  return (
    <div className="border-t border-gray-100">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Presença</p>
        <div className="flex items-center gap-1">
          <button onClick={() => mover(-1)} className="p-1 text-gray-400 hover:text-gray-700" title="Semestre anterior"><ChevronLeft size={14} /></button>
          <span className="text-xs text-gray-500">{rotuloSemestre(ano, semestre)}</span>
          <button onClick={() => mover(1)} disabled={ehAtual} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Próximo semestre"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="px-5 pb-4">
        {!res ? (
          <p className="text-sm text-gray-300 text-center py-3">Carregando...</p>
        ) : res.reunioes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Nenhuma reunião neste semestre.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between rounded-lg px-3 py-2 mb-2" style={{ background: baixa ? '#fef2f2' : '#f0fdf4' }}>
              <span className="text-sm text-gray-600">
                {res.presencas} de {res.consideradas} {res.consideradas === 1 ? 'reunião' : 'reuniões'}
                {res.justificadas > 0 && ` · ${res.justificadas} justificada${res.justificadas > 1 ? 's' : ''}`}
              </span>
              <span className="text-base font-black" style={{ color: baixa ? '#dc2626' : '#16a34a' }}>{fmtPct(res.pct)}</span>
            </div>
            {baixa && <p className="text-[11px] text-red-500 mb-2">Abaixo de {FREQUENCIA_MINIMA}% de frequência.</p>}
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {res.reunioes.map(r => {
                const s = SITUACAO[r.situacao]
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 truncate">{r.titulo}</p>
                      <p className="text-[11px] text-gray-400">{fmtData(r.data)}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded flex-shrink-0" style={{ color: s.color, background: s.bg }}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
