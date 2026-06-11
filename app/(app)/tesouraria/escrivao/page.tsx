'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type Membro } from '@/lib/supabase'
import { Plus, Trash2, Check, FileSpreadsheet } from 'lucide-react'
import { exportarExcel } from '@/lib/excel'

type Reuniao = { id: string; data: string; titulo: string; ata: string }

const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export default function EscrivaoPage() {
  const [reunioes, setReunioes] = useState<Reuniao[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [sel, setSel] = useState<Reuniao | null>(null)
  const [presencas, setPresencas] = useState<Record<string, boolean>>({})
  const [ata, setAta] = useState('')
  const [salvandoAta, setSalvandoAta] = useState(false)
  const [ataSalva, setAtaSalva] = useState(false)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from('reunioes').select('*').order('data', { ascending: false }),
      supabase.from('membros').select('*').order('nome'),
    ])
    setReunioes((r ?? []) as Reuniao[])
    setMembros([...(m ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })))
    setLoading(false)
    return (r ?? []) as Reuniao[]
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function selecionar(r: Reuniao) {
    setSel(r); setAta(r.ata ?? ''); setAtaSalva(false)
    const { data } = await supabase.from('reuniao_presencas').select('membro_id, presente').eq('reuniao_id', r.id)
    const mapa: Record<string, boolean> = {}
    for (const p of data ?? []) mapa[p.membro_id] = p.presente
    setPresencas(mapa)
  }

  async function novaReuniao() {
    const hoje = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('reunioes').insert([{ data: hoje, titulo: 'Reunião', ata: '' }]).select('*').single()
    if (data) { await carregar(); selecionar(data as Reuniao) }
  }

  async function excluirReuniao(r: Reuniao) {
    if (!confirm(`Excluir a reunião de ${fmtData(r.data)}?`)) return
    await supabase.from('reunioes').delete().eq('id', r.id)
    if (sel?.id === r.id) setSel(null)
    carregar()
  }

  async function togglePresenca(membroId: string) {
    if (!sel) return
    const novo = !presencas[membroId]
    setPresencas(prev => ({ ...prev, [membroId]: novo }))
    await supabase.from('reuniao_presencas')
      .upsert({ reuniao_id: sel.id, membro_id: membroId, presente: novo }, { onConflict: 'reuniao_id,membro_id' })
  }

  async function salvarAta() {
    if (!sel) return
    setSalvandoAta(true)
    await supabase.from('reunioes').update({ ata }).eq('id', sel.id)
    setReunioes(prev => prev.map(r => r.id === sel.id ? { ...r, ata } : r))
    setSel(prev => prev ? { ...prev, ata } : prev)
    setSalvandoAta(false); setAtaSalva(true)
    setTimeout(() => setAtaSalva(false), 2500)
  }

  async function atualizarCampo(campo: 'data' | 'titulo', valor: string) {
    if (!sel) return
    setSel({ ...sel, [campo]: valor })
    setReunioes(prev => prev.map(r => r.id === sel.id ? { ...r, [campo]: valor } : r))
    await supabase.from('reunioes').update({ [campo]: valor }).eq('id', sel.id)
  }

  function exportarPresenca() {
    if (!sel) return
    const linhas: (string | number)[][] = [[`Reunião ${sel.titulo} — ${fmtData(sel.data)}`], [], ['Membro', 'Presença']]
    for (const m of membros) linhas.push([m.nome, presencas[m.id] ? 'Presente' : 'Ausente'])
    linhas.push([]); linhas.push(['Total presentes', presentes])
    exportarExcel(`presenca_${sel.data}.xlsx`, linhas, 'Presença')
  }

  const presentes = membros.filter(m => presencas[m.id]).length

  return (
    <div className="p-4 sm:p-7 max-w-6xl">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#c0392b' }}>Escrivão</p>
        <h1 className="text-2xl font-black text-gray-900">Reuniões — Presença e Ata</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Lista de reuniões */}
        <div className="space-y-3">
          <button onClick={novaReuniao}
            className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-2.5 rounded-xl"
            style={{ background: '#c0392b' }}>
            <Plus size={16} /> Nova reunião
          </button>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-300">Carregando...</div>
            ) : reunioes.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-gray-300">Nenhuma reunião ainda.</div>
            ) : reunioes.map((r, i) => (
              <button key={r.id} onClick={() => selecionar(r)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${i < reunioes.length-1 ? 'border-b border-gray-50' : ''}`}
                style={sel?.id === r.id ? { background: '#fef2f2' } : {}}>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{r.titulo}</p>
                  <p className="text-xs text-gray-400">{fmtData(r.data)}</p>
                </div>
                <Trash2 size={14} className="text-gray-300 hover:text-red-500 flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); excluirReuniao(r) }} />
              </button>
            ))}
          </div>
        </div>

        {/* Detalhe da reunião */}
        {!sel ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center py-24 text-sm text-gray-300">
            Selecione ou crie uma reunião.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Cabeçalho editável */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título</label>
                <input value={sel.titulo} onChange={e => atualizarCampo('titulo', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Data</label>
                <input type="date" value={sel.data} onChange={e => atualizarCampo('data', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Presença */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-black uppercase tracking-widest text-gray-700">Presença</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                    {presentes}/{membros.length} presentes
                  </span>
                  <button onClick={exportarPresenca} className="text-gray-400 hover:text-emerald-600" title="Exportar Excel">
                    <FileSpreadsheet size={16} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {membros.map(m => {
                  const presente = !!presencas[m.id]
                  return (
                    <div key={m.id} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-sm font-medium text-gray-800">{m.nome}</span>
                      <button onClick={() => togglePresenca(m.id)}
                        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-colors"
                        style={presente ? { background: '#f0fdf4', color: '#16a34a' } : { background: '#fef2f2', color: '#dc2626' }}>
                        {presente && <Check size={12} />} {presente ? 'Presente' : 'Ausente'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ata */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black uppercase tracking-widest text-gray-700">Ata da reunião</p>
                <button onClick={salvarAta} disabled={salvandoAta}
                  className="flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                  style={{ background: ataSalva ? '#16a34a' : '#c0392b' }}>
                  {ataSalva ? <><Check size={14} /> Salva</> : salvandoAta ? 'Salvando...' : 'Salvar ata'}
                </button>
              </div>
              <textarea value={ata} onChange={e => { setAta(e.target.value); setAtaSalva(false) }}
                placeholder="Escreva aqui a ata da reunião — pauta, decisões, deliberações, encaminhamentos…"
                rows={14}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:border-gray-400 outline-none" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
