/**
 * Centralized Frontend Logger
 *
 * Provides consistent logging across the application with:
 * - Log levels (debug, info, warn, error)
 * - Environment-aware logging (silent in production for debug/info)
 * - Contextual prefixes for easier debugging
 * - Optional remote logging capability
 * - Timestamp support
 *
 * Usage:
 *   import { logger } from '../utils/logger'
 *   logger.info('User logged in', { userId: 123 })
 *   logger.error('API call failed', error)
 *
 *   // With context
 *   const log = logger.withContext('MaterialsPage')
 *   log.debug('Loading materials...')
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

// Determine current log level based on environment
const getLogLevel = () => {
  // Check for explicit override in localStorage (for debugging in production)
  const override = localStorage.getItem('SPM_LOG_LEVEL')
  if (override && LOG_LEVELS[override] !== undefined) {
    return LOG_LEVELS[override]
  }

  // Default: debug in development, warn in production
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'
  return isDev ? LOG_LEVELS.debug : LOG_LEVELS.warn
}

// Format timestamp
const timestamp = () => {
  const now = new Date()
  return now.toISOString().slice(11, 23) // HH:mm:ss.SSS
}

// Format log prefix
const formatPrefix = (level, context) => {
  const ts = timestamp()
  const levelStr = level.toUpperCase().padEnd(5)
  return context ? `[${ts}] ${levelStr} [${context}]` : `[${ts}] ${levelStr}`
}

// Log storage for recent errors (useful for error reporting)
const errorBuffer = []
const MAX_ERROR_BUFFER = 50

// Core logging function
const log = (level, context, message, ...args) => {
  const currentLevel = getLogLevel()
  const targetLevel = LOG_LEVELS[level]

  if (targetLevel < currentLevel) return

  const prefix = formatPrefix(level, context)
  const fullMessage = `${prefix} ${message}`

  // Store errors in buffer
  if (level === 'error') {
    errorBuffer.push({
      timestamp: new Date().toISOString(),
      context,
      message,
      args,
    })
    if (errorBuffer.length > MAX_ERROR_BUFFER) {
      errorBuffer.shift()
    }
  }

  // Console output with appropriate styling
  const styles = {
    debug: 'color: #888',
    info: 'color: #2563eb',
    warn: 'color: #d97706',
    error: 'color: #dc2626; font-weight: bold',
  }

  switch (level) {
    case 'debug':
      console.debug(`%c${fullMessage}`, styles.debug, ...args)
      break
    case 'info':
      console.info(`%c${fullMessage}`, styles.info, ...args)
      break
    case 'warn':
      console.warn(`%c${fullMessage}`, styles.warn, ...args)
      break
    case 'error':
      console.error(`%c${fullMessage}`, styles.error, ...args)
      break
    default:
      console.log(fullMessage, ...args)
  }
}

/**
 * Create a logger with a specific context
 * @param {string} context - Context name (e.g., component name)
 * @returns {Object} Logger instance with context
 */
const createContextLogger = (context) => ({
  debug: (message, ...args) => log('debug', context, message, ...args),
  info: (message, ...args) => log('info', context, message, ...args),
  warn: (message, ...args) => log('warn', context, message, ...args),
  error: (message, ...args) => log('error', context, message, ...args),
})

/**
 * Main logger object
 */
export const logger = {
  /**
   * Log a debug message (development only by default)
   */
  debug: (message, ...args) => log('debug', null, message, ...args),

  /**
   * Log an info message (development only by default)
   */
  info: (message, ...args) => log('info', null, message, ...args),

  /**
   * Log a warning message (always shown)
   */
  warn: (message, ...args) => log('warn', null, message, ...args),

  /**
   * Log an error message (always shown)
   */
  error: (message, ...args) => log('error', null, message, ...args),

  /**
   * Create a logger with a specific context
   * @param {string} context - Context name for log prefix
   * @returns {Object} Contextualized logger
   *
   * @example
   * const log = logger.withContext('Auth')
   * log.info('User logged in')  // [12:34:56.789] INFO  [Auth] User logged in
   */
  withContext: createContextLogger,

  /**
   * Get recent errors from the buffer
   * Useful for error reporting or debugging
   */
  getRecentErrors: () => [...errorBuffer],

  /**
   * Clear the error buffer
   */
  clearErrors: () => {
    errorBuffer.length = 0
  },

  /**
   * Set log level at runtime (useful for debugging in production)
   * @param {'debug' | 'info' | 'warn' | 'error' | 'silent'} level
   */
  setLevel: (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      localStorage.setItem('SPM_LOG_LEVEL', level)
      logger.info(`Log level set to: ${level}`)
    } else {
      logger.error(`Invalid log level: ${level}`)
    }
  },

  /**
   * Reset log level to environment default
   */
  resetLevel: () => {
    localStorage.removeItem('SPM_LOG_LEVEL')
    logger.info('Log level reset to default')
  },

  /**
   * Log API request/response (helper for API debugging)
   */
  api: {
    request: (method, url, data) => {
      log('debug', 'API', `${method.toUpperCase()} ${url}`, data ? { data } : '')
    },
    response: (method, url, status, duration) => {
      const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'debug'
      log(level, 'API', `${method.toUpperCase()} ${url} → ${status} (${duration}ms)`)
    },
    error: (method, url, error) => {
      log('error', 'API', `${method.toUpperCase()} ${url} FAILED`, error)
    },
  },

  /**
   * Log performance metric
   */
  perf: (label, durationMs) => {
    log('debug', 'PERF', `${label}: ${durationMs.toFixed(2)}ms`)
  },

  /**
   * Time a function execution
   * @param {string} label - Label for the timing
   * @param {Function} fn - Function to time
   * @returns {*} Function result
   */
  time: async (label, fn) => {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      logger.perf(label, duration)
      return result
    } catch (error) {
      const duration = performance.now() - start
      logger.error(`${label} failed after ${duration.toFixed(2)}ms`, error)
      throw error
    }
  },
}

// Expose logger globally for debugging in console
if (typeof window !== 'undefined') {
  window.__SPM_LOGGER = logger
}

export default logger
