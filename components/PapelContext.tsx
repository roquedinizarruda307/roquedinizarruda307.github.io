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
      if (!user?.email) { setPapel('admin'); setCarregando(false); return }
      const email = user.email.toLowerCase()
      const { data } = await supabase.from('perfis').select('papel').eq('email', email).maybeSingle()
      // conta antiga sem ficha: cria uma automaticamente (admin, como já era o acesso dela)
      // para sempre aparecer em Ajustes → Contas e níveis
      if (!data) await supabase.from('perfis').upsert({ email, papel: 'admin', aprovado: true }, { onConflict: 'email' })
      setPapel((data?.papel as Papel) ?? 'admin')
      setCarregando(false)
    })
  }, [])

  // Escrivão vê tudo, mas só edita a própria aba (escritas fora dela são bloqueadas)
  useEffect(() => { setModoConsulta(papel === 'escrivao') }, [papel])

  return <Ctx.Provider value={{ papel, carregando }}>{children}</Ctx.Provider>
}
