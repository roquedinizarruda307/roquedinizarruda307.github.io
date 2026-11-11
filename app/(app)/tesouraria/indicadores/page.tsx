'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Users, Cake, Info } from 'lucide-react'
import { buscarTodas, resumoAno, mensalidadesEmAberto, competenciaAtual, primeiroAnoMens, type MensP } from '@/lib/pendencias'
import { infoMaioridade, proximosSemestres, IDADE_MAIORIDADE } from '@/lib/maioridade'
import { parseDataLocal, aniversarioDe, fmtDataBR } from '@/lib/datas'

const MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pctTxt = (v: number) => `${Math.round(v * 100)}%`

type MembroI = {
  id: string; nome: string; status: string; data_entrada?: string | null
  situacao?: string | null; data_nascimento?: string | null
}

const SITUACOES = [
  { id: 'regular',   label: 'Regular',   cor: '#16a34a' },
  { id: 'irregular', label: 'Irregular', cor: '#d97706' },
  { id: 'inativo',   label: 'Inativo',   cor: '#9ca3af' },
] as const

function Card({ titulo, children, icone: Icone }: { titulo: string; children: React.ReactNode; icone: typeof Users }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 sm:px-6 py-4 border-b border-gray-100">
        <Icone size={15} className="text-gray-400" />
        <h2 className="text-sm font-black tracking-widest uppercase text-gray-800">{titulo}</h2>
      </div>
      <div className="px-4 sm:px-6 py-5">{children}</div>
    </section>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-4 text-sm" style={{ background: '#f9fafb', color: '#6b7280' }}>
      <Info size={16} className="flex-shrink-0 mt-0.5 text-gray-400" />
      <div>{children}</div>
    </div>
  )
}

export default function IndicadoresPage() {
  const [membros, setMembros] = useState<MembroI[]>([])
  const [mens, setMens] = useState<MensP[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [ate] = useState(competenciaAtual)   // estável entre renderizações
  const [ano, setAno] = useState(ate.ano)

  useEffect(() => {
    // select('*'): situacao/data_nascimento vêm automaticamente quando a migração existir
    Promise.all([
      buscarTodas<MembroI>('membros', '*'),
      buscarTodas<MensP>('mensalidades', 'id, membro_id, mes, ano, valor, status'),
    ]).then(([m, ms]) => { setMembros(m); setMens(ms) })
      .catch(e => setErro(e?.message ?? 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [])

  const anos = useMemo(() => {
    const ini = primeiroAnoMens(mens, ate)
    return Array.from({ length: ate.ano - ini + 1 }, (_, i) => ini + i)
  }, [mens, ate])

  // ── 1. Mensalidades
  const meses = useMemo(() => resumoAno(membros, mens, ano, ate), [membros, mens, ano, ate])
  const emAberto = useMemo(() => mensalidadesEmAberto(mens), [mens])
  const abertoAno = meses.reduce((s, m) => s + m.valorAberto, 0)
  const somaTotal = meses.reduce((s, m) => s + m.total, 0)
  const somaOk = meses.reduce((s, m) => s + m.pagos + m.isentos, 0)
  const ativos = membros.filter(m => m.status === 'ativo').length

  // ── 2. Situação
  const comSituacao = membros.filter(m => SITUACOES.some(s => s.id === (m.situacao ?? '').toLowerCase()))
  const contSit = SITUACOES.map(s => ({ ...s, n: comSituacao.filter(m => (m.situacao ?? '').toLowerCase() === s.id).length }))
  const semSituacao = membros.length - comSituacao.length

  // ── 3. Maioridade
  const semestres = proximosSemestres(4)
  const ativosComNasc = membros.filter(m => m.status === 'ativo' && parseDataLocal(m.data_nascimento))
  const ativosSemNasc = ativos - ativosComNasc.length
  const pendentesTransf = ativosComNasc.filter(m => {
    const i = infoMaioridade(m)
    return i?.estado === 'completou' && i.data < semestres[0].inicio
  })
  const porSemestre = semestres.map(s => ({
    ...s,
    membros: ativosComNasc
      .map(m => ({ m, data: aniversarioDe(parseDataLocal(m.data_nascimento)!, IDADE_MAIORIDADE) }))
      .filter(x => x.data >= s.inicio && x.data <= s.fim)
      .sort((a, b) => +a.data - +b.data),
  }))
  const totalSaidas = pendentesTransf.length + porSemestre.reduce((s, x) => s + x.membros.length, 0)
  const maxSem = Math.max(1, ...porSemestre.map(s => s.membros.length))

  if (loading) return <div className="p-7 text-sm text-gray-300">Carregando...</div>

  return (
    <div className="p-4 sm:p-7 max-w-6xl space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Indicadores</h1>
        <p className="text-sm text-gray-400 mt-0.5">Mensalidades, situação dos membros e saídas por maioridade</p>
      </div>

      {erro && <Vazio>Não foi possível carregar os dados: {erro}</Vazio>}

      {/* ── 1. Mensalidades ───────────────────────────────────────────── */}
      <Card titulo="Mensalidades pagas por mês" icone={AlertCircle}>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl px-4 py-3.5" style={{ background: '#fef2f2' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#dc2626' }}>Total em aberto</p>
            <p className="text-xl sm:text-2xl font-black mt-1" style={{ color: '#c0392b' }}>{fmt(emAberto.total)}</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#b91c1c' }}>{emAberto.itens.length} mensalidade{emAberto.itens.length !== 1 ? 's' : ''} lançada{emAberto.itens.length !== 1 ? 's' : ''} como não paga{emAberto.itens.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl px-4 py-3.5" style={{ background: '#f0fdf4' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#16a34a' }}>Em dia em {ano}</p>
            <p className="text-xl sm:text-2xl font-black mt-1" style={{ color: '#15803d' }}>{somaTotal ? pctTxt(somaOk / somaTotal) : '—'}</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#15803d' }}>Em aberto no ano: {fmt(abertoAno)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="text-xs text-gray-400">% pagas + isentas sobre os membros do mês</p>
          {anos.length > 1 && (
            <select value={ano} onChange={e => setAno(+e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white">
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        {meses.length === 0 || somaTotal === 0 ? (
          <Vazio>Sem mensalidades devidas em {ano}.</Vazio>
        ) : (
          <>
            {/* Gráfico de barras (CSS) */}
            <div className="flex items-end gap-1 sm:gap-2 h-44 border-b border-gray-200" role="img"
              aria-label={`Percentual de mensalidades em dia por mês em ${ano}`}>
              {meses.map(m => {
                const cor = m.pct >= 0.8 ? '#16a34a' : m.pct >= 0.5 ? '#d97706' : '#dc2626'
                return (
                  <div key={m.mes} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] sm:text-[11px] font-bold text-gray-700 mb-1">{pctTxt(m.pct)}</span>
                    <div className="w-full max-w-[36px] rounded-t-md" title={`${MESES_C[m.mes - 1]}: ${pctTxt(m.pct)} · ${fmt(m.valorAberto)} em aberto`}
                      style={{ height: `${Math.max(2, m.pct * 100)}%`, background: cor }} />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-1 sm:gap-2 mt-1.5">
              {meses.map(m => (
                <span key={m.mes} className="flex-1 min-w-0 text-center text-[9px] sm:text-[11px] font-semibold text-gray-400">{MESES_C[m.mes - 1]}</span>
              ))}
            </div>

            {/* Tabela */}
            <div className="mt-5 divide-y divide-gray-50 text-sm">
              <div className="grid grid-cols-[3rem_1fr_auto] gap-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span>Mês</span><span>Em dia</span><span className="text-right">Em aberto</span>
              </div>
              {meses.map(m => (
                <div key={m.mes} className="grid grid-cols-[3rem_1fr_auto] gap-2 py-2 items-center">
                  <span className="font-semibold text-gray-700">{MESES_C[m.mes - 1]}</span>
                  <span className="text-gray-500 text-xs">
                    <b className="text-gray-800">{pctTxt(m.pct)}</b> · {m.pagos} pagas, {m.isentos} isentas de {m.total}{m.semLancamento > 0 ? ` · ${m.semLancamento} sem lançamento` : ''}
                  </span>
                  <span className="text-right font-bold" style={{ color: m.valorAberto > 0 ? '#c0392b' : '#16a34a' }}>
                    {m.valorAberto > 0 ? fmt(m.valorAberto) : 'Em dia'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="text-[11px] text-gray-400 mt-4">
          Critério (o mesmo da aba Pendências): em aberto é só a mensalidade lançada como “Não paga”. Janeiro e julho não têm mensalidade.
          Mês sem lançamento não é dívida (aparece como “sem lançamento”). Entram no mês os membros Ativos ({ativos} hoje) que já tinham entrado,
          e qualquer membro que tenha lançamento naquele mês. Meses futuros não entram.
        </p>
      </Card>

      {/* ── 2. Situação ───────────────────────────────────────────────── */}
      <Card titulo="Situação dos membros" icone={Users}>
        {comSituacao.length === 0 ? (
          <Vazio>
            Ainda não há situação (Regular / Irregular / Inativo) cadastrada para os membros.
            Assim que os dados forem importados, o gráfico aparece aqui.
          </Vazio>
        ) : (
          <>
            <div className="flex h-8 w-full rounded-lg overflow-hidden" role="img"
              aria-label={contSit.map(s => `${s.label}: ${s.n}`).join(', ')}>
              {contSit.filter(s => s.n > 0).map(s => (
                <div key={s.id} style={{ width: `${(s.n / comSituacao.length) * 100}%`, background: s.cor }}
                  className="flex items-center justify-center text-[11px] font-bold text-white" title={`${s.label}: ${s.n}`}>
                  {s.n / comSituacao.length >= 0.1 ? pctTxt(s.n / comSituacao.length) : ''}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {contSit.map(s => (
                <div key={s.id} className="rounded-xl px-3 py-2.5" style={{ background: '#f9fafb' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.cor }} />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{s.label}</span>
                  </div>
                  <p className="text-lg font-black text-gray-900 mt-1">{s.n}
                    <span className="text-xs font-semibold text-gray-400 ml-1">{pctTxt(s.n / comSituacao.length)}</span>
                  </p>
                </div>
              ))}
            </div>
            {semSituacao > 0 && (
              <p className="text-[11px] text-gray-400 mt-3">{semSituacao} membro{semSituacao !== 1 ? 's' : ''} sem situação cadastrada (fora do gráfico).</p>
            )}
          </>
        )}
      </Card>

      {/* ── 3. Maioridade ─────────────────────────────────────────────── */}
      <Card titulo={`Saída por maioridade (${IDADE_MAIORIDADE} anos)`} icone={Cake}>
        {ativosComNasc.length === 0 ? (
          <Vazio>
            Ainda não há datas de nascimento cadastradas para os membros ativos.
            Assim que os dados forem importados, a previsão por semestre aparece aqui.
          </Vazio>
        ) : (
          <>
            <div className="rounded-xl px-4 py-3.5 mb-5" style={{ background: totalSaidas ? '#fff7ed' : '#f0fdf4' }}>
              <p className="text-sm font-bold" style={{ color: totalSaidas ? '#9a3412' : '#15803d' }}>
                {totalSaidas === 0
                  ? 'Nenhum ativo completa 21 anos nos próximos 4 semestres.'
                  : `São necessárias ${totalSaidas} iniciaç${totalSaidas !== 1 ? 'ões' : 'ão'} para manter o tamanho do capítulo (${ativos} ativos) até ${fmtDataBR(semestres[semestres.length - 1].fim)}.`}
              </p>
              {pendentesTransf.length > 0 && (
                <p className="text-xs mt-1" style={{ color: '#9a3412' }}>
                  Inclui {pendentesTransf.length} que já completaram 21 anos antes deste semestre e ainda estão como ativos.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {porSemestre.map(s => (
                <div key={s.label}>
                  <div className="flex items-center gap-3">
                    <span className="w-24 flex-shrink-0 text-xs font-semibold text-gray-600">{s.label}</span>
                    <div className="flex-1 h-6 rounded-md bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${(s.membros.length / maxSem) * 100}%`, background: '#c0392b' }} />
                    </div>
                    <span className="w-8 text-right text-sm font-black text-gray-900">{s.membros.length}</span>
                  </div>
                  {s.membros.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1 ml-0 sm:ml-[108px]">
                      {s.membros.map(x => `${x.m.nome} (${fmtDataBR(x.data)})`).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {ativosSemNasc > 0 && (
              <p className="text-[11px] text-gray-400 mt-4">{ativosSemNasc} ativo{ativosSemNasc !== 1 ? 's' : ''} sem data de nascimento (não contado{ativosSemNasc !== 1 ? 's' : ''}).</p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
