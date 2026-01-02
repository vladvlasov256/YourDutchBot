# Dutch Learning Telegram Bot — MVP

A Telegram bot for learning Dutch (A2 level) for inburgeringsexamen preparation. The bot proactively sends daily exercises based on fresh news from topics the user cares about.

## Core Concept

**Problem:** Language learning apps are boring. Tutors are expensive and passive.

**Solution:** A Telegram bot that:
- Sends daily exercises every morning (user doesn't need to initiate)
- Uses fresh news from topics user actually cares about
- Covers all 4 language skills: reading, listening, speaking, writing
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

## Daily Flow

```
08:00 CET — Cron triggers /api/daily-push
    ↓
Bot sends Task #1 (Reading) to all active users
    ↓
User answers → Bot evaluates → sends Task #2 (Listening)
    ↓
User answers → Bot evaluates → sends Task #3 (Speaking)
    ↓
User sends voice message → Bot transcribes & evaluates
    ↓
Bot sends completion message + vocabulary list (max 10 words)
    ↓
state.currentTask = "done" — bot waits until next day
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
| `/reset`  | Reset current day, start exercises over  |
| `/status` | Show today's progress (task 1/2/3/done)  |

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
  topics: string[],        // topic IDs
  timezone: "CET",
  createdAt: string        // ISO date
}
```

### Daily State
```
Key: user:{telegramId}:state

{
  todayDate: "2025-01-15",           // ISO date
  currentTask: 1 | 2 | 3 | "done",
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

### Phase 1: Project Setup
- [ ] Initialize project with `npm init`
- [ ] Install dependencies: grammy, openai, @vercel/kv
- [ ] Configure TypeScript
- [ ] Set up vercel.json with cron
- [ ] Create .env.local with all keys

### Phase 2: Core Infrastructure
- [ ] Implement /lib/telegram.ts — sendMessage, sendVoice, answerCallback
- [ ] Implement /lib/openai.ts — chat completion, whisper, tts
- [ ] Implement /lib/gnews.ts — fetch news by topic
- [ ] Implement /lib/storage.ts — get/set user profile and state

### Phase 3: Webhook Handler
- [ ] POST /api/webhook.ts — receive Telegram updates
- [ ] Handle /start command — create user profile
- [ ] Handle /reset command — clear today's state
- [ ] Handle /status command — show current progress
- [ ] Handle text messages — process task answers
- [ ] Handle voice messages — process speaking task

### Phase 4: Task Generation
- [ ] Implement generateReadingTask(article) — adapt news to A2 Dutch
- [ ] Implement generateListeningTask(topic) — create short audio content
- [ ] Implement generateSpeakingPrompt(topic) — create speaking prompt
- [ ] Implement evaluateSpeaking(transcript) — assess user's speech

### Phase 5: Daily Push
- [ ] GET /api/daily-push.ts — cron handler
- [ ] Fetch all active users
- [ ] For each user: generate Task 1, send message, update state
- [ ] Handle errors gracefully (don't fail entire batch)

### Phase 6: Flow Logic
- [ ] After Task 1 answered correctly → generate and send Task 2
- [ ] After Task 2 answered correctly → generate and send Task 3
- [ ] After Task 3 voice received → evaluate and send summary
- [ ] Send vocabulary list at the end
- [ ] Set state to "done"

### Phase 7: Polish
- [ ] Error handling and user-friendly error messages
- [ ] Input validation
- [ ] Rate limiting considerations
- [ ] Logging for debugging

## UI/UX Guidelines

- **Bot language:** English (for interface and instructions)
- **Learning content:** Dutch
- **Questions:** Dutch with Dutch answer options
- **Feedback & explanations:** English
- **Tone:** Friendly, encouraging, not robotic

## Example Messages

### Morning Push (Task 1)
```
🌅 Goedemorgen! Time for your Dutch practice.

📰 Today's topic: Manchester United

[Dutch text about recent ManU news, 100-150 words]

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

Reply with your answers (e.g., "A B C")
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

1. **GNews free tier:** 100 requests/day — should be enough for MVP
2. **OpenAI TTS Dutch quality:** Test early, switch to ElevenLabs if needed
3. **Summer time:** Cron is UTC-based, will need adjustment in March/October
4. **Whisper accuracy:** Generally good for Dutch, but monitor and adjust prompts
5. **Telegram voice messages:** Come as .oga files, need to download and send to Whisper

## Future Enhancements (Post-MVP)

- [ ] Writing task (Task 4)
- [ ] Topic selection command
- [ ] Progress statistics
- [ ] Streak tracking
- [ ] KNM (Dutch society knowledge) exercises
- [ ] Difficulty progression (A2 → B1)
- [ ] Evening reminder if tasks not completed
- [ ] Export vocabulary to Anki format
