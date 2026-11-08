'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createRecoveryClient, isSupabaseConfigured } from '@/lib/supabase-browser'

// Página aberta pelo link do e-mail "esqueci minha senha".
// O link traz o token de recuperação no endereço (#access_token=...&type=recovery).
type Fase = 'verificando' | 'form' | 'invalido' | 'pronto'

const input: React.CSSProperties = { width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'13px 15px', fontSize:14, color:'#faf5f5', outline:'none', marginBottom:14 }

export default function RedefinirSenhaPage() {
  const cliente = useRef<ReturnType<typeof createRecoveryClient> | null>(null)
  const [fase, setFase] = useState<Fase>('verificando')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) { setFase('invalido'); return }
    // só aceita link de recuperação (type=recovery), não outros links com token
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const temToken = hash.get('type') === 'recovery' && !!hash.get('access_token')
    const c = createRecoveryClient()
    cliente.current = c
    c.auth.getSession().then(({ data: { session } }) => {
      // tira o token da barra de endereço
      if (window.location.hash) history.replaceState(null, '', window.location.pathname)
      setFase(session && temToken ? 'form' : 'invalido')
    })
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (senha !== confirma) { setErro('As duas senhas não são iguais.'); return }
    const c = cliente.current
    if (!c) return
    setLoading(true)
    const { error } = await c.auth.updateUser({ password: senha })
    setLoading(false)
    if (error) {
      setErro(/different from the old/i.test(error.message)
        ? 'A nova senha precisa ser diferente da anterior.'
        : 'Não foi possível salvar. O link pode ter expirado; peça um novo na tela de login.')
      return
    }
    await c.auth.signOut()
    setFase('pronto')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#0e0101', display:'flex', alignItems:'center', justifyContent:'center', padding:16, fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ width:'100%', maxWidth:420, padding:'36px 28px', borderRadius:20, border:'1px solid rgba(255,255,255,.08)', background:'#0c0606', boxShadow:'0 40px 120px rgba(0,0,0,.7)' }}>
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#fff' }}>Criar nova senha</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', letterSpacing:'.18em', textTransform:'uppercase', marginTop:3 }}>Capítulo Nº 307</div>
        </div>

        {fase === 'verificando' && <p style={{ color:'rgba(255,255,255,.5)', fontSize:13 }}>Verificando link…</p>}

        {fase === 'invalido' && (
          <p style={{ color:'#fca5a5', fontSize:13, lineHeight:1.5 }}>
            Este link é inválido ou expirou. Volte ao <Link href="/login" style={{ color:'#e07a6f', textDecoration:'underline' }}>login</Link> e use “Esqueci minha senha” para receber outro.
          </p>
        )}

        {fase === 'pronto' && (
          <p style={{ color:'#86efac', fontSize:13, lineHeight:1.5 }}>
            Senha alterada. <Link href="/login" style={{ color:'#e07a6f', textDecoration:'underline' }}>Entrar com a nova senha</Link>.
          </p>
        )}

        {fase === 'form' && (
          <form onSubmit={salvar}>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Nova senha (mín. 8 caracteres)" required minLength={8} autoComplete="new-password" style={input} />
            <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} placeholder="Confirmar nova senha" required minLength={8} autoComplete="new-password" style={input} />
            {erro && <p style={{ fontSize:12, color:'#fca5a5', marginBottom:12 }}>{erro}</p>}
            <button type="submit" disabled={loading} style={{ width:'100%', background:'#c0392b', color:'#fff', border:'none', borderRadius:10, padding:14, fontSize:14.5, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1 }}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
