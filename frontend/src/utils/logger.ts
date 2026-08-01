const PREFIX = "[YourJunior]"

type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLevel(): LogLevel {
  if (import.meta.env.DEV) return "debug"
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("yourjunior_log_level")
    if (stored && stored in LOG_LEVELS) return stored as LogLevel
  }
  return "info"
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()]
}

function fmt(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const parts = [`${PREFIX} [${ts}] [${level.toUpperCase()}] ${msg}`]
  if (data && Object.keys(data).length > 0) {
    parts.push(JSON.stringify(data))
  }
  return parts.join(" ")
}

export const logger = {
  debug(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("debug")) console.debug(fmt("debug", msg, data))
  },
  info(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("info")) console.info(fmt("info", msg, data))
  },
  warn(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("warn")) console.warn(fmt("warn", msg, data))
  },
  error(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("error")) console.error(fmt("error", msg, data))
  },
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__YOURJUNIOR_LOG_LEVEL__ = (level: LogLevel) => {
    localStorage.setItem("yourjunior_log_level", level)
    console.info(`${PREFIX} Log level set to: ${level}`)
  }
}
