import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
