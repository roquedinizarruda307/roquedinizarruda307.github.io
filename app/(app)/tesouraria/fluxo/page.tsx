'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, Trash2, FileSpreadsheet } from 'lucide-react'
import { exportarExcel } from '@/lib/excel'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FluxoPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const anos = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  useEffect(() => { load() }, [mes, ano])

  async function load() {
    setLoading(true)
    const m = String(mes).padStart(2, '0')
    const pm = mes === 12 ? 1 : mes + 1
    const pa = mes === 12 ? ano + 1 : ano
    const pm2 = String(pm).padStart(2, '0')
    const { data } = await supabase.from('transacoes').select('*')
      .gte('data', `${ano}-${m}-01`).lt('data', `${pa}-${pm2}-01`)
      .order('data', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  async function excluir(r: any) {
    if (!confirm(`Excluir "${r.descricao}" (${fmt(+r.valor)})?`)) return
    await supabase.from('transacoes').delete().eq('id', r.id)
    load()
  }

  const entradas = rows.filter(r => r.tipo === 'entrada').reduce((s, r) => s + +r.valor, 0)
  const saidas   = rows.filter(r => r.tipo === 'saida').reduce((s, r) => s + +r.valor, 0)
  const saldo    = entradas - saidas

  function exportar() {
    const linhas: (string | number)[][] = [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']]
    for (const r of rows) {
      linhas.push([
        new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR'),
        r.descricao ?? '', r.categoria ?? '', r.tipo === 'entrada' ? 'Entrada' : 'Saída',
        (r.tipo === 'entrada' ? 1 : -1) * +r.valor,
      ])
    }
    linhas.push([])
    linhas.push(['', '', '', 'Entradas', entradas])
    linhas.push(['', '', '', 'Saídas', saidas])
    linhas.push(['', '', '', 'Saldo', saldo])
    exportarExcel(`fluxo_${MESES[mes-1]}_${ano}.xlsx`, linhas, 'Fluxo')
  }

  return (
    <div className="p-7 max-w-6xl space-y-5">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-0 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="relative">
            <select value={mes} onChange={e => setMes(+e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 text-sm font-medium bg-transparent cursor-pointer border-r border-gray-200">
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={ano} onChange={e => setAno(+e.target.value)}
              className="appearance-none pl-4 pr-8 py-2.5 text-sm font-medium bg-transparent cursor-pointer">
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <button onClick={exportar} disabled={rows.length === 0}
          className="flex items-center gap-1.5 border border-gray-200 bg-white rounded-lg px-3.5 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40">
          <FileSpreadsheet size={14} className="text-emerald-500" /> Exportar Excel
        </button>
        <div className="flex-1" />
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">Saldo do período</p>
          <p className="text-lg font-bold" style={{ color: saldo >= 0 ? '#111' : '#c0392b' }}>{fmt(saldo)}</p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
          <p className="text-xs text-gray-400 mb-3">Total entradas</p>
          <p className="text-3xl font-bold" style={{ color: '#16a34a' }}>{fmt(entradas)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
          <p className="text-xs text-gray-400 mb-3">Total saídas</p>
          <p className="text-3xl font-bold" style={{ color: '#c0392b' }}>{fmt(saidas)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <div className="min-w-[660px]">
        <div className="grid grid-cols-[110px_1fr_140px_70px_120px_60px] px-6 py-3 border-b border-gray-100">
          {['Data','Descrição','Categoria','Recibo','Valor',''].map((h, idx) => (
            <p key={idx} className="text-xs font-semibold text-gray-400">{h}</p>
          ))}
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-300">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-300">Nenhuma movimentação neste período.</div>
        ) : rows.map((r, i) => (
          <div key={r.id}
            className={`grid grid-cols-[110px_1fr_140px_70px_120px_60px] px-6 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < rows.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <p className="text-sm text-gray-500">{new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <p className="text-sm text-gray-800 pr-4">{r.descricao}</p>
            <p className="text-sm text-gray-400">{r.categoria ?? '—'}</p>
            <div>
              {r.recibo_url
                ? <a href={r.recibo_url} target="_blank" rel="noreferrer" className="text-xs font-medium underline" style={{ color: '#c0392b' }}>Ver</a>
                : <span className="text-sm text-gray-300">—</span>}
            </div>
            <p className="text-sm font-semibold" style={{ color: r.tipo === 'entrada' ? '#16a34a' : '#c0392b' }}>
              {r.tipo === 'entrada' ? '+' : '-'}{fmt(+r.valor)}
            </p>
            <div className="flex justify-end">
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
