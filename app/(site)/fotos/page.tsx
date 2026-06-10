import PublicNav from '@/components/PublicNav'
import { asset } from '@/lib/asset'

const TOTAL = 75

export default function FotosPage() {
  const fotos = Array.from({ length: TOTAL }, (_, i) => `/fotos/foto-${i + 1}.jpg`)

  return (
    <>
      <PublicNav />
      <main className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Galeria</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-6 md:mb-8">Fotos</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Momentos e registros do Capítulo Roque Diniz Arruda nº 307.
        </p>

        {/* Masonry: ~8 fotos por coluna (6 colunas no desktop) */}
        <div className="[column-count:2] sm:[column-count:3] lg:[column-count:6] gap-3">
          {fotos.map((src, i) => (
            <div key={i} className="mb-3 break-inside-avoid overflow-hidden rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <img src={asset(src)} alt={`Foto ${i + 1}`} loading="lazy" className="w-full h-auto block" />
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
