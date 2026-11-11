// Regras de saída por maioridade (21 anos) — DeMolay ativo vira Sênior.
import { parseDataLocal, aniversarioDe, diasEntre, hojeDate, fmtDataBR } from '@/lib/datas'

export const IDADE_MAIORIDADE = 21
export const DIAS_AVISO_21 = 60

type MembroM = { status: string; data_nascimento?: string | null }

export type InfoMaioridade = {
  estado: 'completou' | 'em_breve' | 'futuro'
  data: Date      // data em que completa 21
  dataBR: string
  dias: number    // dias até completar (negativo = já completou)
}

/** Só se aplica a membros com status 'ativo' e data de nascimento válida. */
export function infoMaioridade(m: MembroM, hoje = hojeDate()): InfoMaioridade | null {
  if (m.status !== 'ativo') return null
  const nasc = parseDataLocal(m.data_nascimento ?? null)
  if (!nasc) return null
  const data = aniversarioDe(nasc, IDADE_MAIORIDADE)
  const dias = diasEntre(hoje, data)
  const estado = dias <= 0 ? 'completou' : dias <= DIAS_AVISO_21 ? 'em_breve' : 'futuro'
  return { estado, data, dataBR: fmtDataBR(data), dias }
}

export type Semestre = { ano: number; s: 1 | 2; inicio: Date; fim: Date; label: string }

/** Semestre atual + próximos (n no total). */
export function proximosSemestres(n = 4, hoje = hojeDate()): Semestre[] {
  let ano = hoje.getFullYear()
  let s: 1 | 2 = hoje.getMonth() < 6 ? 1 : 2
  const out: Semestre[] = []
  for (let i = 0; i < n; i++) {
    const inicio = new Date(ano, s === 1 ? 0 : 6, 1)
    const fim = new Date(ano, s === 1 ? 6 : 12, 0)
    out.push({ ano, s, inicio, fim, label: `${s}º sem/${ano}` })
    if (s === 1) s = 2; else { s = 1; ano++ }
  }
  return out
}
