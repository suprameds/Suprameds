type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function shouldLog(level: LogLevel): boolean {
  const configured = (process.env.LOG_LEVEL || "info") as LogLevel
  return LOG_LEVELS[level] >= (LOG_LEVELS[configured] ?? 1)
}

export function createLogger(module: string) {
  const prefix = `[${module}]`
  return {
    debug: (...args: any[]) => shouldLog("debug") && console.debug(prefix, ...args),
    info: (...args: any[]) => shouldLog("info") && console.info(prefix, ...args),
    warn: (...args: any[]) => shouldLog("warn") && console.warn(prefix, ...args),
    error: (...args: any[]) => shouldLog("error") && console.error(prefix, ...args),
  }
}
