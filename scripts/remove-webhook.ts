// Script to remove Telegram webhook
// Run with: pnpm remove:webhook

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function removeWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env');
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`;

  console.log('Removing webhook...');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ drop_pending_updates: true }),
    });

    const data = await response.json() as { ok: boolean; description?: string; result?: boolean };

    if (data.ok) {
      console.log('✅ Webhook removed successfully!');
      console.log('💡 You can now use polling mode for local development (pnpm dev:local)');
    } else {
      console.error('❌ Failed to remove webhook:', data.description || data);
    }
  } catch (error) {
    console.error('Error removing webhook:', error);
    process.exit(1);
  }
}

removeWebhook();
