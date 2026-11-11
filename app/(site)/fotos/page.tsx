import fs from 'fs'
import path from 'path'
import PublicNav from '@/components/PublicNav'
import GaleriaFotos from '@/components/GaleriaFotos'

// Lê a pasta public/fotos no build e lista todas as imagens automaticamente.
// Assim, basta adicionar arquivos em public/fotos — não precisa mexer em código.
function listarFotos(): string[] {
  const dir = path.join(process.cwd(), 'public', 'fotos')
  let arquivos: string[] = []
  try {
    arquivos = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  } catch {
    arquivos = []
  }
  // ordena por número (foto-2 antes de foto-10) quando o padrão for foto-N
  const num = (f: string) => {
    const m = f.match(/(\d+)/)
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
  }
  arquivos.sort((a, b) => num(a) - num(b) || a.localeCompare(b))
  return arquivos.map(f => `/fotos/${f}`)
}

export default function FotosPage() {
  const fotos = listarFotos()

  return (
    <>
      <PublicNav />
      <main className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Galeria</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-6 md:mb-8">Fotos</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Momentos e registros do Capítulo Roque Diniz Arruda nº 307.
        </p>

        <GaleriaFotos fotos={fotos} />
      </main>
    </>
  )
}
