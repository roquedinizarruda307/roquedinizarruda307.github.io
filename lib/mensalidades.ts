// Meses em que existe mensalidade. Janeiro (1) e julho (7) não são cobrados.
// Toda tela/cálculo de mensalidade deve usar esta lista.
export const MESES_COBRADOS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const

export const ehMesCobrado = (mes: number) => (MESES_COBRADOS as readonly number[]).includes(mes)

// Mês cobrado mais próximo (para quando o filtro estiver em jan/jul): jan → fev, jul → ago
export const mesCobradoMaisProximo = (mes: number) =>
  ehMesCobrado(mes) ? mes : (MESES_COBRADOS.find(m => m > mes) ?? MESES_COBRADOS[0])

// Só membro com status 'ativo' paga mensalidade/anuidade e entra nas cobranças.
// 'senior' e 'afastado' não geram dívida nova; o que já está lançado continua valendo.
export const STATUS_QUE_PAGA: readonly string[] = ['ativo']
export const pagaMensalidade = (m: { status?: string | null }) => STATUS_QUE_PAGA.includes(String(m.status ?? ''))
