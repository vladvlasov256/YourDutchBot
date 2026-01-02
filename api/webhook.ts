import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

bot.command('start', (ctx) => {
  ctx.reply('Hello! 👋 Welcome to YourDutchBot. I will help you learn Dutch!');
});

bot.on('message', (ctx) => {
  ctx.reply('Bot is under construction. Stay tuned! 🚧');
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } else {
      res.status(200).json({ status: 'Bot is running' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
