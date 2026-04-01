import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { getChannel } from '../../db/repositories/channel.repo';

const router = Router();

function getChannelTitle(): string {
  const channel = getChannel(config.channelId);
  return channel?.title ?? 'Channel';
}

router.get('/', (_req: Request, res: Response) => {
  res.render('index', {
    channelTitle: getChannelTitle(),
    channelId: config.channelId,
  });
});

router.get('/posts', (_req: Request, res: Response) => {
  res.render('posts', {
    channelTitle: getChannelTitle(),
    channelId: config.channelId,
  });
});

export { router as pageRouter };
