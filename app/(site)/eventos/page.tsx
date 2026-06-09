import PublicNav from '@/components/PublicNav'

type Evento = { dia: string; mes: string; titulo: string; obs?: string }

// Agenda do capítulo (ordem cronológica)
const AGENDA: Evento[] = [
  { dia: '01',        mes: 'AGO', titulo: 'Cerimônia de Instalação e Cerimônia do Abraço' },
  { dia: '22',        mes: 'AGO', titulo: 'Filantropia' },
  { dia: '04 a 06',   mes: 'SET', titulo: 'Olimpíadas DeMolay' },
  { dia: '07',        mes: 'SET', titulo: 'Dia do Patriota' },
  { dia: '27',        mes: 'SET', titulo: 'Filantropia 02' },
  { dia: '01',        mes: 'OUT', titulo: 'Filantropia 04', obs: 'Doação de Sangue' },
  { dia: '03',        mes: 'OUT', titulo: 'Filantropia 03', obs: 'Dia das Crianças' },
  { dia: '18',        mes: 'OUT', titulo: 'Dia Educacional', obs: 'Feira das Profissões' },
  { dia: '21',        mes: 'NOV', titulo: 'Cerimônia de Iniciação e Apresentação de Novos Membros' },
  { dia: '22',        mes: 'NOV', titulo: 'Dia em Memória a Frank Sherman Land' },
  { dia: '22',        mes: 'NOV', titulo: 'Entretenimento 05' },
  { dia: '29',        mes: 'NOV', titulo: 'Dia do Meu Governo' },
]

export default function EventosPage() {
  return (
    <>
      <PublicNav />
      <main className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-16 text-white">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#c0392b' }}>Agenda</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Eventos &amp; Notícias</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Calendário de atividades do Capítulo Roque Diniz Arruda nº 307.
        </p>

        <div className="space-y-3">
          {AGENDA.map((ev, i) => (
            <div key={i}
              className="flex items-center gap-4 rounded-2xl px-4 sm:px-5 py-4 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Data */}
              <div className="flex-shrink-0 w-16 sm:w-20 text-center rounded-xl py-2"
                style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)' }}>
                <div className="text-base sm:text-lg font-black leading-none text-white">{ev.dia}</div>
                <div className="text-[10px] font-bold tracking-widest mt-1" style={{ color: '#e07a6f' }}>{ev.mes}</div>
              </div>
              {/* Título */}
              <div className="min-w-0">
                <p className="font-bold text-white text-sm sm:text-base leading-snug">{ev.titulo}</p>
                {ev.obs && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{ev.obs}</p>}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs mt-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Datas sujeitas a alteração. Acompanhe o Instagram <a href="https://instagram.com/roquedinizarruda" target="_blank" rel="noopener noreferrer" style={{ color: '#e07a6f' }}>@roquedinizarruda</a> para confirmações.
        </p>
      </main>
    </>
  )
}
