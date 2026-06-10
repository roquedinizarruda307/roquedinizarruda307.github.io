import * as XLSX from 'xlsx'

// Exporta uma matriz de linhas (1ª linha = cabeçalho) para .xlsx
export function exportarExcel(nomeArquivo: string, linhas: (string | number)[][], aba = 'Dados') {
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  // largura automática simples das colunas
  const ncols = Math.max(...linhas.map(l => l.length), 1)
  ws['!cols'] = Array.from({ length: ncols }, (_, c) => {
    const max = Math.max(...linhas.map(l => String(l[c] ?? '').length), 8)
    return { wch: Math.min(max + 2, 40) }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, aba)
  XLSX.writeFile(wb, nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`)
}
