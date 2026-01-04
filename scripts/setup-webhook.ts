// Script to set Telegram webhook for Vercel deployment
// Run with: pnpm setup:webhook

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function setWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env');
    process.exit(1);
  }

  if (!WEBHOOK_URL) {
    console.error('❌ WEBHOOK_URL is not set in .env');
    console.log('Add this to your .env file:');
    console.log('WEBHOOK_URL=https://your-dutch-bot.vercel.app/api/webhook');
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;

  console.log(`Setting webhook to: ${WEBHOOK_URL}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: WEBHOOK_URL }),
    });

    const data = await response.json() as { ok: boolean; description?: string; result?: boolean };

    if (data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
    } else {
      console.error('❌ Failed to set webhook:', data.description || data);
    }
  } catch (error) {
    console.error('Error setting webhook:', error);
    process.exit(1);
  }
}

setWebhook();
