'use client'

import { useState, useEffect } from 'react'
import { supabase, type Mensalidade, type Membro } from '@/lib/supabase'
import { CheckCircle, Clock, AlertCircle, Plus } from 'lucide-react'

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function MensalidadesPage() {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    membro_id: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    valor: '',
    status: 'pendente' as 'pago' | 'pendente' | 'atrasado',
  })

  useEffect(() => {
    fetchDados()
  }, [anoSelecionado])

  async function fetchDados() {
    setLoading(true)
    const [{ data: m }, { data: ms }] = await Promise.all([
      supabase.from('membros').select('*').eq('status', 'ativo').order('nome'),
      supabase.from('mensalidades').select('*, membro:membros(*)').eq('ano', anoSelecionado).order('mes'),
    ])
    setMembros(m ?? [])
    setMensalidades(ms ?? [])
    setLoading(false)
  }

  async function salvarMensalidade(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('mensalidades').upsert([{
      ...form,
      valor: parseFloat(form.valor),
      data_pagamento: form.status === 'pago' ? new Date().toISOString() : null,
    }], { onConflict: 'membro_id,mes,ano' })
    setShowForm(false)
    fetchDados()
  }

  async function alterarStatus(id: string, status: 'pago' | 'pendente' | 'atrasado') {
    await supabase.from('mensalidades').update({
      status,
      data_pagamento: status === 'pago' ? new Date().toISOString() : null,
    }).eq('id', id)
    fetchDados()
  }

  const statusIcon = (s: string) => {
    if (s === 'pago') return <CheckCircle size={16} className="text-green-500" />
    if (s === 'atrasado') return <AlertCircle size={16} className="text-red-500" />
    return <Clock size={16} className="text-yellow-500" />
  }

  const statusColor = (s: string) =>
    s === 'pago' ? 'bg-green-100 text-green-700' :
    s === 'atrasado' ? 'bg-red-100 text-red-700' :
    'bg-yellow-100 text-yellow-700'

  const pagas = mensalidades.filter(m => m.status === 'pago').length
  const pendentes = mensalidades.filter(m => m.status === 'pendente').length
  const atrasadas = mensalidades.filter(m => m.status === 'atrasado').length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mensalidades</h1>
          <p className="text-gray-500 mt-1">Controle de pagamentos dos membros</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300">
            {[2023, 2024, 2025, 2026].map(a => <option key={a}>{a}</option>)}
          </select>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #c0392b, #8B1A1A)" }}>
            <Plus size={16} />
            Lançar
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="text-green-500" />
          <div>
            <p className="text-2xl font-bold text-green-700">{pagas}</p>
            <p className="text-xs text-green-600">Pagas</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex items-center gap-3">
          <Clock className="text-yellow-500" />
          <div>
            <p className="text-2xl font-bold text-yellow-700">{pendentes}</p>
            <p className="text-xs text-yellow-600">Pendentes</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500" />
          <div>
            <p className="text-2xl font-bold text-red-700">{atrasadas}</p>
            <p className="text-xs text-red-600">Atrasadas</p>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={salvarMensalidade} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Lançar Mensalidade</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={form.membro_id} onChange={e => setForm({ ...form, membro_id: e.target.value })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300">
              <option value="">Selecionar membro</option>
              {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <select value={form.mes} onChange={e => setForm({ ...form, mes: Number(e.target.value) })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300">
              {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input required type="number" step="0.01" min="0" placeholder="Valor (R$)" value={form.valor}
              onChange={e => setForm({ ...form, valor: e.target.value })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300" />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'pago' | 'pendente' | 'atrasado' })}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300">
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="text-white text-sm font-medium px-5 py-2 rounded-xl hover:opacity-90" style={{ background: "linear-gradient(135deg, #c0392b, #8B1A1A)" }}>Salvar</button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-200 px-6 py-2 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : mensalidades.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma mensalidade lançada para {anoSelecionado}.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Membro</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mês</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mensalidades.map(ms => (
                <tr key={ms.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {(ms.membro as Membro)?.nome ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{meses[ms.mes - 1]}/{ms.ano}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {ms.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColor(ms.status)}`}>
                      {statusIcon(ms.status)}
                      {ms.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {ms.status !== 'pago' && (
                      <button onClick={() => alterarStatus(ms.id, 'pago')}
                        className="text-xs text-red-600 hover:text-blue-800 font-medium mr-3">
                        Marcar pago
                      </button>
                    )}
                    {ms.status === 'pendente' && (
                      <button onClick={() => alterarStatus(ms.id, 'atrasado')}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Marcar atrasado
                      </button>
                    )}
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
