import { Telegraf } from 'telegraf';
import { config } from '../../config';
import { logger } from '../../logger';
import { withRetry } from '../../utils/retry';
import { upsertChannel } from '../../db/repositories/channel.repo';
import { insertMemberSnapshot } from '../../db/repositories/snapshot.repo';

export async function collectMemberCount(bot: Telegraf): Promise<void> {
  try {
    const chat = await withRetry(() => bot.telegram.getChat(config.channelId), 'getChat');
    if (!('title' in chat)) {
      logger.warn('Channel chat has no title — skipping');
      return;
    }

    upsertChannel(config.channelId, chat.title);

    const count = await withRetry(
      () => bot.telegram.getChatMembersCount(config.channelId),
      'getChatMembersCount',
    );
    insertMemberSnapshot(config.channelId, count);

    logger.info({ channel: chat.title, count }, 'Member count collected');
  } catch (error) {
    logger.error({ err: error }, 'Failed to collect member count');
  }
}
