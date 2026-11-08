'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Tela antiga de mensalidades (desativada): tudo está em Pagamentos > Mensalidades.
// Mantida só como redirecionamento para links salvos.
export default function MensalidadesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/tesouraria/pagamentos') }, [router])
  return <div className="py-12 text-center text-sm text-gray-300">Redirecionando para Pagamentos…</div>
}
