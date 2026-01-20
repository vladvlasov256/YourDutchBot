import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllActiveUsers, getDailyState } from '../lib/storage.js';
import { createBot } from '../lib/bot.js';

const bot = createBot(process.env.TELEGRAM_BOT_TOKEN || '');

// Engaging morning messages for users with NO lesson today - randomly selected each day
const NEW_LESSON_MESSAGES = [
  '☀️ *Goedemorgen!*\n\nReady for your daily Dutch practice? Let\'s learn something new today!\n\nUse /lesson to begin! 🇳🇱',

  '🌅 *Good morning!*\n\nYour daily Dutch lesson is waiting. 10 minutes today = fluent tomorrow!\n\nTap /lesson to start! 💪',

  '☕ *Morning!*\n\nTime to feed your brain some Dutch! Fresh news topics are ready for you.\n\nUse /lesson to dive in! 📰',

  '🌞 *Goedemorgen!*\n\nAnother day, another step closer to mastering Dutch. Let\'s do this!\n\nStart with /lesson! 🚀',

  '🌄 *Rise and shine!*\n\nYour daily dose of Dutch awaits. Reading, listening, speaking - all in one lesson.\n\nUse /lesson to begin! ✨',
];

// Messages for users with lesson IN PROGRESS
const IN_PROGRESS_MESSAGES = [
  '👋 *Good morning!*\n\nYou have an unfinished lesson from earlier. Let\'s complete it!\n\nUse /lesson to continue! 📚',

  '☀️ *Goedemorgen!*\n\nYour lesson is waiting for you! Don\'t leave it hanging.\n\nUse /lesson to pick up where you left off! 💪',

  '🔔 *Reminder!*\n\nYou started a lesson but didn\'t finish. Let\'s wrap it up!\n\nUse /lesson to continue! 🎯',
];

// Messages for users who COMPLETED today's lesson
const COMPLETED_MESSAGES = [
  '🎉 *Well done!*\n\nYou already completed today\'s lesson! Want more practice?\n\nUse /lesson to start another one! 🇳🇱',

  '⭐ *Great job!*\n\nLesson complete! Feeling ambitious? You can do another round.\n\nUse /lesson for more practice! 💪',

  '✅ *All done for today!*\n\nBut who says one lesson is enough? Challenge yourself!\n\nUse /lesson to keep going! 🚀',
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
        stats: { total: 0, sent: 0, failed: 0, skipped: 0 }
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const messageIndex = new Date().getDate() % 3; // Use modulo 3 for all message arrays

    let sent = 0;
    let failed = 0;
    let newLessons = 0;
    let inProgress = 0;
    let completed = 0;

    // Send to each user with rate limiting
    for (const user of users) {
      try {
        // Check user's lesson state
        const state = await getDailyState(user.telegramId);
        let message: string;
        let userType: string;

        // Determine which message to send based on state
        if (state && state.todayDate === today) {
          if (state.currentTask === 'done') {
            // User completed today's lesson - congratulate them
            message = COMPLETED_MESSAGES[messageIndex];
            userType = 'completed';
            completed++;
          } else {
            // User has lesson in progress - remind them to continue
            message = IN_PROGRESS_MESSAGES[messageIndex];
            userType = 'in_progress';
            inProgress++;
          }
        } else {
          // No lesson today yet (or old lesson from yesterday) - send new lesson message
          message = NEW_LESSON_MESSAGES[messageIndex];
          userType = 'new';
          newLessons++;
        }

        await bot.api.sendMessage(user.telegramId, message, {
          parse_mode: 'Markdown'
        });
        sent++;

        console.log(`[Daily Push] Sent to user ${user.telegramId} (${userType})`);

        // Wait 35ms between messages (allows ~28 msg/sec, safely under 30/sec limit)
        await delay(35);

      } catch (error) {
        console.error(`[Daily Push] Failed to send to user ${user.telegramId}:`, error);
        failed++;
        // Continue with other users even if one fails
      }
    }

    console.log(`[Daily Push] Completed. Total: ${users.length}, Sent: ${sent}, Failed: ${failed}`);
    console.log(`[Daily Push] Breakdown - New: ${newLessons}, In Progress: ${inProgress}, Completed: ${completed}`);

    return res.status(200).json({
      success: true,
      message: 'Daily push completed',
      stats: {
        total: users.length,
        sent,
        failed,
        breakdown: {
          newLessons,
          inProgress,
          completed
        }
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
