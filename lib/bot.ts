import { Bot, Context } from 'grammy';
import { getUserProfile, createUserProfile, getDailyState, resetDailyState } from './storage.js';
import { TOPICS } from '../config/topics.js';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // /start command - Register user
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    const firstName = ctx.from?.first_name || 'User';

    if (!telegramId) {
      await ctx.reply('Error: Could not get your user ID.');
      return;
    }

    // Check if user already exists
    let profile = await getUserProfile(telegramId);

    if (profile) {
      await ctx.reply(
        `Welcome back, ${profile.firstName}! 👋\n\n` +
        `You're already registered. Use /status to check your progress.\n\n` +
        `Commands:\n` +
        `/status - Check today's progress\n` +
        `/reset - Start over today's exercises`
      );
      return;
    }

    // Create new user profile with all topics
    const topicIds = TOPICS.map(t => t.id);
    profile = await createUserProfile(telegramId, firstName, topicIds);

    await ctx.reply(
      `Hello, ${firstName}! 👋 Welcome to YourDutchBot.\n\n` +
      `I'll help you learn Dutch (A2 level) for the inburgeringsexamen.\n\n` +
      `Every day at 08:00 CET, I'll send you exercises covering:\n` +
      `• Reading comprehension\n` +
      `• Listening comprehension\n` +
      `• Speaking practice\n\n` +
      `Topics: ${TOPICS.map(t => t.label).join(', ')}\n\n` +
      `Commands:\n` +
      `/status - Check today's progress\n` +
      `/reset - Start over today's exercises\n\n` +
      `Your first exercises will arrive tomorrow morning! Tot morgen! 🇳🇱`
    );
  });

  // /status command - Show current progress
  bot.command('status', async (ctx) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply('Error: Could not get your user ID.');
      return;
    }

    const profile = await getUserProfile(telegramId);

    if (!profile) {
      await ctx.reply('You are not registered yet. Use /start to begin!');
      return;
    }

    const state = await getDailyState(telegramId);

    if (!state) {
      await ctx.reply(
        `📊 Status: No exercises yet today.\n\n` +
        `Your daily exercises will be sent at 08:00 CET.`
      );
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (state.todayDate !== today) {
      await ctx.reply(
        `📊 Status: No exercises yet today.\n\n` +
        `Your daily exercises will be sent at 08:00 CET.`
      );
      return;
    }

    if (state.currentTask === 'done') {
      await ctx.reply(
        `✅ All done for today!\n\n` +
        `You completed all 3 exercises.\n` +
        `See you tomorrow! Tot morgen! 🇳🇱`
      );
      return;
    }

    const taskNames = ['Reading', 'Listening', 'Speaking'];
    const currentTaskName = taskNames[(state.currentTask as number) - 1];

    await ctx.reply(
      `📊 Today's Progress:\n\n` +
      `${state.currentTask === 1 ? '⏳' : '✅'} Task 1: Reading\n` +
      `${state.currentTask === 2 ? '⏳' : state.currentTask > 2 ? '✅' : '⬜'} Task 2: Listening\n` +
      `${state.currentTask === 3 ? '⏳' : '⬜'} Task 3: Speaking\n\n` +
      `Current task: ${currentTaskName}`
    );
  });

  // /reset command - Reset today's exercises
  bot.command('reset', async (ctx) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply('Error: Could not get your user ID.');
      return;
    }

    const profile = await getUserProfile(telegramId);

    if (!profile) {
      await ctx.reply('You are not registered yet. Use /start to begin!');
      return;
    }

    await resetDailyState(telegramId);

    await ctx.reply(
      `🔄 Today's exercises have been reset.\n\n` +
      `You can start fresh, but you'll need to wait for the daily push or manually trigger new exercises.\n\n` +
      `Use /status to check your progress.`
    );
  });

  // Handle text messages (for task answers)
  bot.on('message:text', async (ctx) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      return;
    }

    // Skip if it's a command
    if (ctx.message.text.startsWith('/')) {
      return;
    }

    const profile = await getUserProfile(telegramId);

    if (!profile) {
      await ctx.reply('Please use /start first to register!');
      return;
    }

    // TODO: Process task answers based on current state
    await ctx.reply(
      `Message received! 📝\n\n` +
      `Task answer processing is coming soon.\n` +
      `For now, use /status to check your progress.`
    );
  });

  // Handle voice messages (for speaking task)
  bot.on('message:voice', async (ctx) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      return;
    }

    const profile = await getUserProfile(telegramId);

    if (!profile) {
      await ctx.reply('Please use /start first to register!');
      return;
    }

    // TODO: Process voice message for speaking task
    await ctx.reply(
      `Voice message received! 🎤\n\n` +
      `Speaking task processing is coming soon.\n` +
      `For now, use /status to check your progress.`
    );
  });

  return bot;
}
