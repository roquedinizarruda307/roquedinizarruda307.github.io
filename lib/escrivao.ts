// Regras da aba Escrivão (chamada de presença e frequência).

// Quem entra na chamada de cada reunião (além de quem já tem presença gravada nela).
// Para incluir Sênior: ['ativo', 'senior']
export const STATUS_NA_CHAMADA: readonly string[] = ['ativo']

// Frequência mínima esperada no semestre (%). Abaixo disso o membro fica destacado.
export const FREQUENCIA_MINIMA = 75

// Coluna de falta justificada em reuniao_presencas. Hoje não existe no banco (null).
// Se for criada (ex.: 'justificada' boolean), coloque o nome aqui: a falta justificada
// passa a aparecer numa coluna à parte e deixa de contar como falta.
export const CAMPO_FALTA_JUSTIFICADA: string | null = null

export const naChamada = (m: { status?: string | null }) => STATUS_NA_CHAMADA.includes(String(m.status ?? ''))
