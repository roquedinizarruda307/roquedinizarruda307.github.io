'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'

export type Papel = 'admin' | 'escrivao'

// null = sem papel válido (sem acesso). Nunca assume admin por padrão.
const Ctx = createContext<{ papel: Papel | null; carregando: boolean }>({ papel: null, carregando: true })
export const usePapel = () => useContext(Ctx)

// 'dono' (donos do sistema) tem as mesmas permissões de admin.
function papelValido(p: unknown): Papel | null {
  if (p === 'admin' || p === 'dono') return 'admin'
  if (p === 'escrivao') return 'escrivao'
  return null
}

export function PapelProvider({ children }: { children: React.ReactNode }) {
  const [papel, setPapel] = useState<Papel | null>(null)
  const [carregando, setCarregando] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Sem Supabase: admin só em desenvolvimento local.
    if (!isSupabaseConfigured()) { setPapel(process.env.NODE_ENV === 'production' ? null : 'admin'); setCarregando(false); return }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) { setPapel(null); setCarregando(false); return }
      const { data } = await supabase.from('perfis').select('papel,aprovado').eq('email', user.email.trim().toLowerCase()).maybeSingle()
      setPapel(data?.aprovado === true ? papelValido(data.papel) : null)
      setCarregando(false)
    })
  }, [])

  // Escrivão só acessa a aba do escrivão
  useEffect(() => {
    if (carregando) return
    if (papel === 'escrivao' && !pathname.startsWith('/tesouraria/escrivao')) {
      router.replace('/tesouraria/escrivao')
    }
  }, [papel, carregando, pathname, router])

  // Não renderiza a área logada enquanto o papel não for confirmado,
  // nem se o papel for desconhecido (o AuthGuard já mostra a tela de sem acesso).
  if (carregando || !papel) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {carregando ? 'Verificando acesso…' : 'Sem acesso'}
        </span>
      </div>
    )
  }

  return <Ctx.Provider value={{ papel, carregando }}>{children}</Ctx.Provider>
}
