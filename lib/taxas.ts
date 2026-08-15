// Taxas bancárias sobre transferências.
// RECEITA: entra integral no saldo — a Caixa quase nunca tarifa PIX recebido
// (conferido no extrato de agosto/2026). Diferenças pontuais se acertam na calibragem.
// DESPESA: sai com 0,89% (máx. R$ 8,50 por operação) somado ao valor.
export const TAXA = 0.0089
export const TAXA_MAX = 8.5

export const taxaOperacao = (v: number) => Math.min(Math.round(v * TAXA * 100) / 100, TAXA_MAX)

// Entradas: sem desconto (líquido = bruto)
export const liquidoEntrada = (v: number) => Math.round(v * 100) / 100
export const brutoEntrada   = (v: number) => Math.round(v * 100) / 100

// Saídas: taxa embutida no valor que sai do saldo
export const comTaxaSaida = (v: number) => Math.round((v + taxaOperacao(v)) * 100) / 100
export const semTaxaSaida = (tot: number) => {
  const cand = Math.round(tot / (1 + TAXA) * 100) / 100
  return taxaOperacao(cand) >= TAXA_MAX ? Math.round((tot - TAXA_MAX) * 100) / 100 : cand
}
