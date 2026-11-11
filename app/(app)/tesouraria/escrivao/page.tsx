'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, type Membro } from '@/lib/supabase'
import { Plus, Trash2, Check, FileSpreadsheet, FileText } from 'lucide-react'
import { exportarExcel } from '@/lib/excel'
import { exportarWord, escaparHtml } from '@/lib/word'
import { aparecaNaReuniao } from '@/lib/escrivao'
import { hojeLocal, fmtDataBR, parseDataLocal } from '@/lib/datas'
import FrequenciaSemestre from '@/components/FrequenciaSemestre'

type Reuniao = { id: string; data: string; titulo: string; ata: string }

// nunca mostra "Invalid Date": data vazia/inválida vira '—'
const fmtData = (d: string) => fmtDataBR(d)
const DEBOUNCE_MS = 800

export default function EscrivaoPage() {
  const [reunioes, setReunioes] = useState<Reuniao[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [sel, setSel] = useState<Reuniao | null>(null)
  const [presencas, setPresencas] = useState<Record<string, boolean>>({})
  const [ata, setAta] = useState('')
  const [salvandoAta, setSalvandoAta] = useState(false)
  const [ataSalva, setAtaSalva] = useState(false)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'reunioes' | 'frequencia'>('reunioes')
  // gravação adiada de título/data (evita gravar a cada tecla)
  const pendente = useRef<{ id: string; campos: Partial<Pick<Reuniao, 'data' | 'titulo'>> } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // último valor válido salvo de cada reunião (para restaurar data vazia/inválida)
  const salvo = useRef<Record<string, { data: string; titulo: string }>>({})

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
    await gravarPendente()
    setSel(r); setAta(r.ata ?? ''); setAtaSalva(false)
    const { data } = await supabase.from('reuniao_presencas').select('membro_id, presente').eq('reuniao_id', r.id)
    const mapa: Record<string, boolean> = {}
    for (const p of data ?? []) mapa[p.membro_id] = p.presente
    setPresencas(mapa)
  }

  async function novaReuniao() {
    await gravarPendente()
    const hoje = hojeLocal()
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

  // grava o que estiver pendente agora (blur, troca de reunião, saída da tela)
  async function gravarPendente() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const p = pendente.current
    pendente.current = null
    if (!p || !Object.keys(p.campos).length) return
    const { error } = await supabase.from('reunioes').update(p.campos).eq('id', p.id)
    if (!error) salvo.current[p.id] = { ...(salvo.current[p.id] ?? { data: '', titulo: '' }), ...p.campos }
  }

  function atualizarCampo(campo: 'data' | 'titulo', valor: string) {
    if (!sel) return
    if (!salvo.current[sel.id]) salvo.current[sel.id] = { data: sel.data, titulo: sel.titulo }
    // mostra na tela na hora
    setSel({ ...sel, [campo]: valor })
    setReunioes(prev => prev.map(r => r.id === sel.id ? { ...r, [campo]: valor } : r))
    // data vazia ou inválida não é gravada (a anterior volta no blur)
    const valido = campo === 'data' ? !!parseDataLocal(valor) : true
    const atual = pendente.current?.id === sel.id ? pendente.current.campos : {}
    const campos = { ...atual }
    if (valido) campos[campo] = valor
    else delete campos[campo]
    pendente.current = { id: sel.id, campos }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { gravarPendente() }, DEBOUNCE_MS)
  }

  // ao sair do campo: grava já; se a data ficou vazia/inválida, restaura a última válida
  function aoSairDoCampo(campo: 'data' | 'titulo') {
    if (!sel) return
    if (campo === 'data' && !parseDataLocal(sel.data)) {
      const anterior = salvo.current[sel.id]?.data
      if (anterior) {
        setSel({ ...sel, data: anterior })
        setReunioes(prev => prev.map(r => r.id === sel.id ? { ...r, data: anterior } : r))
      }
    }
    gravarPendente()
  }

  // grava o pendente se a pessoa sair da tela antes do debounce
  useEffect(() => () => { gravarPendente() }, [])

  function exportarPresenca() {
    if (!sel) return
    const linhas: (string | number)[][] = [[`Reunião ${sel.titulo} — ${fmtData(sel.data)}`], [], ['Membro', 'Presença']]
    for (const m of chamada) linhas.push([m.nome, presencas[m.id] ? 'Presente' : 'Ausente'])
    linhas.push([]); linhas.push(['Total presentes', presentes])
    exportarExcel(`presenca_${sel.data}.xlsx`, linhas, 'Presença')
  }

  function exportarAtaWord() {
    if (!sel) return
    const presentesNomes = chamada.filter(m => presencas[m.id]).map(m => m.nome)
    const ausentesNomes = chamada.filter(m => !presencas[m.id]).map(m => m.nome)
    const corpo =
      `<h2 style="text-align:center;margin:0 0 4px">Capítulo Roque Diniz Arruda nº 307</h2>` +
      `<p style="text-align:center;color:#666;margin:0 0 18px">Ordem DeMolay</p>` +
      `<h3 style="margin:0">${escaparHtml(sel.titulo)}</h3>` +
      `<p style="color:#666;margin:2px 0 16px">Data: ${fmtData(sel.data)}</p>` +
      `<p><b>Presentes (${presentesNomes.length}):</b> ${presentesNomes.length ? escaparHtml(presentesNomes.join(', ')) : '—'}</p>` +
      `<p><b>Ausentes (${ausentesNomes.length}):</b> ${ausentesNomes.length ? escaparHtml(ausentesNomes.join(', ')) : '—'}</p>` +
      `<hr/>` +
      `<h3>Ata</h3>` +
      `<div>${ata ? escaparHtml(ata).replace(/\n/g, '<br/>') : '—'}</div>`
    exportarWord(`ata_${sel.data}`, `Ata ${fmtData(sel.data)}`, corpo)
  }

  // Chamada (regra única aparecaNaReuniao): quem já tem presença gravada nesta reunião (atas antigas
  // ficam completas) + 'ativo' que já tinha entrado até a data da reunião
  const chamada = sel ? membros.filter(m => aparecaNaReuniao(m, m.id in presencas, sel.data)) : []
  const presentes = chamada.filter(m => presencas[m.id]).length

  return (
    <div className="p-4 sm:p-7 max-w-6xl">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#c0392b' }}>Escrivão</p>
        <h1 className="text-2xl font-black text-gray-900">{aba === 'reunioes' ? 'Reuniões — Presença e Ata' : 'Frequência no semestre'}</h1>
      </div>

      <div className="flex bg-gray-100 rounded-2xl p-1.5 mb-5 max-w-sm">
        {([['reunioes', 'Reuniões'], ['frequencia', 'Frequência']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            className="flex-1 py-3 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
            style={aba === id ? { background: '#fff', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#9ca3af' }}>
            {label}
          </button>
        ))}
      </div>

      {aba === 'frequencia' ? <FrequenciaSemestre /> : (
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
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${i < reunioes.length-1 ? 'border-b border-gray-50' : ''}`}
                style={sel?.id === r.id ? { background: '#fef2f2' } : {}}>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 max-sm:leading-snug break-words sm:truncate">{r.titulo}</p>
                  <p className="text-xs text-gray-400">{fmtData(r.data)}</p>
                </div>
                <span role="button" aria-label="Excluir reunião" title="Excluir reunião"
                  className="p-3 -my-2 -mr-3 sm:p-0 sm:my-0 sm:mr-0 flex-shrink-0 text-gray-300 hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); excluirReuniao(r) }}>
                  <Trash2 size={14} />
                </span>
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Título</label>
                <input value={sel.titulo} onChange={e => atualizarCampo('titulo', e.target.value)} onBlur={() => aoSairDoCampo('titulo')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Data</label>
                <input type="date" value={sel.data ?? ''} onChange={e => atualizarCampo('data', e.target.value)} onBlur={() => aoSairDoCampo('data')}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Presença */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-black uppercase tracking-widest text-gray-700">Presença</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                    {presentes}/{chamada.length} presentes
                  </span>
                  <button onClick={exportarPresenca} className="p-2.5 -m-2.5 sm:p-0 sm:m-0 text-gray-400 hover:text-emerald-600" title="Exportar Excel">
                    <FileSpreadsheet size={16} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {chamada.map(m => {
                  const presente = !!presencas[m.id]
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5">
                      <span className="text-sm font-medium text-gray-800 max-sm:leading-snug min-w-0 break-words">{m.nome}</span>
                      <button onClick={() => togglePresenca(m.id)}
                        className="flex items-center justify-center gap-1.5 flex-shrink-0 min-w-[104px] sm:min-w-0 min-h-[40px] sm:min-h-0 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-colors"
                        style={presente ? { background: '#f0fdf4', color: '#16a34a' } : { background: '#fef2f2', color: '#dc2626' }}>
                        {presente && <Check size={12} />} {presente ? 'Presente' : 'Ausente'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ata */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <p className="text-sm font-black uppercase tracking-widest text-gray-700">Ata da reunião</p>
                <div className="flex items-center gap-2">
                  <button onClick={exportarAtaWord}
                    className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-lg hover:bg-gray-50">
                    <FileText size={14} className="text-blue-600" /> Exportar Word
                  </button>
                  <button onClick={salvarAta} disabled={salvandoAta}
                    className="flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                    style={{ background: ataSalva ? '#16a34a' : '#c0392b' }}>
                    {ataSalva ? <><Check size={14} /> Salva</> : salvandoAta ? 'Salvando...' : 'Salvar ata'}
                  </button>
                </div>
              </div>
              <textarea value={ata} onChange={e => { setAta(e.target.value); setAtaSalva(false) }}
                placeholder="Escreva aqui a ata da reunião — pauta, decisões, deliberações, encaminhamentos…"
                rows={14}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:border-gray-400 outline-none" />
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
