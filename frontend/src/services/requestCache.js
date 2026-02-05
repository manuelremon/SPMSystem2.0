/**
 * Request Deduplication Cache
 *
 * Previene múltiples llamadas simultáneas al mismo endpoint.
 * Útil para:
 * - Clicks rápidos en botones (evita 5 llamadas idénticas)
 * - Múltiples componentes montando simultáneamente
 * - Race conditions en actualizaciones
 *
 * Ejemplo:
 *   const cache = new RequestCache();
 *   const promise1 = cache.get('/api/kpis', () => fetch('/api/kpis'));
 *   const promise2 = cache.get('/api/kpis', () => fetch('/api/kpis'));
 *   // promise1 === promise2 (misma Promise, solo 1 llamada real)
 */

export class RequestCache {
  constructor() {
    this.pending = new Map(); // key -> { promise, timestamp }
    this.ttl = 300; // 5 minutos máximo de cache
  }

  /**
   * Obtiene resultado cacheado o ejecuta la función si no existe
   * @param {string} key - Clave única para la request
   * @param {Function} fn - Función que retorna la Promise
   * @param {number} ttl - TTL en segundos (default: 300)
   * @returns {Promise} Promise que se resuelve cuando la request completa
   */
  get(key, fn, ttl = this.ttl) {
    const now = Date.now();

    // Verificar si existe y está vigente
    if (this.pending.has(key)) {
      const cached = this.pending.get(key);
      const age = (now - cached.timestamp) / 1000;

      if (age < ttl) {
        // Aún está dentro del TTL, retornar la Promise existente
        return cached.promise;
      } else {
        // Expiró, eliminar del cache
        this.pending.delete(key);
      }
    }

    // No existe o expiró - crear nueva Promise
    const promise = fn()
      .then((result) => {
        // Remover del cache después de resolver
        this.pending.delete(key);
        return result;
      })
      .catch((error) => {
        // Remover del cache después de error (para que se reintente)
        this.pending.delete(key);
        throw error;
      });

    // Almacenar Promise en cache
    this.pending.set(key, {
      promise,
      timestamp: now,
    });

    return promise;
  }

  /**
   * Invalida una clave específica del cache
   */
  invalidate(key) {
    this.pending.delete(key);
  }

  /**
   * Invalida todas las claves que coincidan con un patrón
   */
  invalidatePattern(pattern) {
    const keys = Array.from(this.pending.keys());
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.pending.delete(key);
      }
    });
  }

  /**
   * Limpia todo el cache
   */
  clear() {
    this.pending.clear();
  }

  /**
   * Obtiene estadísticas del cache
   */
  stats() {
    const now = Date.now();
    let expired = 0;

    this.pending.forEach(({ timestamp }) => {
      const age = (now - timestamp) / 1000;
      if (age >= this.ttl) {
        expired++;
      }
    });

    return {
      pending: this.pending.size,
      expired,
      ttl: this.ttl,
    };
  }
}

// Instancia global singleton
export const globalRequestCache = new RequestCache();

export default RequestCache;
