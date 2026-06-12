'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Wallet, Check, NotebookPen, Trash2 } from 'lucide-react'
import { usePapel } from '@/components/PapelContext'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Perfil = { email: string; papel: string }

export default function AjustesPage() {
  const { papel } = usePapel()
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [pendentes, setPendentes] = useState<Perfil[]>([])
  const [novoEmail, setNovoEmail] = useState('')
  const [saldo, setSaldo] = useState<number | null>(null)
  const [alvo, setAlvo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)

  async function carregarSaldo() {
    const { data } = await supabase.from('transacoes').select('tipo,valor')
    const s = (data ?? []).reduce((acc, t) => t.tipo === 'entrada' ? acc + +t.valor : acc - +t.valor, 0)
    setSaldo(s)
  }

  useEffect(() => { carregarSaldo(); carregarPerfis() }, [])

  async function carregarPerfis() {
    const { data } = await supabase.from('perfis').select('*').order('email')
    const todos = (data ?? []) as (Perfil & { aprovado: boolean })[]
    setPerfis(todos.filter(p => p.aprovado && p.papel === 'escrivao'))
    setPendentes(todos.filter(p => !p.aprovado))
  }

  async function aprovar(email: string, comoPapel: 'admin' | 'escrivao') {
    await supabase.from('perfis').update({ aprovado: true, papel: comoPapel }).eq('email', email)
    carregarPerfis()
  }

  async function recusar(email: string) {
    await supabase.from('perfis').delete().eq('email', email)
    carregarPerfis()
  }

  async function addEscrivao(e: React.FormEvent) {
    e.preventDefault()
    const email = novoEmail.trim().toLowerCase()
    if (!email) return
    await supabase.from('perfis').upsert({ email, papel: 'escrivao' }, { onConflict: 'email' })
    setNovoEmail(''); carregarPerfis()
  }

  async function removerEscrivao(email: string) {
    await supabase.from('perfis').delete().eq('email', email)
    carregarPerfis()
  }

  async function calibrar(e: React.FormEvent) {
    e.preventDefault()
    if (saldo === null) return
    const valorAlvo = parseFloat(alvo.replace(',', '.'))
    if (isNaN(valorAlvo)) return
    const diff = +(valorAlvo - saldo).toFixed(2)
    if (diff === 0) return

    setSalvando(true)
    await supabase.from('transacoes').insert([{
      tipo: diff > 0 ? 'entrada' : 'saida',
      valor: Math.abs(diff),
      data: new Date().toISOString().slice(0, 10),
      categoria: 'Ajuste de caixa',
      descricao: `Calibragem manual do saldo para ${fmt(valorAlvo)}`,
    }])
    await carregarSaldo()
    setAlvo('')
    setSalvando(false)
    setOk(true)
    setTimeout(() => setOk(false), 2500)
  }

  const valorAlvo = parseFloat(alvo.replace(',', '.'))
  const diff = saldo !== null && !isNaN(valorAlvo) ? +(valorAlvo - saldo).toFixed(2) : null

  return (
    <div className="p-7 max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#c0392b' }}>Ajustes</p>
        <h1 className="text-2xl font-black text-gray-900">Calibrar o caixa</h1>
        <p className="text-sm text-gray-400 mt-1">
          Defina o saldo real do caixa. O sistema cria um lançamento de ajuste com a diferença.
        </p>
      </div>

      {/* Saldo atual */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#f3f4f6' }}>
          <Wallet size={18} className="text-gray-500" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Saldo atual do sistema</p>
          <p className="text-2xl font-black" style={{ color: (saldo ?? 0) >= 0 ? '#16a34a' : '#c0392b' }}>
            {saldo === null ? '—' : fmt(saldo)}
          </p>
        </div>
      </div>

      {/* Form de calibragem */}
      <form onSubmit={calibrar} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Saldo real do caixa
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-semibold">R$</span>
            <input
              value={alvo}
              onChange={e => setAlvo(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:border-gray-400 outline-none transition-colors"
            />
          </div>
        </div>

        {diff !== null && diff !== 0 && (
          <div className="text-sm rounded-xl px-4 py-3" style={{
            background: diff > 0 ? '#f0fdf4' : '#fef2f2',
            color: diff > 0 ? '#16a34a' : '#dc2626',
          }}>
            Será criada uma <b>{diff > 0 ? 'entrada' : 'saída'}</b> de <b>{fmt(Math.abs(diff))}</b> para acertar o saldo.
          </div>
        )}

        <button type="submit" disabled={salvando || diff === null || diff === 0}
          className="flex items-center justify-center gap-2 w-full text-white font-bold py-3.5 rounded-xl transition-opacity disabled:opacity-40"
          style={{ background: '#c0392b' }}>
          {ok ? <><Check size={16} /> Saldo calibrado!</> : salvando ? 'Salvando...' : 'Calibrar saldo'}
        </button>
      </form>

      <p className="text-xs text-gray-400">
        O ajuste aparece no Fluxo como "Ajuste de caixa" e pode ser conferido/excluído lá a qualquer momento.
      </p>

      {/* Solicitações pendentes (só admin) */}
      {papel === 'admin' && (
        <div className="bg-white rounded-2xl border shadow-sm px-6 py-6 space-y-4 mt-2"
          style={{ borderColor: pendentes.length ? '#fde2e2' : '#f3f4f6' }}>
          <div>
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              Solicitações de acesso
              {pendentes.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  {pendentes.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400">Contas novas só entram após você aprovar.</p>
          </div>

          {pendentes.length === 0 ? (
            <p className="text-sm text-gray-300">Nenhuma solicitação pendente.</p>
          ) : pendentes.map(p => (
            <div key={p.email} className="flex items-center justify-between gap-3 flex-wrap bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-gray-800 min-w-0 truncate">{p.email}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => aprovar(p.email, 'admin')}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: '#16a34a' }}>
                  Aprovar (Admin)
                </button>
                <button onClick={() => aprovar(p.email, 'escrivao')}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#eef2ff', color: '#4338ca' }}>
                  Aprovar (Escrivão)
                </button>
                <button onClick={() => recusar(p.email)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Perfis de acesso (só admin) */}
      {papel === 'admin' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-4 mt-2">
          <div className="flex items-center gap-2.5">
            <NotebookPen size={18} className="text-gray-500" />
            <div>
              <h2 className="text-base font-black text-gray-900">Acesso de Escrivão</h2>
              <p className="text-xs text-gray-400">Contas listadas aqui só verão a aba Escrivão.</p>
            </div>
          </div>

          <form onSubmit={addEscrivao} className="flex items-center gap-2">
            <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
              placeholder="email@do-escrivao.com" required
              className="flex-1 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:border-gray-400 outline-none" />
            <button type="submit" className="text-white text-sm font-bold px-4 py-2.5 rounded-lg" style={{ background: '#c0392b' }}>
              Adicionar
            </button>
          </form>

          <div className="space-y-1.5">
            {perfis.length === 0 ? (
              <p className="text-sm text-gray-300">Nenhum escrivão definido. Todos com conta têm acesso completo.</p>
            ) : perfis.map(p => (
              <div key={p.email} className="flex items-center justify-between bg-gray-50 rounded-lg px-3.5 py-2.5">
                <span className="text-sm text-gray-700">{p.email}</span>
                <button onClick={() => removerEscrivao(p.email)} className="text-gray-300 hover:text-red-500" title="Remover">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            A conta precisa ser criada normalmente (na tela de login → "Criar conta"). Depois adicione o e-mail aqui para limitar o acesso só ao Escrivão.
          </p>
        </div>
      )}
    </div>
  )
}
