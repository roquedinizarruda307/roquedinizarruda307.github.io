import PublicNav from '@/components/PublicNav'

export default function FotosPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Galeria</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-6 md:mb-8">Fotos</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Momentos e registros do Capítulo Nº 307.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Foto</span>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
