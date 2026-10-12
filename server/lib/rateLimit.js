/*
 * Small in-memory rate limiter (no extra package needed).
 *
 *   app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 30, methods: ["POST"] }))
 *
 * Counts requests per visitor IP in fixed windows. Over the limit -> HTTP 429
 * with a Retry-After header. Needs app.set("trust proxy", 1) behind Caddy so the
 * real visitor IP is used instead of Caddy's.
 *
 * Limits are generous on purpose: in the Philippines many mobile users share one
 * public IP (carrier-grade NAT), so a strict per-IP limit would block real people.
 */
export function rateLimit({ windowMs, max, methods, message = "Too many requests. Please slow down and try again shortly." }) {
  const hits = new Map() // ip -> { count, resetAt }

  // Forget finished windows so memory doesn't grow.
  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip)
  }, windowMs).unref()

  return (req, res, next) => {
    if (methods && !methods.includes(req.method)) return next()

    const ip = req.ip || req.socket?.remoteAddress || "unknown"
    const now = Date.now()
    let entry = hits.get(ip)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(ip, entry)
    }
    entry.count++

    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({ error: message })
    }
    next()
  }
}