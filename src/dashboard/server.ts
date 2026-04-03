import express from 'express';
import path from 'path';
import { config } from '../config';
import { logger } from '../logger';
import { healthRouter } from './routes/health';
import { basicAuth } from './middleware/auth';
import { pageRouter } from './routes/index';
import { apiRouter } from './routes/api';

export function createDashboard(): express.Express {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(healthRouter);
  app.use(basicAuth);
  app.use(pageRouter);
  app.use(apiRouter);

  return app;
}

export function startDashboard(): Promise<void> {
  return new Promise((resolve) => {
    const app = createDashboard();
    app.listen(config.dashboard.port, () => {
      logger.info({ port: config.dashboard.port }, 'Dashboard listening');
      resolve();
    });
  });
}
