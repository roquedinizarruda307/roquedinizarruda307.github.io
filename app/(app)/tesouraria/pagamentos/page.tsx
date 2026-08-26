'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type Membro } from '@/lib/supabase'
import { Plus, FileSpreadsheet, X, ChevronDown, Ticket, Check, Trash2, Pencil } from 'lucide-react'
import { exportarExcel } from '@/lib/excel'
import { liquidoEntrada, comTaxaSaida } from '@/lib/taxas'

const MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2]

type StatusMens = 'pago' | 'isento' | 'nao_pago'
const inp = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:border-gray-400 transition-colors"
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function inicial(nome: string) {
  return (nome?.trim()?.[0] ?? '?').toUpperCase()
}

// Regras de cobrança: membro só é cobrado a partir do mês/ano em que entrou;
// inativo não gera dívidas novas (as já registradas continuam valendo)
function entrouAte(m: Membro, mes: number, ano: number) {
  if (!m.data_entrada) return true
  const y = +String(m.data_entrada).slice(0, 4), mo = +String(m.data_entrada).slice(5, 7)
  if (!y || !mo) return true
  return y < ano || (y === ano && mo <= mes)
}

function entrouAteAno(m: Membro, ano: number) {
  if (!m.data_entrada) return true
  const y = +String(m.data_entrada).slice(0, 4)
  return !y || y <= ano
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

  // Quem aparece no mês: quem já tem registro nele, ou está ativo e já tinha entrado
  const visiveis = membros.filter(m => mapa[m.id] || (m.status !== 'inativo' && entrouAte(m, mes, ano)))

  // disponibiliza dados pro relatório
  useEffect(() => {
    registrar(() => {
      const label = { pago: 'Pago', nao_pago: 'Não pago', isento: 'Isento' }
      const linhas: string[][] = [['Membro', 'Status', `Mensalidade ${MESES_C[mes-1]}/${ano}`]]
      for (const m of visiveis) {
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
      valor: liquidoEntrada(20),   // conta no saldo já sem a taxa
      valor_bruto: 20,             // aparece nas listas
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
  if (visiveis.length === 0) return <div className="py-12 text-center text-sm text-gray-300">Nenhum membro a cobrar neste mês.</div>

  const opcoes = [
    { s: 'pago'     as StatusMens, label: 'Paga',     bg: '#f0fdf4', color: '#16a34a' },
    { s: 'nao_pago' as StatusMens, label: 'Não paga', bg: '#fef2f2', color: '#dc2626' },
    { s: 'isento'   as StatusMens, label: 'Isento',   bg: '#eff6ff', color: '#1d4ed8' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {visiveis.map((membro, i) => {
        const status: StatusMens = mapa[membro.id]?.status ?? 'nao_pago'
        const isSaving = saving === membro.id
        return (
          <div key={membro.id}
            className={`flex items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors ${i < visiveis.length - 1 ? 'border-b border-gray-50' : ''}`}>
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

  // Quem aparece no ano: quem já tem registro nele, ou está ativo e já tinha entrado
  const visiveis = membros.filter(m => mapa[m.id] || (m.status !== 'inativo' && entrouAteAno(m, ano)))

  useEffect(() => {
    registrar(() => {
      const linhas: string[][] = [['Membro', 'Status', `Anuidade ${ano}`]]
      for (const m of visiveis) {
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
  if (visiveis.length === 0) return <div className="py-12 text-center text-sm text-gray-300">Nenhum membro a cobrar neste ano.</div>

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {visiveis.map((m, i) => {
        const status = mapa[m.id]?.status ?? 'pendente'
        const st = stStyle(status)
        return (
          <div key={m.id}
            className={`flex items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors ${i < visiveis.length - 1 ? 'border-b border-gray-50' : ''}`}>
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

// ─── Corpo de evento tipo "lista de pedidos" (ex.: camisetas) ─────────────────
type ItemEv = { id: string; evento_id: string; nome: string; valor: number }
type LinhaItem = { item_id: string; nome: string; qtd: number; valor_unit: number }
type Pedido = { id: string; evento_id: string; nome: string; membro_id: string | null; item_id: string | null; item_nome: string | null; qtd: number; valor: number; pago: boolean; retirado: boolean; transacao_id: string | null; tamanho: string | null; numero: string | null; nome_camisa: string | null; itens: LinhaItem[] | null }

// resumo textual dos itens de um pedido (suporta multi-item novo e item único antigo)
function resumoItens(p: Pedido): string {
  if (Array.isArray(p.itens) && p.itens.length) return p.itens.map(l => `${l.qtd}x ${l.nome}`).join(', ')
  if (p.item_nome) return `${p.qtd}x ${p.item_nome}`
  return ''
}

function ListaPedidos({ ev, membros, onMudou, onExcluir }: { ev: any; membros: Membro[]; onMudou: () => void; onExcluir: () => void }) {
  const [itens, setItens] = useState<ItemEv[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  // form de item
  const [itemNome, setItemNome] = useState('')
  const [itemValor, setItemValor] = useState('')
  // form de pedido
  const [pNome, setPNome] = useState('')
  const [pMembro, setPMembro] = useState('')   // '' = comprador externo (público)
  const [pItem, setPItem] = useState('')
  const [pQtd, setPQtd] = useState('1')
  const [pValor, setPValor] = useState('')
  const [pTamanho, setPTamanho] = useState('')
  const [pNumero, setPNumero] = useState('')
  const [pNomeCamisa, setPNomeCamisa] = useState('')
  const [linhas, setLinhas] = useState<LinhaItem[]>([])   // carrinho de itens do pedido

  const fetchTudo = useCallback(async () => {
    setLoading(true)
    const [{ data: its }, { data: peds }] = await Promise.all([
      supabase.from('evento_itens').select('*').eq('evento_id', ev.id).order('created_at'),
      supabase.from('evento_pedidos').select('*').eq('evento_id', ev.id).order('created_at'),
    ])
    setItens((its ?? []) as ItemEv[]); setPedidos((peds ?? []) as Pedido[]); setLoading(false)
  }, [ev.id])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!itemNome.trim()) return
    await supabase.from('evento_itens').insert([{ evento_id: ev.id, nome: itemNome, valor: +itemValor || 0 }])
    setItemNome(''); setItemValor(''); fetchTudo()
  }
  async function delItem(id: string) {
    await supabase.from('evento_itens').delete().eq('id', id); fetchTudo()
  }

  const totalLinhas = linhas.reduce((s, l) => s + l.qtd * l.valor_unit, 0)

  // adiciona um item ao carrinho do pedido (soma se já existir)
  function addLinha() {
    const item = itens.find(i => i.id === pItem)
    if (!item) return
    const qtd = +pQtd || 1
    setLinhas(prev => {
      const idx = prev.findIndex(l => l.item_id === item.id)
      if (idx >= 0) { const cp = [...prev]; cp[idx] = { ...cp[idx], qtd: cp[idx].qtd + qtd }; return cp }
      return [...prev, { item_id: item.id, nome: item.nome, qtd, valor_unit: item.valor }]
    })
    setPItem(''); setPQtd('1')
  }
  function removeLinha(item_id: string) {
    setLinhas(prev => prev.filter(l => l.item_id !== item_id))
  }

  async function addPedido(e: React.FormEvent) {
    e.preventDefault()
    const membro = membros.find(m => m.id === pMembro)
    const nomeFinal = membro ? membro.nome : pNome.trim()
    if (!nomeFinal) return
    // dois caminhos: carrinho com itens, ou valor avulso
    const usaCarrinho = linhas.length > 0
    const valor = usaCarrinho ? totalLinhas : (pValor !== '' ? +pValor : 0)
    const qtdResumo = usaCarrinho ? linhas.reduce((s, l) => s + l.qtd, 0) : 1
    await supabase.from('evento_pedidos').insert([{
      evento_id: ev.id, nome: nomeFinal, membro_id: membro?.id ?? null,
      item_id: null, item_nome: null, qtd: qtdResumo, valor,
      itens: usaCarrinho ? linhas : null,
      tamanho: pTamanho.trim() || null, numero: pNumero.trim() || null, nome_camisa: pNomeCamisa.trim() || null,
    }])
    setPNome(''); setPMembro(''); setPItem(''); setPQtd('1'); setPValor(''); setPTamanho(''); setPNumero(''); setPNomeCamisa(''); setLinhas([]); fetchTudo(); onMudou()
  }

  async function togglePago(p: Pedido) {
    const novo = !p.pago
    setPedidos(prev => prev.map(x => x.id === p.id ? { ...x, pago: novo } : x))
    if (novo) {
      // lança no caixa
      const resumo = resumoItens(p)
      const { data } = await supabase.from('transacoes').insert([{
        tipo: 'entrada', valor: liquidoEntrada(+p.valor), valor_bruto: +p.valor, data: new Date().toISOString().slice(0, 10),
        categoria: 'Evento', descricao: `${ev.nome} — ${p.nome}${resumo ? ` (${resumo})` : ''}`,
      }]).select('id').single()
      await supabase.from('evento_pedidos').update({ pago: true, transacao_id: data?.id ?? null }).eq('id', p.id)
    } else {
      if (p.transacao_id) await supabase.from('transacoes').delete().eq('id', p.transacao_id)
      await supabase.from('evento_pedidos').update({ pago: false, transacao_id: null }).eq('id', p.id)
    }
    onMudou()
  }

  async function toggleRetirado(p: Pedido) {
    const novo = !p.retirado
    setPedidos(prev => prev.map(x => x.id === p.id ? { ...x, retirado: novo } : x))
    await supabase.from('evento_pedidos').update({ retirado: novo }).eq('id', p.id)
  }

  // Altera a quantidade do pedido; se tiver item vinculado, recalcula o valor (preço x qtd)
  async function setQtdPedido(p: Pedido, novaQtd: number) {
    if (novaQtd < 1) return
    const item = itens.find(i => i.id === p.item_id)
    const novoValor = item ? item.valor * novaQtd : +p.valor
    setPedidos(prev => prev.map(x => x.id === p.id ? { ...x, qtd: novaQtd, valor: novoValor } : x))
    await supabase.from('evento_pedidos').update({ qtd: novaQtd, valor: novoValor }).eq('id', p.id)
    // se já estava pago, atualiza o valor lançado no caixa
    if (p.pago && p.transacao_id) {
      await supabase.from('transacoes').update({ valor: novoValor }).eq('id', p.transacao_id)
    }
    onMudou()
  }

  async function delPedido(p: Pedido) {
    if (p.transacao_id) await supabase.from('transacoes').delete().eq('id', p.transacao_id)
    setPedidos(prev => prev.filter(x => x.id !== p.id))
    await supabase.from('evento_pedidos').delete().eq('id', p.id)
    onMudou()
  }

  const total = pedidos.reduce((s, p) => s + +p.valor, 0)
  const arrecadado = pedidos.filter(p => p.pago).reduce((s, p) => s + +p.valor, 0)
  // contagem por item (soma multi-item novo + item único antigo)
  const contagem = itens.map(it => {
    let qtd = 0, npedidos = 0
    for (const p of pedidos) {
      if (Array.isArray(p.itens)) {
        const l = p.itens.find(x => x.item_id === it.id)
        if (l) { qtd += l.qtd; npedidos++ }
      } else if (p.item_id === it.id) {
        qtd += p.qtd; npedidos++
      }
    }
    return { ...it, qtd, pedidos: npedidos }
  })

  if (loading) return <div className="py-6 text-center text-sm text-gray-300">Carregando...</div>

  return (
    <div className="border-t border-gray-50 px-4 sm:px-6 py-4 space-y-5">
      {/* Catálogo de itens */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Itens do evento</p>
        <div className="space-y-1.5 mb-3">
          {contagem.length === 0 && <p className="text-sm text-gray-300">Nenhum item cadastrado.</p>}
          {contagem.map(it => (
            <div key={it.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">{it.nome}</span>
                <span className="text-xs text-gray-400">{fmt(it.valor)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#eef2ff', color: '#4338ca' }}>{it.qtd} un.</span>
                <button onClick={() => delItem(it.id)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={addItem} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input value={itemNome} onChange={e => setItemNome(e.target.value)} placeholder="Item (ex.: Camiseta P)" className={inp + ' flex-1'} />
          <div className="flex gap-2">
            <input value={itemValor} onChange={e => setItemValor(e.target.value)} type="number" step="0.01" placeholder="Valor" className={inp + ' flex-1 sm:w-28'} />
            <button className="text-white text-sm font-medium px-3.5 py-2 rounded-lg whitespace-nowrap flex-shrink-0" style={{ background: '#111827' }}>+ Item</button>
          </div>
        </form>
      </div>

      {/* Pedidos */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Pedidos ({pedidos.length})</p>
        <div className="space-y-2 mb-3">
          {pedidos.length === 0 && <p className="text-sm text-gray-300">Nenhum pedido ainda.</p>}
          {pedidos.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
                  {p.nome}
                  {p.membro_id && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#eef2ff', color: '#4338ca' }}>MEMBRO</span>}
                </p>
                <p className="text-xs" style={{ color: p.pago ? '#16a34a' : '#dc2626' }}>
                  {resumoItens(p) ? `${resumoItens(p)} · ` : ''}{p.pago ? `Pago ${fmt(+p.valor)}` : `Deve ${fmt(+p.valor)}`}
                </p>
                {(p.tamanho || p.numero || p.nome_camisa) && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {p.tamanho && <span className="font-semibold">Tam: {p.tamanho}</span>}
                    {p.tamanho && p.numero && ' · '}
                    {p.numero && <span className="font-semibold">Nº {p.numero}</span>}
                    {(p.tamanho || p.numero) && p.nome_camisa && ' · '}
                    {p.nome_camisa && <span className="font-semibold">Nome: {p.nome_camisa}</span>}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* quantidade (só p/ pedidos de item único; multi-item edita pelo carrinho) */}
                {!Array.isArray(p.itens) && p.item_id && (
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button onClick={() => setQtdPedido(p, p.qtd - 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-50">−</button>
                    <span className="px-2 text-xs font-bold text-gray-700 min-w-[36px] text-center">{p.qtd}x</span>
                    <button onClick={() => setQtdPedido(p, p.qtd + 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-50">+</button>
                  </div>
                )}
                <button onClick={() => togglePago(p)}
                  className="text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg"
                  style={p.pago ? { background: '#f0fdf4', color: '#16a34a' } : { background: '#fef2f2', color: '#dc2626' }}>
                  {p.pago ? 'Pago' : 'Não pago'}
                </button>
                <button onClick={() => toggleRetirado(p)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg"
                  style={p.retirado ? { background: '#eff6ff', color: '#1d4ed8' } : { background: '#f9fafb', color: '#9ca3af' }}>
                  {p.retirado && <Check size={12} />} {p.retirado ? 'Entregue' : 'A entregar'}
                </button>
                <button onClick={() => delPedido(p)} className="text-gray-300 hover:text-red-500 p-1"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Adicionar pedido */}
        <form onSubmit={addPedido} className="space-y-2">
          {/* Carrinho: escolher vários itens (ex.: 1 Kit + 1 Camisa) */}
          {itens.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
              {linhas.length > 0 && (
                <div className="space-y-1">
                  {linhas.map(l => (
                    <div key={l.item_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{l.qtd}x {l.nome}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{fmt(l.qtd * l.valor_unit)}</span>
                        <button type="button" onClick={() => removeLinha(l.item_id)} className="text-gray-300 hover:text-red-500"><X size={13} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end text-xs font-bold text-gray-700 pt-1.5 border-t border-gray-200">Total: {fmt(totalLinhas)}</div>
                </div>
              )}
              <div className="flex gap-2">
                <select value={pItem} onChange={e => setPItem(e.target.value)} className={inp + ' appearance-none flex-1'}>
                  <option value="">Escolher item…</option>
                  {itens.map(it => <option key={it.id} value={it.id}>{it.nome} — {fmt(it.valor)}</option>)}
                </select>
                <input value={pQtd} onChange={e => setPQtd(e.target.value)} type="number" min="1" className={inp + ' w-16'} />
                <button type="button" onClick={addLinha} disabled={!pItem}
                  className="text-white text-sm font-medium px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0 disabled:opacity-40" style={{ background: '#111827' }}>+ Add</button>
              </div>
            </div>
          )}
          {ev.personalizavel && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input value={pTamanho} onChange={e => setPTamanho(e.target.value)} placeholder="Tamanho (ex.: M)" className={inp} />
              <input value={pNumero} onChange={e => setPNumero(e.target.value)} placeholder="Número (ex.: 10)" className={inp} />
              <input value={pNomeCamisa} onChange={e => setPNomeCamisa(e.target.value)} placeholder="Nome na camisa" className={inp} />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] gap-2 items-center">
          {/* Membro (vincula dívida) */}
          <select value={pMembro} onChange={e => setPMembro(e.target.value)} className={inp + ' appearance-none'}>
            <option value="">Comprador externo</option>
            {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {/* Nome livre (usado se não for membro) */}
          <input value={pNome} onChange={e => setPNome(e.target.value)} placeholder="Nome (se externo)" disabled={!!pMembro}
            className={inp + (pMembro ? ' opacity-50' : '')} />
          {/* Valor: automático pelo carrinho, ou avulso quando vazio */}
          <input value={linhas.length > 0 ? totalLinhas.toFixed(2) : pValor} onChange={e => setPValor(e.target.value)} type="number" step="0.01"
            placeholder="Valor avulso" disabled={linhas.length > 0}
            className={inp + (linhas.length > 0 ? ' opacity-60' : '')} />
          <button className="text-white text-sm font-medium px-3.5 py-2 rounded-lg whitespace-nowrap" style={{ background: '#c0392b' }}>+ Pedido</button>
          </div>
        </form>
      </div>

      {/* Totais */}
      <div className="flex items-center justify-between gap-5 pt-1 text-sm flex-wrap">
        <button onClick={onExcluir} className="text-xs text-gray-400 hover:text-red-500">Excluir evento</button>
        <div className="flex items-center gap-5">
          <span className="text-gray-400">Arrecadado: <b className="text-green-600">{fmt(arrecadado)}</b></span>
          <span className="text-gray-400">A receber: <b style={{ color: '#dc2626' }}>{fmt(total - arrecadado)}</b></span>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard de Inscrições (eventos vindos do formulário) ───────────────────
const CAT_CORES: Record<string, { bg: string; color: string }> = {
  'DEMOLAY ATIVO':  { bg: '#eef2ff', color: '#4338ca' },
  'SÊNIOR DEMOLAY': { bg: '#eff6ff', color: '#1d4ed8' },
  'MAÇOM':          { bg: '#fefce8', color: '#a16207' },
  'ACOMPANHANTE':   { bg: '#fdf2f8', color: '#be185d' },
}
const catCor = (c: string) => CAT_CORES[c] ?? { bg: '#f3f4f6', color: '#6b7280' }

function DashboardInscricoes({ ev, onMudou, onExcluir }: { ev: any; onMudou: () => void; onExcluir: () => void }) {
  const [inscritos, setInscritos] = useState<Pedido[]>([])
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [dTipo, setDTipo] = useState<'saida' | 'entrada'>('saida')
  const [dDesc, setDDesc] = useState('')
  const [dValor, setDValor] = useState('')
  const [editTx, setEditTx] = useState<{ id: string; tipo: string; desc: string; valor: string } | null>(null)

  const fetchTudo = useCallback(async () => {
    setLoading(true)
    const [{ data: peds }, { data: t }] = await Promise.all([
      supabase.from('evento_pedidos').select('*').eq('evento_id', ev.id).order('nome'),
      supabase.from('transacoes').select('*').ilike('descricao', `${ev.nome}%`).order('data', { ascending: false }),
    ])
    setInscritos((peds ?? []) as Pedido[]); setTxs(t ?? []); setLoading(false)
  }, [ev.id, ev.nome])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  // bruto: valores cheios (sem taxa) para mostrar; líquido: o que conta no saldo
  const brutoTx = (t: any) => +(t.valor_bruto ?? t.valor)
  const receita = txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + +t.valor, 0)
  const receitaBruta = txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + brutoTx(t), 0)
  const despesas = txs.filter(t => t.tipo === 'saida')
  const despesa = despesas.reduce((s, t) => s + +t.valor, 0)
  const despesaBruta = despesas.reduce((s, t) => s + brutoTx(t), 0)
  // lançamentos avulsos do evento: todas as saídas + entradas que não são inscrição
  const lancamentos = txs.filter(t => t.tipo === 'saida' || !String(t.descricao).includes('(inscrição)'))

  const categorias = [...new Set(inscritos.map(p => (p.item_nome ?? 'SEM CATEGORIA').toUpperCase()))]
    .map(c => ({ c, n: inscritos.filter(p => (p.item_nome ?? 'SEM CATEGORIA').toUpperCase() === c).length }))
    .sort((a, b) => b.n - a.n)

  const filtrados = inscritos.filter(p => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))

  async function togglePago(p: Pedido) {
    const novo = !p.pago
    setInscritos(prev => prev.map(x => x.id === p.id ? { ...x, pago: novo } : x))
    if (novo) {
      const { data } = await supabase.from('transacoes').insert([{
        tipo: 'entrada', valor: liquidoEntrada(+p.valor), valor_bruto: +p.valor, data: new Date().toISOString().slice(0, 10),
        categoria: 'Evento', descricao: `${ev.nome} — ${p.nome} (inscrição)`,
      }]).select('id').single()
      await supabase.from('evento_pedidos').update({ pago: true, transacao_id: data?.id ?? null }).eq('id', p.id)
    } else {
      if (p.transacao_id) await supabase.from('transacoes').delete().eq('id', p.transacao_id)
      await supabase.from('evento_pedidos').update({ pago: false, transacao_id: null }).eq('id', p.id)
    }
    fetchTudo(); onMudou()
  }

  async function delInscrito(p: Pedido) {
    if (!confirm(`Excluir a inscrição de ${p.nome}?${p.pago ? ' O valor sai do caixa também.' : ''}`)) return
    if (p.transacao_id) await supabase.from('transacoes').delete().eq('id', p.transacao_id)
    await supabase.from('evento_pedidos').delete().eq('id', p.id)
    fetchTudo(); onMudou()
  }

  // Lançamento avulso do evento: despesa (com taxa) ou receita, ex.: patrocínio (integral)
  async function addLancamento(e: React.FormEvent) {
    e.preventDefault()
    if (!dDesc.trim() || !+dValor) return
    const ehSaida = dTipo === 'saida'
    await supabase.from('transacoes').insert([{
      tipo: dTipo, valor: ehSaida ? comTaxaSaida(+dValor) : +dValor, valor_bruto: +dValor,
      data: new Date().toISOString().slice(0, 10),
      categoria: 'Evento', descricao: `${ev.nome} — ${dDesc.trim()}`,
    }])
    setDDesc(''); setDValor(''); fetchTudo(); onMudou()
  }

  // Corrige um lançamento do evento (descrição/valor) — a taxa é reaplicada se for despesa
  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!editTx || !editTx.desc.trim() || !+editTx.valor) return
    const ehSaida = editTx.tipo === 'saida'
    await supabase.from('transacoes').update({
      descricao: `${ev.nome} — ${editTx.desc.trim()}`,
      valor: ehSaida ? comTaxaSaida(+editTx.valor) : +editTx.valor,
      valor_bruto: +editTx.valor,
    }).eq('id', editTx.id)
    setEditTx(null); fetchTudo(); onMudou()
  }

  async function delLancamento(t: any) {
    const nomeL = String(t.descricao).replace(`${ev.nome} — `, '')
    if (!confirm(`Excluir "${nomeL}" (${fmt(+(t.valor_bruto ?? t.valor))})?`)) return
    await supabase.from('transacoes').delete().eq('id', t.id)
    fetchTudo(); onMudou()
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-300">Carregando...</div>

  const cards = [
    { label: 'Inscritos', valor: String(inscritos.length), cor: '#111827', sub: '' },
    { label: 'Receita (bruta)', valor: fmt(receitaBruta), cor: '#16a34a', sub: `líquida: ${fmt(receita)}` },
    { label: 'Despesas (brutas)', valor: fmt(despesaBruta), cor: '#dc2626', sub: `com taxas: ${fmt(despesa)}` },
    { label: 'Saldo do evento', valor: fmt(receita - despesa), cor: receita - despesa >= 0 ? '#16a34a' : '#dc2626', sub: 'já sem as taxas' },
  ]

  return (
    <div className="border-t border-gray-50 px-4 sm:px-6 py-5 space-y-5">
      {/* Resumo do evento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{c.label}</p>
            <p className="text-lg font-black" style={{ color: c.cor }}>{c.valor}</p>
            {c.sub && <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Contagem por categoria */}
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categorias.map(({ c, n }) => (
            <span key={c} className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg"
              style={{ background: catCor(c).bg, color: catCor(c).color }}>
              {c}: {n}
            </span>
          ))}
        </div>
      )}

      {/* Inscritos */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Inscritos ({inscritos.length})</p>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome…"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white w-full sm:w-56" />
        </div>
        <div>
          {filtrados.length === 0 && <p className="text-sm text-gray-300 py-2">Nenhum inscrito{busca ? ' encontrado' : ' ainda'}.</p>}
          {filtrados.map(p => {
            const cat = (p.item_nome ?? '').toUpperCase()
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap py-2.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                    {p.nome}
                    {cat && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: catCor(cat).bg, color: catCor(cat).color }}>{cat}</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {p.nome_camisa && <span>{p.nome_camisa}</span>}
                    {p.nome_camisa && p.tamanho ? ' · ' : ''}
                    {p.tamanho && <span>ID {p.tamanho}</span>}
                    {(p.nome_camisa || p.tamanho) && p.numero ? ' · ' : ''}
                    {p.numero && <span>{p.numero}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold" style={{ color: p.pago ? '#16a34a' : '#dc2626' }}>{fmt(+p.valor)}</span>
                  <button onClick={() => togglePago(p)}
                    className="text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg"
                    style={p.pago ? { background: '#f0fdf4', color: '#16a34a' } : { background: '#fef2f2', color: '#dc2626' }}>
                    {p.pago ? 'Pago' : 'Não pago'}
                  </button>
                  <button onClick={() => delInscrito(p)} className="text-gray-300 hover:text-red-500 p-1"><X size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lançamentos do evento: despesas e receitas avulsas (patrocínios etc.) */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Lançamentos do evento ({lancamentos.length})</p>
        <div className="mb-3">
          {lancamentos.length === 0 && <p className="text-sm text-gray-300">Nenhum lançamento ainda (despesas, patrocínios…).</p>}
          {lancamentos.map(t => {
            const nomeL = String(t.descricao).replace(`${ev.nome} — `, '')
            const ehSaida = t.tipo === 'saida'
            if (editTx && editTx.id === t.id) {
              const et = editTx
              return (
                <form key={t.id} onSubmit={salvarEdicao} className="flex flex-col sm:flex-row gap-2 py-2 border-b border-gray-50 last:border-0">
                  <input value={et.desc} onChange={e => setEditTx({ ...et, desc: e.target.value })} className={inp + ' flex-1'} />
                  <div className="flex gap-2">
                    <input value={et.valor} onChange={e => setEditTx({ ...et, valor: e.target.value })} type="number" step="0.01" className={inp + ' w-28'} />
                    <button className="text-white text-sm font-medium px-3 py-2 rounded-lg" style={{ background: '#16a34a' }}>Salvar</button>
                    <button type="button" onClick={() => setEditTx(null)} className="border border-gray-200 text-gray-500 text-sm px-3 py-2 rounded-lg">Cancelar</button>
                  </div>
                </form>
              )
            }
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{nomeL}</p>
                  <p className="text-[11px] text-gray-400">{new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold" style={{ color: ehSaida ? '#dc2626' : '#16a34a' }}>{ehSaida ? '-' : '+'}{fmt(+(t.valor_bruto ?? t.valor))}</span>
                  <button onClick={() => setEditTx({ id: t.id, tipo: t.tipo, desc: nomeL, valor: String(+(t.valor_bruto ?? t.valor)) })}
                    className="text-gray-300 hover:text-gray-700 p-1" title="Editar"><Pencil size={13} /></button>
                  <button onClick={() => delLancamento(t)} className="text-gray-300 hover:text-red-500 p-1" title="Excluir"><X size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
        <form onSubmit={addLancamento} className="flex flex-col sm:flex-row gap-2">
          <select value={dTipo} onChange={e => setDTipo(e.target.value as 'saida' | 'entrada')} className={inp + ' sm:w-32 appearance-none'}>
            <option value="saida">Despesa</option>
            <option value="entrada">Receita</option>
          </select>
          <input value={dDesc} onChange={e => setDDesc(e.target.value)}
            placeholder={dTipo === 'saida' ? 'Despesa (ex.: Ônibus, Alimentação…)' : 'Receita (ex.: Patrocínio Loja Maçônica…)'} className={inp + ' flex-1'} />
          <div className="flex gap-2">
            <input value={dValor} onChange={e => setDValor(e.target.value)} type="number" step="0.01" placeholder="Valor" className={inp + ' flex-1 sm:w-32'} />
            <button className="text-white text-sm font-medium px-3.5 py-2 rounded-lg whitespace-nowrap flex-shrink-0"
              style={{ background: dTipo === 'saida' ? '#c0392b' : '#16a34a' }}>+ Lançar</button>
          </div>
        </form>
        {+dValor > 0 && dTipo === 'saida' && (
          <p className="text-xs text-gray-400 mt-2">
            Com a taxa de transferência (0,89%, máx. R$ 8,50), sai do saldo: <b style={{ color: '#c0392b' }}>{fmt(comTaxaSaida(+dValor))}</b>
          </p>
        )}
        {+dValor > 0 && dTipo === 'entrada' && (
          <p className="text-xs text-gray-400 mt-2">Entra integral no caixa e soma na receita do evento.</p>
        )}
      </div>
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
    const [{ data: evsMes }, { data: evsLista }, { data: ms }] = await Promise.all([
      // eventos do mês (simples/ingresso) + listas do mês
      supabase.from('pagamentos_eventos').select('*').gte('data', `${ano}-${m}-01`).lte('data', `${ano}-${m}-31`).order('data'),
      // listas de pedidos e inscrições aparecem sempre (não são de um mês específico)
      supabase.from('pagamentos_eventos').select('*').in('tipo', ['lista', 'inscricao']).order('created_at', { ascending: false }),
      supabase.from('membros').select('*').order('nome'),
    ])
    // junta sem duplicar
    const mapaEv = new Map<string, any>()
    for (const e of evsMes ?? []) mapaEv.set(e.id, e)
    for (const e of evsLista ?? []) mapaEv.set(e.id, e)
    const evs = [...mapaEv.values()]
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
    if (!confirm(`Excluir o evento "${ev.nome}" e tudo que está dentro dele (itens, pedidos e participantes)?`)) return
    // apaga primeiro o que depende do evento, para nada travar a exclusão
    await Promise.all([
      supabase.from('evento_participantes').delete().eq('evento_id', ev.id),
      supabase.from('evento_itens').delete().eq('evento_id', ev.id),
      supabase.from('evento_pedidos').delete().eq('evento_id', ev.id),
    ])
    const { error } = await supabase.from('pagamentos_eventos').delete().eq('id', ev.id)
    if (error) { alert(`Não foi possível excluir o evento: ${error.message}`); return }
    fetchDados(); onMudou()
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
                <option value="simples">Valor único (por membro)</option>
                <option value="ingresso">Venda de ingressos</option>
                <option value="lista">Lista de pedidos (público)</option>
              </select>
              {form.tipo === 'lista' ? (
                <div className="md:col-span-1 flex items-center text-xs text-gray-400 px-1">
                  Os itens e valores são definidos depois, dentro do evento.
                </div>
              ) : (
                <input required type="number" step="0.01" placeholder={form.tipo === 'ingresso' ? 'Valor por ingresso' : 'Valor R$'} value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className={inp} />
              )}
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
            <div onClick={() => setExpandido(aberto ? null : ev.id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                {ev.tipo === 'ingresso' && <Ticket size={16} className="text-gray-400 flex-shrink-0" />}
                {(ev.tipo === 'lista' || ev.tipo === 'inscricao') && <Ticket size={16} className="text-gray-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{ev.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {ev.tipo === 'inscricao'
                      ? ' · Inscrições via formulário'
                      : ev.tipo === 'lista'
                      ? ' · Lista de pedidos'
                      : ev.tipo === 'ingresso'
                        ? ` · ${fmt(+ev.valor)}/ingresso · ${ps.length} participante(s)`
                        : ` · ${fmt(+ev.valor)} · ${ps.length} participante(s)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {ev.tipo !== 'lista' && ev.tipo !== 'inscricao' && (pendente > 0
                  ? <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{fmt(pendente)} a receber</span>
                  : ps.length > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a' }}>Quitado</span>)}
                <button onClick={e => { e.stopPropagation(); removerEvento(ev) }} title="Excluir evento"
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={15} />
                </button>
                <ChevronDown size={16} className="text-gray-400 transition-transform" style={{ transform: aberto ? 'rotate(180deg)' : 'none' }} />
              </div>
            </div>

            {/* Corpo: lista de pedidos OU participantes */}
            {aberto && ev.tipo === 'inscricao' && <DashboardInscricoes ev={ev} onMudou={onMudou} onExcluir={() => removerEvento(ev)} />}
            {aberto && ev.tipo === 'lista' && <ListaPedidos ev={ev} membros={membros} onMudou={onMudou} onExcluir={() => removerEvento(ev)} />}
            {aberto && ev.tipo !== 'lista' && ev.tipo !== 'inscricao' && (
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

// ─── Tab: Pendências ──────────────────────────────────────────────────────────
type PendDados =
  | { t: 'mensalidade'; id?: string; mes: number; ano: number }
  | { t: 'anuidade'; id: string }
  | { t: 'participante'; id: string }
  | { t: 'pedido'; id: string; descricao: string }

type Pendencia = { key: string; tipo: 'Mensalidade' | 'Anuidade' | 'Evento' | 'Pedido'; ref: string; valor: number; dados: PendDados }

const PEND_CORES: Record<Pendencia['tipo'], { bg: string; color: string }> = {
  Mensalidade: { bg: '#fef2f2', color: '#dc2626' },
  Anuidade:    { bg: '#fefce8', color: '#a16207' },
  Evento:      { bg: '#eef2ff', color: '#4338ca' },
  Pedido:      { bg: '#eff6ff', color: '#1d4ed8' },
}

function TabPendencias({ registrar, onMudou }: { registrar: (fn: () => string[][]) => void; onMudou: () => void }) {
  const [membros, setMembros] = useState<Membro[]>([])
  const [porMembro, setPorMembro] = useState<Record<string, Pendencia[]>>({})
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchDados = useCallback(async () => {
    setLoading(true)
    const hoje = new Date()
    const anoAtual = hoje.getFullYear()
    const mesAtual = hoje.getMonth() + 1

    const [{ data: ms }, { data: mens }, { data: anu }, { data: evs }, { data: parts }, { data: peds }] = await Promise.all([
      supabase.from('membros').select('*').order('nome'),
      supabase.from('mensalidades').select('id, membro_id, mes, ano, status').eq('ano', anoAtual),
      supabase.from('anuidades').select('id, membro_id, ano, valor, status').neq('status', 'pago'),
      supabase.from('pagamentos_eventos').select('id, nome, valor, tipo'),
      supabase.from('evento_participantes').select('*').eq('pago', false),
      supabase.from('evento_pedidos').select('*').eq('pago', false).not('membro_id', 'is', null),
    ])

    const mapa: Record<string, Pendencia[]> = {}
    const add = (mid: string, p: Pendencia) => { (mapa[mid] = mapa[mid] ?? []).push(p) }

    // Mensalidades: meses já decorridos do ano sem "pago" nem "isento"
    const quitadas = new Set((mens ?? []).filter(r => r.status === 'pago' || r.status === 'isento').map(r => `${r.membro_id}-${r.mes}`))
    const regMens: Record<string, string> = {}
    for (const r of mens ?? []) regMens[`${r.membro_id}-${r.mes}`] = r.id
    for (const m of ms ?? [])
      for (let mes = 1; mes <= mesAtual; mes++) {
        if (quitadas.has(`${m.id}-${mes}`)) continue
        // sem registro no mês, só cobra quem estava ativo e já tinha entrado
        const temRegistro = regMens[`${m.id}-${mes}`] !== undefined
        if (!temRegistro && (m.status === 'inativo' || !entrouAte(m, mes, anoAtual))) continue
        add(m.id, { key: `mens-${m.id}-${mes}`, tipo: 'Mensalidade', ref: `${MESES_C[mes - 1]}/${anoAtual}`, valor: 20,
          dados: { t: 'mensalidade', id: regMens[`${m.id}-${mes}`], mes, ano: anoAtual } })
      }

    // Anuidades em aberto (qualquer ano)
    for (const a of anu ?? [])
      add(a.membro_id, { key: `anu-${a.id}`, tipo: 'Anuidade', ref: String(a.ano), valor: +a.valor, dados: { t: 'anuidade', id: a.id } })

    // Eventos: participações não pagas (qualquer data)
    for (const p of parts ?? []) {
      const ev = (evs ?? []).find(e => e.id === p.evento_id)
      if (ev) add(p.membro_id, { key: `part-${p.id}`, tipo: 'Evento', ref: ev.nome, valor: ev.tipo === 'ingresso' ? +ev.valor * p.qtd : +ev.valor,
        dados: { t: 'participante', id: p.id } })
    }

    // Pedidos de listas (ex.: camisetas) não pagos, vinculados a membros
    for (const pd of peds ?? []) {
      const ev = (evs ?? []).find(e => e.id === pd.evento_id)
      const resumo = resumoItens(pd as Pedido)
      add(pd.membro_id, { key: `ped-${pd.id}`, tipo: 'Pedido', ref: `${ev?.nome ?? 'Evento'}${resumo ? ` (${resumo})` : ''}`, valor: +pd.valor,
        dados: { t: 'pedido', id: pd.id, descricao: `${ev?.nome ?? 'Evento'} — ${pd.nome}${resumo ? ` (${resumo})` : ''}` } })
    }

    setMembros(ms ?? []); setPorMembro(mapa); setLoading(false)
  }, [])

  useEffect(() => { fetchDados() }, [fetchDados])

  const devedores = membros.filter(m => (porMembro[m.id]?.length ?? 0) > 0)
  const totalGeral = devedores.reduce((s, m) => s + porMembro[m.id].reduce((x, p) => x + p.valor, 0), 0)

  useEffect(() => {
    registrar(() => {
      const linhas: string[][] = [['Membro', 'Tipo', 'Referência', 'Valor']]
      for (const m of membros) for (const p of porMembro[m.id] ?? []) linhas.push([m.nome, p.tipo, p.ref, fmt(p.valor)])
      linhas.push(['TOTAL', '', '', fmt(totalGeral)])
      return linhas
    })
  }, [membros, porMembro, totalGeral, registrar])

  // Dá baixa numa pendência: mesma lógica das outras abas (marca pago e lança no caixa quando é o caso)
  async function baixar(membro: Membro, p: Pendencia) {
    const agora = new Date().toISOString()
    const hoje = agora.slice(0, 10)
    const d = p.dados
    if (d.t === 'mensalidade') {
      let id = d.id
      if (id) {
        await supabase.from('mensalidades').update({ status: 'pago', data_pagamento: agora }).eq('id', id)
      } else {
        const { data } = await supabase.from('mensalidades').insert([{
          membro_id: membro.id, mes: d.mes, ano: d.ano, valor: 20, status: 'pago', data_pagamento: agora,
        }]).select('id').single()
        id = data?.id
      }
      if (id) {
        const { data: existe } = await supabase.from('transacoes').select('id').eq('mensalidade_id', id).limit(1)
        if (!existe?.length) await supabase.from('transacoes').insert([{
          tipo: 'entrada', valor: liquidoEntrada(20), valor_bruto: 20, data: hoje, categoria: 'Mensalidade',
          descricao: `Mensalidade ${p.ref} — ${membro.nome}`, membro_id: membro.id, mensalidade_id: id,
        }])
      }
    } else if (d.t === 'anuidade') {
      await supabase.from('anuidades').update({ status: 'pago', data_pagamento: agora }).eq('id', d.id)
    } else if (d.t === 'participante') {
      await supabase.from('evento_participantes').update({ pago: true }).eq('id', d.id)
    } else {
      const { data } = await supabase.from('transacoes').insert([{
        tipo: 'entrada', valor: p.valor, data: hoje, categoria: 'Evento', descricao: d.descricao,
      }]).select('id').single()
      await supabase.from('evento_pedidos').update({ pago: true, transacao_id: data?.id ?? null }).eq('id', d.id)
    }
    // remove da lista na tela
    setPorMembro(prev => ({ ...prev, [membro.id]: (prev[membro.id] ?? []).filter(x => x.key !== p.key) }))
  }

  async function darBaixa(membro: Membro, p: Pendencia) {
    if (saving) return
    setSaving(p.key)
    await baixar(membro, p)
    setSaving(null)
    onMudou()
  }

  async function darBaixaTudo(membro: Membro) {
    const pends = porMembro[membro.id] ?? []
    const total = pends.reduce((s, p) => s + p.valor, 0)
    if (!confirm(`Dar baixa em todas as ${pends.length} pendências de ${membro.nome} (${fmt(total)})?`)) return
    setSaving(`tudo-${membro.id}`)
    for (const p of pends) await baixar(membro, p)
    setSaving(null)
    onMudou()
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-300">Carregando...</div>

  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <div className="rounded-2xl border px-5 py-4 shadow-sm flex items-center justify-between flex-wrap gap-2"
        style={{ background: '#fef2f2', borderColor: '#fde2e2' }}>
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#dc2626' }}>
          {devedores.length} membro{devedores.length === 1 ? '' : 's'} com pendências ativas
        </p>
        <p className="text-xl font-black" style={{ color: '#c0392b' }}>{fmt(totalGeral)}</p>
      </div>

      {devedores.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-sm text-gray-300">
          Nenhuma pendência ativa. Tudo em dia!
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {devedores.map((m, i) => {
            const pends = porMembro[m.id]
            const total = pends.reduce((s, p) => s + p.valor, 0)
            const exp = aberto === m.id
            return (
              <div key={m.id} className={i < devedores.length - 1 ? 'border-b border-gray-50' : ''}>
                <button onClick={() => setAberto(exp ? null : m.id)}
                  className="w-full flex items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                      style={{ background: '#f3f4f6', color: '#6b7280' }}>{inicial(m.nome)}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 uppercase tracking-tight text-sm truncate">{m.nome}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{pends.length} pendência{pends.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>{fmt(total)}</span>
                    <ChevronDown size={16} className="text-gray-400 transition-transform" style={{ transform: exp ? 'rotate(180deg)' : 'none' }} />
                  </div>
                </button>
                {exp && (
                  <div className="border-t border-gray-50 px-4 sm:px-6 py-3">
                    {pends.map(p => (
                      <div key={p.key} className="flex items-center justify-between gap-3 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: PEND_CORES[p.tipo].bg, color: PEND_CORES[p.tipo].color }}>{p.tipo}</span>
                          <span className="text-sm text-gray-700 truncate">{p.ref}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>{fmt(p.valor)}</span>
                          <button onClick={() => darBaixa(m, p)} disabled={!!saving}
                            className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                            style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <Check size={12} /> {saving === p.key ? '...' : 'Dar baixa'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2 mt-1 border-t border-gray-50">
                      <button onClick={() => darBaixaTudo(m)} disabled={!!saving}
                        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3.5 py-2 rounded-lg transition-colors disabled:opacity-40 text-white"
                        style={{ background: '#16a34a' }}>
                        <Check size={13} /> {saving === `tudo-${m.id}` ? 'Dando baixa...' : `Dar baixa em tudo (${fmt(total)})`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PagamentosPage() {
  const hoje = new Date()
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1)
  const [anoSel, setAnoSel] = useState(hoje.getFullYear())
  const [tab, setTab] = useState<'mensalidades' | 'anuidades' | 'eventos' | 'pendencias'>('mensalidades')
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
      supabase.from('membros').select('id, status, data_entrada'),
      supabase.from('mensalidades').select('membro_id, status').eq('mes', mesSel).eq('ano', anoSel),
      supabase.from('anuidades').select('membro_id, valor, status').eq('ano', anoSel),
      supabase.from('pagamentos_eventos').select('id, valor, tipo').gte('data', `${anoSel}-${m}-01`).lte('data', `${anoSel}-${m}-31`),
    ])

    // Mensalidades: registro "não pago" conta; sem registro, só conta quem estava ativo e já tinha entrado
    const comRegistro = new Set((mens ?? []).map(r => r.membro_id))
    const naoPagosReg = (mens ?? []).filter(r => r.status === 'nao_pago').length
    const semRegistroCobraveis = ((membros ?? []) as Membro[]).filter(mb =>
      !comRegistro.has(mb.id) && mb.status !== 'inativo' && entrouAte(mb, mesSel, anoSel)).length
    const totalMens = (naoPagosReg + semRegistroCobraveis) * 20

    // Anuidades: pendentes (não pagas)
    const totalAnu = (anu ?? []).filter(r => r.status !== 'pago').reduce((s, r) => s + +r.valor, 0)

    // Eventos: falta receber de participantes (simples/ingresso) + pedidos (lista)
    let totalEv = 0
    const evIds = (evs ?? []).map(e => e.id)
    if (evIds.length) {
      const [{ data: parts }, { data: peds }] = await Promise.all([
        supabase.from('evento_participantes').select('*').in('evento_id', evIds),
        supabase.from('evento_pedidos').select('valor, pago, evento_id').in('evento_id', evIds),
      ])
      for (const p of parts ?? []) {
        if (p.pago) continue
        const ev = (evs ?? []).find(e => e.id === p.evento_id)
        if (ev) totalEv += ev.tipo === 'ingresso' ? +ev.valor * p.qtd : +ev.valor
      }
      for (const pd of peds ?? []) {
        if (!pd.pago) totalEv += +pd.valor
      }
    }

    setResumo({ pendente: totalMens + totalAnu + totalEv, anuidade: totalAnu, mensalidades: totalMens, eventos: totalEv })
  }

  const mesLabel = MESES_C[mesSel - 1]
  const mostraMeses = tab !== 'anuidades' && tab !== 'pendencias'
  const mostraAnos = tab !== 'pendencias'
  const tabs = [
    { id: 'mensalidades' as const, label: 'Mensalidades' },
    { id: 'anuidades'    as const, label: 'Anuidades' },
    { id: 'eventos'      as const, label: 'Eventos' },
    { id: 'pendencias'   as const, label: 'Pendências' },
  ]

  const cards = [
    { label: `Pendente em ${mesLabel}`,    value: resumo.pendente,     destaque: true },
    { label: `Anuidade ${anoSel}`,          value: resumo.anuidade,     destaque: false },
    { label: `Mensalidades ${mesLabel}`,    value: resumo.mensalidades, destaque: false },
    { label: `Eventos ${mesLabel}`,         value: resumo.eventos,      destaque: false },
  ]

  function exportarRelatorio() {
    const linhas = gerarLinhas()
    const nome = `${tab}_${mostraMeses ? mesLabel + '_' : ''}${anoSel}.xlsx`
    exportarExcel(nome, linhas, tab)
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

        {mostraAnos && ANOS.map(a => {
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
          <FileSpreadsheet size={15} className="text-emerald-500" /> Exportar Excel
        </button>
      </div>

      {/* Conteúdo */}
      {tab === 'mensalidades' && <TabMensalidades mes={mesSel} ano={anoSel} registrar={registrar} onMudou={fetchResumoDebounced} />}
      {tab === 'anuidades'    && <TabAnuidades ano={anoSel} registrar={registrar} onMudou={fetchResumoDebounced} />}
      {tab === 'eventos'      && <TabEventos mes={mesSel} ano={anoSel} registrar={registrar} onMudou={fetchResumoDebounced} />}
      {tab === 'pendencias'   && <TabPendencias registrar={registrar} onMudou={fetchResumoDebounced} />}
    </div>
  )
}
