# Feature: Contextual Q&A Chat

Allow users to ask questions at any point — about the current exercise, today's topic, or Dutch language in general.

## Problem

Current flow is rigid: exercise → answer → next exercise. But learning is messy:
- "Wait, what does 'binnenkort' mean?"
- "Why is it 'zal komen' and not 'komt'?"
- "Is Trump actually using vetos? What's happening?"
- "How do I pronounce 'uitgesproken'?"

User has to leave the bot, Google it, lose focus, come back.

## Solution

Three-layer context system. Bot understands questions at any level:

```
┌─────────────────────────────────────────┐
│  Layer 1: Current Exercise Context      │
│  "What does the third word mean?"       │
│  "I don't understand question 2"        │
│  "Can you repeat the audio?"            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Layer 2: Today's Topic Context         │
│  "What's happening with Trump's vetos?" │
│  "Tell me more about Ukraine situation" │
│  "Is this news from today?"             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Layer 3: General Dutch Questions       │
│  "When do I use 'zal' vs 'gaat'?"       │
│  "How do you pronounce 'ui'?"           │
│  "What's the difference between         │
│   'kunnen' and 'mogen'?"                │
└─────────────────────────────────────────┘
```

## UX Flow

### During exercise
```
Bot: Question 2: Wat denken Brooks en Capehart over de oorlog?
     A) De oorlog zal beginnen
     B) De oorlog kan eindigen
     C) De oorlog zal doorgaan

User: what does eindigen mean?

Bot: 💬 "Eindigen" means "to end" (verb).
     
     Example: De film eindigt om 10 uur.
     (The film ends at 10 o'clock.)
     
     Now, back to the question — what's your answer? (A/B/C)

User: B

Bot: ✅ Correct!
```

### Topic question
```
User: is this actually happening? trump vetos?

Bot: 💬 Yes! This is based on real news. In early January 2025, 
     Trump issued his first vetoes of his second term, blocking 
     [specific legislation]. The article we're reading is adapted 
     from recent PBS NewsHour coverage.
     
     Want to continue with the exercise?

User: yes

Bot: Question 3: ...
```

### General Dutch question
```
User: why is it "zal komen" not just "komt"?

Bot: 💬 Good question! 

     "Komt" = present tense (comes / is coming)
     "Zal komen" = future tense (will come)
     
     In Dutch, future is formed with "zullen" + infinitive:
     • Ik zal gaan (I will go)
     • Hij zal komen (He will come)
     
     In the text "vrede zal komen" = "peace will come" (future)
     
     Ready for the next question?
```

## Detection Logic

```typescript
function classifyUserMessage(
  message: string, 
  currentState: UserState
): MessageType {
  
  // Check if it's an exercise answer
  if (isExerciseAnswer(message, currentState)) {
    return { type: "answer", value: message };
  }
  
  // Check if it's a command
  if (message.startsWith("/")) {
    return { type: "command", value: message };
  }
  
  // Otherwise, it's a question — classify the layer
  return { 
    type: "question", 
    layer: classifyQuestionLayer(message, currentState)
  };
}

function classifyQuestionLayer(
  message: string,
  state: UserState
): "exercise" | "topic" | "general" {
  
  // Use GPT to classify with context
  const prompt = `
    User is doing a Dutch learning exercise.
    Current exercise: ${state.currentTask}
    Exercise content: ${state.tasks[state.currentTask].content}
    Today's topic: ${state.topicLabel}
    Original article: ${state.articleTitle}
    
    User message: "${message}"
    
    Classify this message:
    - "exercise" — question about current exercise, vocabulary, or specific sentences
    - "topic" — question about today's news topic, real-world context
    - "general" — general Dutch grammar, pronunciation, or language question
    
    Reply with only one word: exercise, topic, or general
  `;
  
  return await classifyWithGPT(prompt);
}
```

## Context Building

```typescript
function buildQuestionContext(
  layer: "exercise" | "topic" | "general",
  state: UserState
): string {
  
  const base = `
    You are a friendly Dutch teacher helping an ${state.level} learner.
    Keep answers concise but helpful.
    After answering, gently guide back to the exercise.
  `;
  
  if (layer === "exercise") {
    return `
      ${base}
      
      Current exercise context:
      - Type: ${state.currentTask === 1 ? "reading" : state.currentTask === 2 ? "listening" : "speaking"}
      - Text: ${state.tasks[state.currentTask].content}
      - Vocabulary: ${state.tasks[state.currentTask].words.join(", ")}
      - Current question: ${getCurrentQuestion(state)}
      
      Answer questions about this specific exercise, vocabulary, or sentences.
      Give Dutch examples when explaining words.
    `;
  }
  
  if (layer === "topic") {
    return `
      ${base}
      
      Today's topic context:
      - Topic: ${state.topicLabel}
      - Original article title: ${state.articleTitle}
      - Article URL: ${state.articleUrl}
      - Article summary: ${state.articleSummary}
      
      Answer questions about the real-world news/events.
      You can mention this is adapted from real news.
      If you don't know current details, say so.
    `;
  }
  
  // General Dutch
  return `
    ${base}
    
    The user is asking a general Dutch language question.
    They are at ${state.level} level.
    
    Explain grammar, pronunciation, or usage clearly.
    Give simple examples.
    Relate to their current exercise if relevant.
    
    Current exercise topic: ${state.topicLabel}
    Recent vocabulary: ${state.collectedWords.map(w => w.dutch).join(", ")}
  `;
}
```

## Answer Detection

Need to distinguish answers from questions:

```typescript
function isExerciseAnswer(message: string, state: UserState): boolean {
  const msg = message.trim().toUpperCase();
  
  // Reading/Listening: expect A, B, C or combinations
  if (state.currentTask === 1 || state.currentTask === 2) {
    // "A", "B", "C", "A B C", "1 2 3", etc.
    const answerPattern = /^[ABC123\s,]+$/i;
    return answerPattern.test(msg);
  }
  
  // Speaking: expect voice message (handled separately)
  return false;
}
```

## State Update

Add conversation history for context:

```typescript
// user:{id}:state
{
  ...existing fields...
  
  conversation: [
    { role: "bot", content: "Question 2: ...", timestamp: "..." },
    { role: "user", content: "what does eindigen mean?", timestamp: "..." },
    { role: "bot", content: "💬 'Eindigen' means...", timestamp: "..." },
    { role: "user", content: "B", timestamp: "..." },
    { role: "bot", content: "✅ Correct!", timestamp: "..." },
  ]
}
```

Keep last N messages (e.g., 20) for context window.

## Response Format

```typescript
interface QuestionResponse {
  answer: string;           // The actual answer
  followUp: string;         // "Ready to continue?" / "What's your answer?"
  showExerciseReminder: boolean;  // Should we re-show the current question?
}

// Example output:
{
  answer: "💬 \"Eindigen\" means \"to end\" (verb).\n\nExample: De film eindigt om 10 uur.",
  followUp: "Now, back to the question — what's your answer? (A/B/C)",
  showExerciseReminder: false
}
```

## Edge Cases

### User goes off-topic completely
```
User: what's the weather like in Amsterdam?

Bot: 💬 I'm not sure about today's weather! 
     I'm here to help with Dutch learning.
     
     Fun fact: "weather" in Dutch is "het weer"
     Example: Hoe is het weer vandaag? (How is the weather today?)
     
     Let's continue with the exercise?
```

### User asks in Dutch
```
User: wat betekent "eindigen"?

Bot: 💬 Goed dat je in het Nederlands vraagt! 
     
     "Eindigen" = to end
     Example: De les eindigt om 3 uur.
     
     Klaar voor de volgende vraag?
```

### User is frustrated
```
User: I don't understand anything

Bot: 💬 That's okay! Let's slow down.
     
     Here's the sentence again:
     "De oorlog kan eindigen" = "The war can end"
     
     • oorlog = war
     • kan = can
     • eindigen = to end
     
     Would you like me to explain more, or try the question again?
```

## Implementation Checklist

### Phase 1: Detection
- [ ] Add `isExerciseAnswer()` function
- [ ] Add `classifyQuestionLayer()` with GPT
- [ ] Update webhook to route messages appropriately

### Phase 2: Context
- [ ] Store conversation history in state (last 20 messages)
- [ ] Implement `buildQuestionContext()` for each layer
- [ ] Pass context to GPT for answering

### Phase 3: Response
- [ ] Generate helpful answers with examples
- [ ] Add follow-up prompts to return to exercise
- [ ] Handle re-showing current question if needed

### Phase 4: Edge Cases
- [ ] Handle off-topic gracefully
- [ ] Detect frustration / confusion
- [ ] Support questions in Dutch

### Phase 5: Polish
- [ ] Limit question length to avoid abuse
- [ ] Rate limit questions per exercise (max 5?)
- [ ] Track popular questions for FAQ

## Example Conversation

```
Bot: 📖 Reading Exercise
     [Dutch text about Trump vetos]
     
     Question 1: Wat heeft President Trump gedaan?
     A) Hij heeft nieuwe wetten goedgekeurd
     B) Hij heeft veto's gegeven
     C) Hij heeft de oorlog beëindigd

User: what is a veto?

Bot: 💬 A "veto" is when a president rejects a law passed by congress.
     In Dutch: "een veto uitspreken" (to issue a veto)
     
     In this text, Trump used vetos to block certain laws.
     
     So, what's your answer? (A/B/C)

User: but why did he do that?

Bot: 💬 Good question about the news! According to the original 
     article, Trump vetoed legislation related to [topic]. This 
     was discussed by Brooks and Capehart on PBS NewsHour.
     
     Ready to answer? (A/B/C)

User: how do you pronounce "goedgekeurd"?

Bot: 💬 "Goedgekeurd" (approved) is pronounced:
     GOOT-geh-KUHRT
     
     It's the past participle of "goedkeuren" (to approve).
     "Goed" = good, "keuren" = to judge/approve
     
     Your answer? (A/B/C)

User: B

Bot: ✅ Correct! The answer is B.
     
     Question 2: ...
```

## Notes

- Keep answers concise — user is mid-exercise, don't lecture
- Always guide back to the exercise
- Use the question as a teaching moment (add to vocabulary?)
- Consider: if user asks about a word, add it to today's vocabulary list?
