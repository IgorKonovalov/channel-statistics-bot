import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimit(
  windowMs: number = 60 * 1000,
  maxRequests: number = 100,
): (req: Request, res: Response, next: NextFunction) => void {
  const clients = new Map<string, RateLimitEntry>();

  // Clean up expired entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of clients) {
      if (entry.resetAt <= now) clients.delete(key);
    }
  }, 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    let entry = clients.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(ip, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      res.status(429).send('Too many requests');
      return;
    }

    next();
  };
}
