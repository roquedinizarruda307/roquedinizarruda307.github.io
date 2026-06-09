'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, Menu, X } from 'lucide-react'
import { useState } from 'react'

const links = [
  { href: '/',           label: 'Início' },
  { href: '/historia',   label: 'História' },
  { href: '/antigos-mc', label: 'Past MC' },
  { href: '/fotos',      label: 'Fotos' },
  { href: '/eventos',    label: 'Eventos' },
]

export default function PublicNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header
      className="sticky top-0 z-40"
      style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between px-5 md:px-8 py-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="font-black text-white tracking-tight text-lg">DEMOLAY</span>
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#c0392b' }}>Nº 307</span>
        </Link>

        {/* Links desktop */}
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

        <div className="flex items-center gap-3">
          <Link href="/login"
            className="flex items-center gap-2 rounded-full px-3.5 py-2 transition-colors"
            style={{ background: '#c0392b', color: '#fff' }}>
            <Lock size={12} />
            <span className="text-[11px] font-bold tracking-widest uppercase">Tesouraria</span>
          </Link>

          {/* Botão menu mobile */}
          <button className="md:hidden text-white p-1" onClick={() => setOpen(o => !o)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Menu mobile expandido */}
      {open && (
        <nav className="md:hidden px-5 pb-4 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {links.map(l => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
            return (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className="py-3 text-sm font-semibold tracking-widest uppercase transition-colors"
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                {l.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
