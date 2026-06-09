import PublicNav from '@/components/PublicNav'

export default function AntigosMCPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-4xl mx-auto px-5 md:px-8 py-12 md:py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Galeria de Honra</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-6 md:mb-8">Past MC</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Registro dos jovens que conduziram o Capítulo Nº 307 ao longo dos anos.
        </p>

        {/* Grade de registros — placeholder */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[].length === 0 && (
            <p className="col-span-full text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Nenhum registro cadastrado ainda. [Em breve será possível adicionar os antigos MCs.]
            </p>
          )}
        </div>
      </main>
    </>
  )
}
