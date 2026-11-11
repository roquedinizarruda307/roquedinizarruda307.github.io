import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client SÓ para recuperação de senha, com fluxo "implicit".
// Motivo: no PKCE (padrão do @supabase/ssr) o link do e-mail só funciona no
// mesmo navegador que pediu a recuperação. No implicit, o Supabase devolve
// #access_token=...&type=recovery direto na URL, funcionando em qualquer
// aparelho com o template padrão ({{ .ConfirmationURL }}).
// A sessão fica só em memória (não mistura com o login normal) e some ao
// sair da página.
let client: SupabaseClient | null = null

export function createRecoveryClient(): SupabaseClient {
  if (client) return client
  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key',
    {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false, // a página /redefinir-senha lê a URL manualmente
        storageKey: 'sb-recuperacao-senha',
      },
    }
  )
  return client
}
