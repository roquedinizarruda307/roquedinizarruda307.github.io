'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Membro } from '@/lib/supabase'
import { Plus, FileSpreadsheet, X } from 'lucide-react'

const MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2]

type StatusMens = 'pago' | 'isento' | 'nao_pago'
const inp = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:border-gray-400 transition-colors"
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function inicial(nome: string) {
  return (nome?.trim()?.[0] ?? '?').toUpperCase()
}

function baixarCSV(nome: string, linhas: string[][]) {
  const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

// ─── Tab: Mensalidades ────────────────────────────────────────────────────────
function TabMensalidades({ mes, ano, registrar }: { mes: number; ano: number; registrar: (fn: () => string[][]) => void }) {
  const [membros, setMembros] = useState<Membro[]>([])
  const [mapa, setMapa] = useState<Record<string, { id?: string; status: StatusMens }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchDados = useCallback(async () => {
    setLoading(true)
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from('membros').select('*').order('nome'),
      supabase.from('mensalidades').select('*').eq('mes', mes).eq('ano', ano),
    ])
    const novoMapa: Record<string, { id?: string; status: StatusMens }> = {}
    for (const reg of r ?? []) novoMapa[reg.membro_id] = { id: reg.id, status: reg.status as StatusMens }
    setMembros(m ?? [])
    setMapa(novoMapa)
    setLoading(false)
  }, [mes, ano])

  useEffect(() => { fetchDados() }, [fetchDados])

  // disponibiliza dados pro relatório
  useEffect(() => {
    registrar(() => {
      const label = { pago: 'Pago', nao_pago: 'Não pago', isento: 'Isento' }
      const linhas: string[][] = [['Membro', 'Status', `Mensalidade ${MESES_C[mes-1]}/${ano}`]]
      for (const m of membros) {
        const st = mapa[m.id]?.status ?? 'nao_pago'
        linhas.push([m.nome, label[st], st === 'nao_pago' ? 'R$ 20,00' : '—'])
      }
      return linhas
    })
  }, [membros, mapa, mes, ano, registrar])

  async function setStatus(membroId: string, prox: StatusMens) {
    if (mapa[membroId]?.status === prox) return
    const id = mapa[membroId]?.id
    setSaving(membroId)
    setMapa(prev => ({ ...prev, [membroId]: { ...prev[membroId], status: prox } }))
    if (id) {
      await supabase.from('mensalidades').update({ status: prox, data_pagamento: prox === 'pago' ? new Date().toISOString() : null }).eq('id', id)
    } else {
      const { data } = await supabase.from('mensalidades').insert([{
        membro_id: membroId, mes, ano, valor: 20, status: prox,
        data_pagamento: prox === 'pago' ? new Date().toISOString() : null,
      }]).select('id').single()
      if (data) setMapa(prev => ({ ...prev, [membroId]: { id: data.id, status: prox } }))
    }
    setSaving(null)
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-300">Carregando...</div>
  if (membros.length === 0) return <div className="py-12 text-center text-sm text-gray-300">Nenhum membro cadastrado.</div>

  const opcoes = [
    { s: 'pago'     as StatusMens, label: 'Paga',     bg: '#f0fdf4', color: '#16a34a' },
    { s: 'nao_pago' as StatusMens, label: 'Não paga', bg: '#fef2f2', color: '#dc2626' },
    { s: 'isento'   as StatusMens, label: 'Isento',   bg: '#eff6ff', color: '#1d4ed8' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {membros.map((membro, i) => {
        const status: StatusMens = mapa[membro.id]?.status ?? 'nao_pago'
        const isSaving = saving === membro.id
        return (
          <div key={membro.id}
            className={`flex items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors ${i < membros.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{ background: '#f3f4f6', color: '#6b7280' }}>
                {inicial(membro.nome)}
              </div>
              <p className="font-bold text-gray-900 uppercase tracking-tight text-sm truncate">{membro.nome}</p>
            </div>
            <div className="flex items-center bg-gray-100 rounded-xl p-1 flex-shrink-0">
              {opcoes.map(({ s, label, bg, color }) => {
                const active = status === s
                return (
                  <button key={s} onClick={() => setStatus(membro.id, s)} disabled={isSaving}
                    className="px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide rounded-lg transition-all"
                    style={active
                      ? { background: bg, color, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                      : { background: 'transparent', color: '#9ca3af' }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Anuidades ───────────────────────────────────────────────────────────
function TabAnuidades({ ano, registrar }: { ano: number; registrar: (fn: () => string[][]) => void }) {
  const [membros, setMembros] = useState<Membro[]>([])
  const [mapa, setMapa] = useState<Record<string, { id?: string; status: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchDados = useCallback(async () => {
    setLoading(true)
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from('membros').select('*').order('nome'),
      supabase.from('anuidades').select('*').eq('ano', ano),
    ])
    const mp: Record<string, { id?: string; status: string }> = {}
    for (const reg of r ?? []) mp[reg.membro_id] = { id: reg.id, status: reg.status }
    setMembros(m ?? [])
    setMapa(mp)
    setLoading(false)
  }, [ano])

  useEffect(() => { fetchDados() }, [fetchDados])

  const stStyle = (s: string) =>
    s === 'pago'     ? { bg: '#f0fdf4', color: '#16a34a', label: 'Pago' } :
    s === 'atrasado' ? { bg: '#fef2f2', color: '#dc2626', label: 'Atrasado' } :
                       { bg: '#fefce8', color: '#a16207', label: 'Pendente' }

  useEffect(() => {
    registrar(() => {
      const linhas: string[][] = [['Membro', 'Status', `Anuidade ${ano}`]]
      for (const m of membros) {
        const st = mapa[m.id]?.status ?? 'pendente'
        linhas.push([m.nome, stStyle(st).label, st !== 'pago' ? 'R$ 120,00' : '—'])
      }
      return linhas
    })
  }, [membros, mapa, ano, registrar])

  async function ciclar(membroId: string) {
    const ciclo = ['pendente', 'pago', 'atrasado']
    const atual = mapa[membroId]?.status ?? 'pendente'
    const prox = ciclo[(ciclo.indexOf(atual) + 1) % ciclo.length]
    const id = mapa[membroId]?.id
    setSaving(membroId)
    setMapa(prev => ({ ...prev, [membroId]: { ...prev[membroId], status: prox } }))
    if (id) {
      await supabase.from('anuidades').update({ status: prox, data_pagamento: prox === 'pago' ? new Date().toISOString() : null }).eq('id', id)
    } else {
      const { data } = await supabase.from('anuidades').insert([{ membro_id: membroId, ano, valor: 120, status: prox }]).select('id').single()
      if (data) setMapa(prev => ({ ...prev, [membroId]: { id: data.id, status: prox } }))
    }
    setSaving(null)
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-300">Carregando...</div>
  if (membros.length === 0) return <div className="py-12 text-center text-sm text-gray-300">Nenhum membro cadastrado.</div>

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {membros.map((m, i) => {
        const status = mapa[m.id]?.status ?? 'pendente'
        const st = stStyle(status)
        return (
          <div key={m.id}
            className={`flex items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors ${i < membros.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{ background: '#f3f4f6', color: '#6b7280' }}>{inicial(m.nome)}</div>
              <p className="font-bold text-gray-900 uppercase tracking-tight text-sm truncate">{m.nome}</p>
            </div>
            <button onClick={() => ciclar(m.id)} disabled={saving === m.id}
              className="text-[11px] sm:text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-lg flex-shrink-0 transition-colors"
              style={{ background: st.bg, color: st.color }}>
              {saving === m.id ? '...' : st.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Eventos ─────────────────────────────────────────────────────────────
function TabEventos({ mes, ano, registrar }: { mes: number; ano: number; registrar: (fn: () => string[][]) => void }) {
  const [eventos, setEventos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', data: `${ano}-${String(mes).padStart(2,'0')}-01`, valor: '', descricao: '' })

  const fetchDados = useCallback(async () => {
    setLoading(true)
    const m = String(mes).padStart(2,'0')
    const { data } = await supabase.from('pagamentos_eventos').select('*')
      .gte('data', `${ano}-${m}-01`).lte('data', `${ano}-${m}-31`).order('data')
    setEventos(data ?? [])
    setLoading(false)
  }, [mes, ano])

  useEffect(() => { fetchDados() }, [fetchDados])

  const stStyle = (s: string) =>
    s === 'pago'     ? { bg: '#f0fdf4', color: '#16a34a', label: 'Pago' } :
    s === 'atrasado' ? { bg: '#fef2f2', color: '#dc2626', label: 'Atrasado' } :
                       { bg: '#fefce8', color: '#a16207', label: 'Pendente' }

  useEffect(() => {
    registrar(() => {
      const linhas: string[][] = [['Evento', 'Descrição', 'Valor', 'Status']]
      for (const ev of eventos) linhas.push([ev.nome, ev.descricao ?? '', fmt(+ev.valor), stStyle(ev.status).label])
      return linhas
    })
  }, [eventos, registrar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('pagamentos_eventos').insert([{ ...form, valor: +form.valor, status: 'pendente' }])
    setShowForm(false); setForm({ nome: '', data: `${ano}-${String(mes).padStart(2,'0')}-01`, valor: '', descricao: '' })
    fetchDados()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:opacity-90"
          style={{ background: '#c0392b' }}>
          <Plus size={14} /> Novo evento
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-800">Novo evento</p>
            <button onClick={() => setShowForm(false)} className="text-gray-300 hover:text-gray-500"><X size={15} /></button>
          </div>
          <form onSubmit={salvar}>
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Nome do evento" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className={inp + ' col-span-2'} />
              <input required type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className={inp} />
              <input required type="number" step="0.01" placeholder="Valor R$" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className={inp} />
              <input placeholder="Descrição" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className={inp + ' col-span-2'} />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="text-white text-sm font-medium px-4 py-2 rounded-lg" style={{ background: '#c0392b' }}>Salvar</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-300">Carregando...</div>
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-sm text-gray-300">
          Nenhum evento em {MESES_C[mes-1]}/{ano}.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {eventos.map((ev, i) => {
            const st = stStyle(ev.status)
            return (
              <div key={ev.id}
                className={`flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors ${i < eventos.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{ev.nome}</p>
                  {ev.descricao && <p className="text-xs text-gray-400 mt-0.5">{ev.descricao}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">{fmt(+ev.valor)}</span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PagamentosPage() {
  const hoje = new Date()
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1)
  const [anoSel, setAnoSel] = useState(hoje.getFullYear())
  const [tab, setTab] = useState<'mensalidades' | 'anuidades' | 'eventos'>('mensalidades')
  const [resumo, setResumo] = useState({ pendente: 0, anuidade: 0, mensalidades: 0, eventos: 0 })

  // função que gera as linhas do relatório da aba ativa
  const [gerarLinhas, setGerarLinhas] = useState<() => string[][]>(() => () => [])
  const registrar = useCallback((fn: () => string[][]) => setGerarLinhas(() => fn), [])

  useEffect(() => { fetchResumo() }, [mesSel, anoSel])

  async function fetchResumo() {
    const m = String(mesSel).padStart(2,'0')
    const [{ data: mens }, { data: anu }, { data: ev }] = await Promise.all([
      supabase.from('mensalidades').select('valor, status').eq('mes', mesSel).eq('ano', anoSel),
      supabase.from('anuidades').select('valor, status').eq('ano', anoSel),
      supabase.from('pagamentos_eventos').select('valor, status').gte('data', `${anoSel}-${m}-01`).lte('data', `${anoSel}-${m}-31`),
    ])
    const totalMens = (mens ?? []).filter(r => r.status === 'nao_pago').reduce((s, r) => s + +r.valor, 0)
    const totalAnu  = (anu  ?? []).filter(r => r.status !== 'pago').reduce((s, r) => s + +r.valor, 0)
    const totalEv   = (ev   ?? []).filter(r => r.status !== 'pago').reduce((s, r) => s + +r.valor, 0)
    setResumo({ pendente: totalMens + totalAnu + totalEv, anuidade: totalAnu, mensalidades: totalMens, eventos: totalEv })
  }

  const mesLabel = MESES_C[mesSel - 1]
  const mostraMeses = tab !== 'anuidades'
  const tabs = [
    { id: 'mensalidades' as const, label: 'Mensalidades' },
    { id: 'anuidades'    as const, label: 'Anuidades' },
    { id: 'eventos'      as const, label: 'Eventos' },
  ]

  const cards = [
    { label: `Pendente em ${mesLabel}`,    value: resumo.pendente,     destaque: true },
    { label: `Anuidade ${anoSel}`,          value: resumo.anuidade,     destaque: false },
    { label: `Mensalidades ${mesLabel}`,    value: resumo.mensalidades, destaque: false },
    { label: `Eventos ${mesLabel}`,         value: resumo.eventos,      destaque: false },
  ]

  function exportarRelatorio() {
    const linhas = gerarLinhas()
    const nome = `${tab}_${mostraMeses ? mesLabel + '_' : ''}${anoSel}.csv`
    baixarCSV(nome, linhas)
  }

  return (
    <div className="p-4 sm:p-7 max-w-6xl space-y-5">

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label}
            className="rounded-2xl border px-5 py-5 shadow-sm"
            style={c.destaque
              ? { background: '#fef2f2', borderColor: '#fde2e2' }
              : { background: '#fff', borderColor: '#f3f4f6' }}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{ color: c.destaque ? '#dc2626' : '#9ca3af' }}>{c.label}</p>
            <p className="text-2xl font-black" style={{ color: c.destaque ? '#c0392b' : '#111827' }}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Filtros: meses + anos em pills */}
      <div className="space-y-3">
        {mostraMeses && (
          <div className="flex flex-wrap gap-2">
            {MESES_C.map((m, i) => {
              const active = mesSel === i + 1
              return (
                <button key={m} onClick={() => setMesSel(i + 1)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
                  style={active
                    ? { background: '#c0392b', color: '#fff', boxShadow: '0 2px 8px rgba(192,57,43,0.3)' }
                    : { background: '#fff', color: '#9ca3af', border: '1px solid #f0f0f0' }}>
                  {m}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {ANOS.map(a => {
            const active = anoSel === a
            return (
              <button key={a} onClick={() => setAnoSel(a)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all"
                style={active
                  ? { background: '#111827', color: '#fff' }
                  : { background: '#fff', color: '#9ca3af', border: '1px solid #f0f0f0' }}>
                {a}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sub-abas segmentadas */}
      <div className="flex bg-gray-100 rounded-2xl p-1.5">
        {tabs.map(({ id, label }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all"
              style={active
                ? { background: '#fff', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { background: 'transparent', color: '#9ca3af' }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Botão Relatório */}
      <div>
        <button onClick={exportarRelatorio}
          className="flex items-center gap-2 border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
          <FileSpreadsheet size={15} className="text-emerald-500" /> Relatório
        </button>
      </div>

      {/* Conteúdo */}
      {tab === 'mensalidades' && <TabMensalidades mes={mesSel} ano={anoSel} registrar={registrar} />}
      {tab === 'anuidades'    && <TabAnuidades ano={anoSel} registrar={registrar} />}
      {tab === 'eventos'      && <TabEventos mes={mesSel} ano={anoSel} registrar={registrar} />}
    </div>
  )
}
