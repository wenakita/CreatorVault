type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL: LogLevel = import.meta.env.PROD ? 'warn' : 'debug'

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
}

function log(level: LogLevel, msg: string, data?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(`[${level.toUpperCase()}] ${msg}`, data ?? '')
}
