import { Context, Telegraf } from 'telegraf';
import { config } from '../../config';
import { insertPostSnapshot, getLatestPostSnapshot } from '../../db/repositories/snapshot.repo';

interface ChannelPostLike {
  chat: { id: number };
  message_id: number;
  views?: number;
  forward_count?: number;
}

function processPost(post: ChannelPostLike, reactions: number = 0): void {
  const chatId = post.chat.id.toString();
  if (chatId !== config.channelId) return;

  const views = post.views ?? 0;
  const forwards = post.forward_count ?? 0;

  const latest = getLatestPostSnapshot(config.channelId, post.message_id);
  if (
    latest &&
    latest.views === views &&
    latest.forwards === forwards &&
    latest.reactions === reactions
  ) {
    return;
  }

  insertPostSnapshot(config.channelId, post.message_id, views, forwards, reactions);
  console.log(
    `[collector] Post ${post.message_id} — views: ${views}, forwards: ${forwards}, reactions: ${reactions}`
  );
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

    const latest = getLatestPostSnapshot(config.channelId, reactionCount.message_id);
    insertPostSnapshot(
      config.channelId,
      reactionCount.message_id,
      latest?.views ?? 0,
      latest?.forwards ?? 0,
      totalReactions
    );
    console.log(
      `[collector] Post ${reactionCount.message_id} — reactions updated: ${totalReactions}`
    );
  });
}
