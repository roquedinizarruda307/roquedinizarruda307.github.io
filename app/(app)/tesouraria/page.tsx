'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Users } from 'lucide-react'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Home() {
  const [stats, setStats] = useState({ saldo: 0, receitas: 0, despesas: 0, pendencias: 0, ativos: 0 })
  const [dividas, setDividas] = useState({ anuidades: 0, mensalidades: 0, eventos: 0 })
  const [notifs, setNotifs] = useState<{ id: string; nome: string; descricao: string; tipo: string }[]>([])
  const mesAtual = MESES_C[new Date().getMonth()]

  useEffect(() => {
    async function load() {
      const now = new Date()
      const mes = now.getMonth() + 1
      const ano = now.getFullYear()
      const m = String(mes).padStart(2,'0')
      const pm = mes === 12 ? 1 : mes + 1
      const pa = mes === 12 ? ano + 1 : ano
      const pm2 = String(pm).padStart(2,'0')

      const [{ data: transAll },{ data: transMes },{ data: mensP },{ data: membrosAtivos },{ data: anuP },{ data: evtP }] =
        await Promise.all([
          supabase.from('transacoes').select('tipo,valor'),
          supabase.from('transacoes').select('tipo,valor').gte('data',`${ano}-${m}-01`).lt('data',`${pa}-${pm2}-01`),
          supabase.from('mensalidades').select('membro_id,valor').eq('status','nao_pago'),
          supabase.from('membros').select('id').eq('status','ativo'),
          supabase.from('anuidades').select('valor').eq('status','pendente'),
          supabase.from('pagamentos_eventos').select('valor').eq('status','pendente'),
        ])

      const saldo = (transAll??[]).reduce((s,t)=>t.tipo==='entrada'?s+ +t.valor:s- +t.valor,0)
      const receitas = (transMes??[]).filter(t=>t.tipo==='entrada').reduce((s,t)=>s+ +t.valor,0)
      const despesas = (transMes??[]).filter(t=>t.tipo==='saida').reduce((s,t)=>s+ +t.valor,0)
      const pendencias = (mensP??[]).reduce((s,t)=>s+ +t.valor,0)
      setStats({ saldo, receitas, despesas, pendencias, ativos: membrosAtivos?.length??0 })
      setDividas({
        anuidades:   (anuP??[]).reduce((s,t)=>s+ +t.valor,0),
        mensalidades: pendencias,
        eventos:     (evtP??[]).reduce((s,t)=>s+ +t.valor,0),
      })

      // Notificações: mensalidades nao_pago + eventos atrasados
      const memIds = [...new Set((mensP??[]).map(r=>r.membro_id))]
      const notifList: typeof notifs = []

      if (memIds.length) {
        const { data: nomes } = await supabase.from('membros').select('id,nome').in('id', memIds.slice(0,20))
        const nomeMap = Object.fromEntries((nomes??[]).map(n=>[n.id,n.nome]))
        const { data: mensAtrasadas } = await supabase.from('mensalidades')
          .select('id,membro_id,mes,ano,valor').eq('status','nao_pago')
          .order('ano').order('mes').limit(10)
        for (const r of mensAtrasadas??[]) {
          notifList.push({
            id: r.id,
            nome: nomeMap[r.membro_id]??'—',
            descricao: `Mensalidade ${MESES_C[r.mes-1]}/${r.ano}: ${(+r.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} pendente`,
            tipo: 'mensalidade',
          })
        }
      }

      const { data: evts } = await supabase.from('pagamentos_eventos')
        .select('id,nome,valor,status').neq('status','pago').limit(5)
      for (const ev of evts??[]) {
        notifList.push({
          id: ev.id,
          nome: ev.nome,
          descricao: `${ev.nome}: ${(+ev.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} pendente`,
          tipo: ev.status,
        })
      }

      setNotifs(notifList)
    }
    load()
  }, [])

  const cards = [
    { label: 'Saldo Atual',          value: fmt(stats.saldo),      color: stats.saldo>=0?'#16a34a':'#c0392b', icon: Wallet },
    { label: `Receitas em ${mesAtual}`,  value: fmt(stats.receitas),   color: '#111827', icon: TrendingUp },
    { label: `Despesas em ${mesAtual}`,  value: fmt(stats.despesas),   color: '#111827', icon: TrendingDown },
    { label: 'Pendências Totais',    value: fmt(stats.pendencias),  color: '#c0392b',  icon: AlertCircle },
    { label: 'Demolays Ativos',      value: String(stats.ativos),   color: '#1d4ed8',  icon: Users },
  ]

  const tipoCor = (tipo: string) =>
    tipo === 'pago'      ? '#16a34a' :
    tipo === 'atrasado'  ? '#c0392b' :
    tipo === 'mensalidade' ? '#c0392b' : '#a16207'

  const tipoLabel = (tipo: string) =>
    tipo === 'atrasado'   ? 'Atrasado' :
    tipo === 'mensalidade'? 'Pendente' : 'Pendente'

  return (
    <div>

      {/* Conteúdo do dashboard */}
      <div className="p-7 space-y-5 max-w-6xl">

      {/* 5 Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-tight pr-2">{label}</p>
              <Icon size={14} className="text-gray-300 flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-xl font-black" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Notificações */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <span className="text-sm font-black tracking-widest uppercase text-gray-800">Central de Notificações</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {notifs.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-300">Nenhuma notificação no momento</div>
            ) : notifs.map(n => (
              <div key={n.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: tipoCor(n.tipo) }} />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{n.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{n.descricao}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0 ml-3"
                  style={{ background: tipoCor(n.tipo) + '20', color: tipoCor(n.tipo) }}>
                  {tipoLabel(n.tipo)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo de dívidas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm font-black tracking-widest uppercase text-gray-800">Resumo de Dívidas</p>
          </div>
          <div className="px-6 py-5 space-y-5">
            {[
              { label: 'Anuidades',    value: dividas.anuidades },
              { label: 'Mensalidades', value: dividas.mensalidades },
              { label: 'Eventos',      value: dividas.eventos },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-1">{label}</p>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-black text-gray-900">{fmt(value)}</p>
                  {value > 0 && (
                    <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded"
                      style={{ background: '#fef2f2', color: '#c0392b' }}>Pendente</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      </div> {/* fecha p-7 wrapper */}
    </div>
  )
}
