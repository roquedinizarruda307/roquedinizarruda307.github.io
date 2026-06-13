'use client'

import { useState, useEffect, useCallback } from 'react'
import PublicNav from '@/components/PublicNav'
import { asset } from '@/lib/asset'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const TOTAL = 221

export default function FotosPage() {
  const fotos = Array.from({ length: TOTAL }, (_, i) => `/fotos/foto-${i + 1}.jpg`)
  const [aberta, setAberta] = useState<number | null>(null)

  const fechar = useCallback(() => setAberta(null), [])
  const anterior = useCallback(() => setAberta(i => (i === null ? i : (i - 1 + TOTAL) % TOTAL)), [])
  const proxima = useCallback(() => setAberta(i => (i === null ? i : (i + 1) % TOTAL)), [])

  // teclado: Esc fecha, setas navegam
  useEffect(() => {
    if (aberta === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'ArrowRight') proxima()
    }
    window.addEventListener('keydown', onKey)
    // trava o scroll do fundo enquanto o lightbox está aberto
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [aberta, fechar, anterior, proxima])

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
        <div className="[column-count:3] sm:[column-count:4] lg:[column-count:6] gap-2 sm:gap-3">
          {fotos.map((src, i) => (
            <button key={i} onClick={() => setAberta(i)}
              className="mb-2 sm:mb-3 w-full break-inside-avoid overflow-hidden rounded-lg sm:rounded-xl block cursor-zoom-in group"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <img src={asset(src)} alt={`Foto ${i + 1}`} loading="lazy"
                className="w-full h-auto block transition-transform duration-300 ease-out group-hover:scale-105" />
            </button>
          ))}
        </div>
      </main>

      {/* Lightbox */}
      {aberta !== null && (
        <div onClick={fechar}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 fdj-fade"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>

          {/* Fechar */}
          <button onClick={fechar}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar">
            <X size={26} />
          </button>

          {/* Contador */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest text-white/60">
            {aberta + 1} / {TOTAL}
          </div>

          {/* Anterior */}
          <button onClick={e => { e.stopPropagation(); anterior() }}
            className="absolute left-2 sm:left-5 p-2 sm:p-3 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Anterior">
            <ChevronLeft size={32} />
          </button>

          {/* Imagem */}
          <img key={aberta} src={asset(fotos[aberta])} alt={`Foto ${aberta + 1}`}
            onClick={e => e.stopPropagation()}
            className="max-h-[85vh] max-w-full w-auto object-contain rounded-lg shadow-2xl fdj-zoom" />

          {/* Próxima */}
          <button onClick={e => { e.stopPropagation(); proxima() }}
            className="absolute right-2 sm:right-5 p-2 sm:p-3 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Próxima">
            <ChevronRight size={32} />
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes fdjFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fdjZoom { from { opacity: 0; transform: scale(0.94) } to { opacity: 1; transform: scale(1) } }
        .fdj-fade { animation: fdjFade .2s ease-out }
        .fdj-zoom { animation: fdjZoom .28s cubic-bezier(0.16, 1, 0.3, 1) }
      `}</style>
    </>
  )
}
