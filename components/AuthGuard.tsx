'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'

type Estado = 'verificando' | 'liberado' | 'pendente'

// Papéis que dão acesso à área logada ('dono' = admin). Qualquer outro valor = sem acesso.
const PAPEIS_VALIDOS = ['dono', 'admin', 'escrivao']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>('verificando')
  const router = useRouter()

  useEffect(() => {
    // Sem Supabase configurado: libera só em desenvolvimento local; em produção bloqueia.
    if (!isSupabaseConfigured()) { setEstado(process.env.NODE_ENV === 'production' ? 'pendente' : 'liberado'); return }
    // Rodando local (npm run dev), libera sem login — nunca vale no site publicado.
    // O papel continua vindo do PapelContext (sem login = modo consulta).
    if (process.env.NODE_ENV === 'development') { setEstado('liberado'); return }

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      // Nega por padrão: só libera com perfil existente, aprovado e papel conhecido.
      // Sem perfil, não aprovado, papel desconhecido ou erro na consulta = sem acesso.
      const { data, error } = await supabase.from('perfis').select('aprovado,papel').eq('email', (user.email ?? '').trim().toLowerCase()).maybeSingle()
      if (!error && data && data.aprovado === true && PAPEIS_VALIDOS.includes(data.papel)) setEstado('liberado')
      else setEstado('pendente')
    })
  }, [router])

  async function sair() {
    const supabase = createClient()
    if (isSupabaseConfigured()) await supabase.auth.signOut()
    router.replace('/login')
  }

  if (estado === 'pendente') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e07a6f', fontSize: 26 }}>⏳</div>
        <div>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Conta aguardando aprovação</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6, maxWidth: 340 }}>
            Sua conta ainda não tem acesso liberado. Um administrador do capítulo precisa aprovar seu acesso antes de você entrar no sistema.
          </p>
        </div>
        <button onClick={sair} style={{ marginTop: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 22px', cursor: 'pointer' }}>
          Sair
        </button>
      </div>
    )
  }

  if (estado !== 'liberado') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Verificando acesso…
        </span>
      </div>
    )
  }

  return <>{children}</>
}
