// Local development bot with polling
// Run this with: pnpm dev:local

import * as dotenv from 'dotenv';
import { createBot } from './lib/bot.js';

// Load environment variables
dotenv.config({ path: '.env' });

const bot = createBot(process.env.TELEGRAM_BOT_TOKEN || '');

// Start the bot with polling (for local development)
console.log('Starting bot in polling mode...');
bot.start();

console.log('Bot is running! Press Ctrl+C to stop.');
