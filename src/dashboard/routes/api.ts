import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Telegraf } from 'telegraf';
import { config } from '../../config';
import { getPostPhotoFileId } from '../../db/repositories/post.repo';
import {
  getMemberSnapshots,
  getReactionsAggregated,
  getPostBreakdown,
} from '../../db/repositories/snapshot.repo';
import { logger } from '../../logger';

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 19).replace('T', ' '),
    to: to.toISOString().slice(0, 19).replace('T', ' '),
  };
}

const PHOTO_CACHE_DIR = path.join(path.dirname(config.dbPath), 'photos');

export function createApiRouter(bot: Telegraf): Router {
  const router = Router();

  router.get('/api/members', (req: Request, res: Response) => {
    const { from, to } = defaultDateRange();
    const fromParam = (req.query['from'] as string) ?? from;
    const toParam = (req.query['to'] as string) ?? to;

    const data = getMemberSnapshots(config.channelId, fromParam, toParam);
    res.json(
      data.map((s) => ({
        date: s.recorded_at,
        count: s.count,
      })),
    );
  });

  router.get('/api/reactions', (req: Request, res: Response) => {
    const { from, to } = defaultDateRange();
    const fromParam = (req.query['from'] as string) ?? from;
    const toParam = (req.query['to'] as string) ?? to;

    const data = getReactionsAggregated(config.channelId, fromParam, toParam);
    res.json(data);
  });

  router.get('/api/posts', (req: Request, res: Response) => {
    const { from, to } = defaultDateRange();
    const fromParam = (req.query['from'] as string) ?? from;
    const toParam = (req.query['to'] as string) ?? to;
    const sortBy = (req.query['sort'] as string) ?? 'reactions';

    const data = getPostBreakdown(config.channelId, fromParam, toParam, sortBy);
    res.json(data);
  });

  router.get('/api/photo/:messageId', async (req: Request, res: Response) => {
    const messageId = parseInt(req.params['messageId'] as string, 10);
    if (isNaN(messageId)) {
      res.status(400).send('Invalid message ID');
      return;
    }

    const fileId = getPostPhotoFileId(config.channelId, messageId);
    if (!fileId) {
      res.status(404).send('No photo');
      return;
    }

    const cachePath = path.join(PHOTO_CACHE_DIR, `${messageId}.jpg`);

    // Serve from cache if available
    if (fs.existsSync(cachePath)) {
      res.type('image/jpeg').sendFile(cachePath);
      return;
    }

    try {
      const fileLink = await bot.telegram.getFileLink(fileId);
      const response = await fetch(fileLink.toString());
      if (!response.ok) {
        res.status(502).send('Failed to fetch photo');
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Cache to disk
      fs.mkdirSync(PHOTO_CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath, buffer);

      res.type('image/jpeg').send(buffer);
    } catch (err) {
      logger.error({ err, messageId }, 'Failed to serve photo');
      res.status(500).send('Photo unavailable');
    }
  });

  return router;
}
