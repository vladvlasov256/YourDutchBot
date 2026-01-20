import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllActiveUsers } from '../lib/storage.js';
import { createBot } from '../lib/bot.js';

const bot = createBot(process.env.TELEGRAM_BOT_TOKEN || '');

// Engaging morning messages - randomly selected each day
const MORNING_MESSAGES = [
  '☀️ *Goedemorgen!*\n\nReady for your daily Dutch practice? Let\'s learn something new today!\n\nUse /lesson to begin! 🇳🇱',

  '🌅 *Good morning!*\n\nYour daily Dutch lesson is waiting. 10 minutes today = fluent tomorrow!\n\nTap /lesson to start! 💪',

  '☕ *Morning!*\n\nTime to feed your brain some Dutch! Fresh news topics are ready for you.\n\nUse /lesson to dive in! 📰',

  '🌞 *Goedemorgen!*\n\nAnother day, another step closer to mastering Dutch. Let\'s do this!\n\nStart with /lesson! 🚀',

  '🌄 *Rise and shine!*\n\nYour daily dose of Dutch awaits. Reading, listening, speaking - all in one lesson.\n\nUse /lesson to begin! ✨',
];

// Add delay between messages to respect Telegram rate limits (~30 msg/sec)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is called by Vercel Cron (security check)
  // Vercel automatically adds this header when calling cron endpoints
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[Daily Push] Unauthorized request - invalid or missing Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Daily Push] Starting daily push job...');

    // Get all active users
    const users = await getAllActiveUsers();
    console.log(`[Daily Push] Found ${users.length} active users`);

    if (users.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active users to notify',
        stats: { total: 0, sent: 0, failed: 0 }
      });
    }

    // Pick a random message for today
    const messageIndex = new Date().getDate() % MORNING_MESSAGES.length;
    const message = MORNING_MESSAGES[messageIndex];

    let sent = 0;
    let failed = 0;

    // Send to each user with rate limiting
    for (const user of users) {
      try {
        await bot.api.sendMessage(user.telegramId, message, {
          parse_mode: 'Markdown'
        });
        sent++;

        // Wait 35ms between messages (allows ~28 msg/sec, safely under 30/sec limit)
        await delay(35);

      } catch (error) {
        console.error(`[Daily Push] Failed to send to user ${user.telegramId}:`, error);
        failed++;
        // Continue with other users even if one fails
      }
    }

    console.log(`[Daily Push] Completed. Sent: ${sent}, Failed: ${failed}`);

    return res.status(200).json({
      success: true,
      message: 'Daily push completed',
      stats: {
        total: users.length,
        sent,
        failed
      }
    });

  } catch (error) {
    console.error('[Daily Push] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
