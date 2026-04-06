/**
 * Utility script to get a Telegram chat ID.
 *
 * Usage:
 *   1. Stop the main bot
 *   2. Run: npx tsx scripts/get-chat-id.ts
 *   3. Send any message in the target group
 *   4. The chat ID will be printed and the script will exit
 */
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.on("message", (ctx) => {
  console.log("Chat ID:", ctx.chat.id);
  console.log("Chat type:", ctx.chat.type);
  if ("title" in ctx.chat) {
    console.log("Chat title:", ctx.chat.title);
  }
  process.exit(0);
});

console.log("Listening... Send any message in the target group.");
bot.launch();
