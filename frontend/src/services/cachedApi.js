/**
 * Cached API wrapper
 *
 * Integra axios con RequestCache para deduplicación automática.
 * Solo deduplicar GET requests (son idempotentes).
 *
 * Uso:
 *   import { cachedGet } from './services/cachedApi';
 *   const data = await cachedGet('/api/kpis');
 */

import { logger } from '../utils/logger'
import { globalRequestCache } from './requestCache'
import api from './api'

const log = logger.withContext('CachedAPI')

/**
 * Wrapper para GET con deduplicación automática
 * @param {string} url - URL a fetchear
 * @param {object} config - Config de axios
 * @param {number} ttl - TTL de deduplicación en segundos
 */
export async function cachedGet(url, config = {}, ttl = 300) {
  // Crear clave única basada en URL y parámetros
  const cacheKey = `GET:${url}:${JSON.stringify(config.params || {})}`

  return globalRequestCache.get(
    cacheKey,
    () => {
      log.debug(`Fetching: ${url}`)
      return api.get(url, config)
    },
    ttl
  )
}

/**
 * GET sin cache (fallback si necesitas ignorar deduplicación)
 */
export async function directGet(url, config = {}) {
  return api.get(url, config)
}

/**
 * Invalidar una URL del cache de deduplicación
 */
export function invalidateCache(pattern) {
  if (pattern) {
    globalRequestCache.invalidatePattern(pattern)
    log.debug(`Cache invalidated: ${pattern}`)
  } else {
    globalRequestCache.clear()
    log.debug(`All cache cleared`)
  }
}

/**
 * Obtener stats del cache de deduplicación
 */
export function getCacheStats() {
  return globalRequestCache.stats()
}

export default {
  cachedGet,
  directGet,
  invalidateCache,
  getCacheStats,
}
