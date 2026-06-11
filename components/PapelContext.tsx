'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'

export type Papel = 'admin' | 'escrivao'

const Ctx = createContext<{ papel: Papel; carregando: boolean }>({ papel: 'admin', carregando: true })
export const usePapel = () => useContext(Ctx)

export function PapelProvider({ children }: { children: React.ReactNode }) {
  const [papel, setPapel] = useState<Papel>('admin')
  const [carregando, setCarregando] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isSupabaseConfigured()) { setPapel('admin'); setCarregando(false); return }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) { setPapel('admin'); setCarregando(false); return }
      const { data } = await supabase.from('perfis').select('papel').eq('email', user.email.toLowerCase()).maybeSingle()
      setPapel((data?.papel as Papel) ?? 'admin')
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

  return <Ctx.Provider value={{ papel, carregando }}>{children}</Ctx.Provider>
}
