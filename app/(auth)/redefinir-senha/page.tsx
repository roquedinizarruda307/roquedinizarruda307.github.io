'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/supabase-browser'
import { createRecoveryClient } from '@/lib/supabase-recuperacao'
import { pedirLinkRecuperacao } from '@/lib/recuperar-senha'

// Guarda a URL original assim que o módulo carrega no navegador.
// O link padrão do e-mail ({{ .ConfirmationURL }}) volta para cá com
// #access_token=...&refresh_token=...&type=recovery (fluxo implicit).
const URL_INICIAL = typeof window !== 'undefined' ? window.location.href : ''

type Estado = 'verificando' | 'pronto' | 'invalido' | 'salvando' | 'sucesso'

function lerParametros(href: string) {
  const u = new URL(href)
  const hash = new URLSearchParams(u.hash.replace(/^#/, ''))
  const get = (k: string) => u.searchParams.get(k) ?? hash.get(k)
  return {
    tokenHash: get('token_hash'),
    type: get('type'),
    accessToken: hash.get('access_token'),
    refreshToken: hash.get('refresh_token'),
  }
}

function limparUrl() {
  // remove tokens da barra de endereço/histórico
  window.history.replaceState(null, '', window.location.pathname)
}

const input: React.CSSProperties = { width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'13px 15px', fontFamily:"'DM Sans',sans-serif", fontSize:16, color:'#faf5f5', outline:'none' }
const label: React.CSSProperties = { display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.35)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:7 }
const botao = (desab: boolean): React.CSSProperties => ({ width:'100%', background:'#c0392b', color:'#fff', border:'none', borderRadius:10, padding:14, fontFamily:"'DM Sans',sans-serif", fontSize:14.5, fontWeight:700, cursor: desab ? 'not-allowed' : 'pointer', opacity: desab ? .7 : 1 })
const link: React.CSSProperties = { background:'none', border:'none', padding:0, font:'inherit', color:'rgba(220,100,100,.7)', cursor:'pointer' }

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('verificando')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  // pedir novo link (quando o atual é inválido)
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    if (!isSupabaseConfigured()) { Promise.resolve().then(() => setEstado('invalido')); return }

    const supabase = createRecoveryClient()

    ;(async () => {
      const p = lerParametros(URL_INICIAL || window.location.href)
      limparUrl()
      try {
        let ok = false
        // 1) Link padrão (implicit): #access_token=...&type=recovery
        if (p.accessToken && p.refreshToken && p.type === 'recovery') {
          const { data, error } = await supabase.auth.setSession({ access_token: p.accessToken, refresh_token: p.refreshToken })
          if (error) throw error
          ok = !!data.session
        }
        // 2) Link com token_hash (caso o template seja trocado no futuro)
        else if (p.tokenHash && p.type === 'recovery') {
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: p.tokenHash, type: 'recovery' })
          if (error) throw error
          ok = !!data.session
        }
        // Qualquer outra coisa (?code= antigo do PKCE, #error=..., sem token) = link inválido
        setEstado(ok ? 'pronto' : 'invalido')
      } catch {
        setEstado('invalido')
      }
    })()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (senha.length > 72) { setErro('A senha pode ter no máximo 72 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não são iguais.'); return }

    setEstado('salvando')
    const supabase = createRecoveryClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      const code = (error as { code?: string }).code ?? ''
      let msg = 'Não foi possível salvar a nova senha. Tente de novo.'
      if (code === 'same_password') msg = 'A nova senha precisa ser diferente da anterior.'
      else if (code === 'weak_password') msg = 'Senha fraca. Use letras, números e símbolos.'
      else if (code === 'session_expired' || code === 'session_not_found' || error.status === 401) {
        setEstado('invalido'); return
      }
      setErro(msg)
      setEstado('pronto')
      return
    }
    // encerra a sessão de recuperação (e as demais sessões da conta)
    await supabase.auth.signOut()
    setSenha(''); setConfirma('')
    setEstado('sucesso')
    setTimeout(() => router.replace('/login'), 3000)
  }

  async function voltarLogin() {
    // a sessão de recuperação fica só em memória; descarta mesmo assim
    if (estado === 'pronto' && isSupabaseConfigured()) await createRecoveryClient().auth.signOut({ scope: 'local' })
    router.replace('/login')
  }

  async function pedirNovo(e: React.FormEvent) {
    e.preventDefault()
    if (enviando || cooldown > 0) return
    setEnviando(true); setErro(''); setAviso('')
    const r = await pedirLinkRecuperacao(email)
    setEnviando(false)
    if (r.ok) {
      setAviso('Se o e-mail estiver cadastrado, enviamos um novo link. Confira a caixa de entrada e o spam.')
      setCooldown(60)
    } else {
      setErro(r.erro)
      if (r.limite) setCooldown(60)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        body { background: #0e0101; }
        @keyframes cardIn { from{opacity:0;transform:translateY(30px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        .orb { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; }
        @media (max-width: 640px) { .reset-card { padding:32px 22px !important; border-radius:18px !important; } }
      `}</style>

      <div style={{ position:'fixed', inset:0, background:'#0e0101', fontFamily:"'DM Sans', sans-serif", overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <div className="orb" style={{ width:900, height:700, top:-180, right:-80, background:'radial-gradient(circle at 40% 40%,rgba(200,30,30,.45) 0%,rgba(150,20,20,.25) 40%,transparent 70%)' }} />
        <div className="orb" style={{ width:500, height:400, bottom:-100, left:'10%', background:'radial-gradient(circle,rgba(150,20,20,.2) 0%,transparent 70%)' }} />

        <div className="reset-card" style={{ width:'100%', maxWidth:420, padding:'44px 40px', position:'relative', borderRadius:24, border:'1px solid rgba(255,255,255,.08)', boxShadow:'0 40px 120px rgba(0,0,0,.7)', animation:'cardIn .55s cubic-bezier(.22,1,.36,1) both', background:'#0c0606', color:'#faf5f5' }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.01em' }}>Ordem DeMolay</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', letterSpacing:'.18em', textTransform:'uppercase', marginTop:3 }}>Capítulo Nº 307</div>
          </div>

          {estado === 'verificando' && (
            <p role="status" style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>Verificando o link…</p>
          )}

          {(estado === 'pronto' || estado === 'salvando') && (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginBottom:6 }}>Criar nova senha</div>
              <p style={{ fontSize:12.5, color:'rgba(255,255,255,.45)', marginBottom:22, lineHeight:1.5 }}>Use pelo menos 8 caracteres.</p>
              <form onSubmit={salvar} noValidate>
                <div style={{ marginBottom:16 }}>
                  <label htmlFor="nova" style={label}>Nova senha</label>
                  <input id="nova" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required style={input} />
                </div>
                <div style={{ marginBottom:18 }}>
                  <label htmlFor="confirma" style={label}>Confirmar senha</label>
                  <input id="confirma" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirma} onChange={e => setConfirma(e.target.value)} placeholder="••••••••" required style={input} />
                </div>
                {erro && <p role="alert" style={{ fontSize:12, color:'#fca5a5', marginBottom:12 }}>{erro}</p>}
                <button type="submit" disabled={estado === 'salvando'} style={botao(estado === 'salvando')}>
                  {estado === 'salvando' ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}

          {estado === 'sucesso' && (
            <>
              <div role="status" style={{ fontSize:15, fontWeight:700, color:'#86efac', marginBottom:8 }}>Senha alterada!</div>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.55)', marginBottom:20, lineHeight:1.5 }}>Agora é só entrar com a nova senha. Você será levado ao login em instantes.</p>
              <button type="button" onClick={() => router.replace('/login')} style={botao(false)}>Ir para o login</button>
            </>
          )}

          {estado === 'invalido' && (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:'#fca5a5', marginBottom:8 }}>Link inválido ou expirado</div>
              <p style={{ fontSize:12.5, color:'rgba(255,255,255,.5)', marginBottom:22, lineHeight:1.5 }}>
                Este link é inválido ou já expirou. Peça um novo abaixo.
              </p>
              <form onSubmit={pedirNovo} noValidate>
                <div style={{ marginBottom:18 }}>
                  <label htmlFor="email" style={label}>E-mail</label>
                  <input id="email" type="email" autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={input} />
                </div>
                {erro && <p role="alert" style={{ fontSize:12, color:'#fca5a5', marginBottom:12 }}>{erro}</p>}
                {aviso && <p role="status" style={{ fontSize:12, color:'#86efac', marginBottom:12, lineHeight:1.5 }}>{aviso}</p>}
                <button type="submit" disabled={enviando || cooldown > 0} style={botao(enviando || cooldown > 0)}>
                  {enviando ? 'Enviando...' : cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Enviar novo link'}
                </button>
              </form>
            </>
          )}

          {estado !== 'sucesso' && (
            <div style={{ marginTop:18, fontSize:11.5 }}>
              <button type="button" onClick={voltarLogin} style={link}>← Voltar para o login</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
