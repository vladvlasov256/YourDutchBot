// Local development bot with polling
// Run this with: tsx dev-bot.ts or ts-node dev-bot.ts

import { Bot } from 'grammy';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

bot.command('start', async (ctx) => {
  await ctx.reply('Hello! 👋 Welcome to YourDutchBot. I will help you learn Dutch!');
});

bot.on('message', async (ctx) => {
  await ctx.reply('Bot is under construction. Stay tuned! 🚧');
});

// Start the bot with polling (for local development)
console.log('Starting bot in polling mode...');
bot.start();

console.log('Bot is running! Press Ctrl+C to stop.');
