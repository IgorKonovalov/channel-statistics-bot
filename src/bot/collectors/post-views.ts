import { Context, Telegraf } from 'telegraf';
import { config } from '../../config';
import { insertPostSnapshot, getLatestPostSnapshot } from '../../db/repositories/snapshot.repo';

interface ChannelPostLike {
  chat: { id: number };
  message_id: number;
  views?: number;
  forward_date?: number;
}

function processPost(post: ChannelPostLike): void {
  const chatId = post.chat.id.toString();
  if (chatId !== config.channelId) return;

  const views = post.views ?? 0;
  const forwards = post.forward_date ? 1 : 0;

  const latest = getLatestPostSnapshot(config.channelId, post.message_id);
  if (latest && latest.views === views) return;

  insertPostSnapshot(config.channelId, post.message_id, views, forwards);
  console.log(`[collector] Post ${post.message_id} — views: ${views}`);
}

export function registerPostListener(bot: Telegraf): void {
  bot.on('channel_post', (ctx: Context) => {
    if (ctx.channelPost) processPost(ctx.channelPost as unknown as ChannelPostLike);
  });

  bot.on('edited_channel_post', (ctx: Context) => {
    if (ctx.editedChannelPost) processPost(ctx.editedChannelPost as unknown as ChannelPostLike);
  });
}
