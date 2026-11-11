// Utilitários de data sem armadilhas de fuso horário.
// Regra: datas 'AAAA-MM-DD' são sempre tratadas como data LOCAL (nunca via toISOString / new Date('AAAA-MM-DD')).

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})/

/** Converte 'AAAA-MM-DD' (ou timestamp que comece assim) em Date local à meia-noite. Retorna null se inválida. */
export function parseDataLocal(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = RE_DATA.exec(String(s))
  if (!m) return null
  const ano = +m[1], mes = +m[2], dia = +m[3]
  const d = new Date(ano, mes - 1, dia)
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
  return d
}

/** Date local -> 'AAAA-MM-DD' */
export function paraISOData(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Hoje (local) em 'AAAA-MM-DD' */
export function hojeLocal(): string {
  return paraISOData(new Date())
}

/** Hoje (local) à meia-noite */
export function hojeDate(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA' (ou '—' se inválida) */
export function fmtDataBR(s: string | Date | null | undefined): string {
  const d = s instanceof Date ? s : parseDataLocal(s)
  if (!d) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Último dia real do mês em 'AAAA-MM-DD' (mes 1..12) */
export function ultimoDiaMes(ano: number, mes: number): string {
  return paraISOData(new Date(ano, mes, 0))
}

/** Data em que a pessoa completa `anos` anos (local). 29/02 cai em 01/03 em anos não bissextos. */
export function aniversarioDe(nascimento: Date, anos: number): Date {
  return new Date(nascimento.getFullYear() + anos, nascimento.getMonth(), nascimento.getDate())
}

/** Diferença em dias inteiros (b - a), ambas datas locais à meia-noite */
export function diasEntre(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86400000)
}
