import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { getChannel } from '../../db/repositories/channel.repo';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const channel = getChannel(config.channelId);
  res.render('index', {
    channelTitle: channel?.title ?? 'Channel',
    channelId: config.channelId,
  });
});

export { router as pageRouter };
