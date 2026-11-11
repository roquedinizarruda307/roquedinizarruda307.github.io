'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'
import { setModoConsulta } from '@/lib/supabase'

// 'dono' = conta dona do sistema: tudo o que o admin pode + a aba Ajustes.
export type Papel = 'dono' | 'admin' | 'escrivao'

// null = sem papel válido (sem acesso). Nunca assume admin por padrão.
const Ctx = createContext<{ papel: Papel | null; carregando: boolean }>({ papel: null, carregando: true })
export const usePapel = () => useContext(Ctx)

// Só aceita papéis conhecidos; qualquer outro valor = sem acesso.
function papelValido(p: unknown): Papel | null {
  if (p === 'dono' || p === 'admin' || p === 'escrivao') return p
  return null
}

// 'dono' tem as mesmas permissões de admin em todas as telas.
export const ehAdmin = (p: Papel | null) => p === 'admin' || p === 'dono'

export function PapelProvider({ children }: { children: React.ReactNode }) {
  const [papel, setPapel] = useState<Papel | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const dev = process.env.NODE_ENV === 'development'
    // atalho de teste no computador local: ?papel=dono|admin|escrivao
    const teste = papelValido(new URLSearchParams(window.location.search).get('papel'))
    if (dev && teste) { setPapel(teste); setCarregando(false); return }
    // Sem Supabase: admin só em desenvolvimento local; em produção, sem acesso.
    if (!isSupabaseConfigured()) { setPapel(dev ? 'admin' : null); setCarregando(false); return }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      // sem login: no computador local (npm run dev) entra em modo consulta; publicado = sem acesso
      if (!user?.email) { setPapel(dev ? 'escrivao' : null); setCarregando(false); return }
      const { data, error } = await supabase.from('perfis').select('papel,aprovado').eq('email', user.email.trim().toLowerCase()).maybeSingle()
      // Nega por padrão: sem ficha, não aprovado, erro ou papel desconhecido = sem acesso.
      // Nunca criar perfil pelo navegador.
      setPapel(!error && data?.aprovado === true ? papelValido(data.papel) : null)
      setCarregando(false)
    })
  }, [])

  // Escrivão vê tudo, mas só edita as abas liberadas (escritas fora delas são bloqueadas).
  // Sem papel também fica em modo consulta, por segurança.
  useEffect(() => { setModoConsulta(papel !== 'admin' && papel !== 'dono') }, [papel])

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
