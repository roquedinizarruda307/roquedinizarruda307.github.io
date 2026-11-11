// Leitura de membros respeitando a PRIVACIDADE do banco
// (supabase/migrations/20261111_membros_dados_pessoais.sql):
// - a tabela membros só libera SELECT nas colunas comuns (nunca use select('*') nela:
//   o banco recusa a consulta inteira, para qualquer conta);
// - nascimento, iniciação, elevação, situação, anuidade, e-mail e telefone vêm da função
//   membros_dados_pessoais(), que só devolve linhas para dono e admin.
import { supabase } from '@/lib/supabase'
import { parseDataLocal, paraISOData } from '@/lib/datas'

/** Colunas comuns de membros (legíveis por qualquer conta aprovada). */
export const COLUNAS_MEMBRO = 'id, nome, matricula, status, data_entrada, cargo, created_at'

/** Linha de membros com as colunas de COLUNAS_MEMBRO. */
export type MembroLinha = {
  id: string
  nome: string
  matricula: string | null
  status: string
  data_entrada: string | null
  cargo: string | null
  created_at: string
}

export type Situacao ='regular' | 'irregular' | 'inativo'

export type DadosPessoais = {
  id: string
  data_nascimento: string | null
  data_iniciacao: string | null
  data_elevacao: string | null
  situacao: Situacao | null
  anuidade_vencimento: string | null
}

export const SITUACOES: readonly { id: Situacao; label: string; cor: string; fundo: string }[] = [
  { id: 'regular',   label: 'Regular',   cor: '#15803d', fundo: '#dcfce7' },
  { id: 'irregular', label: 'Irregular', cor: '#b45309', fundo: '#fef3c7' },
  { id: 'inativo',   label: 'Inativo',   cor: '#6b7280', fundo: '#f3f4f6' },
]
export const infoSituacao = (s?: string | null) => SITUACOES.find(x => x.id === String(s ?? '').toLowerCase()) ?? null

/**
 * Dados pessoais por id de membro. Só dono/admin recebem linhas; para os demais
 * (ou se a migração ainda não foi aplicada) devolve um mapa vazio.
 * Não guarda nada no navegador além da memória da página.
 */
export async function carregarDadosPessoais(): Promise<Record<string, DadosPessoais>> {
  const { data, error } = await supabase.rpc('membros_dados_pessoais')
  if (error || !Array.isArray(data)) return {}
  const out: Record<string, DadosPessoais> = {}
  for (const r of data as DadosPessoais[]) {
    if (!r?.id) continue
    out[r.id] = {
      id: r.id,
      data_nascimento: r.data_nascimento ?? null,
      data_iniciacao: r.data_iniciacao ?? null,
      data_elevacao: r.data_elevacao ?? null,
      situacao: infoSituacao(r.situacao)?.id ?? null,
      anuidade_vencimento: r.anuidade_vencimento ?? null,
    }
  }
  return out
}

/** Junta os dados pessoais (quando houver) às linhas comuns de membros. */
export function juntarDadosPessoais<T extends { id: string }>(membros: T[], dados: Record<string, DadosPessoais>) {
  return membros.map(m => {
    const { id: _id, ...resto } = dados[m.id] ?? {}
    void _id
    return { ...m, ...resto } as T & Partial<Omit<DadosPessoais, 'id'>>
  })
}

/**
 * Novo vencimento ao registrar a anuidade paga: soma 1 ano ao vencimento atual se
 * ele ainda estiver no futuro (não perde dias pagos adiantado); senão, 1 ano a partir de hoje.
 * 29/02 + 1 ano vira 28/02 (não pula para março).
 */
export function proximoVencimentoAnuidade(atual: string | null | undefined, hoje: Date): string {
  const d = parseDataLocal(atual)
  const base = d && d > hoje ? d : hoje
  const ano = base.getFullYear() + 1, mes = base.getMonth()
  const dia = Math.min(base.getDate(), new Date(ano, mes + 1, 0).getDate())
  return paraISOData(new Date(ano, mes, dia))
}

/**
 * Grava situação e vencimento da anuidade de UM membro (só dono/admin).
 * Usa a função do banco membros_atualizar_dados_ordem (migração 20261111c), porque
 * as contas logadas não gravam essas colunas direto na tabela.
 * Lança Error com a mensagem do banco em caso de falha.
 */
export async function atualizarDadosOrdem(id: string, situacao: Situacao | null, anuidadeVencimento: string | null) {
  if (!id) throw new Error('Membro não informado.')
  if (situacao !== null && !SITUACOES.some(s => s.id === situacao)) throw new Error('Situação inválida.')
  if (anuidadeVencimento !== null && !parseDataLocal(anuidadeVencimento)) throw new Error('Data de vencimento inválida.')
  const { error } = await supabase.rpc('membros_atualizar_dados_ordem', {
    p_id: id,
    p_situacao: situacao,
    p_anuidade_vencimento: anuidadeVencimento,
  })
  if (error) throw new Error(error.message)
}
