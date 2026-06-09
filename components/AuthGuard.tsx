'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Sem Supabase configurado, libera (modo desenvolvimento)
    if (!isSupabaseConfigured()) { setAllowed(true); return }

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAllowed(true)
      else router.replace('/login')
    })
  }, [router])

  if (!allowed) {
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
