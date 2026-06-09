// Prefixa caminhos de assets estáticos (imagens em /public) com o basePath,
// necessário quando o site é servido numa subpasta (GitHub Pages).
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

export function asset(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${BASE}${path.startsWith('/') ? '' : '/'}${path}`
}
