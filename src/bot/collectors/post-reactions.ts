import { Context, Telegraf } from 'telegraf';
import { config } from '../../config';
import { logger } from '../../logger';
import { ensureChannel } from '../../db/repositories/channel.repo';
import { upsertPost } from '../../db/repositories/post.repo';
import { insertPostSnapshot, getLatestPostSnapshot } from '../../db/repositories/snapshot.repo';

interface ChannelPostLike {
  chat: { id: number; username?: string };
  message_id: number;
  text?: string;
  caption?: string;
  date?: number;
  photo?: { file_id: string }[];
}

function processPost(post: ChannelPostLike, reactions: number = 0): void {
  const chatId = post.chat.id.toString();
  if (chatId !== config.channelId) return;

  const latest = getLatestPostSnapshot(config.channelId, post.message_id);
  if (latest && latest.reactions === reactions) {
    return;
  }

  ensureChannel(config.channelId);

  const postText = (post.text ?? post.caption ?? '').slice(0, 200);
  const postDate = post.date ? new Date(post.date * 1000).toISOString() : new Date().toISOString();
  const username = post.chat.username;
  const postUrl = username ? `https://t.me/${username}/${post.message_id}` : '';
  const photoFileId = post.photo?.length ? post.photo[post.photo.length - 1]?.file_id : undefined;

  upsertPost(config.channelId, post.message_id, postText, postDate, postUrl, photoFileId);
  insertPostSnapshot(config.channelId, post.message_id, reactions);
  logger.info({ postId: post.message_id, reactions }, 'Post snapshot saved');
}

export function registerPostListener(bot: Telegraf): void {
  bot.on('channel_post', (ctx: Context) => {
    if (ctx.channelPost) processPost(ctx.channelPost as unknown as ChannelPostLike);
  });

  bot.on('edited_channel_post', (ctx: Context) => {
    if (ctx.editedChannelPost) processPost(ctx.editedChannelPost as unknown as ChannelPostLike);
  });

  // Capture reaction count updates on channel posts
  bot.on('message_reaction_count' as never, (ctx: Context) => {
    const update = (ctx as unknown as Record<string, unknown>).update as Record<string, unknown>;
    const reactionCount = update['message_reaction_count'] as
      | { chat: { id: number }; message_id: number; reactions: { total_count: number }[] }
      | undefined;

    if (!reactionCount) return;

    const chatId = reactionCount.chat.id.toString();
    if (chatId !== config.channelId) return;

    const totalReactions = reactionCount.reactions.reduce((sum, r) => sum + r.total_count, 0);

    ensureChannel(config.channelId);
    insertPostSnapshot(config.channelId, reactionCount.message_id, totalReactions);
    logger.info(
      { postId: reactionCount.message_id, reactions: totalReactions },
      'Reactions updated',
    );
  });
}
