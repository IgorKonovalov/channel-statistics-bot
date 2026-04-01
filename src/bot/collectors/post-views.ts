import { Context, Telegraf } from 'telegraf';
import { config } from '../../config';
import { insertPostSnapshot, getLatestPostSnapshot } from '../../db/repositories/snapshot.repo';

const trackedMessageIds = new Set<number>();

export function registerPostListener(bot: Telegraf): void {
  bot.on('channel_post', (ctx: Context) => {
    const post = ctx.channelPost;
    if (!post) return;

    const chatId = post.chat.id.toString();
    if (chatId !== config.channelId) return;

    trackedMessageIds.add(post.message_id);

    const views = 'views' in post ? ((post as Record<string, unknown>).views as number ?? 0) : 0;
    const forwards = 'forward_date' in post ? 1 : 0;

    insertPostSnapshot(config.channelId, post.message_id, views, forwards);
    console.log(`[collector] New post ${post.message_id} tracked (views: ${views})`);
  });
}

export async function refreshPostViews(bot: Telegraf): Promise<void> {
  if (trackedMessageIds.size === 0) return;

  for (const messageId of trackedMessageIds) {
    try {
      const forwarded = await bot.telegram.forwardMessage(
        config.channelId,
        config.channelId,
        messageId
      );

      const views = 'views' in forwarded ? ((forwarded as { views?: number }).views ?? 0) : 0;

      const latest = getLatestPostSnapshot(config.channelId, messageId);
      const lastViews = latest?.views ?? 0;

      if (views !== lastViews) {
        insertPostSnapshot(config.channelId, messageId, views, 0);
        console.log(`[collector] Updated views for post ${messageId}: ${views}`);
      }

      // Delete the forwarded copy
      await bot.telegram.deleteMessage(config.channelId, forwarded.message_id);
    } catch (error) {
      console.error(`[collector] Failed to refresh views for post ${messageId}:`, error);
      // If message is too old or deleted, stop tracking it
      trackedMessageIds.delete(messageId);
    }
  }
}
