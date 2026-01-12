// Utility helpers for consistent token naming/symbol grammar.
// Share (OFT) tokens use a black square prefix; Vault share tokens use a white square prefix.
// All helpers preserve the underlying creator coin ticker verbatim (e.g., AKITA).

export const SHARE_SYMBOL_PREFIX = '■' // U+25A0, Black Square
export const VAULT_SYMBOL_PREFIX = '▢' // U+25A2, White Square with Rounded Corners

function titleCase(word: string): string {
  if (!word) return ''
  const lower = word.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Strip known prefixes (Unicode badges or legacy ws/s) to recover the underlying ticker.
 */
export function normalizeUnderlyingSymbol(raw: string): string {
  const symbol = (raw ?? '').trim()
  if (!symbol) return ''
  if (symbol.startsWith(SHARE_SYMBOL_PREFIX) || symbol.startsWith(VAULT_SYMBOL_PREFIX)) {
    return symbol.slice(1)
  }
  if (/^ws/i.test(symbol)) return symbol.replace(/^ws/i, '')
  if (/^s/i.test(symbol)) return symbol.replace(/^s/i, '')
  return symbol
}

export function underlyingSymbolUpper(raw: string): string {
  const core = normalizeUnderlyingSymbol(raw)
  return core ? core.toUpperCase() : ''
}

export function toShareSymbol(rawUnderlying: string): string {
  const ticker = underlyingSymbolUpper(rawUnderlying)
  return ticker ? `${SHARE_SYMBOL_PREFIX}${ticker}` : ''
}

export function toVaultSymbol(rawUnderlying: string): string {
  const ticker = underlyingSymbolUpper(rawUnderlying)
  return ticker ? `${VAULT_SYMBOL_PREFIX}${ticker}` : ''
}

export function toShareName(rawUnderlying: string, creatorName?: string): string {
  const base = creatorName?.trim() || normalizeUnderlyingSymbol(rawUnderlying)
  if (!base) return ''
  return `${titleCase(base)} Share Token`
}

export function toVaultName(rawUnderlying: string, creatorName?: string): string {
  const base = creatorName?.trim() || normalizeUnderlyingSymbol(rawUnderlying)
  if (!base) return ''
  return `${titleCase(base)} Vault Token`
}

export function isUnicodeShareSymbol(symbol: string): boolean {
  return (symbol ?? '').startsWith(SHARE_SYMBOL_PREFIX)
}

export function isUnicodeVaultSymbol(symbol: string): boolean {
  return (symbol ?? '').startsWith(VAULT_SYMBOL_PREFIX)
}
