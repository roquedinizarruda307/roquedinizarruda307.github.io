'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, X, AlertCircle, UserCheck, List, Cake, ArrowRightCircle, ChevronDown } from 'lucide-react'
import { carregarPendencias } from '@/lib/pendencias'
import { usePapel, ehAdmin } from '@/components/PapelContext'
import { hojeLocal, hojeDate, parseDataLocal, fmtDataBR } from '@/lib/datas'
import { COLUNAS_MEMBRO, SITUACOES, infoSituacao, carregarDadosPessoais, juntarDadosPessoais, type Situacao, type MembroLinha } from '@/lib/membros'
import { infoMaioridade, DIAS_AVISO_21 } from '@/lib/maioridade'
import { ehMesCobrado, filtroEmAberto } from '@/lib/mensalidades'
import PresencaMembro from '@/components/PresencaMembro'
import { FREQUENCIA_MINIMA } from '@/lib/escrivao'
import { calcularFrequencia, carregarSemestre, fmtPct, semestreAtual, type PresencaFreq, type ResultadoFreq } from '@/lib/frequencia'

const inp = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:border-gray-400 transition-colors"
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const VALOR = 20

type Status = 'ativo' | 'senior' | 'afastado'
const STATUS: Record<Status, { label: string; color: string }> = {
  ativo:    { label: 'Ativo',    color: '#16a34a' },
  senior:   { label: 'Sênior',  color: '#1d4ed8' },
  afastado: { label: 'Afastado', color: '#9ca3af' },
}
/** Idade completa em anos na data `hoje` (null se a data for inválida). */
function idadeEm(nasc: Date, hoje: Date) {
  let anos = hoje.getFullYear() - nasc.getFullYear()
  if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) anos--
  return anos
}

type FiltroSit = 'todas' | Situacao | 'sem'
type Ordem = 'nome' | 'situacao' | 'anuidade'

/** Linha "rótulo — valor" dos dados da Ordem. */
function LinhaDado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{rotulo}</span>
      <span className="text-sm font-semibold text-gray-800 text-right">{children}</span>
    </div>
  )
}

function BadgeSituacao({ situacao }: { situacao?: string | null }) {
  const s = infoSituacao(situacao)
  if (!s) return <span className="text-sm font-semibold text-gray-400">—</span>
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: s.fundo, color: s.cor }}>{s.label}</span>
  )
}

const CATEGORIA: Record<Status, string> = {
  ativo:    'Demolay Ativo',
  senior:   'Demolay Sênior',
  afastado: 'Demolay Afastado',
}

function ModalPendencias({ membro, onClose }: { membro: any; onClose: () => void }) {
  const [pendencias, setPendencias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    filtroEmAberto(supabase.from('mensalidades').select('*').eq('membro_id', membro.id))
      .order('ano').order('mes')
      .then(({ data }) => { setPendencias(data ?? []); setLoading(false) })
  }, [membro.id])

  const total = pendencias.reduce((s, p) => s + +p.valor, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900 text-sm">{membro.nome}</p>
            <p className="text-xs text-gray-400 mt-0.5">Mensalidades em aberto e presença</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 -mr-3 flex items-center justify-center flex-shrink-0 sm:w-auto sm:h-auto sm:mr-0 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 max-h-56 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-300 text-center py-4">Carregando...</p>
          ) : pendencias.length === 0 ? (
            <div className="text-center py-6">
              <UserCheck size={22} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Em dia.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendencias.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={12} className="text-red-400" />
                    <span className="text-sm text-gray-700">{MESES[p.mes - 1]} / {p.ano}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">
                    {(+p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {pendencias.length > 0 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex justify-between">
            <span className="text-sm text-gray-400">{pendencias.length} {pendencias.length === 1 ? 'mês' : 'meses'}</span>
            <span className="text-sm font-bold text-red-600">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        )}
        <PresencaMembro membro={membro} />
      </div>
    </div>
  )
}

export default function MembrosPage() {
  const [membros, setMembros] = useState<any[]>([])
  const [dividas, setDividas] = useState<Record<string, number>>({})
  const [transferindo, setTransferindo] = useState<string | null>(null)
  const { papel, carregando: carregandoPapel } = usePapel()
  // Só admin/dona transfere para Sênior (escrivão edita Membros, mas não faz a transferência)
  const podeAdministrar = !carregandoPapel && ehAdmin(papel)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroSit, setFiltroSit] = useState<FiltroSit>('todas')
  const [ordem, setOrdem] = useState<Ordem>('nome')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [modal, setModal] = useState<any | null>(null)
  const [form, setForm] = useState({ nome: '', matricula: '', status: 'ativo' as Status })

  useEffect(() => { fetchTudo() }, [])

  const [frequencias, setFrequencias] = useState<Record<string, ResultadoFreq>>({})

  async function fetchTudo() {
    setLoading(true)
    const sem = semestreAtual()
    const [{ data: lista }, pessoais, pend, freqSem] = await Promise.all([
      supabase.from('membros').select(COLUNAS_MEMBRO).order('nome'),
      // nascimento, iniciação, elevação, situação e anuidade: o banco só entrega a dono/admin
      carregarDadosPessoais(),
      carregarPendencias().catch(() => null),   // mesma regra do Painel, Pagamentos e Indicadores (lib/pendencias)
      carregarSemestre(sem.ano, sem.semestre),   // reuniões + presenças do semestre: uma consulta para a lista toda
    ])
    const m = juntarDadosPessoais((lista ?? []) as MembroLinha[], pessoais)
    setMembros(m)

    // Frequência do semestre atual (mesmo cálculo da ficha e da aba Frequência)
    const presPorMembro = new Map<string, PresencaFreq[]>()
    for (const p of freqSem.presencas) (presPorMembro.get(p.membro_id) ?? presPorMembro.set(p.membro_id, []).get(p.membro_id)!).push(p)
    const fr: Record<string, ResultadoFreq> = {}
    for (const mb of m ?? []) fr[mb.id] = calcularFrequencia(mb, freqSem.reunioes, presPorMembro.get(mb.id) ?? [])
    setFrequencias(fr)

    setDividas(pend?.porMembro ?? {})
    setLoading(false)
  }

  async function transferirSenior(m: { id: string; nome: string }, completou: string) {
    if (!podeAdministrar || transferindo) return
    if (!confirm(`Transferir ${m.nome} para Sênior DeMolay?\n\nEle completou 21 anos em ${completou}. O status passará de Ativo para Sênior e ele deixa de gerar mensalidade nova.`)) return
    setTransferindo(m.id)
    const { data: alt, error } = await supabase.from('membros').update({ status: 'senior' }).eq('id', m.id).eq('status', 'ativo').select('id')
    setTransferindo(null)
    if (error) { alert('Não foi possível transferir: ' + error.message); return }
    if (!alt?.length) { alert('Nada foi alterado (o membro já não está como Ativo ou sua conta não tem permissão).') }
    fetchTudo()
  }

  function abrirNovo() { setEditando(null); setForm({ nome: '', matricula: '', status: 'ativo' }); setShowForm(true) }
  function abrirEdicao(m: any) { setEditando(m); setForm({ nome: m.nome, matricula: m.matricula ?? '', status: m.status }); setShowForm(true) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (editando) {
      // .select: sem permissão no banco (RLS) o update não dá erro, só não altera nada — avisa
      const { data: alt, error } = await supabase.from('membros').update({ nome: form.nome, matricula: form.matricula, status: form.status }).eq('id', editando.id).select('id')
      if (error || !alt?.length) { alert('Não foi possível salvar. Sua conta pode não ter permissão para editar membros.'); return }
    } else {
      const { data: novo, error } = await supabase.from('membros')
        .insert([{ nome: form.nome, matricula: form.matricula, status: form.status, data_entrada: hojeLocal() }])
        .select('id').single()
      if (error || !novo) { alert('Não foi possível cadastrar. Sua conta pode não ter permissão para editar membros.'); return }
      if (novo?.id) {
        // membro novo só é cobrado a partir do mês de entrada (nada retroativo);
        // jan e jul não têm mensalidade
        const ano = new Date().getFullYear(), mes = new Date().getMonth() + 1
        if (ehMesCobrado(mes)) {
          await supabase.from('mensalidades').insert(
            [{ membro_id: novo.id, mes, ano, valor: VALOR, status: 'nao_pago' }]
          )
        }
      }
    }
    setShowForm(false); setEditando(null)
    setForm({ nome: '', matricula: '', status: 'ativo' })
    fetchTudo()
  }

  // Nascimento é dado pessoal: o aviso de 21 anos só aparece para dono/admin (o banco também não entrega ao escrivão)
  const maioridade = Object.fromEntries(membros.map(m => [m.id, podeAdministrar ? infoMaioridade(m) : null]))
  const jaCompletaram = membros.filter(m => maioridade[m.id]?.estado === 'completou')
  const proximos = membros.filter(m => maioridade[m.id]?.estado === 'em_breve')
    .sort((a, b) => (maioridade[a.id]!.dias - maioridade[b.id]!.dias))

  const hoje = hojeDate()
  const anuidadeVencida = (m: { anuidade_vencimento?: string | null }) => {
    const d = parseDataLocal(m.anuidade_vencimento)
    return !!d && d < hoje
  }
  const contagemSit = (s: FiltroSit) => membros.filter(m =>
    s === 'todas' ? true : s === 'sem' ? !infoSituacao(m.situacao) : infoSituacao(m.situacao)?.id === s).length
  const temDadosOrdem = podeAdministrar && membros.some(m => m.situacao || m.data_nascimento || m.data_iniciacao)

  const termo = busca.toLowerCase()
  const ordemSit = (s?: string | null) => { const i = SITUACOES.findIndex(x => x.id === infoSituacao(s)?.id); return i < 0 ? 99 : i }
  const filtrados = membros
    .filter(m => m.nome.toLowerCase().includes(termo) || (m.matricula ?? '').toLowerCase().includes(termo))
    .filter(m => !podeAdministrar || filtroSit === 'todas'
      || (filtroSit === 'sem' ? !infoSituacao(m.situacao) : infoSituacao(m.situacao)?.id === filtroSit))
    .sort((a, b) => {
      if (podeAdministrar && ordem === 'situacao') return ordemSit(a.situacao) - ordemSit(b.situacao) || a.nome.localeCompare(b.nome)
      if (podeAdministrar && ordem === 'anuidade') {
        // vencimento mais antigo primeiro; sem data no fim
        const da = a.anuidade_vencimento ?? '9999', db = b.anuidade_vencimento ?? '9999'
        return da.localeCompare(db) || a.nome.localeCompare(b.nome)
      }
      return a.nome.localeCompare(b.nome)
    })

  return (
    <div className="p-4 sm:p-7 max-w-6xl space-y-5">
      {modal && <ModalPendencias membro={modal} onClose={() => setModal(null)} />}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Membros</h1>
          <p className="text-sm text-gray-400 mt-0.5">{membros.length} cadastrados</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-1.5 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
          style={{ background: '#c0392b' }}>
          <Plus size={14} /> Novo membro
        </button>
      </div>

      {/* Formulário (modal) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => { setShowForm(false); setEditando(null) }}>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-800">{editando ? 'Editar membro' : 'Novo membro'}</p>
            <button onClick={() => { setShowForm(false); setEditando(null) }} className="text-gray-300 hover:text-gray-500">
              <X size={15} />
            </button>
          </div>
          <form onSubmit={salvar}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required placeholder="Nome completo" value={form.nome}
                onChange={e => setForm({...form, nome: e.target.value})} className={inp + ' md:col-span-2'} />
              <input placeholder="ID / Matrícula" value={form.matricula}
                onChange={e => setForm({...form, matricula: e.target.value})} className={inp} />
            </div>
            <div className="flex gap-2 mt-3">
              {(['ativo', 'senior', 'afastado'] as Status[]).map(s => (
                <button key={s} type="button" onClick={() => setForm({...form, status: s})}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={form.status === s
                    ? { borderColor: STATUS[s].color, color: STATUS[s].color, background: STATUS[s].color + '15' }
                    : { borderColor: '#e5e7eb', color: '#9ca3af', background: '#fff' }}>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
            {!editando && (
              <p className="text-xs text-gray-400 mt-2.5">
                Cobrado a partir do mês de entrada ({MESES[new Date().getMonth()]}), R$ {VALOR}/mês. Janeiro e julho não têm mensalidade.
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button type="submit" className="text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
                style={{ background: '#c0392b' }}>{editando ? 'Atualizar' : 'Salvar'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditando(null) }}
                className="border border-gray-200 text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* Avisos de maioridade (21 anos) */}
      {!loading && (jaCompletaram.length > 0 || proximos.length > 0) && (
        <div className="space-y-3">
          {jaCompletaram.length > 0 && (
            <div className="rounded-2xl border px-4 py-3.5" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
              <p className="text-sm font-bold flex items-center gap-2" style={{ color: '#9a3412' }}>
                <Cake size={15} /> {jaCompletaram.length === 1 ? '1 membro ativo já completou' : `${jaCompletaram.length} membros ativos já completaram`} 21 anos — transferir para Sênior
              </p>
              <p className="text-xs mt-1" style={{ color: '#9a3412' }}>
                {jaCompletaram.map(m => `${m.nome} (${maioridade[m.id]!.dataBR})`).join(' · ')}
              </p>
            </div>
          )}
          {proximos.length > 0 && (
            <div className="rounded-2xl border px-4 py-3.5" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
              <p className="text-sm font-bold flex items-center gap-2" style={{ color: '#1e40af' }}>
                <Cake size={15} /> Completam 21 anos nos próximos {DIAS_AVISO_21} dias
              </p>
              <ul className="text-xs mt-1 space-y-0.5" style={{ color: '#1e40af' }}>
                {proximos.map(m => (
                  <li key={m.id}>{m.nome} — {maioridade[m.id]!.dataBR} (em {maioridade[m.id]!.dias} dia{maioridade[m.id]!.dias !== 1 ? 's' : ''})</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input placeholder="Buscar por nome ou matrícula..." value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
      </div>

      {/* Filtro por situação e ordenação (só dono/admin, quando há dados da Ordem) */}
      {temDadosOrdem && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0" role="group" aria-label="Filtrar por situação">
            {([['todas', 'Todas'], ...SITUACOES.map(s => [s.id, s.label]), ['sem', 'Sem situação']] as [FiltroSit, string][])
              .filter(([id]) => id !== 'sem' || contagemSit('sem') > 0)
              .map(([id, label]) => {
                const ativo = filtroSit === id
                return (
                  <button key={id} type="button" onClick={() => setFiltroSit(id)} aria-pressed={ativo}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                    style={ativo ? { background: '#111827', color: '#fff', borderColor: '#111827' } : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
                    {label} <span className="opacity-60">{contagemSit(id)}</span>
                  </button>
                )
              })}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 sm:ml-auto">
            Ordenar
            <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white">
              <option value="nome">Nome</option>
              <option value="situacao">Situação</option>
              <option value="anuidade">Vencimento da anuidade</option>
            </select>
          </label>
        </div>
      )}

      {/* Grid de cards */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-300">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-300">Nenhum membro encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(m => {
            const st = STATUS[m.status as Status] ?? STATUS.ativo
            const cat = CATEGORIA[m.status as Status] ?? CATEGORIA.ativo
            const divida = dividas[m.id] ?? 0
            const fq = frequencias[m.id]
            const mai = maioridade[m.id]
            const fqBaixa = fq?.pct !== null && fq?.pct !== undefined && fq.pct < FREQUENCIA_MINIMA
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">

                {/* Topo: avatar + nome + status */}
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#f5f5f5' }}>
                    <span className="text-2xl font-black" style={{ color: '#c0392b' }}>
                      {m.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-gray-900 text-base leading-tight uppercase">{m.nome}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5"
                        style={{ color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{m.matricula || '—'}</p>
                  </div>
                </div>

                {/* Aviso de maioridade */}
                {mai?.estado === 'completou' && (
                  <div className="rounded-xl px-3 py-2.5 space-y-2" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#9a3412' }}>
                      <Cake size={13} /> Completou 21 anos em {mai.dataBR}
                    </p>
                    {podeAdministrar && (
                      <button onClick={() => transferirSenior(m, mai.dataBR)} disabled={transferindo === m.id}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
                        style={{ background: '#1d4ed8' }}>
                        <ArrowRightCircle size={13} /> {transferindo === m.id ? 'Transferindo...' : 'Transferir para Sênior DeMolay'}
                      </button>
                    )}
                  </div>
                )}
                {mai?.estado === 'em_breve' && (
                  <p className="text-xs font-semibold rounded-xl px-3 py-2 flex items-center gap-1.5" style={{ background: '#eff6ff', color: '#1e40af' }}>
                    <Cake size={13} /> Completa 21 anos em {mai.dataBR}
                  </p>
                )}

                {/* Dados da Ordem (só dono/admin; o banco não entrega ao escrivão) */}
                {podeAdministrar && (() => {
                  const nasc = parseDataLocal(m.data_nascimento)
                  const vencida = anuidadeVencida(m)
                  return (
                    <details className="group rounded-xl border border-gray-100 bg-gray-50/60">
                      <summary className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3 py-2.5 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">Dados da Ordem</span>
                        <span className="flex items-center gap-1.5 ml-auto">
                          {vencida && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                              style={{ background: '#fee2e2', color: '#b91c1c' }}>Anuidade vencida</span>
                          )}
                          <BadgeSituacao situacao={m.situacao} />
                          <ChevronDown size={14} className="text-gray-400 transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <div className="px-3 pb-3 pt-1 space-y-2">
                        <LinhaDado rotulo="Matrícula">{m.matricula || '—'}</LinhaDado>
                        <LinhaDado rotulo="Nascimento">
                          {nasc ? <>{fmtDataBR(nasc)} <span className="text-xs text-gray-400">({idadeEm(nasc, hoje)} anos)</span></> : '—'}
                        </LinhaDado>
                        <LinhaDado rotulo="Iniciação">{fmtDataBR(m.data_iniciacao)}</LinhaDado>
                        <LinhaDado rotulo="Elevação">{fmtDataBR(m.data_elevacao)}</LinhaDado>
                        <LinhaDado rotulo="Situação"><BadgeSituacao situacao={m.situacao} /></LinhaDado>
                        <LinhaDado rotulo="Anuidade vence">
                          <span style={vencida ? { color: '#b91c1c', fontWeight: 700 } : undefined}>
                            {fmtDataBR(m.anuidade_vencimento)}{vencida ? ' (vencida)' : ''}
                          </span>
                        </LinhaDado>
                      </div>
                    </details>
                  )
                })()}

                {/* Linha divisória */}
                <div style={{ borderTop: '1px solid #f3f3f3' }} />

                {/* Infos */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Categoria</span>
                    <span className="text-sm font-bold text-gray-900">{cat}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Dívida ativa</span>
                    <span className="text-sm font-bold" style={{ color: divida > 0 ? '#c0392b' : '#16a34a' }}>
                      {divida > 0
                        ? divida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : 'Em dia'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Frequência (semestre)</span>
                    {!fq || fq.pct === null ? (
                      <span className="text-sm font-bold text-gray-400">—</span>
                    ) : (
                      <span className="text-sm font-bold" style={{ color: fqBaixa ? '#c0392b' : '#16a34a' }}>
                        {fmtPct(fq.pct)} <span className="text-xs font-semibold text-gray-400">({fq.presencas} de {fq.consideradas})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => setModal(m)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors"
                    style={{ background: '#fff0f0', color: '#c0392b' }}>
                    <List size={13} /> Ver pendências
                  </button>
                  <button onClick={() => abrirEdicao(m)}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                    Editar
                  </button>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
