'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Wallet, Check } from 'lucide-react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AjustesPage() {
  const [saldo, setSaldo] = useState<number | null>(null)
  const [alvo, setAlvo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)

  async function carregarSaldo() {
    const { data } = await supabase.from('transacoes').select('tipo,valor')
    const s = (data ?? []).reduce((acc, t) => t.tipo === 'entrada' ? acc + +t.valor : acc - +t.valor, 0)
    setSaldo(s)
  }

  useEffect(() => { carregarSaldo() }, [])

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
    </div>
  )
}
