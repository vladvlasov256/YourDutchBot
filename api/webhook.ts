import { Bot, webhookCallback } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

bot.command('start', async (ctx) => {
  await ctx.reply('Hello! 👋 Welcome to YourDutchBot. I will help you learn Dutch!');
});

bot.on('message', async (ctx) => {
  await ctx.reply('Bot is under construction. Stay tuned! 🚧');
});

export default webhookCallback(bot, 'https');
