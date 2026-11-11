import Link from 'next/link'

export const metadata = { title: 'Página não encontrada · Roque Diniz Arruda 307' }

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-5xl font-black" style={{ color: '#c0392b' }}>404</p>
        <h1 className="mt-3 text-xl font-bold text-gray-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-gray-500">O endereço pode estar errado ou a página foi removida.</p>
        <Link href="/" className="inline-block mt-6 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90"
          style={{ background: '#c0392b' }}>
          Voltar ao início
        </Link>
      </div>
    </main>
  )
}
