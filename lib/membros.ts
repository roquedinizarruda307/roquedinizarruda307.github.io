// Leitura de membros respeitando a PRIVACIDADE do banco
// (supabase/migrations/20261111_membros_dados_pessoais.sql):
// - a tabela membros só libera SELECT nas colunas comuns (nunca use select('*') nela:
//   o banco recusa a consulta inteira, para qualquer conta);
// - nascimento, iniciação, elevação, situação, anuidade, e-mail e telefone vêm da função
//   membros_dados_pessoais(), que só devolve linhas para dono e admin.
import { supabase } from '@/lib/supabase'

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
