import { isSupabaseConfigured } from '@/lib/supabase-browser'
import { createRecoveryClient } from '@/lib/supabase-recuperacao'
import { asset } from '@/lib/asset'

// Endereço público da página que define a nova senha.
// Usa a origem atual (localhost ou site no ar) + basePath, com barra final
// porque o projeto usa trailingSlash: true.
export function urlRedefinirSenha(): string {
  return `${window.location.origin}${asset('/redefinir-senha/')}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailValido(email: string): boolean {
  const e = email.trim()
  return e.length <= 254 && EMAIL_RE.test(e)
}

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string; limite?: boolean }

// Pede ao Supabase o e-mail de recuperação. A resposta de sucesso é sempre
// neutra (não revela se o e-mail tem conta).
export async function pedirLinkRecuperacao(email: string): Promise<ResultadoEnvio> {
  if (!isSupabaseConfigured()) return { ok: false, erro: 'Supabase não configurado.' }
  const limpo = email.trim().toLowerCase()
  if (!emailValido(limpo)) return { ok: false, erro: 'Digite um e-mail válido.' }

  const supabase = createRecoveryClient()
  const { error } = await supabase.auth.resetPasswordForEmail(limpo, { redirectTo: urlRedefinirSenha() })
  if (!error) return { ok: true }

  const code = (error as { code?: string }).code ?? ''
  if (error.status === 429 || code.includes('rate_limit') || /rate limit|security purposes/i.test(error.message)) {
    return { ok: false, limite: true, erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }
  }
  return { ok: false, erro: 'Não foi possível enviar agora. Verifique sua conexão e tente de novo.' }
}
