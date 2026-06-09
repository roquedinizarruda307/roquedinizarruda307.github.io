'use client'

import { useState, useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { MinimalistHero } from '@/components/ui/minimalist-hero'
import { asset } from '@/lib/asset'

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [phase, setPhase] = useState<'hero' | 'splash' | 'form'>('hero')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const configured = isSupabaseConfigured()

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/tesouraria')
    })
  }, [])

  function startFlow() {
    setPhase('splash')
    setTimeout(() => setPhase('form'), 1100)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!configured) { setErro('Configure o Supabase no .env.local primeiro.'); return }
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('E-mail ou senha incorretos.'); setLoading(false); return }
    router.replace('/tesouraria')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!configured) { setErro('Configure o Supabase no .env.local primeiro.'); return }
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signUp({
      email, password: senha,
      options: { data: { nome } },
    })
    if (error) { setErro(error.message); setLoading(false); return }
    setErro('Conta criada! Verifique seu e-mail para confirmar.')
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0101; }

        @keyframes fadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer   { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes bgPulse   { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes logoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes cardIn    { from{opacity:0;transform:translateY(30px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes glow      { 0%,100%{box-shadow:0 0 40px rgba(180,20,20,.1),0 28px 80px rgba(0,0,0,.6)} 50%{box-shadow:0 0 60px rgba(180,20,20,.22),0 28px 80px rgba(0,0,0,.6)} }
        @keyframes splashIn  { 0%{opacity:0;transform:scale(.3)} 40%{opacity:1;filter:brightness(1.4) drop-shadow(0 0 60px rgba(220,30,30,.9))} 70%{transform:scale(1.06)} 100%{transform:scale(1);filter:brightness(1) drop-shadow(0 0 30px rgba(200,40,40,.5))} }
        @keyframes ringOut   { 0%{transform:translate(-50%,-50%) scale(.8);opacity:0} 40%{opacity:.5} 100%{transform:translate(-50%,-50%) scale(1.6);opacity:0} }
        @keyframes splashJacques { 0%{opacity:0;transform:translateY(60px) scale(1.08);filter:brightness(.4)} 60%{opacity:1;filter:brightness(1.1)} 100%{opacity:1;transform:translateY(0) scale(1);filter:brightness(1)} }

        .orb { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; }
        @media (max-width: 640px) { .login-photo { display:none !important; } }
      `}</style>

      <div style={{ position:'fixed', inset:0, background:'#0e0101', fontFamily:"'DM Sans', sans-serif", overflow:'hidden' }}>

        {/* Orbs */}
        <div className="orb" style={{ width:900, height:700, top:-180, right:-80, background:'radial-gradient(circle at 40% 40%,rgba(200,30,30,.55) 0%,rgba(150,20,20,.3) 40%,transparent 70%)' }} />
        <div className="orb" style={{ width:600, height:600, top:60, right:200, background:'radial-gradient(circle,rgba(100,10,10,.7) 0%,transparent 65%)' }} />
        <div className="orb" style={{ width:500, height:400, bottom:-100, left:'10%', background:'radial-gradient(circle,rgba(150,20,20,.2) 0%,transparent 70%)' }} />
        <div style={{ position:'absolute', width:'200%', height:2, background:'linear-gradient(90deg,transparent 0%,rgba(200,30,30,.18) 30%,rgba(220,100,100,.35) 50%,rgba(200,30,30,.18) 70%,transparent 100%)', top:'52%', left:'-50%', transform:'rotate(-8deg)' }} />

        {/* ── HERO (Jacques DeMolay) — idêntico ao dashboard ── */}
        {phase === 'hero' && (
          <div style={{ position:'absolute', inset:0, zIndex:5 }}>
            <MinimalistHero
              logoText="DeMolay"
              navLinks={[
                { label: 'Login',   href: '#', onClick: startFlow },
                { label: 'Contato', href: 'https://instagram.com/roquedinizarruda' },
              ]}
              mainText=""
              readMoreLink="#"
              imageSrc="/jacques.png"
              imageAlt="Jacques DeMolay"
              overlayText={{ part1: 'Roque', part2: 'Diniz', part3: 'Arruda' }}
              instagramHandle="@roquedinizarruda"
              socialLinks={[]}
              locationText="Capítulo Nº 307 — Brasil"
              className="w-full h-full"
            />
          </div>
        )}

        {/* ── SPLASH (Jacques surgindo) ── */}
        {phase === 'splash' && (
          <div style={{ position:'fixed', inset:0, zIndex:50, background:'#060101', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', overflow:'hidden' }}>
            {/* glow vermelho atrás */}
            <div style={{ position:'absolute', top:'45%', left:'50%', transform:'translate(-50%,-50%)', width:520, height:520, borderRadius:'50%', background:'radial-gradient(circle, rgba(200,30,30,.45) 0%, rgba(120,15,15,.2) 45%, transparent 70%)', animation:'bgPulse 2s ease-in-out infinite' }} />
            <div style={{ position:'absolute', top:'45%', left:'50%', transform:'translate(-50%,-50%)', width:300, height:300, borderRadius:'30%', border:'2px solid rgba(200,30,30,.35)', animation:'ringOut 1.6s ease-out infinite' }} />
            {/* Jacques */}
            <img src={asset("/jacques.png")} alt="Jacques DeMolay"
              style={{ position:'relative', height:'82vh', width:'auto', objectFit:'contain', objectPosition:'bottom', zIndex:2, animation:'splashJacques 1.1s cubic-bezier(.22,1,.36,1) forwards' }} />
            {/* Nome */}
            <div style={{ position:'absolute', bottom:'8%', zIndex:3, textAlign:'center', opacity:0, animation:'fadeUp .6s ease .5s forwards' }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:26, fontWeight:800, color:'#fff', letterSpacing:'-.01em' }}>Ordem DeMolay</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', letterSpacing:'.2em', textTransform:'uppercase', marginTop:4 }}>Capítulo Nº 307</div>
            </div>
          </div>
        )}

        {/* ── FORM — painel dividido (Jacques + formulário) ── */}
        {phase === 'form' && (
          <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(4,0,0,.75)', backdropFilter:'blur(12px)' }}
            onClick={e => { if (e.target === e.currentTarget) setPhase('hero') }}>
            <div style={{ width:'100%', maxWidth:420, padding:'44px 40px', display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', borderRadius:24, border:'1px solid rgba(255,255,255,.08)', boxShadow:'0 40px 120px rgba(0,0,0,.7)', animation:'cardIn .55s cubic-bezier(.22,1,.36,1) both', background:'#0c0606' }}>

              {/* Formulário */}
              <div>
                <button onClick={() => setPhase('hero')} style={{ position:'absolute', top:18, right:18, width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.5)', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>

                <div style={{ marginBottom:24 }}>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.01em' }}>Ordem DeMolay</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', letterSpacing:'.18em', textTransform:'uppercase', marginTop:3 }}>Capítulo Nº 307</div>
                </div>

                {/* Tabs minimalistas */}
                <div style={{ display:'flex', gap:24, marginBottom:26, borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                  {(['login','signup'] as const).map(t => (
                    <button key={t} onClick={() => { setTab(t); setErro('') }}
                      style={{ background:'none', border:'none', borderBottom: tab===t ? '2px solid #c0392b' : '2px solid transparent', padding:'0 0 12px', marginBottom:-1, fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600, cursor:'pointer', color: tab===t ? '#fff' : 'rgba(255,255,255,.35)', transition:'color .2s' }}>
                      {t === 'login' ? 'Entrar' : 'Criar conta'}
                    </button>
                  ))}
                </div>

                <form onSubmit={tab === 'login' ? handleLogin : handleSignup}>
                  {tab === 'signup' && (
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.35)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:7 }}>Nome completo</label>
                      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'13px 15px', fontFamily:"'DM Sans',sans-serif", fontSize:14, color:'#faf5f5', outline:'none' }} />
                    </div>
                  )}
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.35)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:7 }}>E-mail</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'13px 15px', fontFamily:"'DM Sans',sans-serif", fontSize:14, color:'#faf5f5', outline:'none' }} />
                  </div>
                  <div style={{ marginBottom:18 }}>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.35)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:7 }}>Senha</label>
                    <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'13px 15px', fontFamily:"'DM Sans',sans-serif", fontSize:14, color:'#faf5f5', outline:'none' }} />
                  </div>

                  {erro && (
                    <p style={{ fontSize:12, color: erro.includes('Conta criada') ? '#86efac' : '#fca5a5', marginBottom:12 }}>{erro}</p>
                  )}

                  <button type="submit" disabled={loading} style={{ width:'100%', background:'#c0392b', color:'#fff', border:'none', borderRadius:10, padding:14, fontFamily:"'DM Sans',sans-serif", fontSize:14.5, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, transition:'background .2s' }}
                    onMouseEnter={e => !loading && ((e.currentTarget as HTMLElement).style.background='#a93226')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background='#c0392b')}>
                    {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar no Sistema' : 'Criar conta'}
                  </button>
                </form>

                <div style={{ marginTop:18, fontSize:11.5, color:'rgba(255,255,255,.25)' }}>
                  Acesso restrito · <span style={{ color:'rgba(220,100,100,.7)', cursor:'pointer' }}>Esqueci minha senha</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
