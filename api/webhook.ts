import { Bot, webhookCallback } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

bot.command('start', (ctx) => {
  ctx.reply('Hello! 👋 Welcome to YourDutchBot. I will help you learn Dutch!');
});

bot.on('message', (ctx) => {
  ctx.reply('Bot is under construction. Stay tuned! 🚧');
});

export default webhookCallback(bot, 'std/http');
