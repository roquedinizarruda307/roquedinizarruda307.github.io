'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'

const links = [
  { href: '/',           label: 'Início' },
  { href: '/historia',   label: 'História' },
  { href: '/antigos-mc', label: 'Antigos MCs' },
  { href: '/fotos',      label: 'Fotos' },
  { href: '/eventos',    label: 'Eventos' },
]

export default function PublicNav() {
  const pathname = usePathname()
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-8 py-4"
      style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <span className="font-black text-white tracking-tight text-lg">DEMOLAY</span>
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#c0392b' }}>Nº 307</span>
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        {links.map(l => {
          const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
          return (
            <Link key={l.href} href={l.href}
              className="text-xs font-semibold tracking-widest uppercase transition-colors"
              style={{ color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}>
              {l.label}
            </Link>
          )
        })}
      </nav>

      <Link href="/login"
        className="flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
        style={{ background: '#c0392b', color: '#fff' }}>
        <Lock size={12} />
        <span className="text-[11px] font-bold tracking-widest uppercase">Tesouraria</span>
      </Link>
    </header>
  )
}
