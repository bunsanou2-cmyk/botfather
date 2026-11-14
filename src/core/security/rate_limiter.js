/**
 * Rate Limiter Module
 * Sliding-window rate limiter for Telegram updates and HTTP requests.
 */

const config = require('../../config');

class RateLimiter {
  constructor(windowMs = config.security.rateLimitWindowMs, maxRequests = config.security.rateLimitMaxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    // Clean up expired buckets periodically
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  isAllowed(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.hits.set(key, validTimestamps);
    return true;
  }

  getRemaining(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter(t => now - t < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }
}

// Global default rate limiters
const telegramRateLimiter = new RateLimiter(60000, 30); // 30 messages per minute per user
const httpRateLimiter = new RateLimiter(60000, 100);    // 100 requests per minute per IP

module.exports = {
  RateLimiter,
  telegramRateLimiter,
  httpRateLimiter,
};
