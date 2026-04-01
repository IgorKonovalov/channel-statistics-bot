import { Telegraf } from 'telegraf';
import { config } from '../../config';
import { upsertChannel } from '../../db/repositories/channel.repo';
import { insertMemberSnapshot } from '../../db/repositories/snapshot.repo';

export async function collectMemberCount(bot: Telegraf): Promise<void> {
  try {
    const chat = await bot.telegram.getChat(config.channelId);
    if (!('title' in chat)) {
      console.warn('[collector] Channel chat has no title — skipping');
      return;
    }

    upsertChannel(config.channelId, chat.title);

    const count = await bot.telegram.getChatMembersCount(config.channelId);
    insertMemberSnapshot(config.channelId, count);

    console.log(`[collector] Member count for ${chat.title}: ${count}`);
  } catch (error) {
    console.error('[collector] Failed to collect member count:', error);
  }
}
