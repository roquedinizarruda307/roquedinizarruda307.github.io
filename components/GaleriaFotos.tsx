'use client'

import { useState, useEffect, useCallback } from 'react'
import { asset } from '@/lib/asset'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

// miniatura leve (public/fotos/thumbs) usada na grade; a original só abre no lightbox
const thumb = (src: string) => src.replace('/fotos/', '/fotos/thumbs/')

export default function GaleriaFotos({ fotos }: { fotos: string[] }) {
  const total = fotos.length
  const [aberta, setAberta] = useState<number | null>(null)

  const fechar = useCallback(() => setAberta(null), [])
  const anterior = useCallback(() => setAberta(i => (i === null ? i : (i - 1 + total) % total)), [total])
  const proxima = useCallback(() => setAberta(i => (i === null ? i : (i + 1) % total)), [total])

  // teclado: Esc fecha, setas navegam
  useEffect(() => {
    if (aberta === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'ArrowRight') proxima()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [aberta, fechar, anterior, proxima])

  // pré-carrega a anterior e a próxima para a navegação ser instantânea
  useEffect(() => {
    if (aberta === null) return
    for (const j of [aberta + 1, aberta - 1]) {
      const img = new Image()
      img.src = asset(fotos[(j + total) % total])
    }
  }, [aberta, fotos, total])

  return (
    <>
      {/* Masonry: ~8 fotos por coluna (6 colunas no desktop) */}
      <div className="[column-count:3] sm:[column-count:4] lg:[column-count:6] gap-2 sm:gap-3">
        {fotos.map((src, i) => (
          <button key={src} onClick={() => setAberta(i)}
            className="mb-2 sm:mb-3 w-full break-inside-avoid overflow-hidden rounded-lg sm:rounded-xl block cursor-zoom-in group"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <img src={asset(thumb(src))} alt={`Foto ${i + 1}`} loading="lazy" decoding="async"
              className="w-full h-auto block transition-transform duration-300 ease-out group-hover:scale-105" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {aberta !== null && (
        <div onClick={fechar}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 fdj-fade"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>

          <button onClick={fechar}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar">
            <X size={26} />
          </button>

          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest text-white/60">
            {aberta + 1} / {total}
          </div>

          <button onClick={e => { e.stopPropagation(); anterior() }}
            className="absolute left-2 sm:left-5 p-2 sm:p-3 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Anterior">
            <ChevronLeft size={32} />
          </button>

          {/* miniatura (já em cache) aparece na hora; a original carrega por cima */}
          <img key={aberta} src={asset(fotos[aberta])} alt={`Foto ${aberta + 1}`}
            onClick={e => e.stopPropagation()}
            style={{ backgroundImage: `url(${asset(thumb(fotos[aberta]))})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
            className="max-h-[85vh] max-w-full w-auto object-contain rounded-lg shadow-2xl fdj-zoom" />

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
