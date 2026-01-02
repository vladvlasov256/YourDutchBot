import { kv } from '@vercel/kv';
import { NewsArticle } from './gnews.js';

// User Profile Types
export interface UserProfile {
  telegramId: number;
  firstName: string;
  topics: string[];
  timezone: string;
  createdAt: string;
}

// Daily State Types
export interface TaskQuestion {
  question: string;
  options: string[];
  correct: 'A' | 'B' | 'C';
}

export interface ReadingTask {
  articleTitle: string;
  articleUrl: string;
  content: string;
  questions: TaskQuestion[];
  words: string[];
}

export interface ListeningTask {
  audioUrl: string;
  transcript: string;
  questions: TaskQuestion[];
  words: string[];
}

export interface SpeakingTask {
  prompt: string;
  words: string[];
}

export interface VocabularyWord {
  dutch: string;
  english: string;
}

export interface DailyState {
  todayDate: string;
  currentTask: 1 | 2 | 3 | 'done' | 'selecting_topic';
  selectedTopicIndex: number | null;
  availableTopics?: NewsArticle[];
  tasks: {
    1?: ReadingTask;
    2?: ListeningTask;
    3?: SpeakingTask;
  };
  collectedWords: VocabularyWord[];
  completedAt: string | null;
}

// Daily Topics Cache Types
export interface DailyTopicsCache {
  date: string;
  topics: NewsArticle[];
  fetchedAt: string;
}

// Storage Keys
const getUserProfileKey = (telegramId: number) => `user:${telegramId}:profile`;
const getUserStateKey = (telegramId: number) => `user:${telegramId}:state`;
const getDailyTopicsKey = (date: string) => `topics:${date}`;

// User Profile Operations
export async function getUserProfile(telegramId: number): Promise<UserProfile | null> {
  const key = getUserProfileKey(telegramId);
  return await kv.get<UserProfile>(key);
}

export async function setUserProfile(profile: UserProfile): Promise<void> {
  const key = getUserProfileKey(profile.telegramId);
  await kv.set(key, profile);
}

export async function createUserProfile(
  telegramId: number,
  firstName: string,
  topics: string[]
): Promise<UserProfile> {
  const profile: UserProfile = {
    telegramId,
    firstName,
    topics,
    timezone: 'CET',
    createdAt: new Date().toISOString(),
  };
  await setUserProfile(profile);
  return profile;
}

// Daily State Operations
export async function getDailyState(telegramId: number): Promise<DailyState | null> {
  const key = getUserStateKey(telegramId);
  return await kv.get<DailyState>(key);
}

export async function setDailyState(telegramId: number, state: DailyState): Promise<void> {
  const key = getUserStateKey(telegramId);
  await kv.set(key, state);
}

export async function createDailyState(telegramId: number): Promise<DailyState> {
  const today = new Date().toISOString().split('T')[0];
  const state: DailyState = {
    todayDate: today,
    currentTask: 'selecting_topic',
    selectedTopicIndex: null,
    tasks: {},
    collectedWords: [],
    completedAt: null,
  };
  await setDailyState(telegramId, state);
  return state;
}

export async function resetDailyState(telegramId: number): Promise<void> {
  // Delete the state entirely - user needs to start a new lesson with /lesson
  const key = getUserStateKey(telegramId);
  await kv.del(key);
}

export async function updateTaskProgress(
  telegramId: number,
  taskNumber: 1 | 2 | 3 | 'done'
): Promise<void> {
  const state = await getDailyState(telegramId);
  if (state) {
    state.currentTask = taskNumber;
    if (taskNumber === 'done') {
      state.completedAt = new Date().toISOString();
    }
    await setDailyState(telegramId, state);
  }
}

// Get all active users (for daily push)
export async function getAllActiveUsers(): Promise<UserProfile[]> {
  // Note: This requires scanning keys, which can be expensive
  // For MVP, we'll use a simple pattern match
  // In production, consider maintaining a separate set of active user IDs
  const keys = await kv.keys('user:*:profile');
  const profiles: UserProfile[] = [];

  for (const key of keys) {
    const profile = await kv.get<UserProfile>(key);
    if (profile) {
      profiles.push(profile);
    }
  }

  return profiles;
}

// Daily Topics Cache Operations
export async function getDailyTopics(): Promise<NewsArticle[] | null> {
  const today = new Date().toISOString().split('T')[0];
  const key = getDailyTopicsKey(today);
  const cache = await kv.get<DailyTopicsCache>(key);

  if (!cache) {
    return null;
  }

  return cache.topics;
}

export async function setDailyTopics(topics: NewsArticle[]): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = getDailyTopicsKey(today);

  const cache: DailyTopicsCache = {
    date: today,
    topics,
    fetchedAt: new Date().toISOString(),
  };

  // Cache for 24 hours (86400 seconds)
  await kv.set(key, cache, { ex: 86400 });
}
