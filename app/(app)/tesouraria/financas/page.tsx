'use client'

import { useState, useEffect } from 'react'
import { supabase, type Transacao } from '@/lib/supabase'
import { Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const categorias = {
  entrada: ['Mensalidade', 'Doação', 'Evento', 'Outros'],
  saida: ['Material', 'Aluguel', 'Alimentação', 'Evento', 'Outros'],
}

export default function FinancasPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [form, setForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    categoria: 'Outros',
  })

  useEffect(() => {
    fetchTransacoes()
  }, [])

  async function fetchTransacoes() {
    setLoading(true)
    const { data } = await supabase.from('transacoes').select('*').order('data', { ascending: false })
    setTransacoes(data ?? [])
    setLoading(false)
  }

  async function salvarTransacao(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('transacoes').insert([{ ...form, valor: parseFloat(form.valor) }])
    setForm({ tipo: 'entrada', descricao: '', valor: '', data: new Date().toISOString().split('T')[0], categoria: 'Outros' })
    setShowForm(false)
    fetchTransacoes()
  }

  const filtradas = transacoes.filter(t => filtro === 'todos' || t.tipo === filtro)
  const totalEntradas = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0)
  const totalSaidas = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0)
  const saldo = totalEntradas - totalSaidas

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanças</h1>
          <p className="text-gray-500 mt-1">Controle de entradas e saídas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #c0392b, #8B1A1A)" }}
        >
          <Plus size={16} />
          Nova Transação
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Entradas</span>
            <TrendingUp size={18} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(totalEntradas)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Saídas</span>
            <TrendingDown size={18} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{fmt(totalSaidas)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Saldo em Caixa</span>
            <DollarSign size={18} className="text-red-500" />
          </div>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-red-900' : 'text-red-600'}`}>{fmt(saldo)}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={salvarTransacao} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Nova Transação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida', categoria: 'Outros' })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300">
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300">
              {categorias[form.tipo].map(c => <option key={c}>{c}</option>)}
            </select>
            <input required type="number" step="0.01" min="0" placeholder="Valor (R$)" value={form.valor}
              onChange={e => setForm({ ...form, valor: e.target.value })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300" />
            <input required placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 md:col-span-2" />
            <input required type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300" />
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="text-white text-sm font-medium px-5 py-2 rounded-xl hover:opacity-90" style={{ background: "linear-gradient(135deg, #c0392b, #8B1A1A)" }}>Salvar</button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-200 px-6 py-2 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['todos', 'entrada', 'saida'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filtro === f ? 'bg-red-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f === 'todos' ? 'Todos' : f === 'entrada' ? 'Entradas' : 'Saídas'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma transação encontrada.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(t.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${t.tipo === 'entrada' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium text-gray-900">{t.descricao}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{t.categoria}</td>
                  <td className={`px-6 py-4 text-sm font-semibold text-right
                    ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.tipo === 'saida' ? '- ' : '+ '}{fmt(t.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
