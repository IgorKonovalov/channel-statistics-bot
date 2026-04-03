import { Router, Request, Response } from 'express';
import { config } from '../../config';
import {
  getMemberSnapshots,
  getViewsAggregated,
  getReactionsAggregated,
  getForwardsAggregated,
  getPostBreakdown,
} from '../../db/repositories/snapshot.repo';

const router = Router();

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 19).replace('T', ' '),
    to: to.toISOString().slice(0, 19).replace('T', ' '),
  };
}

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

router.get('/api/views', (req: Request, res: Response) => {
  const { from, to } = defaultDateRange();
  const fromParam = (req.query['from'] as string) ?? from;
  const toParam = (req.query['to'] as string) ?? to;

  const data = getViewsAggregated(config.channelId, fromParam, toParam);
  res.json(data);
});

router.get('/api/reactions', (req: Request, res: Response) => {
  const { from, to } = defaultDateRange();
  const fromParam = (req.query['from'] as string) ?? from;
  const toParam = (req.query['to'] as string) ?? to;

  const data = getReactionsAggregated(config.channelId, fromParam, toParam);
  res.json(data);
});

router.get('/api/forwards', (req: Request, res: Response) => {
  const { from, to } = defaultDateRange();
  const fromParam = (req.query['from'] as string) ?? from;
  const toParam = (req.query['to'] as string) ?? to;

  const data = getForwardsAggregated(config.channelId, fromParam, toParam);
  res.json(data);
});

router.get('/api/posts', (req: Request, res: Response) => {
  const { from, to } = defaultDateRange();
  const fromParam = (req.query['from'] as string) ?? from;
  const toParam = (req.query['to'] as string) ?? to;
  const sortBy = (req.query['sort'] as string) ?? 'views';

  const data = getPostBreakdown(config.channelId, fromParam, toParam, sortBy);
  res.json(data);
});

export { router as apiRouter };
