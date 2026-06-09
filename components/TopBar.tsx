'use client'

import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'

const LABELS: Record<string, string> = {
  '/tesouraria':            'Início',
  '/tesouraria/fluxo':      'Fluxo',
  '/tesouraria/entradas':   'Entradas',
  '/tesouraria/saidas':     'Saídas',
  '/tesouraria/membros':    'Membros',
  '/tesouraria/pagamentos': 'Pagamentos',
  '/tesouraria/ajustes':    'Ajustes',
}

export default function TopBar() {
  const pathname = usePathname()
  const label = LABELS[pathname] ??
    LABELS[Object.keys(LABELS).find(k => k !== '/tesouraria' && pathname.startsWith(k)) ?? '/tesouraria'] ?? 'Início'

  return (
    <div className="flex items-center justify-between px-8 py-4 bg-white" style={{ borderBottom: '1px solid #f0f0f0' }}>
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#aaa' }}>Seção Atual</p>
        <p className="text-lg font-black tracking-tight text-gray-900 uppercase">{label}</p>
      </div>
      <div className="flex items-center gap-5">
        <button className="flex items-center gap-2 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-gray-50 transition-colors">
          <Lock size={11} className="text-gray-400" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-gray-500">Somente Leitura</span>
        </button>
      </div>
    </div>
  )
}
