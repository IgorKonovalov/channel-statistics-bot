import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';

export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Dashboard"');
    res.status(401).send('Authentication required');
    return;
  }

  const credentials = Buffer.from(header.slice(6), 'base64').toString();
  const [user, password] = credentials.split(':');

  if (user === config.dashboard.user && password === config.dashboard.password) {
    next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="Dashboard"');
    res.status(401).send('Invalid credentials');
  }
}
