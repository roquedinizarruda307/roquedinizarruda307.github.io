import { createBrowserClient } from '@supabase/ssr'
import { createClient as createJsClient } from '@supabase/supabase-js'

const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder_anon_key'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const configured = url && !url.startsWith('your_') && key && !key.startsWith('your_')
  return createBrowserClient(
    configured ? url : PLACEHOLDER_URL,
    configured ? key : PLACEHOLDER_KEY
  )
}

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && !url.startsWith('your_') && key && !key.startsWith('your_'))
}

// Cliente só para "esqueci minha senha". Fluxo implícito: o link do e-mail traz o
// token no endereço e funciona mesmo aberto em outro aparelho/navegador (o PKCE
// padrão exigiria abrir no mesmo navegador que pediu). Sessão só em memória.
export function createRecoveryClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const configured = url && !url.startsWith('your_') && key && !key.startsWith('your_')
  return createJsClient(configured ? url : PLACEHOLDER_URL, configured ? key : PLACEHOLDER_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: true },
  })
}
