const cache = new Map()

/**
 * Get a value from the cache, or compute and store it if not present/expired.
 * @param {string} key - unique cache key
 * @param {number} ttlMs - time-to-live in milliseconds
 * @param {Function} fn - async function that returns the value to cache
 */
export const cached = async (key, ttlMs, fn) => {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    console.log(`CACHE HIT: ${key}`)
    return hit.value
  }
  console.log(`CACHE MISS: ${key}`)
  const value = await fn()
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

/**
 * Manually invalidate a specific key (e.g., after mutation).
 */
export const invalidate = (key) => {
  cache.delete(key)
}

/**
 * Clear cache entries whose keys start with a given prefix.
 * Useful for wiping all "players:*" or "games:*" at once.
 */
export const invalidatePrefix = (prefix) => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/**
 * Sweep expired entries periodically so memory doesn't grow forever.
 * Called automatically every 10 min; you can also call it manually.
 */
const sweep = () => {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
}
setInterval(sweep, 10 * 60 * 1000)

/**
 * Optional: current cache stats for debugging
 */
export const stats = () => ({ size: cache.size })