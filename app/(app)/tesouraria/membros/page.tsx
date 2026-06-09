'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, X, AlertCircle, UserCheck, List } from 'lucide-react'

const inp = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:border-gray-400 transition-colors"
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const VALOR = 20

type Status = 'ativo' | 'senior' | 'afastado'
const STATUS: Record<Status, { label: string; color: string }> = {
  ativo:    { label: 'Ativo',    color: '#16a34a' },
  senior:   { label: 'Sênior',  color: '#1d4ed8' },
  afastado: { label: 'Inativo', color: '#9ca3af' },
}
const CATEGORIA: Record<Status, string> = {
  ativo:    'Demolay Ativo',
  senior:   'Demolay Sênior',
  afastado: 'Demolay Inativo',
}

function ModalPendencias({ membro, onClose }: { membro: any; onClose: () => void }) {
  const [pendencias, setPendencias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('mensalidades').select('*')
      .eq('membro_id', membro.id).eq('status', 'nao_pago')
      .order('ano').order('mes')
      .then(({ data }) => { setPendencias(data ?? []); setLoading(false) })
  }, [membro.id])

  const total = pendencias.reduce((s, p) => s + +p.valor, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900 text-sm">{membro.nome}</p>
            <p className="text-xs text-gray-400 mt-0.5">Mensalidades em aberto</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-300 text-center py-4">Carregando...</p>
          ) : pendencias.length === 0 ? (
            <div className="text-center py-6">
              <UserCheck size={22} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Em dia.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendencias.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={12} className="text-red-400" />
                    <span className="text-sm text-gray-700">{MESES[p.mes - 1]} / {p.ano}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">
                    {(+p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {pendencias.length > 0 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex justify-between">
            <span className="text-sm text-gray-400">{pendencias.length} mês{pendencias.length !== 1 ? 'es' : ''}</span>
            <span className="text-sm font-bold text-red-600">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MembrosPage() {
  const [membros, setMembros] = useState<any[]>([])
  const [dividas, setDividas] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [modal, setModal] = useState<any | null>(null)
  const [form, setForm] = useState({ nome: '', matricula: '', status: 'ativo' as Status })

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    const [{ data: m }, { data: mens }] = await Promise.all([
      supabase.from('membros').select('*').order('nome'),
      supabase.from('mensalidades').select('membro_id, valor').eq('status', 'nao_pago'),
    ])
    setMembros(m ?? [])
    const d: Record<string, number> = {}
    for (const row of mens ?? []) {
      d[row.membro_id] = (d[row.membro_id] ?? 0) + +row.valor
    }
    setDividas(d)
    setLoading(false)
  }

  function abrirNovo() { setEditando(null); setForm({ nome: '', matricula: '', status: 'ativo' }); setShowForm(true) }
  function abrirEdicao(m: any) { setEditando(m); setForm({ nome: m.nome, matricula: m.matricula ?? '', status: m.status }); setShowForm(true) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (editando) {
      await supabase.from('membros').update({ nome: form.nome, matricula: form.matricula, status: form.status }).eq('id', editando.id)
    } else {
      const { data: novo } = await supabase.from('membros')
        .insert([{ nome: form.nome, matricula: form.matricula, status: form.status, data_entrada: new Date().toISOString() }])
        .select('id').single()
      if (novo?.id) {
        const ano = new Date().getFullYear(), mes = new Date().getMonth() + 1
        await supabase.from('mensalidades').insert(
          Array.from({ length: mes }, (_, i) => ({ membro_id: novo.id, mes: i + 1, ano, valor: VALOR, status: 'nao_pago' }))
        )
      }
    }
    setShowForm(false); setEditando(null)
    setForm({ nome: '', matricula: '', status: 'ativo' })
    fetchTudo()
  }

  const filtrados = membros.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (m.matricula ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="p-7 max-w-6xl space-y-5">
      {modal && <ModalPendencias membro={modal} onClose={() => setModal(null)} />}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Membros</h1>
          <p className="text-sm text-gray-400 mt-0.5">{membros.length} cadastrados</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-1.5 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
          style={{ background: '#c0392b' }}>
          <Plus size={14} /> Novo membro
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-800">{editando ? 'Editar membro' : 'Novo membro'}</p>
            <button onClick={() => { setShowForm(false); setEditando(null) }} className="text-gray-300 hover:text-gray-500">
              <X size={15} />
            </button>
          </div>
          <form onSubmit={salvar}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required placeholder="Nome completo" value={form.nome}
                onChange={e => setForm({...form, nome: e.target.value})} className={inp + ' md:col-span-2'} />
              <input placeholder="ID / Matrícula" value={form.matricula}
                onChange={e => setForm({...form, matricula: e.target.value})} className={inp} />
            </div>
            <div className="flex gap-2 mt-3">
              {(['ativo', 'senior', 'afastado'] as Status[]).map(s => (
                <button key={s} type="button" onClick={() => setForm({...form, status: s})}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={form.status === s
                    ? { borderColor: STATUS[s].color, color: STATUS[s].color, background: STATUS[s].color + '15' }
                    : { borderColor: '#e5e7eb', color: '#9ca3af', background: '#fff' }}>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
            {!editando && (
              <p className="text-xs text-gray-400 mt-2.5">
                Mensalidades de Jan a {MESES[new Date().getMonth()]} geradas automaticamente (R$ {VALOR}/mês).
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button type="submit" className="text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
                style={{ background: '#c0392b' }}>{editando ? 'Atualizar' : 'Salvar'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditando(null) }}
                className="border border-gray-200 text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input placeholder="Buscar por nome ou matrícula..." value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-300">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-300">Nenhum membro encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(m => {
            const st = STATUS[m.status as Status] ?? STATUS.ativo
            const cat = CATEGORIA[m.status as Status] ?? CATEGORIA.ativo
            const divida = dividas[m.id] ?? 0
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">

                {/* Topo: avatar + nome + status */}
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#f5f5f5' }}>
                    <span className="text-2xl font-black" style={{ color: '#c0392b' }}>
                      {m.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-gray-900 text-base leading-tight uppercase">{m.nome}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5"
                        style={{ color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{m.matricula || '—'}</p>
                  </div>
                </div>

                {/* Linha divisória */}
                <div style={{ borderTop: '1px solid #f3f3f3' }} />

                {/* Infos */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Categoria</span>
                    <span className="text-sm font-bold text-gray-900">{cat}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Dívida ativa</span>
                    <span className="text-sm font-bold" style={{ color: divida > 0 ? '#c0392b' : '#16a34a' }}>
                      {divida > 0
                        ? divida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : 'Em dia'}
                    </span>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => setModal(m)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors"
                    style={{ background: '#fff0f0', color: '#c0392b' }}>
                    <List size={13} /> Ver pendências
                  </button>
                  <button onClick={() => abrirEdicao(m)}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                    Editar
                  </button>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
