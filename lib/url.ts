// Só aceita links https:// (bloqueia javascript:, data: etc. vindos do banco).
export function urlSegura(u: unknown): string | null {
  if (typeof u !== 'string') return null
  const s = u.trim()
  return /^https:\/\/[^\s]+$/i.test(s) ? s : null
}
