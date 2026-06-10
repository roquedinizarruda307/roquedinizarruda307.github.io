import PublicNav from '@/components/PublicNav'
import { asset } from '@/lib/asset'

// Ordem por número de gestão (mais antigo → mais recente)
const ORDEM = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  45, 13, 14, 15, 46, 16, 17, 18, 19, 47, 48, 20, 49, 21, 22, 23, 50,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
  39, 40, 41, 42, 43, 44,
]

export default function AntigosMCPage() {
  const fotos = ORDEM.map(n => `/pastmc/pastmc-${n}.jpg`)

  return (
    <>
      <PublicNav />
      <main className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Galeria de Honra</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-6 md:mb-8">Past MC</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Homenagem aos Past Mestres Conselheiros que conduziram o Capítulo Roque Diniz Arruda nº 307.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {fotos.map((src, i) => (
            <div key={i} className="overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <img
                src={asset(src)}
                alt={`Past Mestre Conselheiro ${i + 1}`}
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
