'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, TrendingUp, TrendingDown, Users, HandCoins, Settings, Menu, X, LogOut, Repeat2, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'

const navItems = [
  { href: '/tesouraria',            label: 'Início',   icon: Home },
  { href: '/tesouraria/fluxo',      label: 'Fluxo',    icon: Repeat2 },
  { href: '/tesouraria/entradas',   label: 'Entradas', icon: TrendingUp },
  { href: '/tesouraria/saidas',     label: 'Saídas',   icon: TrendingDown },
  { href: '/tesouraria/membros',    label: 'Membros',  icon: Users },
  { href: '/tesouraria/pagamentos', label: 'Pgto',     icon: HandCoins },
  { href: '/tesouraria/ajustes',    label: 'Ajustes',  icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    if (isSupabaseConfigured()) await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <>
      <button className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg text-white"
        style={{ background: '#1c1c1c' }} onClick={() => setOpen(!open)}>
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:flex`}
        style={{ width: 210, background: '#12151e' }}>

        {/* Logo */}
        <div className="px-6 pt-6 pb-5 flex items-center gap-3">
          <Image src="/logo-rda.png" alt="Brasão RDA 307" width={44} height={44}
            className="rounded-xl object-cover flex-shrink-0" />
          <div>
            <p className="text-white font-black text-base tracking-tight leading-none">DEMOLAY</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-px" style={{ background: '#c0392b', width: 16 }} />
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#555e7a' }}>Tesouraria</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/tesouraria' ? pathname === '/tesouraria' : pathname.startsWith(href)
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150"
                style={active ? { background: '#1e2235' } : {}}>
                <Icon size={16} style={{ color: active ? '#c0392b' : '#3d4460' }} />
                <span className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: active ? '#ffffff' : '#3d4460' }}>
                  {label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-6">
          <div className="mb-3" style={{ borderTop: '1px solid #1e2235' }} />
          <p className="text-[10px] font-bold tracking-widest uppercase px-3 mb-2" style={{ color: '#2e3450' }}>Visitante</p>
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full transition-all hover:bg-white/5">
            <ArrowRight size={14} style={{ color: '#c0392b' }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c0392b' }}>Acessar Admin</span>
          </button>
        </div>
      </aside>
    </>
  )
}
