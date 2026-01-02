import { webhookCallback } from 'grammy';
import { createBot } from '../lib/bot.js';

const bot = createBot(process.env.TELEGRAM_BOT_TOKEN || '');

export default webhookCallback(bot, 'https');
