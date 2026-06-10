'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type Membro } from '@/lib/supabase'
import { Plus, FileSpreadsheet, X, ChevronDown, Ticket, Check } from 'lucide-react'

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
function TabMensalidades({ mes, ano, registrar, onMudou }: { mes: number; ano: number; registrar: (fn: () => string[][]) => void; onMudou: () => void }) {
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

    // Rede de segurança: remove entradas de mensalidades que não estão mais "pago"
    const naoPagas = (r ?? []).filter(reg => reg.status !== 'pago').map(reg => reg.id)
    if (naoPagas.length) {
      await supabase.from('transacoes').delete().in('mensalidade_id', naoPagas)
    }

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

  // Cria a entrada no caixa correspondente à mensalidade paga (evita duplicar)
  async function gerarReceita(mensalidadeId: string, membro: Membro) {
    const { data: existe } = await supabase.from('transacoes')
      .select('id').eq('mensalidade_id', mensalidadeId).limit(1)
    if (existe && existe.length) return
    const hoje = new Date().toISOString().slice(0, 10)
    await supabase.from('transacoes').insert([{
      tipo: 'entrada',
      valor: 20,
      data: hoje,
      categoria: 'Mensalidade',
      descricao: `Mensalidade ${MESES_C[mes - 1]}/${ano} — ${membro.nome}`,
      membro_id: membro.id,
      mensalidade_id: mensalidadeId,
    }])
  }

  // Remove a entrada do caixa ao desmarcar o pagamento
  async function removerReceita(mensalidadeId: string) {
    await supabase.from('transacoes').delete().eq('mensalidade_id', mensalidadeId)
  }

  async function setStatus(membroId: string, prox: StatusMens) {
    if (mapa[membroId]?.status === prox) return
    const membro = membros.find(m => m.id === membroId)!
    let id = mapa[membroId]?.id

    // Atualiza a UI na hora (otimista)
    setMapa(prev => ({ ...prev, [membroId]: { ...prev[membroId], status: prox } }))
    setSaving(membroId)

    // Salva a mensalidade (escrita crítica)
    if (id) {
      await supabase.from('mensalidades').update({ status: prox, data_pagamento: prox === 'pago' ? new Date().toISOString() : null }).eq('id', id)
    } else {
      const { data } = await supabase.from('mensalidades').insert([{
        membro_id: membroId, mes, ano, valor: 20, status: prox,
        data_pagamento: prox === 'pago' ? new Date().toISOString() : null,
      }]).select('id').single()
      if (data) { id = data.id; setMapa(prev => ({ ...prev, [membroId]: { id: data.id, status: prox } })) }
    }
    setSaving(null)   // libera o botão já — o resto roda em segundo plano

    // Caixa + resumo em segundo plano (não trava a interface)
    if (id) {
      if (prox === 'pago') gerarReceita(id, membro)
      else removerReceita(id)
    }
    onMudou()
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
function TabAnuidades({ ano, registrar, onMudou }: { ano: number; registrar: (fn: () => string[][]) => void; onMudou: () => void }) {
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
    onMudou()
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
type Participante = { id: string; evento_id: string; membro_id: string; qtd: number; pago: boolean; ingresso_retirado: boolean }

function TabEventos({ mes, ano, registrar, onMudou }: { mes: number; ano: number; registrar: (fn: () => string[][]) => void; onMudou: () => void }) {
  const [eventos, setEventos] = useState<any[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [parts, setParts] = useState<Participante[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [addSel, setAddSel] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ nome: '', data: `${ano}-${String(mes).padStart(2,'0')}-01`, valor: '', descricao: '', tipo: 'simples', qtd_ingressos: '1' })

  const fetchDados = useCallback(async () => {
    setLoading(true)
    const m = String(mes).padStart(2,'0')
    const [{ data: evs }, { data: ms }] = await Promise.all([
      supabase.from('pagamentos_eventos').select('*').gte('data', `${ano}-${m}-01`).lte('data', `${ano}-${m}-31`).order('data'),
      supabase.from('membros').select('*').order('nome'),
    ])
    const ids = (evs ?? []).map(e => e.id)
    let ps: Participante[] = []
    if (ids.length) {
      const { data: p } = await supabase.from('evento_participantes').select('*').in('evento_id', ids)
      ps = (p ?? []) as Participante[]
    }
    setEventos(evs ?? []); setMembros(ms ?? []); setParts(ps); setLoading(false)
  }, [mes, ano])

  useEffect(() => { fetchDados() }, [fetchDados])

  const valorDevido = (ev: any, p: Participante) => ev.tipo === 'ingresso' ? +ev.valor * p.qtd : +ev.valor
  const partsDe = (evId: string) => parts.filter(p => p.evento_id === evId)

  useEffect(() => {
    registrar(() => {
      const linhas: string[][] = [['Evento', 'Membro', 'Ingressos', 'Valor', 'Pago', 'Ingresso retirado']]
      for (const ev of eventos) for (const p of partsDe(ev.id)) {
        const m = membros.find(x => x.id === p.membro_id)
        linhas.push([ev.nome, m?.nome ?? '—', ev.tipo === 'ingresso' ? String(p.qtd) : '—',
          fmt(valorDevido(ev, p)), p.pago ? 'Sim' : 'Não', ev.tipo === 'ingresso' ? (p.ingresso_retirado ? 'Sim' : 'Não') : '—'])
      }
      return linhas
    })
  }, [eventos, parts, membros, registrar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('pagamentos_eventos').insert([{
      nome: form.nome, data: form.data, valor: +form.valor, descricao: form.descricao,
      status: 'pendente', tipo: form.tipo, qtd_ingressos: +form.qtd_ingressos || 1,
    }])
    setShowForm(false)
    setForm({ nome: '', data: `${ano}-${String(mes).padStart(2,'0')}-01`, valor: '', descricao: '', tipo: 'simples', qtd_ingressos: '1' })
    fetchDados()
  }

  async function addParticipante(ev: any) {
    const membroId = addSel[ev.id]
    if (!membroId) return
    await supabase.from('evento_participantes').insert([{
      evento_id: ev.id, membro_id: membroId, qtd: ev.tipo === 'ingresso' ? (ev.qtd_ingressos || 1) : 1,
    }])
    setAddSel(s => ({ ...s, [ev.id]: '' }))
    fetchDados(); onMudou()
  }

  async function togglePart(p: Participante, campo: 'pago' | 'ingresso_retirado') {
    const novo = !p[campo]
    setParts(prev => prev.map(x => x.id === p.id ? { ...x, [campo]: novo } : x))
    await supabase.from('evento_participantes').update({ [campo]: novo }).eq('id', p.id)
    if (campo === 'pago') onMudou()
  }

  async function setQtd(p: Participante, qtd: number) {
    if (qtd < 1) return
    setParts(prev => prev.map(x => x.id === p.id ? { ...x, qtd } : x))
    await supabase.from('evento_participantes').update({ qtd }).eq('id', p.id)
  }

  async function removerPart(p: Participante) {
    setParts(prev => prev.filter(x => x.id !== p.id))
    await supabase.from('evento_participantes').delete().eq('id', p.id)
    onMudou()
  }

  async function removerEvento(ev: any) {
    if (!confirm(`Excluir o evento "${ev.nome}" e seus participantes?`)) return
    await supabase.from('pagamentos_eventos').delete().eq('id', ev.id)
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
              {/* tipo */}
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className={inp}>
                <option value="simples">Valor único</option>
                <option value="ingresso">Venda de ingressos</option>
              </select>
              <input required type="number" step="0.01" placeholder={form.tipo === 'ingresso' ? 'Valor por ingresso' : 'Valor R$'} value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className={inp} />
              {form.tipo === 'ingresso'
                ? <input type="number" min="1" placeholder="Ingressos por membro" value={form.qtd_ingressos} onChange={e => setForm({...form, qtd_ingressos: e.target.value})} className={inp} />
                : <div />}
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
      ) : eventos.map(ev => {
        const ps = partsDe(ev.id)
        const totalDevido = ps.reduce((s, p) => s + valorDevido(ev, p), 0)
        const totalPago   = ps.filter(p => p.pago).reduce((s, p) => s + valorDevido(ev, p), 0)
        const pendente    = totalDevido - totalPago
        const aberto = expandido === ev.id
        const disponiveis = membros.filter(m => !ps.some(p => p.membro_id === m.id))
        return (
          <div key={ev.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Cabeçalho do evento */}
            <button onClick={() => setExpandido(aberto ? null : ev.id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                {ev.tipo === 'ingresso' && <Ticket size={16} className="text-gray-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{ev.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {ev.tipo === 'ingresso' ? ` · ${fmt(+ev.valor)}/ingresso` : ` · ${fmt(+ev.valor)}`}
                    {` · ${ps.length} participante(s)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {pendente > 0
                  ? <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{fmt(pendente)} a receber</span>
                  : ps.length > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a' }}>Quitado</span>}
                <ChevronDown size={16} className="text-gray-400 transition-transform" style={{ transform: aberto ? 'rotate(180deg)' : 'none' }} />
              </div>
            </button>

            {/* Participantes */}
            {aberto && (
              <div className="border-t border-gray-50 px-4 sm:px-6 py-4 space-y-2">
                {ps.length === 0 && <p className="text-sm text-gray-300 py-2 text-center">Nenhum participante ainda.</p>}

                {ps.map(p => {
                  const m = membros.find(x => x.id === p.membro_id)
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs" style={{ background: '#f3f4f6', color: '#6b7280' }}>{inicial(m?.nome ?? '?')}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{m?.nome ?? '—'}</p>
                          <p className="text-xs" style={{ color: p.pago ? '#16a34a' : '#dc2626' }}>
                            {p.pago ? 'Pago' : `Deve ${fmt(valorDevido(ev, p))}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* qtd ingressos */}
                        {ev.tipo === 'ingresso' && (
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <button onClick={() => setQtd(p, p.qtd - 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-50">−</button>
                            <span className="px-2 text-xs font-bold text-gray-700 min-w-[42px] text-center">{p.qtd} ing.</span>
                            <button onClick={() => setQtd(p, p.qtd + 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-50">+</button>
                          </div>
                        )}
                        {/* pago */}
                        <button onClick={() => togglePart(p, 'pago')}
                          className="text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-colors"
                          style={p.pago ? { background: '#f0fdf4', color: '#16a34a' } : { background: '#fef2f2', color: '#dc2626' }}>
                          {p.pago ? 'Pago' : 'Não pago'}
                        </button>
                        {/* ingresso retirado */}
                        {ev.tipo === 'ingresso' && (
                          <button onClick={() => togglePart(p, 'ingresso_retirado')}
                            className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-colors"
                            style={p.ingresso_retirado ? { background: '#eff6ff', color: '#1d4ed8' } : { background: '#f9fafb', color: '#9ca3af' }}>
                            {p.ingresso_retirado && <Check size={12} />} {p.ingresso_retirado ? 'Retirado' : 'Não retirado'}
                          </button>
                        )}
                        <button onClick={() => removerPart(p)} className="text-gray-300 hover:text-red-500 p-1"><X size={14} /></button>
                      </div>
                    </div>
                  )
                })}

                {/* Adicionar participante */}
                <div className="flex items-center gap-2 pt-3">
                  <div className="relative flex-1">
                    <select value={addSel[ev.id] ?? ''} onChange={e => setAddSel(s => ({ ...s, [ev.id]: e.target.value }))}
                      className="appearance-none w-full border border-gray-200 rounded-lg pl-3.5 pr-8 py-2 text-sm bg-white cursor-pointer">
                      <option value="">Adicionar membro…</option>
                      {disponiveis.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  <button onClick={() => addParticipante(ev)} disabled={!addSel[ev.id]}
                    className="flex items-center gap-1.5 text-white text-sm font-medium px-3.5 py-2 rounded-lg disabled:opacity-40" style={{ background: '#c0392b' }}>
                    <Plus size={14} /> Adicionar
                  </button>
                  <button onClick={() => removerEvento(ev)} className="text-xs text-gray-400 hover:text-red-500 px-2 whitespace-nowrap">Excluir evento</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
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

  // recálculo do resumo com debounce — coalesce cliques rápidos (evita travar)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchResumoDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { fetchResumo() }, 500)
  }, [mesSel, anoSel])

  useEffect(() => { fetchResumo() }, [mesSel, anoSel])

  async function fetchResumo() {
    const m = String(mesSel).padStart(2,'0')
    const [{ data: membros }, { data: mens }, { data: anu }, { data: evs }] = await Promise.all([
      supabase.from('membros').select('id'),
      supabase.from('mensalidades').select('membro_id, status').eq('mes', mesSel).eq('ano', anoSel),
      supabase.from('anuidades').select('membro_id, valor, status').eq('ano', anoSel),
      supabase.from('pagamentos_eventos').select('id, valor, tipo').gte('data', `${anoSel}-${m}-01`).lte('data', `${anoSel}-${m}-31`),
    ])

    const totalMembros = (membros ?? []).length

    // Mensalidades: todo membro que NÃO está pago nem isento conta como pendência (R$20)
    const pagos   = new Set((mens ?? []).filter(r => r.status === 'pago').map(r => r.membro_id))
    const isentos = new Set((mens ?? []).filter(r => r.status === 'isento').map(r => r.membro_id))
    const naoPagos = Math.max(0, totalMembros - pagos.size - isentos.size)
    const totalMens = naoPagos * 20

    // Anuidades: pendentes (não pagas)
    const totalAnu = (anu ?? []).filter(r => r.status !== 'pago').reduce((s, r) => s + +r.valor, 0)

    // Eventos: soma do que falta receber dos participantes (não pagos)
    let totalEv = 0
    const evIds = (evs ?? []).map(e => e.id)
    if (evIds.length) {
      const { data: parts } = await supabase.from('evento_participantes').select('*').in('evento_id', evIds)
      for (const p of parts ?? []) {
        if (p.pago) continue
        const ev = (evs ?? []).find(e => e.id === p.evento_id)
        if (ev) totalEv += ev.tipo === 'ingresso' ? +ev.valor * p.qtd : +ev.valor
      }
    }

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

      {/* Filtros: meses + anos na mesma linha */}
      <div className="flex flex-wrap items-center gap-2">
        {mostraMeses && MESES_C.map((m, i) => {
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

        {/* separador */}
        {mostraMeses && <div className="w-px h-6 bg-gray-200 mx-1" />}

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
      {tab === 'mensalidades' && <TabMensalidades mes={mesSel} ano={anoSel} registrar={registrar} onMudou={fetchResumoDebounced} />}
      {tab === 'anuidades'    && <TabAnuidades ano={anoSel} registrar={registrar} onMudou={fetchResumoDebounced} />}
      {tab === 'eventos'      && <TabEventos mes={mesSel} ano={anoSel} registrar={registrar} onMudou={fetchResumoDebounced} />}
    </div>
  )
}
