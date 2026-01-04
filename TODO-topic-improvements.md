# Feature: Improved Topic Selection

Better topic quality, pagination, and filtering for more engaging lessons.

## Problems

1. **Only 1-2 interesting topics out of 5** — low hit rate, need more options to browse
2. **Stale articles** — seeing headlines from last month despite "fresh news" promise

## Solutions

### 1. Pagination — Show More Topics

Instead of 5 topics take-it-or-leave-it, let user browse.

**UI:**

```
📰 Choose a topic for today's lesson:

1. Man United defeats Liverpool 2-0 in Premier League
2. Python 3.13 introduces experimental JIT compiler
3. Y Combinator W25 batch features 200 AI startups
4. Russia announces new economic measures
5. Nvidia acquires AI startup for $3B

[ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
[        ← More →           ]
```

User clicks "More →":

```
📰 More topics (page 2/3):

6. Bruno Fernandes signs contract extension
7. OpenAI releases GPT-5 preview
8. Tech layoffs continue in 2025
9. Ukraine peace talks scheduled for February
10. Andreessen Horowitz raises new $5B fund

[ 6 ] [ 7 ] [ 8 ] [ 9 ] [ 10 ]
[   ← Back   |   More →     ]
```

**Implementation:**

```typescript
// Fetch more articles upfront
const ARTICLES_PER_TOPIC = 4;  // was 2
const TOTAL_TOPICS = 4;
// = 16 articles total, show 5 per page = 3 pages

interface DailyTopicsCache {
  date: string;
  topics: NewsArticle[];  // All 15-16 articles
  fetchedAt: string;
}

interface UserState {
  // ...existing
  topicPage: number;  // 0, 1, 2
  availableTopics: NewsArticle[];  // All articles for browsing
}

function getTopicsForPage(topics: NewsArticle[], page: number): NewsArticle[] {
  const PAGE_SIZE = 5;
  const start = page * PAGE_SIZE;
  return topics.slice(start, start + PAGE_SIZE);
}
```

**Callback handling:**

```typescript
// Callback data format: "topic:3" or "page:next" or "page:prev"
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data.startsWith('topic:')) {
    const index = parseInt(data.split(':')[1]);
    await selectTopic(ctx, index);
  } else if (data === 'page:next') {
    state.topicPage++;
    await showTopicsPage(ctx, state);
  } else if (data === 'page:prev') {
    state.topicPage--;
    await showTopicsPage(ctx, state);
  }
});
```

**API quota impact:**
- Was: 4 calls × 2 articles = 8 articles
- Now: 4 calls × 4 articles = 16 articles
- Same number of API calls! Just requesting more per call.

---

### 2. Filter Stale Articles

**Problem:** GNews returns articles sorted by "relevance" not "date", so old articles sneak in.

**Solution A: Use `sortby` parameter**

```typescript
// GNews API supports sortby parameter
const params = {
  q: query,
  lang: 'en',
  max: 4,
  sortby: 'publishedAt',  // Sort by date, newest first
  apikey: GNEWS_API_KEY
};
```

**Solution B: Filter by date client-side**

```typescript
const MAX_AGE_DAYS = 7;

function filterFreshArticles(articles: NewsArticle[]): NewsArticle[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  
  return articles.filter(article => {
    const published = new Date(article.publishedAt);
    return published >= cutoff;
  });
}

// Usage
let articles = await fetchNews(topic.query, 6);  // Fetch extra
articles = filterFreshArticles(articles);        // Remove old ones
articles = articles.slice(0, 4);                 // Take top 4
```

**Solution C: Add date to display**

Even if we can't filter perfectly, show the date so user knows:

```
📰 Choose a topic:

1. [2 days ago] Man United defeats Liverpool 2-0
2. [Today] Python 3.13 introduces JIT compiler
3. [5 days ago] Y Combinator W25 batch announced
```

```typescript
function formatTopicWithAge(article: NewsArticle): string {
  const age = getArticleAge(article.publishedAt);
  return `[${age}] ${truncate(article.title, 50)}`;
}

function getArticleAge(publishedAt: string): string {
  const days = daysSince(publishedAt);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}
```

**Recommendation:** Use all three:
1. `sortby: publishedAt` in API call
2. Filter out articles older than 7 days
3. Show age in topic list

---

---

## Combined Implementation

```typescript
// lib/gnews.ts

const MAX_AGE_DAYS = 7;
const ARTICLES_PER_TOPIC = 6;  // Fetch extra to account for filtering

interface FetchOptions {
  filterStale?: boolean;
}

export async function fetchTopicsForDay(
  options: FetchOptions = { filterStale: true }
): Promise<NewsArticle[]> {
  let allArticles: NewsArticle[] = [];
  
  for (const topic of TOPICS) {
    await delay(500);  // Rate limit protection
    
    const articles = await fetchFromGNews({
      q: topic.query,
      max: ARTICLES_PER_TOPIC,
      sortby: 'publishedAt',  // Newest first
      lang: 'en'
    });
    
    allArticles.push(...articles.map(a => ({ ...a, category: topic.label })));
  }
  
  // Filter stale articles
  if (options.filterStale) {
    allArticles = filterByAge(allArticles, MAX_AGE_DAYS);
  }
  
  // Shuffle for variety
  allArticles = shuffle(allArticles);
  
  // Log stats
  console.log(`[TOPICS] Fetched ${allArticles.length} articles after filtering`);
  
  return allArticles;
}

function filterByAge(articles: NewsArticle[], maxDays: number): NewsArticle[] {
  const cutoff = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
  return articles.filter(a => new Date(a.publishedAt).getTime() >= cutoff);
}
```

---

## Updated Cache Structure

```typescript
interface DailyTopicsCache {
  date: string;
  topics: NewsArticle[];      // All filtered articles (12-20)
  totalFetched: number;       // Before filtering (for monitoring)
  totalAfterFilter: number;   // After filtering
  fetchedAt: string;
}

interface NewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
  // New fields
  category: string;           // "Football", "Software", etc.
  ageLabel: string;           // "Today", "2 days ago"
}
```

---

## Updated UI

```typescript
function formatTopicList(topics: NewsArticle[], page: number): string {
  const PAGE_SIZE = 5;
  const start = page * PAGE_SIZE;
  const pageTopics = topics.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(topics.length / PAGE_SIZE);
  
  let message = `📰 Choose a topic (page ${page + 1}/${totalPages}):\n\n`;
  
  pageTopics.forEach((topic, i) => {
    const num = start + i + 1;
    const age = getArticleAge(topic.publishedAt);
    const category = topic.category;
    message += `${num}. [${age}] [${category}]\n`;
    message += `   ${truncate(topic.title, 55)}\n\n`;
  });
  
  return message;
}

// Example output:
// 📰 Choose a topic (page 1/3):
//
// 1. [Today] [Football]
//    Man United defeats Liverpool 2-0 in Premier League
//
// 2. [Yesterday] [Software]
//    Python 3.13 introduces experimental JIT compiler
//
// 3. [2 days ago] [Startups]
//    Y Combinator W25 batch features 200 AI startups
```

**Inline keyboard:**

```typescript
function buildTopicKeyboard(
  topics: NewsArticle[], 
  page: number
): InlineKeyboard {
  const PAGE_SIZE = 5;
  const start = page * PAGE_SIZE;
  const pageTopics = topics.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(topics.length / PAGE_SIZE);
  
  const keyboard = new InlineKeyboard();
  
  // Topic buttons (1-5 for page 0, 6-10 for page 1, etc.)
  pageTopics.forEach((_, i) => {
    keyboard.text(`${start + i + 1}`, `topic:${start + i}`);
  });
  keyboard.row();
  
  // Navigation
  if (page > 0) {
    keyboard.text('← Back', 'page:prev');
  }
  if (page < totalPages - 1) {
    keyboard.text('More →', 'page:next');
  }
  
  return keyboard;
}
```

---

## Implementation Checklist

### Phase 1: Pagination
- [ ] Increase `ARTICLES_PER_TOPIC` from 2 to 4-6
- [ ] Add `topicPage` to user state
- [ ] Implement `getTopicsForPage()`
- [ ] Add "← Back" and "More →" buttons
- [ ] Handle `page:next` and `page:prev` callbacks

### Phase 2: Freshness Filter
- [ ] Add `sortby: publishedAt` to GNews request
- [ ] Implement `filterByAge()` with 7-day cutoff
- [ ] Add age label to topic display ("[Today]", "[2 days ago]")
- [ ] Log filtered count for monitoring

### Phase 3: UI Improvements
- [ ] Show category label ("[Football]", "[Software]")
- [ ] Show age label
- [ ] Better truncation of long titles
- [ ] Show "page X of Y" in header
