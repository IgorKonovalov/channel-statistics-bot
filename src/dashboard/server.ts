import express from 'express';
import path from 'path';
import { Telegraf } from 'telegraf';
import { config } from '../config';
import { logger } from '../logger';
import { healthRouter } from './routes/health';
import { basicAuth } from './middleware/auth';
import { pageRouter } from './routes/index';
import { createApiRouter } from './routes/api';

export function createDashboard(bot: Telegraf): express.Express {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(healthRouter);
  app.use(basicAuth);
  app.use(pageRouter);
  app.use(createApiRouter(bot));

  return app;
}

export function startDashboard(bot: Telegraf): Promise<void> {
  return new Promise((resolve) => {
    const app = createDashboard(bot);
    app.listen(config.dashboard.port, () => {
      logger.info({ port: config.dashboard.port }, 'Dashboard listening');
      resolve();
    });
  });
}
