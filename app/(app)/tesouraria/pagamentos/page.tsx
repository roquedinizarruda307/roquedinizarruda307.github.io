'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Membro } from '@/lib/supabase'
import { Plus, FileSpreadsheet, ChevronDown, X } from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANOS = [2024, 2025, 2026, 2027]

type StatusMens = 'pago' | 'isento' | 'nao_pago'
const inp = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:border-gray-400 transition-colors"

// ─── Tab: Mensalidades ────────────────────────────────────────────────────────
function TabMensalidades({ mes, ano }: { mes: number; ano: number }) {
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

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-[1fr_220px] px-6 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400">Membro</p>
        <p className="text-xs font-semibold text-gray-400">Status</p>
      </div>
      {membros.map((membro, i) => {
        const status: StatusMens = mapa[membro.id]?.status ?? 'nao_pago'
        const isSaving = saving === membro.id
        return (
          <div key={membro.id}
            className={`grid grid-cols-[1fr_220px] px-6 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < membros.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <p className="text-sm text-gray-800">{membro.nome}</p>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden w-fit">
              {([
                { s: 'pago'     as StatusMens, label: 'Pago',     bg: '#f0fdf4', color: '#16a34a' },
                { s: 'nao_pago' as StatusMens, label: 'Não pago', bg: '#fef2f2', color: '#dc2626' },
                { s: 'isento'   as StatusMens, label: 'Isento',   bg: '#eff6ff', color: '#1d4ed8' },
              ]).map(({ s, label, bg, color }) => {
                const active = status === s
                return (
                  <button key={s} onClick={() => setStatus(membro.id, s)} disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: active ? bg : '#fff', color: active ? color : '#d1d5db' }}>
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
function TabAnuidades({ ano }: { ano: number }) {
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
    const mapa: Record<string, { id?: string; status: string }> = {}
    for (const reg of r ?? []) mapa[reg.membro_id] = { id: reg.id, status: reg.status }
    setMembros(m ?? [])
    setMapa(mapa)
    setLoading(false)
  }, [ano])

  useEffect(() => { fetchDados() }, [fetchDados])

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

  const stStyle = (s: string) =>
    s === 'pago'     ? { bg: '#f0fdf4', color: '#16a34a', label: 'Pago' } :
    s === 'atrasado' ? { bg: '#fef2f2', color: '#dc2626', label: 'Atrasado' } :
                       { bg: '#fefce8', color: '#a16207', label: 'Pendente' }

  if (loading) return <div className="py-12 text-center text-sm text-gray-300">Carregando...</div>

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-[1fr_120px] px-6 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400">Membro</p>
        <p className="text-xs font-semibold text-gray-400">Status</p>
      </div>
      {membros.map((m, i) => {
        const status = mapa[m.id]?.status ?? 'pendente'
        const st = stStyle(status)
        return (
          <div key={m.id}
            className={`grid grid-cols-[1fr_120px] px-6 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < membros.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <p className="text-sm text-gray-800">{m.nome}</p>
            <button onClick={() => ciclar(m.id)} disabled={saving === m.id}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg w-fit transition-colors"
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
function TabEventos({ mes, ano }: { mes: number; ano: number }) {
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

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('pagamentos_eventos').insert([{ ...form, valor: +form.valor, status: 'pendente' }])
    setShowForm(false); setForm({ nome: '', data: `${ano}-${String(mes).padStart(2,'0')}-01`, valor: '', descricao: '' })
    fetchDados()
  }

  const stStyle = (s: string) =>
    s === 'pago'     ? { bg: '#f0fdf4', color: '#16a34a', label: 'Pago' } :
    s === 'atrasado' ? { bg: '#fef2f2', color: '#dc2626', label: 'Atrasado' } :
                       { bg: '#fefce8', color: '#a16207', label: 'Pendente' }

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
        <div className="bg-white rounded-xl border border-gray-100 p-5">
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
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-sm text-gray-300">
          Nenhum evento em {MESES_C[mes-1]}/{ano}.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
                  <span className="text-sm font-semibold text-gray-700">
                    {(+ev.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
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

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const mesLabel = MESES_C[mesSel - 1]
  const tabs = [
    { id: 'mensalidades' as const, label: 'Mensalidades' },
    { id: 'anuidades'    as const, label: 'Anuidades' },
    { id: 'eventos'      as const, label: 'Eventos' },
  ]

  return (
    <div className="p-7 max-w-6xl space-y-5">

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-400 mb-2">Pendente em {mesLabel}</p>
          <p className="text-xl font-bold" style={{ color: resumo.pendente > 0 ? '#c0392b' : '#111' }}>{fmt(resumo.pendente)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-400 mb-2">Anuidade {anoSel}</p>
          <p className="text-xl font-bold text-gray-900">{fmt(resumo.anuidade)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-400 mb-2">Mensalidades {mesLabel}</p>
          <p className="text-xl font-bold text-gray-900">{fmt(resumo.mensalidades)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-400 mb-2">Eventos {mesLabel}</p>
          <p className="text-xl font-bold text-gray-900">{fmt(resumo.eventos)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-3.5 flex items-center gap-3 flex-wrap">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {tabs.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-4 py-2 text-xs font-semibold transition-colors"
              style={tab === id ? { background: '#c0392b', color: '#fff' } : { background: 'transparent', color: '#9ca3af' }}>
              {label}
            </button>
          ))}
        </div>

        {tab !== 'anuidades' && (
          <div className="relative">
            <select value={mesSel} onChange={e => setMesSel(+e.target.value)}
              className="appearance-none border border-gray-200 rounded-lg pl-3.5 pr-7 py-2 text-sm bg-white cursor-pointer">
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        <div className="relative">
          <select value={anoSel} onChange={e => setAnoSel(+e.target.value)}
            className="appearance-none border border-gray-200 rounded-lg pl-3.5 pr-7 py-2 text-sm bg-white cursor-pointer">
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex-1" />

        <button className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3.5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
          <FileSpreadsheet size={13} className="text-emerald-500" /> Relatório
        </button>
      </div>

      {/* Conteúdo */}
      {tab === 'mensalidades' && <TabMensalidades mes={mesSel} ano={anoSel} />}
      {tab === 'anuidades'    && <TabAnuidades ano={anoSel} />}
      {tab === 'eventos'      && <TabEventos mes={mesSel} ano={anoSel} />}
    </div>
  )
}
