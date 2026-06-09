import PublicNav from '@/components/PublicNav'

export default function EventosPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-3xl mx-auto px-8 py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Agenda</p>
        <h1 className="text-4xl font-black tracking-tight mb-8">Eventos & Notícias</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Acompanhe as próximas reuniões, eventos e novidades do capítulo.
        </p>

        <div className="space-y-4">
          {[].length === 0 && (
            <div className="rounded-xl p-8 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Nenhum evento publicado ainda. [Em breve a agenda do capítulo aparecerá aqui.]
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
