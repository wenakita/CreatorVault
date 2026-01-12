type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const envLevel =
  (typeof process !== 'undefined' && (process.env.LOG_LEVEL as LogLevel | undefined)) ||
  ((typeof process !== 'undefined' && process.env.NODE_ENV === 'production') ? 'info' : 'debug')

const MIN_LEVEL: LogLevel = envLevel && LOG_LEVELS[envLevel] !== undefined ? envLevel : 'debug'

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
}

function log(level: LogLevel, msg: string, data?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return
  const payload = data === undefined ? msg : `${msg} ${safeStringify(data)}`
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(payload)
}

function safeStringify(data: unknown): string {
  try {
    if (typeof data === 'string') return data
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}
