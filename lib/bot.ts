import { Bot, Context, InlineKeyboard } from 'grammy';
import { getUserProfile, createUserProfile, getDailyState, resetDailyState, createDailyState, setDailyState, getDailyTopics, setDailyTopics } from './storage.js';
import { TOPICS } from '../config/topics.js';
import { fetchNews, NewsArticle } from './gnews.js';
import { generateReadingTask } from './tasks/reading.js';

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

  // /lesson command - Start a new lesson
  bot.command('lesson', async (ctx) => {
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

    // Check if lesson already in progress
    const state = await getDailyState(telegramId);
    const today = new Date().toISOString().split('T')[0];

    if (state && state.todayDate === today && state.currentTask !== 'done') {
      // Lesson in progress
      if (state.currentTask === 'selecting_topic') {
        // Re-show the topic list
        if (state.availableTopics && state.availableTopics.length > 0) {
          const topicList = state.availableTopics
            .map((article, index) => `${index + 1}. ${article.title}`)
            .join('\n\n');

          // Create inline keyboard with number buttons
          const keyboard = new InlineKeyboard();
          for (let i = 0; i < state.availableTopics.length; i++) {
            keyboard.text(`${i + 1}`, `topic_${i}`);
          }

          await ctx.reply(
            `📰 Choose a topic for today's lesson:\n\n` +
            `${topicList}`,
            { reply_markup: keyboard }
          );
        } else {
          await ctx.reply('Something went wrong. Use /reset to start over.');
        }
        return;
      }

      // User is in the middle of tasks (1, 2, or 3) - re-display the current task
      if (state.currentTask === 1 && state.tasks[1]) {
        // Re-display reading task
        const readingTask = state.tasks[1];

        await ctx.reply(
          `📖 *Reading Exercise* (resuming)\n\n` +
          `${readingTask.content}\n\n` +
          `_Answer the questions below:_`,
          { parse_mode: 'Markdown' }
        );

        // Display each question with inline keyboard
        for (let i = 0; i < readingTask.questions.length; i++) {
          const q = readingTask.questions[i];
          const keyboard = new InlineKeyboard()
            .text('A', `reading_${i}_A`)
            .text('B', `reading_${i}_B`)
            .text('C', `reading_${i}_C`);

          await ctx.reply(
            `*Question ${i + 1}:* ${q.question}\n\n` +
            `A) ${q.options[0]}\n` +
            `B) ${q.options[1]}\n` +
            `C) ${q.options[2]}`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
          );
        }

        await ctx.reply(
          `📝 Select your answers for all 3 questions using the buttons above.`
        );
        return;
      }

      if (state.currentTask === 2 && state.tasks[2]) {
        // TODO: Re-display listening task when implemented
        await ctx.reply(
          `🎧 Listening task in progress.\n\n` +
          `Use /reset to start over.`
        );
        return;
      }

      if (state.currentTask === 3 && state.tasks[3]) {
        // TODO: Re-display speaking task when implemented
        await ctx.reply(
          `🎤 Speaking task in progress.\n\n` +
          `Use /reset to start over.`
        );
        return;
      }

      // Fallback if task data is missing
      await ctx.reply(
        `You have a lesson in progress but I can't find the task data.\n\n` +
        `Use /reset to start over.`
      );
      return;
    }

    // No lesson in progress or user finished - allow starting a new one
    if (state && state.todayDate === today && state.currentTask === 'done') {
      await ctx.reply('Starting a new lesson...');
    }

    // Fetch or get cached topics
    await ctx.reply('🔍 Fetching fresh news topics...');

    let topics = await getDailyTopics();

    if (!topics || topics.length === 0) {
      // Fetch from GNews API - mix topics from user's preferences
      const allArticles: NewsArticle[] = [];

      for (const topic of TOPICS) {
        const articles = await fetchNews(topic.query, 2);
        allArticles.push(...articles);
      }

      if (allArticles.length === 0) {
        await ctx.reply('Sorry, I could not fetch news articles at the moment. Please try again later.');
        return;
      }

      // Shuffle and take 5
      const shuffled = allArticles.sort(() => Math.random() - 0.5);
      topics = shuffled.slice(0, 5);

      // Cache for today
      await setDailyTopics(topics);
    }

    // Create new daily state for this lesson
    const newState = await createDailyState(telegramId);
    newState.availableTopics = topics;

    await setDailyState(telegramId, newState);

    // Display topic selection
    const topicList = topics
      .map((article, index) => `${index + 1}. ${article.title}`)
      .join('\n\n');

    // Create inline keyboard with number buttons
    const keyboard = new InlineKeyboard();
    for (let i = 0; i < topics.length; i++) {
      keyboard.text(`${i + 1}`, `topic_${i}`);
    }

    await ctx.reply(
      `📰 Choose a topic for today's lesson:\n\n` +
      `${topicList}`,
      { reply_markup: keyboard }
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

    if (state.currentTask === 'selecting_topic') {
      await ctx.reply(
        `📊 Status: Waiting for topic selection\n\n` +
        `Use /lesson to start a new lesson!`
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

    // currentTask is now guaranteed to be 1, 2, or 3
    const taskNames: Record<1 | 2 | 3, string> = {
      1: 'Reading',
      2: 'Listening',
      3: 'Speaking',
    };
    const currentTaskName = taskNames[state.currentTask];

    await ctx.reply(
      `📊 Today's Progress:\n\n` +
      `${state.currentTask === 1 ? '⏳' : '✅'} Task 1: Reading\n` +
      `${state.currentTask === 2 ? '⏳' : (typeof state.currentTask === 'number' && state.currentTask > 2) ? '✅' : '⬜'} Task 2: Listening\n` +
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
      `🔄 Your lesson has been reset.\n\n` +
      `Use /lesson to start a new lesson!`
    );
  });

  // Handle inline keyboard callbacks (topic selection)
  bot.on('callback_query:data', async (ctx) => {
    const telegramId = ctx.from?.id;
    const data = ctx.callbackQuery.data;

    if (!telegramId) {
      await ctx.answerCallbackQuery({ text: 'Error: Could not get your user ID.' });
      return;
    }

    // Handle topic selection
    if (data.startsWith('topic_')) {
      const topicIndex = parseInt(data.replace('topic_', ''));
      const state = await getDailyState(telegramId);

      if (!state || state.currentTask !== 'selecting_topic') {
        await ctx.answerCallbackQuery({ text: 'This selection is no longer valid. Use /lesson to start a new lesson.' });
        return;
      }

      if (!state.availableTopics || topicIndex >= state.availableTopics.length) {
        await ctx.answerCallbackQuery({ text: 'Invalid topic selection.' });
        return;
      }

      // Store the selected topic
      state.selectedTopicIndex = topicIndex;
      state.currentTask = 1; // Move to reading task
      await setDailyState(telegramId, state);

      // Answer the callback query (removes the loading state from the button)
      await ctx.answerCallbackQuery();

      // Edit the message to remove the keyboard
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });

      // Start generating the reading task
      const selectedArticle = state.availableTopics[topicIndex];
      await ctx.reply(
        `Great choice! 📚\n\n` +
        `You selected: ${selectedArticle.title}\n\n` +
        `Generating reading exercise...`
      );

      try {
        // Generate the reading task using OpenAI
        const readingTask = await generateReadingTask(selectedArticle);

        // Save to state
        state.tasks[1] = readingTask;
        await setDailyState(telegramId, state);

        // Display the reading task
        await ctx.reply(
          `📖 *Reading Exercise*\n\n` +
          `${readingTask.content}\n\n` +
          `_Answer the questions below:_`,
          { parse_mode: 'Markdown' }
        );

        // Display each question with inline keyboard
        for (let i = 0; i < readingTask.questions.length; i++) {
          const q = readingTask.questions[i];
          const keyboard = new InlineKeyboard()
            .text('A', `reading_${i}_A`)
            .text('B', `reading_${i}_B`)
            .text('C', `reading_${i}_C`);

          await ctx.reply(
            `*Question ${i + 1}:* ${q.question}\n\n` +
            `A) ${q.options[0]}\n` +
            `B) ${q.options[1]}\n` +
            `C) ${q.options[2]}`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
          );
        }

        await ctx.reply(
          `📝 Select your answers for all 3 questions using the buttons above.`
        );

      } catch (error) {
        console.error('Error generating reading task:', error);
        await ctx.reply(
          `Sorry, I encountered an error generating the reading exercise. Please try again with /reset and /lesson.`
        );
      }
    }
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
