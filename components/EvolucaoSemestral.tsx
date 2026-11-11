'use client'

// Gráfico "Evolução semestral" (Indicadores): uma coluna por semestre, em CSS puro.
// Em cima de cada coluna: o valor e a variação em relação ao semestre anterior.
import { useEffect, useRef, useState } from 'react'
import { TrendingUp, Info } from 'lucide-react'
import { variacao, type PontoSem } from '@/lib/semestral'

export type Metrica = 'iniciacoes' | 'arrecadacao' | 'emdia'

export type SerieMetrica = {
  pontos: PontoSem[]
  /** Mensagem amigável quando não há o que mostrar (substitui o gráfico). */
  aviso?: string | null
}

const METRICAS: { id: Metrica; label: string; curto: string; descricao: string }[] = [
  { id: 'iniciacoes',  label: 'Iniciações',          curto: 'Iniciações', descricao: 'Membros iniciados em cada semestre (data de iniciação).' },
  { id: 'arrecadacao', label: 'Arrecadação',         curto: 'Arrecadação', descricao: 'Soma das entradas lançadas no caixa em cada semestre.' },
  { id: 'emdia',       label: 'Mensalidades em dia', curto: 'Em dia', descricao: 'Mensalidades pagas ou isentas sobre as devidas (sem janeiro e julho; só o que foi lançado como “não paga” é dívida).' },
]

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtBRLCurto = (v: number) => v >= 10000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : fmtBRL(v)

function fmtValor(m: Metrica, v: number | null, curto = false) {
  if (v === null) return '—'
  if (m === 'arrecadacao') return curto ? fmtBRLCurto(v) : fmtBRL(v)
  if (m === 'emdia') return `${Math.round(v * 100)}%`
  return String(v)
}

const COR_VAR: Record<string, string> = { subiu: '#15803d', caiu: '#dc2626', novo: '#1d4ed8' }

export default function EvolucaoSemestral({ series }: { series: Record<Metrica, SerieMetrica> }) {
  const [metrica, setMetrica] = useState<Metrica>('iniciacoes')
  const atual = METRICAS.find(x => x.id === metrica)!
  const { pontos, aviso } = series[metrica]
  const max = Math.max(...pontos.map(p => p.valor ?? 0), metrica === 'emdia' ? 1 : 0, 1e-9)
  const rolagem = useRef<HTMLDivElement>(null)

  // No celular, começa mostrando os semestres mais recentes (à direita)
  useEffect(() => {
    const el = rolagem.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [metrica, pontos.length])

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 sm:px-6 py-4 border-b border-gray-100">
        <TrendingUp size={15} className="text-gray-400" />
        <h2 className="text-sm font-black tracking-widest uppercase text-gray-800">Evolução semestral</h2>
      </div>
      <div className="px-4 sm:px-6 py-5">
        {/* Seletor de métrica */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100" role="tablist" aria-label="Métrica do gráfico">
          {METRICAS.map(m => {
            const ativo = m.id === metrica
            return (
              <button key={m.id} type="button" role="tab" aria-selected={ativo} onClick={() => setMetrica(m.id)}
                className="min-w-0 px-1.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-colors"
                style={ativo ? { background: '#fff', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,.08)' } : { color: '#6b7280' }}>
                <span className="sm:hidden">{m.curto}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">{atual.descricao}</p>

        {aviso || pontos.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl px-4 py-4 text-sm mt-4" style={{ background: '#f9fafb', color: '#6b7280' }}>
            <Info size={16} className="flex-shrink-0 mt-0.5 text-gray-400" />
            <div>{aviso ?? 'Ainda não há dados para este gráfico.'}</div>
          </div>
        ) : (
          <>
          {pontos.length > 6 && (
            <p className="sm:hidden text-[11px] text-gray-400 mt-2">← Arraste para ver os semestres anteriores</p>
          )}
          <div ref={rolagem} className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex items-start gap-1.5 sm:gap-2" style={{ minWidth: `${pontos.length * 58}px` }}
              role="img" aria-label={`${atual.label} por semestre: ${pontos.map(p => `${p.label} ${fmtValor(metrica, p.valor)}`).join(', ')}`}>
              {pontos.map((p, i) => {
                const v = variacao(p.valor, pontos[i - 1]?.valor, metrica === 'emdia' ? 'pontos' : 'relativa', i === 0)
                const altura = p.valor === null ? 0 : Math.max(2, (p.valor / max) * 100)
                return (
                  <div key={p.label} className="flex-1 min-w-[52px] flex flex-col items-center">
                    {/* Valor + variação */}
                    <span className="text-[11px] sm:text-xs font-black text-gray-900 leading-tight whitespace-nowrap">{fmtValor(metrica, p.valor, true)}</span>
                    <span className="text-[10px] font-bold leading-tight mb-1 whitespace-nowrap" style={{ color: COR_VAR[v.tipo] ?? '#9ca3af' }}>{v.texto}</span>
                    {/* Coluna */}
                    <div className="w-full h-36 flex items-end justify-center border-b border-gray-200">
                      <div className="w-full max-w-[40px] rounded-t-md"
                        title={`${p.label}: ${fmtValor(metrica, p.valor)}${p.parcial ? ' (parcial)' : ''}`}
                        style={{
                          height: `${altura}%`,
                          background: p.parcial
                            ? 'repeating-linear-gradient(135deg, #334155 0 6px, #94a3b8 6px 10px)'
                            : '#334155',
                          opacity: p.valor === null ? 0 : 1,
                        }} />
                    </div>
                    {/* Rótulo */}
                    <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 mt-1.5 whitespace-nowrap">{p.label}</span>
                    {p.parcial && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full mt-0.5"
                        style={{ background: '#fef3c7', color: '#92400e' }}>parcial</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          </>
        )}

        <p className="text-[11px] text-gray-400 mt-4">
          S1 = janeiro a junho; S2 = julho a dezembro. Variação em relação ao semestre anterior
          ({metrica === 'emdia' ? 'em pontos percentuais' : '“novo” quando o anterior foi zero'}); o semestre atual é parcial.
          {' '}Nota: a planilha só inclui membros atuais; semestres antigos podem estar subestimados.
        </p>
      </div>
    </section>
  )
}
