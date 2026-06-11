// Exporta um documento Word (.doc) a partir de HTML — abre direto no Microsoft Word/Google Docs.
export function escaparHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function exportarWord(nomeArquivo: string, tituloDoc: string, corpoHtml: string) {
  const html =
    `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>${escaparHtml(tituloDoc)}</title></head>` +
    `<body style="font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.5; color:#111;">` +
    corpoHtml +
    `</body></html>`
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.doc') ? nomeArquivo : `${nomeArquivo}.doc`
  a.click()
  URL.revokeObjectURL(url)
}
