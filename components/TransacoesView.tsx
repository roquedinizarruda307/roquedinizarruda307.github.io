'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, FileSpreadsheet, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { exportarExcel } from '@/lib/excel'
import { liquidoEntrada, brutoEntrada, comTaxaSaida, semTaxaSaida } from '@/lib/taxas'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const CATS = ['Mensalidade','Anuidade','Evento','Doação','Material','Alimentação','Transporte','Outro']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const inp = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:border-gray-400 transition-colors"

export default function TransacoesView({ tipo }: { tipo: 'entrada' | 'saida' }) {
  const now  = new Date()
  const [mes, setMes]       = useState(now.getMonth() + 1)
  const [ano, setAno]       = useState(now.getFullYear())
  const [cat, setCat]       = useState('')
  const [rows, setRows]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ descricao: '', origem_destino: '', categoria: '', valor: '', data: now.toISOString().split('T')[0] })
  const anos = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const isE  = tipo === 'entrada'
  const cor  = isE ? '#16a34a' : '#c0392b'

  useEffect(() => { load() }, [mes, ano, cat])

  async function load() {
    setLoading(true)
    const m  = String(mes).padStart(2,'0')
    const pm = mes === 12 ? 1 : mes + 1
    const pa = mes === 12 ? ano + 1 : ano
    const pm2 = String(pm).padStart(2,'0')
    let q = supabase.from('transacoes').select('*').eq('tipo', tipo)
      .gte('data', `${ano}-${m}-01`).lt('data', `${pa}-${pm2}-01`)
      .order('data', { ascending: false })
    if (cat) q = q.eq('categoria', cat)
    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ descricao: '', origem_destino: '', categoria: '', valor: '', data: now.toISOString().split('T')[0] })
    setEditId(null)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      tipo, descricao: form.descricao, origem_destino: form.origem_destino,
      // valor_bruto: o que aparece nas listas · valor: o que conta no saldo
      // (taxa de 0,89%, máx. R$ 8,50 — descontada na entrada, somada na saída)
      categoria: form.categoria || null, data: form.data,
      valor: isE ? liquidoEntrada(+form.valor) : comTaxaSaida(+form.valor),
      valor_bruto: +form.valor,
    }
    if (editId) {
      await supabase.from('transacoes').update(payload).eq('id', editId)
    } else {
      await supabase.from('transacoes').insert([payload])
    }
    resetForm()
    setShowForm(false)
    load()
  }

  function editar(r: any) {
    setEditId(r.id)
    setForm({
      descricao: r.descricao ?? '', origem_destino: r.origem_destino ?? '',
      // o formulário mostra o valor sem a taxa (ela é reaplicada ao salvar)
      categoria: r.categoria ?? '', valor: r.valor == null ? '' : (+(r.valor_bruto ?? (isE ? brutoEntrada(+r.valor) : semTaxaSaida(+r.valor)))).toFixed(2),
      data: (r.data ?? now.toISOString().split('T')[0]).slice(0, 10),
    })
    setShowForm(true)
  }

  async function excluir(r: any) {
    if (!confirm(`Excluir "${r.descricao}" (${fmt(+(r.valor_bruto ?? r.valor))})?`)) return
    await supabase.from('transacoes').delete().eq('id', r.id)
    if (editId === r.id) { resetForm(); setShowForm(false) }
    load()
  }

  // nas listas mostramos o valor bruto; a taxa só aparece descontada no saldo
  const bruto = (r: any) => +(r.valor_bruto ?? r.valor)
  const subtotal = rows.reduce((s, r) => s + bruto(r), 0)

  function exportar() {
    const linhas: (string | number)[][] = [['Data', 'Descrição', isE ? 'Origem' : 'Destino', 'Categoria', 'Valor']]
    for (const r of rows) {
      linhas.push([
        new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR'),
        r.descricao ?? '', r.origem_destino ?? '', r.categoria ?? '', bruto(r),
      ])
    }
    linhas.push(['', '', '', 'TOTAL', subtotal])
    exportarExcel(`${isE ? 'entradas' : 'saidas'}_${MESES[mes-1]}_${ano}.xlsx`, linhas, isE ? 'Entradas' : 'Saídas')
  }

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          <div className="relative">
            <select value={mes} onChange={e => setMes(+e.target.value)}
              className="appearance-none pl-4 pr-7 py-2 text-sm font-medium bg-transparent cursor-pointer border-r border-gray-200">
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={ano} onChange={e => setAno(+e.target.value)}
              className="appearance-none pl-4 pr-7 py-2 text-sm font-medium bg-transparent cursor-pointer">
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="relative">
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="appearance-none border border-gray-200 rounded-lg pl-3.5 pr-7 py-2 text-sm bg-white cursor-pointer text-gray-600">
            <option value="">Todas as categorias</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex-1" />

        <div className="text-right mr-2">
          <p className="text-xs text-gray-400 mb-0.5">Subtotal</p>
          <p className="text-base font-bold" style={{ color: cor }}>{fmt(subtotal)}</p>
        </div>

        <button onClick={exportar} disabled={rows.length === 0}
          className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40">
          <FileSpreadsheet size={14} style={{ color: cor }} /> Exportar Excel
        </button>

        <button onClick={() => { if (showForm) { resetForm(); setShowForm(false) } else { resetForm(); setShowForm(true) } }}
          className="flex items-center gap-1.5 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: cor }}>
          <Plus size={14} /> Nova {isE ? 'entrada' : 'saída'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-800">
              {editId ? 'Editar ' : (isE ? 'Nova entrada' : 'Nova saída')}{editId ? (isE ? 'entrada' : 'saída') : ''}
            </p>
            <button onClick={() => { resetForm(); setShowForm(false) }} className="text-gray-300 hover:text-gray-500"><X size={15} /></button>
          </div>
          <form onSubmit={salvar}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required placeholder="Descrição" value={form.descricao}
                onChange={e => setForm({...form, descricao: e.target.value})} className={inp + ' md:col-span-2'} />
              <input placeholder={isE ? 'Origem' : 'Destino'} value={form.origem_destino}
                onChange={e => setForm({...form, origem_destino: e.target.value})} className={inp} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div className="relative">
                <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                  className={inp + ' appearance-none pr-8'}>
                  <option value="">Categoria</option>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <input required type="number" step="0.01" placeholder="Valor (R$)" value={form.valor}
                onChange={e => setForm({...form, valor: e.target.value})} className={inp} />
              <input required type="date" value={form.data}
                onChange={e => setForm({...form, data: e.target.value})} className={inp} />
            </div>
            {!isE && +form.valor > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                Taxa (0,89%, máx. R$ 8,50): <b style={{ color: cor }}>+{fmt(comTaxaSaida(+form.valor) - +form.valor)}</b>
                {' '}· sai do saldo: <b style={{ color: cor }}>{fmt(comTaxaSaida(+form.valor))}</b>
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button type="submit" className="text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
                style={{ background: cor }}>{editId ? 'Salvar alterações' : 'Salvar'}</button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false) }}
                className="border border-gray-200 text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[110px_1fr_140px_70px_120px_80px] px-6 py-3 border-b border-gray-100">
          {['Data','Descrição','Origem/Destino','Recibo','Valor',''].map((h, idx) => (
            <p key={idx} className="text-xs font-semibold text-gray-400">{h}</p>
          ))}
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-300">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-300">Sem registros neste período.</div>
        ) : rows.map((r, i) => (
          <div key={r.id}
            className={`grid grid-cols-[110px_1fr_140px_70px_120px_80px] px-6 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < rows.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <p className="text-sm text-gray-500">{new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <p className="text-sm text-gray-800 pr-4">{r.descricao}</p>
            <p className="text-sm text-gray-400">{r.origem_destino || '—'}</p>
            <div>
              {r.recibo_url
                ? <a href={r.recibo_url} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: cor }}>Ver</a>
                : <span className="text-sm text-gray-300">—</span>}
            </div>
            <p className="text-sm font-semibold" style={{ color: cor }}>
              {isE ? '+' : '-'}{fmt(bruto(r))}
            </p>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => editar(r)} title="Editar"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => excluir(r)} title="Excluir"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>

    </div>
  )
}
