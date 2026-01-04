# Feature: Visual Diff for Polished Version

Show differences between student's response and polished version with bold highlighting, without relying on LLM.

## Problem

Current output:
```
📝 I heard:
"Ik denk dat 2026 mogelijk wordt. De oorlog duurt al lang."

📝 Polished version:
"Ik denk dat 2026 moeilijk wordt. De oorlog duurt al lang."
```

User has to manually spot the difference. Easy to miss.

## Solution

```
📝 I heard:
"Ik denk dat 2026 mogelijk wordt. De oorlog duurt al lang."

📝 Polished version:
"Ik denk dat 2026 **moeilijk** wordt. De oorlog duurt al lang."
```

Bold = changed/added. User instantly sees what was corrected.

## Algorithm

Use word-level diff, not character-level (more human-readable).

### Option 1: Simple word diff (recommended for MVP)

```typescript
import { diffWords } from 'diff';  // npm package 'diff'

function formatPolishedWithDiff(original: string, polished: string): string {
  const changes = diffWords(original, polished);
  
  let result = '';
  for (const part of changes) {
    if (part.added) {
      // New/changed text — bold
      result += `**${part.value.trim()}** `;
    } else if (part.removed) {
      // Skip removed parts (they're in original)
      continue;
    } else {
      // Unchanged
      result += part.value;
    }
  }
  
  return result.trim();
}

// Example:
formatPolishedWithDiff(
  "Ik denk dat 2026 mogelijk wordt",
  "Ik denk dat 2026 moeilijk wordt"
);
// → "Ik denk dat 2026 **moeilijk** wordt"
```

### Option 2: Show both old and new

```typescript
function formatPolishedWithBothVersions(original: string, polished: string): string {
  const changes = diffWords(original, polished);
  
  let result = '';
  for (const part of changes) {
    if (part.added) {
      result += `**${part.value.trim()}**`;
    } else if (part.removed) {
      result += `~~${part.value.trim()}~~→`;
    } else {
      result += part.value;
    }
  }
  
  return result.trim();
}

// Example:
formatPolishedWithBothVersions(
  "Ik denk dat 2026 mogelijk wordt",
  "Ik denk dat 2026 moeilijk wordt"
);
// → "Ik denk dat 2026 ~~mogelijk~~→**moeilijk** wordt"
```

Telegram supports both **bold** and ~~strikethrough~~ in MarkdownV2.

## Edge Cases

### No changes
```typescript
if (original.trim() === polished.trim()) {
  return "✨ Perfect! No corrections needed.";
}
```

### Only punctuation changes
```
Original: "Ik hoop op vrede maar ik weet het niet"
Polished: "Ik hoop op vrede, maar ik weet het niet."

Output: "Ik hoop op vrede**,** maar ik weet het niet**.**"
```

Might look weird. Consider ignoring punctuation-only diffs or handling separately:

```typescript
function isOnlyPunctuationChange(original: string, polished: string): boolean {
  const normalize = (s: string) => s.replace(/[.,!?;:]/g, '').trim();
  return normalize(original) === normalize(polished);
}

// If true, show:
// "✨ Great! Just minor punctuation fixes: [polished version]"
```

### Word order changes
```
Original: "Ik ga morgen naar school"
Polished: "Morgen ga ik naar school"
```

Word diff will show this messily. For MVP, accept this limitation — complex reorderings are rare at A2.

### Added words
```
Original: "Ik denk dat vrede komt"
Polished: "Ik denk dat er vrede komt"

Output: "Ik denk dat **er** vrede komt"
```

Works well!

### Removed words
```
Original: "Ik denk dat dat vrede komt"  
Polished: "Ik denk dat vrede komt"

Output (option 1): "Ik denk dat vrede komt"  (no indication)
Output (option 2): "Ik denk ~~dat~~ dat vrede komt" (confusing)
```

For removed words, add a note:

```typescript
const hasRemovals = changes.some(p => p.removed);
if (hasRemovals) {
  result += "\n_(some words removed)_";
}
```

## Implementation

### Dependencies

```bash
npm install diff
npm install -D @types/diff
```

### Code

```typescript
// lib/diff.ts
import { diffWords } from 'diff';

interface DiffResult {
  formatted: string;
  hasChanges: boolean;
  changeCount: number;
}

export function formatPolishedDiff(
  original: string, 
  polished: string
): DiffResult {
  // Normalize whitespace
  const orig = original.trim().replace(/\s+/g, ' ');
  const pol = polished.trim().replace(/\s+/g, ' ');
  
  // No changes
  if (orig === pol) {
    return {
      formatted: polished,
      hasChanges: false,
      changeCount: 0
    };
  }
  
  const changes = diffWords(orig, pol);
  
  let result = '';
  let changeCount = 0;
  let hasRemovals = false;
  
  for (const part of changes) {
    if (part.added) {
      result += `**${part.value.trim()}** `;
      changeCount++;
    } else if (part.removed) {
      hasRemovals = true;
      // Don't add to result, but count it
      changeCount++;
    } else {
      result += part.value;
    }
  }
  
  result = result.trim();
  
  if (hasRemovals) {
    result += '\n_(some unnecessary words removed)_';
  }
  
  return {
    formatted: result,
    hasChanges: true,
    changeCount
  };
}
```

### Usage in speaking evaluation

```typescript
// lib/tasks/speaking.ts

async function evaluateSpeaking(transcript: string, prompt: string) {
  // Get polished version from GPT
  const evaluation = await getGPTEvaluation(transcript, prompt);
  
  // Format with diff
  const diff = formatPolishedDiff(transcript, evaluation.polished);
  
  return {
    ...evaluation,
    polishedFormatted: diff.formatted,
    hasCorrections: diff.hasChanges,
    correctionCount: diff.changeCount
  };
}
```

### Message formatting

```typescript
function formatSpeakingFeedback(evaluation: SpeakingEvaluation): string {
  let message = `👍 Feedback\n\n`;
  
  message += `✅ Grammar:\n${evaluation.grammar}\n\n`;
  
  if (evaluation.vocabulary) {
    message += `💡 Vocabulary:\n${evaluation.vocabulary}\n\n`;
  }
  
  if (evaluation.hasCorrections) {
    message += `📝 Polished version:\n"${evaluation.polishedFormatted}"\n\n`;
  } else {
    message += `✨ Perfect! No corrections needed.\n\n`;
  }
  
  message += `🎯 ${evaluation.summary}\n`;
  message += evaluation.score;
  
  return message;
}
```

## Telegram MarkdownV2 Notes

Telegram MarkdownV2 requires escaping special characters. The `diff` output needs sanitization:

```typescript
function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// But DON'T escape our intentional ** markers
function formatForTelegram(diffOutput: string): string {
  // Split by our markers, escape content, rejoin
  const parts = diffOutput.split(/(\*\*.*?\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold section — escape inner content only
      const inner = part.slice(2, -2);
      return `*${escapeMarkdownV2(inner)}*`;  // Telegram uses single *
    }
    return escapeMarkdownV2(part);
  }).join('');
}
```

## Example Output

### Before (current)
```
📝 I heard:
"Ik denk dat 2026 mogelijk wordt. De oorlog duurt al lang. Ik hoop dat er vrede komt maar ik weet het niet zeker."

📝 Polished version:
"Ik denk dat 2026 moeilijk wordt. De oorlog duurt al lang. Ik hoop dat er vrede komt, maar ik weet het niet zeker."
```

### After (with diff)
```
📝 I heard:
"Ik denk dat 2026 mogelijk wordt. De oorlog duurt al lang. Ik hoop dat er vrede komt maar ik weet het niet zeker."

📝 Polished version:
"Ik denk dat 2026 **moeilijk** wordt. De oorlog duurt al lang. Ik hoop dat er vrede komt**,** maar ik weet het niet zeker."
```

User instantly sees: "mogelijk → moeilijk" and missing comma.

## Implementation Checklist

- [ ] Install `diff` package
- [ ] Create `lib/diff.ts` with `formatPolishedDiff()`
- [ ] Handle edge case: no changes
- [ ] Handle edge case: only punctuation
- [ ] Handle edge case: removed words
- [ ] Integrate into speaking evaluation flow
- [ ] Format for Telegram MarkdownV2
- [ ] Test with various correction types

## Future Enhancements

- [ ] Color coding in web version (red=removed, green=added)
- [ ] Audio playback of polished version (TTS the corrected text)
- [ ] Stats: track most common corrections per user
