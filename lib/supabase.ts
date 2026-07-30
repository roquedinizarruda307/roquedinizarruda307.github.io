import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const cliente = createClient(supabaseUrl, supabaseAnonKey)

// ─── Modo consulta (escrivão) ─────────────────────────────────────────────────
// O escrivão vê todas as telas, mas só grava alterações nas abas Escrivão e
// Membros. Qualquer insert/update/delete fora delas é bloqueado aqui, antes do banco.
let modoConsulta = false
export const setModoConsulta = (v: boolean) => { modoConsulta = v }

const ABAS_LIVRES_ESCRIVAO = ['/tesouraria/escrivao', '/tesouraria/membros']
const escritaBloqueada = () =>
  modoConsulta && typeof window !== 'undefined' &&
  !ABAS_LIVRES_ESCRIVAO.some(r => window.location.pathname.startsWith(r))

let ultimoAviso = 0
function bloqueado(): any {
  if (Date.now() - ultimoAviso > 2000) {
    ultimoAviso = Date.now()
    alert('Modo consulta: você pode ver tudo, mas só editar as abas Escrivão e Membros.')
  }
  // objeto encadeável: aceita qualquer chamada e, ao ser aguardado, devolve erro
  const proxy: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: any) => resolve({ data: null, error: { message: 'Somente leitura (modo consulta)' } })
      return () => proxy
    },
    apply() { return proxy },
  })
  return proxy
}

export const supabase = new Proxy(cliente, {
  get(alvo, prop) {
    if (prop === 'from') {
      return (tabela: string) => {
        const builder: any = (alvo as any).from(tabela)
        return new Proxy(builder, {
          get(b, m) {
            if (['insert', 'update', 'delete', 'upsert'].includes(String(m)) && escritaBloqueada()) {
              return () => bloqueado()
            }
            const v = (b as any)[m]
            return typeof v === 'function' ? v.bind(b) : v
          },
        })
      }
    }
    const v = (alvo as any)[prop]
    return typeof v === 'function' ? v.bind(alvo) : v
  },
}) as typeof cliente

export type Membro = {
  id: string
  nome: string
  email: string
  telefone: string
  cargo: string
  status: 'ativo' | 'inativo'
  data_entrada: string
  created_at: string
}

export type Transacao = {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  data: string
  categoria: string
  membro_id?: string
  created_at: string
}

export type Mensalidade = {
  id: string
  membro_id: string
  membro?: Membro
  mes: number
  ano: number
  valor: number
  status: 'pago' | 'pendente' | 'atrasado'
  data_pagamento?: string
  created_at: string
}
