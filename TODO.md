# Dutch Learning Telegram Bot — MVP

A Telegram bot for learning Dutch (A2 level) for inburgeringsexamen preparation. Students choose topics from fresh news they care about and practice reading, listening, and speaking.

## Core Concept

**Problem:** Language learning apps are boring. Tutors are expensive and passive.

**Solution:** A Telegram bot that:
- Let students choose topics from fresh news headlines
- Provides on-demand lessons via `/lesson` command
- Optionally sends daily exercises every morning (via cron)
- Covers 3 language skills: reading, listening, speaking
- Outputs vocabulary in a format suitable for Anki

## Tech Stack

- **Runtime:** Vercel (Serverless Functions + Cron)
- **Bot Framework:** grammy (TypeScript)
- **LLM:** OpenAI GPT-4o
- **Speech-to-Text:** OpenAI Whisper
- **Text-to-Speech:** OpenAI TTS (fallback: ElevenLabs if Dutch quality is poor)
- **News API:** GNews (https://gnews.io/)
- **Storage:** Vercel KV (Redis)
- **Language:** TypeScript

## Lesson Flow

```
User types /lesson
    ↓
Bot fetches 5 news headlines from GNews (or uses cached topics for today)
    ↓
Bot: "Choose a topic:
1️⃣ Manchester United wins 2-0
2️⃣ Python 3.13 released
3️⃣ Russia elections update
4️⃣ Y Combinator new batch
5️⃣ Tech layoffs continue"
    ↓
User: "2"
    ↓
Bot generates Task #1 (Reading) from selected news article
    ↓
User answers → Bot evaluates → sends Task #2 (Listening)
    ↓
User answers → Bot evaluates → sends Task #3 (Speaking)
    ↓
User sends voice message → Bot transcribes & evaluates
    ↓
Bot sends completion message + vocabulary list (max 10 words)
    ↓
state.currentTask = "done" — user can start a new lesson or wait for tomorrow
```

## Optional: Daily Push Flow

```
08:00 CET — Cron triggers /api/daily-push
    ↓
Bot sends topic selection to all active users
    ↓
[Same flow as /lesson command]
```

## Tasks Specification

### Task 1: Reading
- Fetch news article from GNews (random topic from user's preferences)
- Adapt to Dutch A2 level (100-150 words)
- Generate 3 multiple choice questions (A/B/C)
- User responds with answers like "A B C" or "1 2 3"
- Bot evaluates and provides feedback

### Task 2: Listening
- Generate short Dutch text (50-80 words) related to the same news topic
- Send as Telegram voice message (TTS)
- Do NOT show the text initially
- 2 multiple choice questions on comprehension
- After answering, optionally reveal the transcript

### Task 3: Speaking
- Give a prompt: "Vertel in 2-3 zinnen: [question about the news topic]"
- User sends a voice message
- Whisper transcribes
- GPT-4o evaluates: grammar, vocabulary, relevance
- Provide feedback + corrected version if needed

### Vocabulary
- Each task generation extracts 2-4 new/useful words
- At end of day: consolidated list, max 10 words
- Format: Markdown list with Dutch word + English translation

```markdown
📚 *Today's words:*

• **huis** — house
• **werken** — to work
• **misschien** — maybe
```

## Bot Commands

| Command   | Description                              |
|-----------|------------------------------------------|
| `/start`  | Register user, show welcome message      |
| `/lesson` | Start a new lesson (choose topic from news) |
| `/status` | Show today's progress (task 1/2/3/done)  |
| `/skip`   | Skip current exercise and move to next   |
| `/reset`  | Reset current lesson, start over         |

## Setup Commands

| Command              | Description                              |
|----------------------|------------------------------------------|
| `pnpm setup:webhook` | Set Telegram webhook for Vercel deployment |
| `pnpm setup:commands`| Register bot commands with Telegram      |

## Hardcoded Topics

```typescript
const TOPICS = [
  { id: "manchester-united", query: "Manchester United", label: "Football" },
  { id: "software", query: "software development programming", label: "Software" },
  { id: "startups", query: "startups venture capital", label: "Startups" },
  { id: "russia", query: "Russia politics", label: "Russian Politics" },
];
```

## Project Structure

```
/api
  webhook.ts          — Telegram webhook handler (POST)
  daily-push.ts       — Cron job endpoint (GET, called at 08:00 CET)

/lib
  telegram.ts         — Telegram Bot API helpers (sendMessage, sendVoice, etc.)
  openai.ts           — OpenAI API helpers (chat, whisper, tts)
  gnews.ts            — GNews API helper (fetchNews)
  storage.ts          — Vercel KV helpers

/lib/tasks
  reading.ts          — generateReadingTask(newsArticle)
  listening.ts        — generateListeningTask(topic)
  speaking.ts         — generateSpeakingPrompt(topic), evaluateSpeaking(transcript)

/config
  topics.ts           — Topic definitions
  prompts.ts          — System prompts for OpenAI

vercel.json           — Cron configuration
package.json
tsconfig.json
.env.local            — Local env variables (not committed)
```

## Data Models (Vercel KV)

### User Profile
```
Key: user:{telegramId}:profile

{
  telegramId: number,
  firstName: string,
  topics: string[],        // topic IDs for news filtering
  timezone: "CET",
  createdAt: string        // ISO date
}
```

### Daily State
```
Key: user:{telegramId}:state

{
  todayDate: "2025-01-15",           // ISO date
  currentTask: 1 | 2 | 3 | "done" | "selecting_topic",
  selectedTopicIndex: number | null, // Index of chosen news article
  tasks: {
    1: {
      articleTitle: string,
      articleUrl: string,
      content: string,               // adapted Dutch text
      questions: [
        { question: string, options: string[], correct: "A" | "B" | "C" }
      ],
      words: string[]
    },
    2: {
      audioUrl: string,              // Telegram file_id or generated URL
      transcript: string,
      questions: [...],
      words: string[]
    },
    3: {
      prompt: string,
      words: string[]
    }
  },
  collectedWords: [                  // aggregated from all tasks
    { dutch: "huis", english: "house" }
  ],
  completedAt: string | null         // ISO datetime when all done
}
```

### Daily Topics Cache
```
Key: topics:{date}                   // e.g., "topics:2025-01-15"

{
  date: "2025-01-15",
  topics: [
    {
      title: string,
      description: string,
      url: string,
      content: string,
      source: { name: string, url: string }
    }
  ],
  fetchedAt: string                  // ISO datetime
}
```

**Note:** Topics are cached per day and reused for all users and all lessons that day to save GNews API quota (100 requests/day on free tier).

## Configuration Files

### vercel.json
```json
{
  "crons": [
    {
      "path": "/api/daily-push",
      "schedule": "0 7 * * *"
    }
  ]
}
```

Note: Cron uses UTC. 7:00 UTC = 8:00 CET (winter time). Adjust for summer time or implement dynamic timezone handling.

### Environment Variables
```
TELEGRAM_BOT_TOKEN=xxx
OPENAI_API_KEY=xxx
GNEWS_API_KEY=xxx
KV_REST_API_URL=xxx
KV_REST_API_TOKEN=xxx
```

## Implementation Checklist

### Phase 1: Project Setup ✅
- [x] Initialize project with `pnpm init`
- [x] Install dependencies: grammy, openai, @vercel/kv
- [x] Configure TypeScript
- [x] Set up vercel.json with cron
- [x] Create .env with all keys
- [x] Deploy to Vercel
- [x] Set up webhook

### Phase 2: Core Infrastructure ✅
- [x] Implement /lib/telegram.ts — sendMessage, sendVoice, downloadFile
- [x] Implement /lib/openai.ts — chat completion, whisper, tts
- [x] Implement /lib/gnews.ts — fetch news by topic
- [x] Implement /lib/storage.ts — get/set user profile and state
- [x] Implement /config/topics.ts — topic definitions
- [x] Implement /config/prompts.ts — system prompts for OpenAI

### Phase 3: Webhook Handler ✅
- [x] POST /api/webhook.ts — receive Telegram updates
- [x] Implement /lib/bot.ts — shared bot logic for webhook and polling
- [x] Handle /start command — create user profile
- [x] Handle /reset command — clear today's state
- [x] Handle /status command — show current progress
- [x] Handle text messages — placeholder for task answers
- [x] Handle voice messages — placeholder for speaking task
- [x] Create dev-bot.ts — local development with polling

### Phase 4: Lesson Flow (IN PROGRESS)
- [x] Implement /lesson command
- [x] Fetch and cache daily topics from GNews
- [x] Show topic selection (5 news headlines with inline keyboard)
- [x] Handle topic selection (inline button callbacks)
- [x] Generate Reading task from selected article
- [x] Implement generateReadingTask(article) — adapt news to A2 Dutch
- [x] **Reading Task UX Improvements**
  - [x] Add readingProgress sub-state to DailyState
  - [x] Show vocabulary list before reading text
  - [x] Add "Ready" button after text
  - [x] Show questions one at a time (not all at once)
  - [x] Provide immediate feedback (✅/❌) after each answer
  - [x] Show final summary (X/3 correct) after all questions
  - [x] Update resume logic to handle sub-states
- [x] **Reading Task Question Quality Improvements**
  - [x] Fix distractors (B/C options) - make them realistic, not absurd
  - [x] Randomize correct answer position (not always "A")
  - [x] Update generateReadingQuestions prompt in config/prompts.ts
- [x] **Listening Task Implementation**
  - [x] Create lib/tasks/listening.ts - generate listening content
  - [x] Add listeningProgress sub-state to DailyState
  - [x] Generate 50-80 word Dutch audio with OpenAI TTS
  - [x] Send audio as Telegram voice message
  - [x] Create 2 comprehension questions
  - [x] Show vocabulary before questions
  - [x] Handle answers with feedback (one at a time)
  - [x] Show transcript after completion
  - [x] Resume logic for listening task
  - [x] Move to next task or mark as done
- [x] **Speaking Task Implementation**
  - [x] Create lib/tasks/speaking.ts - generate speaking prompt
  - [x] Add speakingProgress state to DailyState
  - [x] Generate speaking prompt based on article
  - [x] Show vocabulary before prompt
  - [x] Handle voice message from user
  - [x] Download and transcribe audio with Whisper
  - [x] Evaluate speech with GPT-4o (grammar, vocabulary, relevance)
  - [x] Show transcript and feedback
  - [x] Show corrected version if needed
  - [x] Resume logic for speaking task
  - [x] Mark lesson as complete after all 3 tasks
- [x] Send consolidated vocabulary summary at completion (combine all words from tasks 1, 2, 3 into final message)

### Phase 5: Task Processing Logic
- [ ] Validate and parse task answers (A B C format or 1 2 3)
- [ ] Evaluate answers and provide feedback
- [ ] Track correct/incorrect answers
- [ ] Progress through tasks: Reading → Listening → Speaking
- [ ] Extract and aggregate vocabulary words
- [ ] Mark lesson as complete

### Phase 6: Daily Push (OPTIONAL - Later)
- [ ] GET /api/daily-push.ts — cron handler
- [ ] Fetch all active users
- [ ] For each user: send topic selection
- [ ] Handle errors gracefully (don't fail entire batch)

### Phase 7: Polish
- [ ] Error handling and user-friendly error messages
- [ ] Input validation
- [ ] Rate limiting considerations
- [ ] Logging for debugging
- [ ] Handle edge cases (network errors, API failures)
- [ ] Improve topic caching TTL

### Phase 8: Switch to ElevenLabs TTS (OPTIONAL)
- [ ] Sign up for ElevenLabs API
- [ ] Add ELEVENLABS_API_KEY to environment variables
- [ ] Implement lib/elevenlabs.ts — TTS helper
- [ ] Test Dutch voice quality
- [ ] Compare with OpenAI TTS
- [ ] Switch if quality is significantly better
- [ ] Update config to use ElevenLabs by default

## UI/UX Guidelines

- **Bot language:** English (for interface and instructions)
- **Learning content:** Dutch
- **Questions:** Dutch with Dutch answer options
- **Feedback & explanations:** English
- **Tone:** Friendly, encouraging, not robotic

## Example Messages

### /lesson Command - Topic Selection
```
📰 Choose a topic for today's lesson:

1️⃣ Manchester United defeats Liverpool 2-0 in Premier League clash
2️⃣ Python 3.13 introduces experimental JIT compiler
3️⃣ Russia announces new economic measures
4️⃣ Y Combinator's W25 batch features 200 startups
5️⃣ Meta announces major AI breakthrough

Reply with the number (1-5) of your chosen topic.
```

### Task 1: Reading
```
📖 Reading Exercise

[Dutch text adapted to A2 level, 100-150 words about the selected topic]

❓ Questions:

1. Wat gebeurde er in de wedstrijd?
   A) United won met 2-0
   B) United verloor met 1-0
   C) Het was gelijk

2. Wie scoorde het doelpunt?
   A) Rashford
   B) Bruno
   C) Hojlund

3. Wanneer is de volgende wedstrijd?
   A) Zaterdag
   B) Zondag
   C) Maandag

Reply with your answers (e.g., "A B C" or "1 2 3")
```

### Task Completion
```
✅ Correct! 3/3

Moving on to listening exercise...
```

### End of Day
```
🎉 Goed gedaan! All exercises completed.

📚 *Today's words:*

• **wedstrijd** — match
• **scoren** — to score
• **winnen** — to win
• **verliezen** — to lose
• **doelpunt** — goal

See you tomorrow! Tot morgen! 👋
```

## Notes & Risks

1. **GNews free tier:** 100 requests/day
   - Solution: Cache topics per day (one fetch for all users/lessons)
   - With 5 topics cached per day, supports up to 20 users or unlimited lessons per day
2. **OpenAI TTS Dutch quality:** Test early, switch to ElevenLabs if needed
3. **Summer time:** Cron is UTC-based, will need adjustment in March/October (if implementing daily push)
4. **Whisper accuracy:** Generally good for Dutch, but monitor and adjust prompts
5. **Telegram voice messages:** Come as .oga files, need to download and send to Whisper
6. **Topic selection UX:** Users might want to see more than 5 topics or refresh topics - consider for future
7. **Multiple lessons per day:** May want to limit to prevent abuse or OpenAI cost overrun

## Future Enhancements (Post-MVP)

- [ ] **Language Level Selection (A0/A1/A2)** — See [TODO-levels.md](./TODO-levels.md) for detailed plan
- [ ] **Contextual Q&A Chat** — See [TODO-chat-context.md](./TODO-chat-context.md) for detailed plan
- [ ] **Visual Diff for Polished Version** — See [TODO-diff-feedback.md](./TODO-diff-feedback.md) for detailed plan
- [ ] **Improved Topic Selection** — See [TODO-topic-improvements.md](./TODO-topic-improvements.md) for detailed plan
- [ ] Writing task (Task 4)
- [ ] Progress statistics and history
- [ ] Streak tracking
- [ ] Lesson limits (e.g., max 3 lessons per day)
- [ ] Topic refresh command (get new topics for today)
- [ ] KNM (Dutch society knowledge) exercises
- [ ] Difficulty progression (A2 → B1)
- [ ] Evening reminder if tasks not completed
- [ ] Export vocabulary to Anki format (.apkg or CSV)
- [ ] User preferences (favorite topics, difficulty level)
- [ ] Multiple languages for interface (not just English)
