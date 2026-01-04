import { Bot, Context, InlineKeyboard, InputFile } from 'grammy';
import { getUserProfile, createUserProfile, getDailyState, resetDailyState, createDailyState, setDailyState, getDailyTopics, setDailyTopics, VocabularyWord } from './storage.js';
import { TOPICS } from '../config/topics.js';
import { fetchNews, NewsArticle } from './gnews.js';
import { generateReadingTask } from './tasks/reading.js';
import { generateListeningTask } from './tasks/listening.js';
import { generateSpeakingTask, evaluateSpeaking } from './tasks/speaking.js';
import { transcribeAudio } from './openai.js';

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
        const progress = state.readingProgress;

        // If no progress data, initialize it (backward compatibility)
        if (!progress) {
          state.readingProgress = {
            currentQuestion: 0,
            userAnswers: [null, null, null]
          };
          await setDailyState(telegramId, state);
        }

        const currentQ = progress?.currentQuestion || 0;

        if (currentQ === 0) {
          // User hasn't started - show vocabulary, text, and ready button
          const vocabList = readingTask.words
            .map(word => {
              const [dutch, english] = word.split(':');
              return `• *${dutch}* - _${english}_`;
            })
            .join('\n');

          await ctx.reply(
            `📚 *Vocabulary* (resuming)\n\n${vocabList}`,
            { parse_mode: 'Markdown' }
          );

          await ctx.reply(
            `📖 *Reading Exercise*\n\n${readingTask.content}`,
            { parse_mode: 'Markdown' }
          );

          const readyKeyboard = new InlineKeyboard()
            .text('✅ Ready for the questions', 'reading_ready');

          await ctx.reply(
            `Take your time to read the text and learn the vocabulary.`,
            { reply_markup: readyKeyboard }
          );
        } else {
          // User is on a specific question (1, 2, or 3)
          const questionIndex = currentQ - 1;
          const q = readingTask.questions[questionIndex];

          const keyboard = new InlineKeyboard()
            .text('A', `reading_answer_${currentQ}_A`)
            .text('B', `reading_answer_${currentQ}_B`)
            .text('C', `reading_answer_${currentQ}_C`);

          await ctx.reply(
            `📖 *Reading Exercise* (resuming)\n\n` +
            `*Question ${currentQ}:* ${q.question}\n\n` +
            `A) ${q.options[0]}\n` +
            `B) ${q.options[1]}\n` +
            `C) ${q.options[2]}`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
          );
        }

        return;
      }

      if (state.currentTask === 2 && state.tasks[2]) {
        // Re-display listening task
        const listeningTask = state.tasks[2];
        const progress = state.listeningProgress;

        // If no progress data, initialize it (backward compatibility)
        if (!progress) {
          state.listeningProgress = {
            currentQuestion: 0,
            userAnswers: [null, null]
          };
          await setDailyState(telegramId, state);
        }

        const currentQ = progress?.currentQuestion || 0;

        // Re-send the audio
        await ctx.api.sendVoice(telegramId, listeningTask.audioUrl, {
          caption: '🎧 *Listening Exercise* (resuming)',
          parse_mode: 'Markdown'
        });

        if (currentQ === 0) {
          // User hasn't started - show vocabulary and ready button
          const vocabList = listeningTask.words
            .map(word => {
              const [dutch, english] = word.split(':');
              return `• *${dutch}* - _${english}_`;
            })
            .join('\n');

          await ctx.reply(
            `📚 *Vocabulary* (resuming)\n\n${vocabList}`,
            { parse_mode: 'Markdown' }
          );

          const readyKeyboard = new InlineKeyboard()
            .text('✅ Ready for the questions', 'listening_ready');

          await ctx.reply(
            `Listen to the audio and learn the vocabulary.\n\n` +
            `Click "Ready" when you're prepared to answer questions.`,
            { reply_markup: readyKeyboard }
          );
        } else {
          // User is on a specific question (1 or 2)
          const questionIndex = currentQ - 1;
          const q = listeningTask.questions[questionIndex];

          const keyboard = new InlineKeyboard()
            .text('A', `listening_answer_${currentQ}_A`)
            .text('B', `listening_answer_${currentQ}_B`)
            .text('C', `listening_answer_${currentQ}_C`);

          await ctx.reply(
            `🎧 *Listening Exercise* (resuming)\n\n` +
            `*Question ${currentQ}:* ${q.question}\n\n` +
            `A) ${q.options[0]}\n` +
            `B) ${q.options[1]}\n` +
            `C) ${q.options[2]}`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
          );
        }

        return;
      }

      if (state.currentTask === 3 && state.tasks[3]) {
        // Re-display speaking task
        const speakingTask = state.tasks[3];
        const progress = state.speakingProgress;

        // If no progress data, initialize it (backward compatibility)
        if (!progress) {
          state.speakingProgress = {
            awaitingVoiceMessage: true
          };
          await setDailyState(telegramId, state);
        }

        if (progress?.awaitingVoiceMessage === false) {
          // User already sent voice message and got feedback
          await ctx.reply(
            `✅ You've already completed the speaking task.\n\n` +
            `Use /lesson to start a new lesson!`
          );
          return;
        }

        // Display vocabulary
        const vocabList = speakingTask.words
          .map(word => {
            const [dutch, english] = word.split(':');
            return `• *${dutch}* - _${english}_`;
          })
          .join('\n');

        await ctx.reply(
          `📚 *Vocabulary* (resuming)\n\n${vocabList}`,
          { parse_mode: 'Markdown' }
        );

        // Display speaking prompt
        await ctx.reply(
          `🎤 *Speaking Exercise* (resuming)\n\n` +
          `${speakingTask.prompt}\n\n` +
          `_Send a voice message with your answer (2-3 sentences in Dutch)._`,
          { parse_mode: 'Markdown' }
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

      // Add delay between requests to avoid rate limiting
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < TOPICS.length; i++) {
        const topic = TOPICS[i];

        // Add 500ms delay between requests (except for the first one)
        if (i > 0) {
          await delay(500);
        }

        // Fetch only 1 article per topic (we need 5 total, we have 4 topics)
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

  bot.command('skip', async (ctx) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply('Error: Could not get your user ID.');
      return;
    }

    const state = await getDailyState(telegramId);

    if (!state) {
      await ctx.reply('No active lesson. Use /lesson to start!');
      return;
    }

    if (state.currentTask === 'selecting_topic') {
      await ctx.reply('Please select a topic first before skipping.');
      return;
    }

    if (state.currentTask === 'done') {
      await ctx.reply('Lesson already complete! Use /lesson to start a new one.');
      return;
    }

    // Skip current task and move to next
    if (state.currentTask === 1) {
      // Skip reading, generate and show listening task
      await ctx.reply('⏭️ Skipping reading...\n\n🎧 Generating listening exercise...');

      try {
        const selectedArticle = state.availableTopics![state.selectedTopicIndex!];
        const { task: listeningTask, audioBuffer } = await generateListeningTask(selectedArticle);

        // Send the audio to Telegram
        const audioMessage = await ctx.replyWithVoice(new InputFile(audioBuffer, 'listening.mp3'));
        listeningTask.audioUrl = audioMessage.voice.file_id;

        // Update state
        state.currentTask = 2;
        state.readingProgress = undefined;
        state.tasks[2] = listeningTask;
        state.listeningProgress = {
          currentQuestion: 0,
          userAnswers: [null, null]
        };
        await setDailyState(telegramId, state);

        // Display vocabulary
        const vocabList = listeningTask.words
          .map(word => {
            const [dutch, english] = word.split(':');
            return `• *${dutch}* - _${english}_`;
          })
          .join('\n');

        await ctx.reply(
          `📚 *Vocabulary*\n\n${vocabList}`,
          { parse_mode: 'Markdown' }
        );

        // Display Ready button
        const readyKeyboard = new InlineKeyboard()
          .text('✅ Ready for the questions', 'listening_ready');

        await ctx.reply(
          `🎧 Listen to the audio and learn the vocabulary.\n\n` +
          `Click "Ready" when you're prepared to answer questions.`,
          { reply_markup: readyKeyboard }
        );
      } catch (error) {
        console.error('Error generating listening task:', error);
        await ctx.reply('Error generating listening task. Please try /reset.');
      }
    } else if (state.currentTask === 2) {
      // Skip listening, generate and show speaking task
      await ctx.reply('⏭️ Skipping listening...\n\n🗣️ Generating speaking exercise...');

      try {
        const selectedArticle = state.availableTopics![state.selectedTopicIndex!];
        const speakingTask = await generateSpeakingTask(selectedArticle);

        // Update state
        state.currentTask = 3;
        state.listeningProgress = undefined;
        state.tasks[3] = speakingTask;
        state.speakingProgress = {
          awaitingVoiceMessage: true
        };
        await setDailyState(telegramId, state);

        // Display vocabulary
        const vocabList = speakingTask.words
          .map(word => {
            const [dutch, english] = word.split(':');
            return `• *${dutch}* - _${english}_`;
          })
          .join('\n');

        await ctx.reply(
          `📚 *Vocabulary*\n\n${vocabList}`,
          { parse_mode: 'Markdown' }
        );

        // Display the prompt
        await ctx.reply(
          `🗣️ *Speaking Exercise*\n\n${speakingTask.prompt}\n\n` +
          `📱 Send a voice message with your response in Dutch.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error generating speaking task:', error);
        await ctx.reply('Error generating speaking task. Please try /reset.');
      }
    } else if (state.currentTask === 3) {
      // Skip speaking, mark as done
      state.currentTask = 'done';
      state.completedAt = new Date().toISOString();
      state.speakingProgress = undefined;
      await setDailyState(telegramId, state);
      await ctx.reply(
        '⏭️ Skipped speaking task.\n\n' +
        '✅ Lesson marked as complete!\n\n' +
        'Use /lesson tomorrow for a new lesson, or /reset to start over.'
      );
    }
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

        // Save to state and initialize reading progress
        state.tasks[1] = readingTask;
        state.readingProgress = {
          currentQuestion: 0,  // 0 = not started, need to click "Ready"
          userAnswers: [null, null, null]
        };
        await setDailyState(telegramId, state);

        // Display vocabulary
        const vocabList = readingTask.words
          .map(word => {
            const [dutch, english] = word.split(':');
            return `• *${dutch}* - _${english}_`;
          })
          .join('\n');

        await ctx.reply(
          `📚 *Vocabulary*\n\n` +
          `${vocabList}`,
          { parse_mode: 'Markdown' }
        );

        // Display the reading text (now includes Dutch title from OpenAI)
        await ctx.reply(
          `📖 *Reading Exercise*\n\n` +
          `${readingTask.content}`,
          { parse_mode: 'Markdown' }
        );

        // Display Ready button
        const readyKeyboard = new InlineKeyboard()
          .text('✅ Ready for the questions', 'reading_ready');

        await ctx.reply(
          `Take your time to read the text and learn the vocabulary.`,
          { reply_markup: readyKeyboard }
        );

      } catch (error) {
        console.error('Error generating reading task:', error);
        await ctx.reply(
          `Sorry, I encountered an error generating the reading exercise. Please try again with /reset and /lesson.`
        );
      }
    }

    // Handle reading_ready callback
    if (data === 'reading_ready') {
      const state = await getDailyState(telegramId);

      if (!state || state.currentTask !== 1 || !state.tasks[1]) {
        await ctx.answerCallbackQuery({
          text: 'This action is no longer valid.'
        });
        return;
      }

      // Move to question 1
      if (!state.readingProgress) {
        state.readingProgress = {
          currentQuestion: 1,
          userAnswers: [null, null, null]
        };
      } else {
        state.readingProgress.currentQuestion = 1;
      }
      await setDailyState(telegramId, state);

      // Answer callback query
      await ctx.answerCallbackQuery();

      // Remove the ready button
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });

      // Display Question 1
      const readingTask = state.tasks[1];
      const q = readingTask.questions[0];

      const keyboard = new InlineKeyboard()
        .text('A', 'reading_answer_1_A')
        .text('B', 'reading_answer_1_B')
        .text('C', 'reading_answer_1_C');

      await ctx.reply(
        `*Question 1:* ${q.question}\n\n` +
        `A) ${q.options[0]}\n` +
        `B) ${q.options[1]}\n` +
        `C) ${q.options[2]}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );

      return;
    }

    // Handle reading answer callbacks
    if (data.startsWith('reading_answer_')) {
      const parts = data.replace('reading_answer_', '').split('_');
      const questionNumber = parseInt(parts[0]) as 1 | 2 | 3;
      const userAnswer = parts[1] as 'A' | 'B' | 'C';

      const state = await getDailyState(telegramId);

      if (!state || state.currentTask !== 1 || !state.tasks[1]) {
        await ctx.answerCallbackQuery({
          text: 'This action is no longer valid.'
        });
        return;
      }

      const readingTask = state.tasks[1];
      const questionIndex = questionNumber - 1;
      const question = readingTask.questions[questionIndex];

      // Ensure progress exists
      if (!state.readingProgress) {
        state.readingProgress = {
          currentQuestion: questionNumber,
          userAnswers: [null, null, null]
        };
      }

      // Save user's answer
      state.readingProgress.userAnswers[questionIndex] = userAnswer;

      // Check if answer is correct
      const isCorrect = userAnswer === question.correct;

      // Answer callback query
      await ctx.answerCallbackQuery();

      // Remove the buttons
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });

      // Show feedback
      if (isCorrect) {
        await ctx.reply(
          `✅ *Correct!*\n\n` +
          `The answer is ${userAnswer}.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Not quite.*\n\n` +
          `The correct answer is ${question.correct}.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Determine next step
      if (questionNumber < 3) {
        // Move to next question
        state.readingProgress.currentQuestion = (questionNumber + 1) as 1 | 2 | 3;
        await setDailyState(telegramId, state);

        const nextQuestionIndex = questionNumber;
        const nextQ = readingTask.questions[nextQuestionIndex];

        const keyboard = new InlineKeyboard()
          .text('A', `reading_answer_${questionNumber + 1}_A`)
          .text('B', `reading_answer_${questionNumber + 1}_B`)
          .text('C', `reading_answer_${questionNumber + 1}_C`);

        await ctx.reply(
          `*Question ${questionNumber + 1}:* ${nextQ.question}\n\n` +
          `A) ${nextQ.options[0]}\n` +
          `B) ${nextQ.options[1]}\n` +
          `C) ${nextQ.options[2]}`,
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
      } else {
        // Finished all questions - show summary and move to next task
        const answers = state.readingProgress.userAnswers;
        const correctCount = readingTask.questions.filter(
          (q, i) => answers[i] === q.correct
        ).length;

        await ctx.reply(
          `🎉 *Reading Exercise Complete!*\n\n` +
          `You got ${correctCount} out of 3 questions correct.\n\n` +
          `Great work! 🇳🇱`,
          { parse_mode: 'Markdown' }
        );

        // Add vocabulary to collected words
        const newWords: VocabularyWord[] = readingTask.words.map(word => {
          const [dutch, english] = word.split(':');
          return { dutch, english };
        });
        state.collectedWords.push(...newWords);

        // Move to listening task
        state.currentTask = 2;
        // Clear reading progress
        state.readingProgress = undefined;
        await setDailyState(telegramId, state);

        await ctx.reply(
          `✅ *Reading Complete!*\n\n` +
          `Great work! Now let's practice listening.\n\n` +
          `Generating listening exercise...`,
          { parse_mode: 'Markdown' }
        );

        try {
          // Get the selected article
          const selectedArticle = state.availableTopics![state.selectedTopicIndex!];

          // Generate the listening task
          const { task: listeningTask, audioBuffer } = await generateListeningTask(selectedArticle);

          // Send the audio to Telegram
          const audioMessage = await ctx.replyWithVoice(new InputFile(audioBuffer, 'listening.mp3'));

          // Store the file_id for later reference
          listeningTask.audioUrl = audioMessage.voice.file_id;

          // Save to state and initialize listening progress
          state.tasks[2] = listeningTask;
          state.listeningProgress = {
            currentQuestion: 0,  // 0 = not started, need to click "Ready"
            userAnswers: [null, null]
          };
          await setDailyState(telegramId, state);

          // Display vocabulary
          const vocabList = listeningTask.words
            .map(word => {
              const [dutch, english] = word.split(':');
              return `• *${dutch}* - _${english}_`;
            })
            .join('\n');

          await ctx.reply(
            `📚 *Vocabulary*\n\n` +
            `${vocabList}`,
            { parse_mode: 'Markdown' }
          );

          // Display Ready button
          const readyKeyboard = new InlineKeyboard()
            .text('✅ Ready for the questions', 'listening_ready');

          await ctx.reply(
            `🎧 Listen to the audio and learn the vocabulary.\n\n` +
            `Click "Ready" when you're prepared to answer questions.`,
            { reply_markup: readyKeyboard }
          );

        } catch (error) {
          console.error('Error generating listening task:', error);
          await ctx.reply(
            `Sorry, I encountered an error generating the listening exercise. Please try again with /reset and /lesson.`
          );
        }
      }

      return;
    }

    // Handle listening_ready callback
    if (data === 'listening_ready') {
      const state = await getDailyState(telegramId);

      if (!state || state.currentTask !== 2 || !state.tasks[2]) {
        await ctx.answerCallbackQuery({
          text: 'This action is no longer valid.'
        });
        return;
      }

      // Move to question 1
      if (!state.listeningProgress) {
        state.listeningProgress = {
          currentQuestion: 1,
          userAnswers: [null, null]
        };
      } else {
        state.listeningProgress.currentQuestion = 1;
      }
      await setDailyState(telegramId, state);

      // Answer callback query
      await ctx.answerCallbackQuery();

      // Remove the ready button
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });

      // Display Question 1
      const listeningTask = state.tasks[2];
      const q = listeningTask.questions[0];

      const keyboard = new InlineKeyboard()
        .text('A', 'listening_answer_1_A')
        .text('B', 'listening_answer_1_B')
        .text('C', 'listening_answer_1_C');

      await ctx.reply(
        `*Question 1:* ${q.question}\n\n` +
        `A) ${q.options[0]}\n` +
        `B) ${q.options[1]}\n` +
        `C) ${q.options[2]}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );

      return;
    }

    // Handle listening answer callbacks
    if (data.startsWith('listening_answer_')) {
      const parts = data.replace('listening_answer_', '').split('_');
      const questionNumber = parseInt(parts[0]) as 1 | 2;
      const userAnswer = parts[1] as 'A' | 'B' | 'C';

      const state = await getDailyState(telegramId);

      if (!state || state.currentTask !== 2 || !state.tasks[2]) {
        await ctx.answerCallbackQuery({
          text: 'This action is no longer valid.'
        });
        return;
      }

      const listeningTask = state.tasks[2];
      const questionIndex = questionNumber - 1;
      const question = listeningTask.questions[questionIndex];

      // Ensure progress exists
      if (!state.listeningProgress) {
        state.listeningProgress = {
          currentQuestion: questionNumber,
          userAnswers: [null, null]
        };
      }

      // Save user's answer
      state.listeningProgress.userAnswers[questionIndex] = userAnswer;

      // Check if answer is correct
      const isCorrect = userAnswer === question.correct;

      // Answer callback query
      await ctx.answerCallbackQuery();

      // Remove the buttons
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });

      // Show feedback
      if (isCorrect) {
        await ctx.reply(
          `✅ *Correct!*\n\n` +
          `The answer is ${userAnswer}.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Not quite.*\n\n` +
          `The correct answer is ${question.correct}.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Determine next step
      if (questionNumber < 2) {
        // Move to question 2
        state.listeningProgress.currentQuestion = 2;
        await setDailyState(telegramId, state);

        const nextQ = listeningTask.questions[1];

        const keyboard = new InlineKeyboard()
          .text('A', 'listening_answer_2_A')
          .text('B', 'listening_answer_2_B')
          .text('C', 'listening_answer_2_C');

        await ctx.reply(
          `*Question 2:* ${nextQ.question}\n\n` +
          `A) ${nextQ.options[0]}\n` +
          `B) ${nextQ.options[1]}\n` +
          `C) ${nextQ.options[2]}`,
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
      } else {
        // Finished all questions - show summary and transcript
        const answers = state.listeningProgress.userAnswers;
        const correctCount = listeningTask.questions.filter(
          (q, i) => answers[i] === q.correct
        ).length;

        await ctx.reply(
          `🎉 *Listening Exercise Complete!*\n\n` +
          `You got ${correctCount} out of 2 questions correct.\n\n` +
          `Great work! 🇳🇱`,
          { parse_mode: 'Markdown' }
        );

        // Show transcript
        await ctx.reply(
          `📝 *Transcript:*\n\n` +
          `${listeningTask.transcript}`,
          { parse_mode: 'Markdown' }
        );

        // Add vocabulary to collected words
        const newWords: VocabularyWord[] = listeningTask.words.map(word => {
          const [dutch, english] = word.split(':');
          return { dutch, english };
        });
        state.collectedWords.push(...newWords);

        // Move to speaking task
        state.currentTask = 3;
        // Clear listening progress
        state.listeningProgress = undefined;
        await setDailyState(telegramId, state);

        await ctx.reply(
          `✅ *Listening Complete!*\n\n` +
          `Great work! Now let's practice speaking.\n\n` +
          `Generating speaking exercise...`,
          { parse_mode: 'Markdown' }
        );

        try {
          // Get the selected article
          const selectedArticle = state.availableTopics![state.selectedTopicIndex!];

          // Generate the speaking task
          const speakingTask = await generateSpeakingTask(selectedArticle);

          // Save to state and initialize speaking progress
          state.tasks[3] = speakingTask;
          state.speakingProgress = {
            awaitingVoiceMessage: true
          };
          await setDailyState(telegramId, state);

          // Display vocabulary
          const vocabList = speakingTask.words
            .map(word => {
              const [dutch, english] = word.split(':');
              return `• *${dutch}* - _${english}_`;
            })
            .join('\n');

          await ctx.reply(
            `📚 *Vocabulary*\n\n` +
            `${vocabList}`,
            { parse_mode: 'Markdown' }
          );

          // Display speaking prompt
          await ctx.reply(
            `🎤 *Speaking Exercise*\n\n` +
            `${speakingTask.prompt}\n\n` +
            `_Send a voice message with your answer (2-3 sentences in Dutch)._`,
            { parse_mode: 'Markdown' }
          );

        } catch (error) {
          console.error('Error generating speaking task:', error);
          await ctx.reply(
            `Sorry, I encountered an error generating the speaking exercise. Please try again with /reset and /lesson.`
          );
        }
      }

      return;
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

    // Check if user is on speaking task
    const state = await getDailyState(telegramId);

    if (!state || state.currentTask !== 3 || !state.tasks[3]) {
      await ctx.reply(
        `Voice message received! 🎤\n\n` +
        `But you're not currently on a speaking exercise.\n\n` +
        `Use /lesson to start a new lesson.`
      );
      return;
    }

    if (!state.speakingProgress?.awaitingVoiceMessage) {
      await ctx.reply(
        `You've already completed the speaking task.\n\n` +
        `Use /lesson to start a new lesson.`
      );
      return;
    }

    const speakingTask = state.tasks[3];

    try {
      await ctx.reply('🎤 Processing your voice message...');

      // Download the voice file
      const file = await ctx.getFile();
      const filePath = file.file_path;

      if (!filePath) {
        throw new Error('Could not get file path');
      }

      // Download the file as buffer
      const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${filePath}`;
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Transcribe the audio (Telegram sends .oga, but Whisper needs a supported format)
      // Renaming to .ogg works as Whisper can handle Ogg Vorbis internally
      await ctx.reply('🎧 Transcribing your speech...');
      const transcript = await transcribeAudio(audioBuffer, 'voice.ogg');

      if (!transcript || transcript.trim().length === 0) {
        await ctx.reply(
          `Sorry, I couldn't transcribe your voice message.\n\n` +
          `Please try again and speak clearly.`
        );
        return;
      }

      // Show transcript
      await ctx.reply(
        `📝 *I heard:*\n\n` +
        `_"${transcript}"_`,
        { parse_mode: 'Markdown' }
      );

      // Evaluate the speaking
      await ctx.reply('✍️ Evaluating your response...');
      const evaluation = await evaluateSpeaking(speakingTask.prompt, transcript);

      // Save to state
      state.speakingProgress!.awaitingVoiceMessage = false;
      state.speakingProgress!.transcript = transcript;
      state.speakingProgress!.evaluation = evaluation;
      await setDailyState(telegramId, state);

      // Show detailed feedback
      let feedbackMessage = `👍 *Feedback*\n\n`;

      // Grammar section
      feedbackMessage += `✅ *Grammar:*\n${evaluation.grammar}\n\n`;

      // Vocabulary section (only if suggestions exist)
      if (evaluation.vocabulary && evaluation.vocabulary.trim().length > 0) {
        feedbackMessage += `💡 *Suggestions:*\n${evaluation.vocabulary}\n\n`;
      }

      await ctx.reply(feedbackMessage, { parse_mode: 'Markdown' });

      // Show polished version
      await ctx.reply(
        `📝 *Polished version:*\n\n` +
        `_"${evaluation.polished}"_`,
        { parse_mode: 'Markdown' }
      );

      // Show summary with score
      await ctx.reply(
        `🎯 ${evaluation.score} *${evaluation.summary}*`,
        { parse_mode: 'Markdown' }
      );

      // Add vocabulary to collected words
      const newWords: VocabularyWord[] = speakingTask.words.map(word => {
        const [dutch, english] = word.split(':');
        return { dutch, english };
      });
      state.collectedWords.push(...newWords);

      // Mark lesson as done
      state.currentTask = 'done';
      state.completedAt = new Date().toISOString();
      state.speakingProgress = undefined;
      await setDailyState(telegramId, state);

      // Show completion message
      await ctx.reply(
        `🎉 *Lesson Complete!*\n\n` +
        `Great job! You've completed all 3 exercises:\n` +
        `✅ Reading\n` +
        `✅ Listening\n` +
        `✅ Speaking\n\n` +
        `Use /lesson to start a new lesson!`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error('Error processing voice message:', error);
      await ctx.reply(
        `Sorry, I encountered an error processing your voice message. Please try again.`
      );
    }
  });

  return bot;
}
