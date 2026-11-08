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

type MembroBase = { status?: string | null; data_entrada?: string | null }

// Mês/ano de entrada do membro (null = sem data: considera que sempre esteve)
function mesEntrada(m: MembroBase): { ano: number; mes: number } | null {
  const s = m.data_entrada ? String(m.data_entrada) : ''
  const ano = +s.slice(0, 4), mes = +s.slice(5, 7)
  return ano && mes ? { ano, mes } : null
}

/** Membro já tinha entrado até o mês/ano informado. */
export function entrouAte(m: MembroBase, mes: number, ano: number) {
  const e = mesEntrada(m)
  return !e || e.ano < ano || (e.ano === ano && e.mes <= mes)
}

/** Membro já tinha entrado em algum mês do ano informado. */
export function entrouAteAno(m: MembroBase, ano: number) {
  const e = mesEntrada(m)
  return !e || e.ano <= ano
}

/**
 * Regra única de exibição por mês (Pagamentos): aparece se já tem linha lançada
 * naquele mês, OU se é 'ativo' e já tinha entrado. Sem linha e antes da entrada: não aparece.
 */
export const aparecaNoMes = (m: MembroBase, temLinha: boolean, mes: number, ano: number) =>
  temLinha || (pagaMensalidade(m) && entrouAte(m, mes, ano))

/**
 * Regra única de PENDÊNCIA de mensalidade (todas as telas): só linha lançada com
 * status 'nao_pago', fora de jan/jul. Mês sem lançamento não é dívida.
 */
export const ehPendencia = (r: { status: string; mes: number }) => r.status === 'nao_pago' && ehMesCobrado(r.mes)

/** Aplica o filtro padrão de mensalidades em aberto (nao_pago, sem jan/jul) numa consulta. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const filtroEmAberto = <Q extends { eq: any; in: any }>(q: Q): Q =>
  q.eq('status', 'nao_pago').in('mes', [...MESES_COBRADOS])
