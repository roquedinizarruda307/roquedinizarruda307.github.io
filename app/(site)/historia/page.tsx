import PublicNav from '@/components/PublicNav'

export default function HistoriaPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-3xl mx-auto px-8 py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Nossa História</p>
        <h1 className="text-4xl font-black tracking-tight mb-8">A Ordem DeMolay</h1>
        <div className="space-y-5 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <p>
            Fundada em 1919 por Frank S. Land, em Kansas City (EUA), a Ordem DeMolay é uma
            organização que forma jovens com base nos valores de fraternidade, cortesia e pureza.
          </p>
          <p>
            O nome homenageia Jacques DeMolay, último Grão-Mestre da Ordem dos Templários,
            símbolo de lealdade e fidelidade aos amigos.
          </p>
          <p>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              [Edite este texto com a história do Capítulo Nº 307.]
            </span>
          </p>
        </div>
      </main>
    </>
  )
}
