// Taxa bancária sobre transferências — 0,89% com teto de R$ 8,50 por operação.
// Receita: o valor entra no caixa já descontada a taxa.
// Despesa: o valor sai do caixa já somada a taxa.
export const TAXA = 0.0089
export const TAXA_MAX = 8.5

export const taxaOperacao = (v: number) => Math.min(Math.round(v * TAXA * 100) / 100, TAXA_MAX)
export const liquidoEntrada = (v: number) => Math.round((v - taxaOperacao(v)) * 100) / 100
export const comTaxaSaida   = (v: number) => Math.round((v + taxaOperacao(v)) * 100) / 100

// Inversas: recuperam o valor original a partir do gravado (para edição)
export const brutoEntrada = (liq: number) => {
  const cand = Math.round(liq / (1 - TAXA) * 100) / 100
  return taxaOperacao(cand) >= TAXA_MAX ? Math.round((liq + TAXA_MAX) * 100) / 100 : cand
}
export const semTaxaSaida = (tot: number) => {
  const cand = Math.round(tot / (1 + TAXA) * 100) / 100
  return taxaOperacao(cand) >= TAXA_MAX ? Math.round((tot - TAXA_MAX) * 100) / 100 : cand
}
