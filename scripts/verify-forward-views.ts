/**
 * Phase 0 verification: does forwardMessage return view counts?
 *
 * Usage: npx tsx scripts/verify-forward-views.ts <UTILITY_CHAT_ID> <MESSAGE_ID>
 *
 * Example: npx tsx scripts/verify-forward-views.ts -100123456789 42
 */
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const utilityChatId = process.argv[2];
const messageId = Number(process.argv[3]);

if (!utilityChatId || !messageId) {
  console.error("Usage: npx tsx scripts/verify-forward-views.ts <UTILITY_CHAT_ID> <MESSAGE_ID>");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN!);
const channelId = Number(process.env.CHANNEL_ID!);

async function test() {
  console.log(`Forwarding message ${messageId} from channel ${channelId} to ${utilityChatId}...`);

  const msg = await bot.telegram.forwardMessage(utilityChatId, channelId, messageId);

  console.log("\n=== Forwarded message ===");
  console.log(JSON.stringify(msg, null, 2));

  console.log("\n=== Key fields ===");
  console.log("views:", (msg as any).views ?? "NOT PRESENT");
  console.log("forward_count:", (msg as any).forward_count ?? "NOT PRESENT");

  await bot.telegram.deleteMessage(utilityChatId, msg.message_id);
  console.log("\nForwarded message deleted.");
}

test().catch(console.error);
