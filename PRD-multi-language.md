# PRD: Multi-Language Support

## Overview

Transform the Dutch learning bot into a multi-language learning platform that can teach Dutch, English, or Serbian. Each language runs as a separate bot instance configured via environment variables. The UI is localized based on the user's Telegram locale.

## Goals

1. **Target Language Configuration** — Deploy separate bots for Dutch, English, Serbian
2. **Localized UI** — Instructions and feedback in user's native language
3. **Language-Specific Prompts** — Tailored prompts per target language
4. **Scalable Architecture** — Easy to add new languages in the future

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Environment Config                       │
│  LEARNING_LANGUAGE=dutch|english|serbian                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Bot Instance                            │
│  - Loads prompts from /prompts/{language}/                  │
│  - Uses language-specific TTS voice                         │
│  - Fetches news in target language                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI Localization                           │
│  - Detects user locale from Telegram (ctx.from.language_code)│
│  - Falls back to English if locale not supported            │
│  - Loads strings from /locales/{locale}.json                │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

```bash
# Target language the bot teaches (required)
LEARNING_LANGUAGE=dutch  # dutch | english | serbian

# Telegram Bot Token (one per language/bot)
TELEGRAM_BOT_TOKEN=xxx

# Each bot has its own webhook URL
WEBHOOK_URL=https://your-dutch-bot.vercel.app/api/webhook
```

**Deployment Strategy:**
- `your-dutch-bot.vercel.app` — LEARNING_LANGUAGE=dutch
- `your-english-bot.vercel.app` — LEARNING_LANGUAGE=english
- `your-serbian-bot.vercel.app` — LEARNING_LANGUAGE=serbian

---

## Folder Structure

```
/prompts
  /dutch
    reading.ts       # Dutch-specific reading task prompts
    listening.ts     # Dutch-specific listening prompts
    speaking.ts      # Dutch-specific speaking prompts
    vocabulary.ts    # Dutch vocabulary extraction prompts
  /english
    reading.ts
    listening.ts
    speaking.ts
    vocabulary.ts
  /serbian
    reading.ts
    listening.ts
    speaking.ts
    vocabulary.ts
  index.ts           # Exports prompts based on LEARNING_LANGUAGE

/locales
  en.json            # English UI strings (default)
  nl.json            # Dutch UI strings
  sr.json            # Serbian UI strings
  ru.json            # Russian UI strings
  index.ts           # Locale loader with fallback

/config
  languages.ts       # Language-specific config (voices, news sources, etc.)
```

---

## Language Configuration

```typescript
// config/languages.ts

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;

  // OpenAI TTS voice
  ttsVoice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

  // News API settings
  newsLanguage: string;  // GNews language code
  newsCountry: string;   // GNews country code

  // Target proficiency level
  defaultLevel: "A1" | "A2" | "B1" | "B2";

  // Example phrases for prompts
  exampleGreeting: string;
  exampleSentence: string;
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  dutch: {
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    ttsVoice: "alloy",
    newsLanguage: "nl",
    newsCountry: "nl",
    defaultLevel: "A2",
    exampleGreeting: "Goedemorgen!",
    exampleSentence: "Ik leer Nederlands.",
  },

  english: {
    code: "en",
    name: "English",
    nativeName: "English",
    ttsVoice: "nova",
    newsLanguage: "en",
    newsCountry: "us",
    defaultLevel: "A2",
    exampleGreeting: "Good morning!",
    exampleSentence: "I am learning English.",
  },

  serbian: {
    code: "sr",
    name: "Serbian",
    nativeName: "Српски",
    ttsVoice: "onyx",  // Closest available
    newsLanguage: "sr",
    newsCountry: "rs",
    defaultLevel: "A2",
    exampleGreeting: "Добро јутро!",
    exampleSentence: "Учим српски.",
  },
};

export function getLanguageConfig(): LanguageConfig {
  const lang = process.env.LEARNING_LANGUAGE || "dutch";
  return LANGUAGES[lang] || LANGUAGES.dutch;
}
```

---

## UI Localization

### Locale Detection

```typescript
// lib/i18n.ts

import en from "../locales/en.json";
import nl from "../locales/nl.json";
import sr from "../locales/sr.json";
import ru from "../locales/ru.json";

const locales: Record<string, typeof en> = { en, nl, sr, ru };

export function getLocale(languageCode?: string): typeof en {
  if (!languageCode) return en;

  // Try exact match first
  if (locales[languageCode]) {
    return locales[languageCode];
  }

  // Try language without region (e.g., "en-US" -> "en")
  const baseCode = languageCode.split("-")[0];
  if (locales[baseCode]) {
    return locales[baseCode];
  }

  // Default to English
  return en;
}

export function t(ctx: Context, key: string, params?: Record<string, string>): string {
  const locale = getLocale(ctx.from?.language_code);
  let text = locale[key] || en[key] || key;

  // Replace placeholders: {{name}} -> value
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${k}}}`, "g"), v);
    }
  }

  return text;
}
```

### Locale File Structure

```json
// locales/en.json
{
  "welcome": "Welcome to {{language}} Learning Bot!",
  "welcome_credits": "You received {{credits}} free credits to get started!",
  "lesson_start": "Choose a topic for today's lesson:",
  "lesson_complete": "All exercises completed!",
  "reading_title": "Reading Exercise",
  "reading_instructions": "Read the text below and answer the questions.",
  "listening_title": "Listening Exercise",
  "listening_instructions": "Listen to the audio and answer the questions.",
  "speaking_title": "Speaking Exercise",
  "speaking_instructions": "Record a voice message answering the prompt.",
  "vocabulary_title": "Today's words:",
  "correct": "Correct!",
  "incorrect": "Incorrect. The correct answer is {{answer}}.",
  "balance": "Your balance: {{credits}} credits",
  "low_balance": "Low balance warning! You have {{credits}} credits remaining.",
  "insufficient_balance": "Insufficient credits. You need ~{{needed}} credits for a lesson.",
  "buy_prompt": "Use /buy to purchase more credits.",
  "tomorrow": "See you tomorrow!",
  "skip_confirm": "Skipped {{task}} task.",
  "error_generic": "Something went wrong. Please try again.",
  "error_no_lesson": "No lesson in progress. Use /lesson to start one."
}
```

```json
// locales/nl.json
{
  "welcome": "Welkom bij de {{language}} Leerbot!",
  "welcome_credits": "Je hebt {{credits}} gratis credits ontvangen om te beginnen!",
  "lesson_start": "Kies een onderwerp voor de les van vandaag:",
  "lesson_complete": "Alle oefeningen voltooid!",
  "reading_title": "Leesoefening",
  "reading_instructions": "Lees de tekst hieronder en beantwoord de vragen.",
  "listening_title": "Luisteroefening",
  "listening_instructions": "Luister naar de audio en beantwoord de vragen.",
  "speaking_title": "Spreekoefening",
  "speaking_instructions": "Neem een spraakbericht op om de vraag te beantwoorden.",
  "vocabulary_title": "Woorden van vandaag:",
  "correct": "Goed!",
  "incorrect": "Fout. Het juiste antwoord is {{answer}}.",
  "balance": "Je saldo: {{credits}} credits",
  "low_balance": "Waarschuwing: laag saldo! Je hebt nog {{credits}} credits.",
  "insufficient_balance": "Onvoldoende credits. Je hebt ~{{needed}} credits nodig voor een les.",
  "buy_prompt": "Gebruik /buy om meer credits te kopen.",
  "tomorrow": "Tot morgen!",
  "skip_confirm": "{{task}} taak overgeslagen.",
  "error_generic": "Er is iets misgegaan. Probeer het opnieuw.",
  "error_no_lesson": "Geen les bezig. Gebruik /lesson om te beginnen."
}
```

```json
// locales/sr.json
{
  "welcome": "Добродошли у {{language}} бот за учење!",
  "welcome_credits": "Добили сте {{credits}} бесплатних кредита за почетак!",
  "lesson_start": "Изаберите тему за данашњу лекцију:",
  "lesson_complete": "Све вежбе завршене!",
  "reading_title": "Вежба читања",
  "reading_instructions": "Прочитајте текст испод и одговорите на питања.",
  "listening_title": "Вежба слушања",
  "listening_instructions": "Слушајте аудио и одговорите на питања.",
  "speaking_title": "Вежба говора",
  "speaking_instructions": "Снимите гласовну поруку као одговор на питање.",
  "vocabulary_title": "Данашње речи:",
  "correct": "Тачно!",
  "incorrect": "Нетачно. Тачан одговор је {{answer}}.",
  "balance": "Ваш салдо: {{credits}} кредита",
  "low_balance": "Упозорење: низак салдо! Имате још {{credits}} кредита.",
  "insufficient_balance": "Недовољно кредита. Потребно вам је ~{{needed}} кредита за лекцију.",
  "buy_prompt": "Користите /buy да купите више кредита.",
  "tomorrow": "Видимо се сутра!",
  "skip_confirm": "Прескочена {{task}} вежба.",
  "error_generic": "Нешто није у реду. Покушајте поново.",
  "error_no_lesson": "Нема лекције у току. Користите /lesson да започнете."
}
```

```json
// locales/ru.json
{
  "welcome": "Добро пожаловать в бот для изучения {{language}}!",
  "welcome_credits": "Вы получили {{credits}} бесплатных кредитов для начала!",
  "lesson_start": "Выберите тему для сегодняшнего урока:",
  "lesson_complete": "Все упражнения завершены!",
  "reading_title": "Упражнение на чтение",
  "reading_instructions": "Прочитайте текст ниже и ответьте на вопросы.",
  "listening_title": "Упражнение на аудирование",
  "listening_instructions": "Прослушайте аудио и ответьте на вопросы.",
  "speaking_title": "Упражнение на говорение",
  "speaking_instructions": "Запишите голосовое сообщение с ответом на вопрос.",
  "vocabulary_title": "Слова на сегодня:",
  "correct": "Правильно!",
  "incorrect": "Неправильно. Правильный ответ: {{answer}}.",
  "balance": "Ваш баланс: {{credits}} кредитов",
  "low_balance": "Предупреждение: низкий баланс! У вас осталось {{credits}} кредитов.",
  "insufficient_balance": "Недостаточно кредитов. Вам нужно ~{{needed}} кредитов для урока.",
  "buy_prompt": "Используйте /buy чтобы купить больше кредитов.",
  "tomorrow": "До завтра!",
  "skip_confirm": "Пропущено упражнение: {{task}}.",
  "error_generic": "Что-то пошло не так. Попробуйте снова.",
  "error_no_lesson": "Нет активного урока. Используйте /lesson чтобы начать."
}
```

---

## Language-Specific Prompts

### Example: Reading Task Prompt

```typescript
// prompts/dutch/reading.ts

export const readingPrompts = {
  adaptArticle: `
You are a Dutch language teacher. Adapt this news article for A2 level Dutch learners.

Requirements:
- Use simple vocabulary (A2 level)
- Short sentences (max 15 words)
- 100-150 words total
- Present tense when possible
- Explain complex concepts simply

Original article:
{{article}}

Output the adapted Dutch text only.
`,

  generateQuestions: `
Create 3 multiple choice questions in Dutch about this text.
Each question tests reading comprehension.

Text:
{{text}}

Requirements:
- Questions in Dutch
- 3 options per question (A, B, C)
- Realistic distractors (not obviously wrong)
- Randomize correct answer position
- A2 vocabulary level

Output JSON format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ..."],
      "correct": "A" | "B" | "C"
    }
  ]
}
`,
};
```

```typescript
// prompts/english/reading.ts

export const readingPrompts = {
  adaptArticle: `
You are an English language teacher. Adapt this news article for A2 level English learners.

Requirements:
- Use simple vocabulary (A2 level, ~1000 most common words)
- Short sentences (max 15 words)
- 100-150 words total
- Present tense when possible
- Avoid idioms and phrasal verbs

Original article:
{{article}}

Output the adapted English text only.
`,

  generateQuestions: `
Create 3 multiple choice questions about this text.
Each question tests reading comprehension.

Text:
{{text}}

Requirements:
- Questions in simple English (A2 level)
- 3 options per question (A, B, C)
- Realistic distractors
- Randomize correct answer position

Output JSON format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ..."],
      "correct": "A" | "B" | "C"
    }
  ]
}
`,
};
```

```typescript
// prompts/serbian/reading.ts

export const readingPrompts = {
  adaptArticle: `
You are a Serbian language teacher. Adapt this news article for A2 level Serbian learners.

Requirements:
- Use simple vocabulary (A2 level)
- Short sentences (max 15 words)
- 100-150 words total
- Use Cyrillic script (ћирилица)
- Avoid complex grammar (stick to present tense, simple past)
- Explain Serbian-specific cultural concepts

Original article:
{{article}}

Output the adapted Serbian text in Cyrillic script only.
`,

  generateQuestions: `
Create 3 multiple choice questions in Serbian about this text.
Each question tests reading comprehension.

Text:
{{text}}

Requirements:
- Questions in Serbian (Cyrillic script)
- 3 options per question (А, Б, В)
- Realistic distractors
- Randomize correct answer position
- A2 vocabulary level

Output JSON format:
{
  "questions": [
    {
      "question": "...",
      "options": ["А) ...", "Б) ...", "В) ..."],
      "correct": "А" | "Б" | "В"
    }
  ]
}
`,
};
```

---

## Implementation Checklist

### Phase 10.1: Language Configuration
- [ ] Create `config/languages.ts` with language configs
- [ ] Add `LEARNING_LANGUAGE` environment variable
- [ ] Create `getLanguageConfig()` helper function
- [ ] Update TTS to use language-specific voice
- [ ] Update news fetching to use language-specific settings

### Phase 10.2: Prompt Organization
- [ ] Create `/prompts` folder structure
- [ ] Move existing Dutch prompts to `/prompts/dutch/`
- [ ] Create English prompts in `/prompts/english/`
- [ ] Create Serbian prompts in `/prompts/serbian/`
- [ ] Create `/prompts/index.ts` to load prompts by language
- [ ] Update all OpenAI calls to use dynamic prompts

### Phase 10.3: UI Localization
- [ ] Create `/locales` folder structure
- [ ] Create `en.json` with all UI strings
- [ ] Create `nl.json` with Dutch translations
- [ ] Create `sr.json` with Serbian translations
- [ ] Create `ru.json` with Russian translations
- [ ] Create `lib/i18n.ts` with `t()` function
- [ ] Update all bot messages to use `t()` function
- [ ] Detect user locale from `ctx.from.language_code`

### Phase 10.4: Bot Message Updates
- [ ] Update `/start` command to use localized strings
- [ ] Update `/lesson` command messages
- [ ] Update reading task messages
- [ ] Update listening task messages
- [ ] Update speaking task messages
- [ ] Update completion messages
- [ ] Update error messages
- [ ] Update `/balance`, `/buy` messages (if monetization enabled)

### Phase 10.5: Testing & Deployment
- [ ] Test Dutch bot with English UI
- [ ] Test Dutch bot with Dutch UI
- [ ] Test English bot with all UI locales
- [ ] Test Serbian bot with Serbian and Russian UI
- [ ] Update deployment docs for multi-bot setup
- [ ] Create separate Vercel projects per language

---

## News Sources by Language

| Language | GNews Settings | Alternative Sources |
|----------|----------------|---------------------|
| Dutch | `lang=nl`, `country=nl` | NOS, RTL Nieuws |
| English | `lang=en`, `country=us` | BBC, CNN |
| Serbian | `lang=sr`, `country=rs` | B92, RTS (may need custom scraper) |

**Note:** GNews may have limited Serbian content. Consider implementing custom news scrapers for Serbian sources.

---

## TTS Voice Selection

| Language | Recommended Voice | Notes |
|----------|-------------------|-------|
| Dutch | `alloy` or `nova` | Test both for naturalness |
| English | `nova` | Clear American English |
| Serbian | `onyx` | OpenAI doesn't have native Serbian voice; consider ElevenLabs |

**Serbian TTS Challenge:** OpenAI TTS may not handle Serbian/Cyrillic well. Consider:
1. Using transliteration (Cyrillic → Latin) for TTS
2. Switching to ElevenLabs for Serbian
3. Implementing a fallback system

---

## Migration Strategy

1. **Phase 1:** Refactor existing code to use language config
2. **Phase 2:** Move prompts to `/prompts/dutch/`
3. **Phase 3:** Add localization layer (keep English as default)
4. **Phase 4:** Add English language support
5. **Phase 5:** Add Serbian language support
6. **Phase 6:** Deploy separate bot instances

---

## Future Enhancements

- [ ] Add more UI languages (German, French, Spanish, etc.)
- [ ] Add more target languages (German, French, Spanish, etc.)
- [ ] Language detection from user messages
- [ ] Mixed-language support (e.g., learn Dutch, UI in Russian)
- [ ] Per-user language preferences stored in database
- [ ] Admin dashboard to manage translations
