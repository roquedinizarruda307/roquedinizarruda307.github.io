'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'

// Troca de senha do próprio usuário logado (qualquer papel aprovado).
// Usa supabase.auth (não passa pelo bloqueio do modo consulta, que só vale p/ tabelas).
export default function TrocarSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (senha.length < 8) { setMsg({ ok: false, texto: 'A senha precisa ter pelo menos 8 caracteres.' }); return }
    if (senha !== confirma) { setMsg({ ok: false, texto: 'As duas senhas não são iguais.' }); return }
    if (!isSupabaseConfigured()) { setMsg({ ok: false, texto: 'Supabase não configurado.' }); return }
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password: senha })
    setLoading(false)
    if (error) {
      const t = /different from the old/i.test(error.message)
        ? 'A nova senha precisa ser diferente da atual.'
        : /session|jwt|not authenticated/i.test(error.message)
          ? 'Sua sessão expirou. Saia e entre de novo para trocar a senha.'
          : 'Não foi possível trocar a senha. Tente novamente.'
      setMsg({ ok: false, texto: t })
      return
    }
    setSenha(''); setConfirma('')
    setMsg({ ok: true, texto: 'Senha alterada com sucesso. Use a nova senha no próximo login.' })
  }

  return (
    <div className="px-8 py-8 max-w-xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <KeyRound size={18} className="text-gray-500" />
          <div>
            <h2 className="text-base font-black text-gray-900">Trocar minha senha</h2>
            <p className="text-xs text-gray-400">Mínimo de 8 caracteres.</p>
          </div>
        </div>

        <form onSubmit={salvar} className="space-y-3">
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
            placeholder="Nova senha" required minLength={8} autoComplete="new-password"
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:border-gray-400 outline-none" />
          <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)}
            placeholder="Confirmar nova senha" required minLength={8} autoComplete="new-password"
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:border-gray-400 outline-none" />
          {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.texto}</p>}
          <button type="submit" disabled={loading}
            className="text-white text-sm font-bold px-4 py-2.5 rounded-lg disabled:opacity-60" style={{ background: '#c0392b' }}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
