# Feature: Language Level Selection

Add support for A0/A1/A2 levels to make the bot useful for complete beginners.

## Problem

Current A2-level texts are too difficult for beginners. Reading about startups or politics at A2 level when you're at "Ik ben een man" stage is frustrating and useless.

## Solution

Manual level selection via `/level` command. Store in user profile, use in all content generation prompts.

## Command

```
/level — Set your Dutch level

📊 Choose your current level:

[A0 - Beginner] 
I know almost nothing. "Ik ben een man."

[A1 - Elementary]
I know basics. Simple sentences, present tense.

[A2 - Pre-intermediate]
I can read simple texts. Target for inburgeringsexamen.
```

## Data Model Update

```typescript
// user:{id}:profile
{
  telegramId: number,
  firstName: string,
  topics: string[],
  timezone: "CET",
  level: "A0" | "A1" | "A2",  // <-- add this, default "A0"
  createdAt: string
}
```

## Level Specifications

```typescript
const LEVEL_SPECS = {
  A0: {
    name: "Beginner",
    wordCount: "30-50 words",
    sentenceLength: "3-6 words per sentence",
    grammar: [
      "Only present tense (zijn, hebben, werken)",
      "Simple SVO structure (Subject-Verb-Object)",
      "No subordinate clauses",
      "No conjunctions except 'en'",
    ],
    vocabulary: [
      "Top 200 most common Dutch words",
      "Concrete nouns (man, vrouw, huis, auto)",
      "Basic verbs (zijn, hebben, gaan, komen, werken, wonen)",
      "Simple adjectives (groot, klein, goed, mooi)",
    ],
    avoidList: [
      "Abstract concepts",
      "Business/technical jargon", 
      "Compound words longer than 2 parts",
      "Modal verbs (kunnen, moeten, willen)",
      "Perfect tense (heeft gedaan)",
      "Passive voice",
    ],
    questionStyle: "Very simple, answers directly stated in text",
  },

  A1: {
    name: "Elementary", 
    wordCount: "50-80 words",
    sentenceLength: "5-10 words per sentence",
    grammar: [
      "Present tense",
      "Simple past of common verbs (was, had, ging)",
      "Basic conjunctions (en, maar, of, want)",
      "Simple questions",
    ],
    vocabulary: [
      "Top 500 most common Dutch words",
      "Time expressions (vandaag, morgen, vorige week)",
      "Common modal verbs (kan, wil, moet)",
    ],
    avoidList: [
      "Complex subordinate clauses",
      "Perfect tense with unusual participles",
      "Passive voice",
      "Idiomatic expressions",
    ],
    questionStyle: "Straightforward, minimal inference required",
  },

  A2: {
    name: "Pre-intermediate",
    wordCount: "100-150 words",
    sentenceLength: "8-15 words per sentence",
    grammar: [
      "Present, past, and perfect tense",
      "Subordinate clauses (dat, omdat, als, wanneer)",
      "All common conjunctions",
      "Passive voice (simple cases)",
    ],
    vocabulary: [
      "Top 1500 most common Dutch words",
      "Abstract concepts",
      "Topic-specific vocabulary with context",
    ],
    avoidList: [
      "Rare idioms",
      "Highly specialized jargon",
      "Complex passive constructions",
    ],
    questionStyle: "May require some inference and understanding of context",
  },
};
```

## Example Outputs by Level

### Topic: Nvidia buying AI21 Labs

**A0 - Beginner:**
```
Nvidia is een bedrijf.
Nvidia maakt computers.
Nvidia wil een ander bedrijf kopen.
Het bedrijf heet AI21.
AI21 maakt software.
Nvidia betaalt veel geld.

Vocabulary:
• bedrijf — company
• kopen — to buy
• geld — money
```

**A1 - Elementary:**
```
Nvidia is een groot techbedrijf. Het maakt computers en software.
Nu wil Nvidia een ander bedrijf kopen. Dit bedrijf heet AI21 en komt uit Israël.
AI21 maakt slimme software. Nvidia wil veel geld betalen, misschien 3 miljard dollar.
Dit is groot nieuws in de techwereld.

Vocabulary:
• techbedrijf — tech company
• slimme — smart
• nieuws — news
• misschien — maybe
```

**A2 - Pre-intermediate:**
```
Nvidia is in gesprek met AI21 Labs over een mogelijke overname. 
Het Israëlische bedrijf ontwikkelt software voor kunstmatige intelligentie.
De deal zou tot 3 miljard dollar kunnen kosten.
Dit is een belangrijke investering in de groeiende AI-sector.
Experts zeggen dat grote techbedrijven steeds meer AI-startups willen kopen.
De overname past in Nvidia's strategie om meer dan alleen chips te verkopen.

Vocabulary:
• overname — acquisition
• kunstmatige intelligentie — artificial intelligence
• investering — investment
• groeiende — growing
```

## Prompt Template

```typescript
function getLevelPrompt(level: "A0" | "A1" | "A2"): string {
  const spec = LEVEL_SPECS[level];
  
  return `
Adapt the following news article to Dutch at ${level} level (${spec.name}).

Requirements:
- Length: ${spec.wordCount}
- Sentence length: ${spec.sentenceLength}
- Grammar rules: ${spec.grammar.join("; ")}
- Use only: ${spec.vocabulary.join("; ")}
- Avoid: ${spec.avoidList.join("; ")}

The text should be interesting but fully understandable for a ${level} learner.
Every single sentence must be simple enough that a beginner can parse it.

For A0: Write like you're explaining to someone who learned Dutch for 2 weeks.
For A1: Write like you're explaining to someone who learned Dutch for 2-3 months.
For A2: Write like you're explaining to someone preparing for inburgeringsexamen.
`;
}
```

## Implementation Checklist

### Phase 1: Core
- [ ] Add `level` field to user profile (default: "A0")
- [ ] Implement `/level` command with inline keyboard
- [ ] Create LEVEL_SPECS config in `/config/levels.ts`
- [ ] Update `/start` to ask for level during onboarding

### Phase 2: Integration
- [ ] Update reading task prompt to use level spec
- [ ] Update listening task prompt to use level spec  
- [ ] Update speaking task prompt to use level spec
- [ ] Adjust vocabulary extraction (fewer words for A0)

### Phase 3: Questions
- [ ] Simplify questions for A0 (2 questions instead of 3)
- [ ] Make A0 answers almost directly quoted from text
- [ ] Gradually increase inference required for A1, A2

### Phase 4: Polish
- [ ] Add level indicator to daily message: "📊 Level: A0"
- [ ] After 7 days of 100% correct, suggest level up
- [ ] Add `/level` to help/status output

## UX Flow

### On /start (new user)
```
👋 Welcome to Dutch Learning Bot!

Before we begin, what's your Dutch level?

[A0 - Beginner] — I just started
[A1 - Elementary] — I know the basics
[A2 - Pre-intermediate] — I can read simple texts
```

### On /level (existing user)
```
📊 Your current level: A0 (Beginner)

Change to:
[A0] [A1] [A2]

Tip: Start lower if unsure. You can always change later!
```

### Daily message header
```
🌅 Goedemorgen! Time for Dutch practice.
📊 Level: A0 | 📰 Topic: Startups

[A0-appropriate text here]
```

## Notes

- Default to A0 for new users — better too easy than too hard
- Don't auto-downgrade, only suggest upgrades
- Keep level visible so user remembers they can change it
- Vocabulary count per level: A0 = 3-4 words, A1 = 4-6 words, A2 = 6-10 words
