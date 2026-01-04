// Script to set bot commands for Telegram
// Run with: pnpm tsx scripts/setup-commands.ts

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function setCommands() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set in .env');
    process.exit(1);
  }

  const commands = [
    { command: 'start', description: 'Register and get started' },
    { command: 'lesson', description: 'Start a new lesson with topic selection' },
    { command: 'status', description: 'Check today\'s progress' },
    { command: 'skip', description: 'Skip current exercise and move to next' },
    { command: 'reset', description: 'Reset current lesson and start over' },
  ];

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands }),
    });

    const data = await response.json() as { ok: boolean; description?: string };

    if (data.ok) {
      console.log('✅ Bot commands set successfully!');
      console.log('Commands:', commands);
    } else {
      console.error('❌ Failed to set commands:', data);
    }
  } catch (error) {
    console.error('Error setting commands:', error);
  }
}

setCommands();
