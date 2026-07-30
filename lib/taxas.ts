// Taxas bancárias sobre transferências — usadas em todo o sistema.
// Receita: o valor entra no caixa já descontada a taxa.
// Despesa: o valor sai do caixa já somada a taxa.
export const TAXA_RECEITA = 0.0071   // 0,71% sobre o que entra
export const TAXA_DESPESA = 0.0134   // 1,34% sobre o que sai

export const liquidoEntrada = (v: number) => Math.round(v * (1 - TAXA_RECEITA) * 100) / 100
export const brutoEntrada   = (v: number) => Math.round(v / (1 - TAXA_RECEITA) * 100) / 100
export const comTaxaSaida   = (v: number) => Math.round(v * (1 + TAXA_DESPESA) * 100) / 100
export const semTaxaSaida   = (v: number) => Math.round(v / (1 + TAXA_DESPESA) * 100) / 100
