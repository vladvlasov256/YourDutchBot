# PRD: Monetization with Telegram Stars

## Overview

Implement a credit-based billing system where users pay with Telegram Stars to access Dutch learning lessons. Credits are consumed based on actual OpenAI API token usage with a margin for sustainability.

## Business Model

```
User buys Stars → Stars convert to Credits → Credits consumed per lesson
                                                      ↓
                                            OpenAI API (tokens) + margin
```

**Key principles:**
- New users get free credits to try the bot
- Transparent pricing tied to actual API costs
- Small margin (20-30%) for sustainability
- Telegram Stars for payment (compliant with App Store rules)

---

## Telegram Stars Basics

### What are Stars?
- In-app currency bought via Apple/Google IAP or @PremiumBot
- Used for digital goods and services in Telegram bots
- Developers can withdraw Stars as TON via Fragment

### Pricing (approximate)
| Stars | User pays (USD) | Developer receives |
|-------|-----------------|-------------------|
| 50    | ~$0.99          | ~$0.65            |
| 100   | ~$1.99          | ~$1.30            |
| 250   | ~$4.99          | ~$3.25            |
| 500   | ~$9.99          | ~$6.50            |

**Note:** Apple/Google take ~30%, then Telegram takes a cut. Developer gets ~65% of user payment.

### Integration
```typescript
// Send invoice for Stars
await bot.api.sendInvoice(chatId, {
  title: "100 Learning Credits",
  description: "Credits for Dutch lessons",
  payload: "credits_100",
  currency: "XTR",  // Telegram Stars
  prices: [{ label: "100 Credits", amount: 50 }],  // 50 Stars
  provider_token: "",  // Empty for digital goods
});

// Handle successful payment
bot.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;
  const { telegram_payment_charge_id, total_amount } = payment;
  
  // Add credits to user
  await addCredits(ctx.from.id, calculateCredits(total_amount));
  
  // Store charge_id for potential refunds
  await storeTransaction(ctx.from.id, telegram_payment_charge_id, total_amount);
});
```

---

## OpenAI API Token Tracking

### Chat Completions (GPT-4o, GPT-4o-mini)

Every response includes usage:

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [...],
});

const usage = response.usage;
// {
//   prompt_tokens: 150,
//   completion_tokens: 200,
//   total_tokens: 350
// }
```

**Pricing (GPT-4o-mini):**
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

### Whisper (Speech-to-Text)

**Pricing:** $0.006 per minute of audio

**Important:** Whisper API does NOT return token count in response. Must estimate from audio duration.

```typescript
// Get audio duration before sending to Whisper
const duration = await getAudioDuration(audioBuffer);  // in seconds

const transcription = await openai.audio.transcriptions.create({
  model: "whisper-1",
  file: audioFile,
});

// Calculate cost manually
const whisperCost = (duration / 60) * 0.006;
```

### TTS (Text-to-Speech)

**Pricing (tts-1):** $15 / 1M characters (~$0.015 per 1000 chars)

**Important:** TTS API does NOT return usage in response. Must calculate from input length.

```typescript
const inputText = "Goedemorgen! Dit is een test.";

const audio = await openai.audio.speech.create({
  model: "tts-1",
  voice: "alloy",
  input: inputText,
});

// Calculate cost manually
const ttsCost = (inputText.length / 1_000_000) * 15;
```

---

## Credit System Design

### Credit Definition

1 Credit = $0.001 USD worth of API usage

This makes math simple:
- 1000 credits = $1 of API cost
- With 25% margin: user pays ~1250 credits worth for $1 of API

### Token to Credit Conversion

```typescript
const CREDIT_RATES = {
  // GPT-4o-mini
  "gpt-4o-mini": {
    input: 0.15,   // credits per 1000 input tokens
    output: 0.60,  // credits per 1000 output tokens
  },
  
  // GPT-4o
  "gpt-4o": {
    input: 2.50,
    output: 10.00,
  },
  
  // Whisper
  "whisper-1": {
    perMinute: 6,  // credits per minute
  },
  
  // TTS
  "tts-1": {
    perChar: 0.015,  // credits per 1000 chars
  },
};

// Add margin
const MARGIN = 1.25;  // 25% margin

function calculateCredits(usage: APIUsage): number {
  let credits = 0;
  
  if (usage.model.startsWith("gpt")) {
    const rates = CREDIT_RATES[usage.model];
    credits += (usage.promptTokens / 1000) * rates.input;
    credits += (usage.completionTokens / 1000) * rates.output;
  }
  
  if (usage.model === "whisper-1") {
    credits += (usage.audioMinutes) * CREDIT_RATES["whisper-1"].perMinute;
  }
  
  if (usage.model === "tts-1") {
    credits += (usage.characters / 1000) * CREDIT_RATES["tts-1"].perChar * 1000;
  }
  
  return Math.ceil(credits * MARGIN);
}
```

### Typical Lesson Cost Estimate

| Component | API Cost | Credits (with margin) |
|-----------|----------|----------------------|
| Reading task (GPT-4o-mini, ~2K tokens) | ~$0.001 | ~2 |
| Listening task (TTS, ~500 chars) | ~$0.0075 | ~10 |
| Speaking task (Whisper, ~30 sec) | ~$0.003 | ~4 |
| Speaking feedback (GPT-4o-mini, ~1K tokens) | ~$0.0005 | ~1 |
| **Total per lesson** | **~$0.012** | **~17 credits** |

**Rounding up:** ~20 credits per full lesson for safety buffer.

---

## Pricing Packages

### Free Tier
- **50 credits** on signup
- Enough for ~2-3 complete lessons
- No credit card required

### Paid Packages

| Package | Stars | Credits | Per Credit | USD Equivalent |
|---------|-------|---------|------------|----------------|
| Starter | 25 ⭐ | 100 | 0.25 ⭐ | ~$0.50 |
| Basic | 50 ⭐ | 250 | 0.20 ⭐ | ~$1.00 |
| Pro | 100 ⭐ | 600 | 0.17 ⭐ | ~$2.00 |
| Premium | 250 ⭐ | 1750 | 0.14 ⭐ | ~$5.00 |

**Volume discount:** Bigger packages = better rate per credit.

---

## Data Model

### User Balance

```typescript
// user:{id}:billing
{
  credits: number,           // Current credit balance
  totalPurchased: number,    // Lifetime purchased credits
  totalSpent: number,        // Lifetime spent credits
  freeCreditsUsed: boolean,  // Has used signup bonus
  createdAt: string,
}
```

### Transactions

```typescript
// transactions:{id}
{
  id: string,                      // UUID
  oderId: number,                  // Telegram user ID
  type: "purchase" | "usage" | "refund" | "bonus",
  amount: number,                  // Credits (positive for purchase, negative for usage)
  details: {
    // For purchase
    telegramChargeId?: string,
    stars?: number,
    package?: string,
    
    // For usage
    lessonId?: string,
    breakdown?: {
      gptTokens?: number,
      whisperMinutes?: number,
      ttsCharacters?: number,
    },
  },
  createdAt: string,
}
```

### Usage Tracking (per request)

```typescript
// Track every API call for billing accuracy
interface APIUsageLog {
  userId: number,
  lessonId: string,
  model: string,
  promptTokens?: number,
  completionTokens?: number,
  audioMinutes?: number,
  characters?: number,
  creditsCharged: number,
  timestamp: string,
}
```

---

## User Flow

### New User

```
User: /start

Bot: 👋 Welcome to Dutch Learning Bot!
     
     🎁 You received 50 free credits to get started!
     This is enough for 2-3 complete lessons.
     
     Use /lesson to begin learning.
     Use /balance to check your credits.
```

### Check Balance

```
User: /balance

Bot: 💰 Your balance: 47 credits
     
     📊 Usage today: 3 credits
     📈 Lessons completed: 1
     
     Need more credits? Use /buy
```

### Low Balance Warning

```
[During lesson, balance drops to <10 credits]

Bot: ⚠️ Low balance warning!
     
     You have 8 credits remaining.
     Complete this lesson, then consider buying more.
     
     Use /buy to see packages.
```

### Insufficient Balance

```
User: /lesson

Bot: ❌ Insufficient credits
     
     You need ~20 credits for a lesson.
     Your balance: 5 credits
     
     Use /buy to purchase more credits.
     
     [Buy Credits]
```

### Purchase Flow

```
User: /buy

Bot: 🛒 Credit Packages
     
     Choose a package:
     
     [25⭐ → 100 credits]
     [50⭐ → 250 credits] ← Best value
     [100⭐ → 600 credits]
     [250⭐ → 1750 credits]
     
     💡 50 credits ≈ 2-3 lessons

User: [clicks "50⭐ → 250 credits"]

Bot: [Telegram payment UI appears]
     
     📦 Basic Package
     250 credits for Dutch lessons
     
     [Pay 50 ⭐]

User: [confirms payment]

Bot: ✅ Payment successful!
     
     +250 credits added to your balance.
     New balance: 255 credits
     
     Happy learning! Use /lesson to continue.
```

---

## Implementation Checklist

### Phase 1: Credit Tracking
- [ ] Add `credits` field to user profile
- [ ] Implement `deductCredits(userId, amount)` function
- [ ] Implement `addCredits(userId, amount)` function
- [ ] Add 50 free credits on `/start`

### Phase 2: Usage Tracking
- [ ] Wrap OpenAI calls to capture usage
- [ ] Calculate credits per API call
- [ ] Log usage to transactions table
- [ ] Deduct credits after each API call

### Phase 3: Balance UI
- [ ] `/balance` command
- [ ] Low balance warnings during lessons
- [ ] Insufficient balance blocking

### Phase 4: Payments
- [ ] `/buy` command with package selection
- [ ] `sendInvoice` for Telegram Stars
- [ ] Handle `successful_payment` callback
- [ ] Store `telegram_payment_charge_id` for refunds

### Phase 5: Refunds
- [ ] `/paysupport` command (required by Telegram)
- [ ] Admin ability to issue refunds
- [ ] Implement `refundStarPayment` API call

---

## API Wrapper for Usage Tracking

```typescript
// lib/openai-tracked.ts

import OpenAI from "openai";
import { deductCredits, logUsage } from "./billing";

const openai = new OpenAI();

export async function chatCompletion(
  userId: number,
  lessonId: string,
  params: OpenAI.ChatCompletionCreateParams
): Promise<OpenAI.ChatCompletion> {
  const response = await openai.chat.completions.create(params);
  
  const usage = response.usage!;
  const model = params.model;
  
  const credits = calculateGPTCredits(model, usage);
  
  await deductCredits(userId, credits);
  await logUsage({
    userId,
    lessonId,
    model,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    creditsCharged: credits,
  });
  
  return response;
}

export async function transcribe(
  userId: number,
  lessonId: string,
  audioBuffer: Buffer,
  durationSeconds: number
): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: new File([audioBuffer], "audio.ogg"),
  });
  
  const minutes = durationSeconds / 60;
  const credits = calculateWhisperCredits(minutes);
  
  await deductCredits(userId, credits);
  await logUsage({
    userId,
    lessonId,
    model: "whisper-1",
    audioMinutes: minutes,
    creditsCharged: credits,
  });
  
  return transcription.text;
}

export async function textToSpeech(
  userId: number,
  lessonId: string,
  text: string
): Promise<Buffer> {
  const audio = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text,
  });
  
  const credits = calculateTTSCredits(text.length);
  
  await deductCredits(userId, credits);
  await logUsage({
    userId,
    lessonId,
    model: "tts-1",
    characters: text.length,
    creditsCharged: credits,
  });
  
  return Buffer.from(await audio.arrayBuffer());
}
```

---

## Commands Summary

| Command | Description |
|---------|-------------|
| `/balance` | Show current credit balance |
| `/buy` | Purchase credits with Stars |
| `/transactions` | Show recent transactions |
| `/paysupport` | Payment support (required by Telegram) |

---

## Telegram Requirements

Per Telegram ToS for bot payments:

1. **`/paysupport` command** — Must handle payment disputes
2. **`/terms` command** — Terms and conditions
3. **Store `telegram_payment_charge_id`** — For refunds
4. **Refund capability** — Via `refundStarPayment` API
5. **Clear pricing** — User must see cost before purchase

---

## Monitoring

### Metrics to Track

```typescript
// Daily aggregates
{
  date: "2025-01-15",
  totalCreditsSpent: 5420,
  totalCreditsPurchased: 8000,
  totalStarsReceived: 1600,
  uniquePayingUsers: 12,
  lessonsCompleted: 245,
  averageCreditsPerLesson: 22,
  
  // API costs
  openaiCost: {
    gpt: 3.20,
    whisper: 1.80,
    tts: 4.50,
    total: 9.50,
  },
  
  // Revenue
  estimatedRevenue: 16.00,  // 1600 stars ≈ $32, dev gets ~50%
  margin: 6.50,  // revenue - costs
}
```

### Alerts

- Credit balance < 0 (bug!)
- Daily API cost exceeds daily revenue
- High refund rate (>5%)
- Unusual usage spikes

---

## Future Enhancements

### Subscriptions (post-MVP)
```
📦 Monthly Subscription
     
     [99⭐/month → Unlimited lessons]
```

### Referral Program
```
🎁 Invite a friend!
     
     Share your link: t.me/YourDutchBot?start=ref_123
     
     You get: 50 credits
     Friend gets: 50 bonus credits
```

### Usage Insights
```
📊 Your Learning Stats
     
     This month:
     • 15 lessons completed
     • 127 credits used
     • 234 new words learned
     
     Most expensive: Speaking exercises (45%)
     Tip: Practice reading more to save credits!
```

---

## Summary

**MVP scope:**
1. Free 50 credits on signup
2. Credit deduction per API call
3. `/balance` and `/buy` commands
4. Telegram Stars payments
5. Basic transaction logging

**Key technical challenges:**
- Whisper and TTS don't return usage — must calculate manually
- Need to track audio duration before sending to Whisper
- Stars payments require proper error handling and refund support

**Economics:**
- ~$0.012 API cost per lesson
- ~20 credits per lesson (with margin)
- User pays ~$0.04 per lesson at best rate
- Sustainable with 25% margin
