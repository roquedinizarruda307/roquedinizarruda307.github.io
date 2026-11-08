'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'
import { setModoConsulta } from '@/lib/supabase'

export type Papel = 'dono' | 'admin' | 'escrivao'

const Ctx = createContext<{ papel: Papel; carregando: boolean }>({ papel: 'admin', carregando: true })
export const usePapel = () => useContext(Ctx)

export function PapelProvider({ children }: { children: React.ReactNode }) {
  const [papel, setPapel] = useState<Papel>('admin')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // atalho de teste no computador local: ?papel=dono|admin|escrivao
    const teste = new URLSearchParams(window.location.search).get('papel')
    if (process.env.NODE_ENV === 'development' && (teste === 'dono' || teste === 'admin' || teste === 'escrivao')) {
      setPapel(teste as Papel); setCarregando(false); return
    }
    if (!isSupabaseConfigured()) { setPapel('admin'); setCarregando(false); return }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) { setPapel('escrivao'); setCarregando(false); return }
      const email = user.email.toLowerCase()
      const { data } = await supabase.from('perfis').select('papel').eq('email', email).maybeSingle()
      // sem ficha em perfis = sem acesso (o AuthGuard já mostra "aguardando aprovação").
      // Nunca criar perfil pelo navegador; papel mínimo por segurança.
      setPapel((data?.papel as Papel) ?? 'escrivao')
      setCarregando(false)
    })
  }, [])

  // Escrivão vê tudo, mas só edita a própria aba (escritas fora dela são bloqueadas)
  useEffect(() => { setModoConsulta(papel === 'escrivao') }, [papel])

  return <Ctx.Provider value={{ papel, carregando }}>{children}</Ctx.Provider>
}
