import { chat, parseJsonResponse } from '../openai.js';
import { PROMPTS } from '../../config/prompts.js';
import { NewsArticle } from '../gnews.js';
import { SpeakingTask, VocabularyWord } from '../storage.js';

export async function generateSpeakingTask(article: NewsArticle): Promise<SpeakingTask> {
  try {
    // Generate speaking prompt
    const prompt = await chat(
      PROMPTS.generateSpeakingPrompt,
      `Article title: ${article.title}\n\nArticle content: ${article.description}\n\n${article.content}`
    );

    if (!prompt) {
      throw new Error('Failed to generate speaking prompt');
    }

    // Extract vocabulary
    const vocabularyJson = await chat(
      PROMPTS.extractVocabulary,
      prompt
    );

    const vocabulary = parseJsonResponse<VocabularyWord[]>(vocabularyJson);
    const words = vocabulary.map(v => `${v.dutch}:${v.english}`);

    return {
      prompt,
      words,
    };
  } catch (error) {
    console.error('Error generating speaking task:', error);
    throw error;
  }
}

interface SpeakingEvaluation {
  grammar: string;
  vocabulary: string;
  polished: string;
  summary: string;
  score: '⭐⭐⭐' | '⭐⭐' | '⭐';
}

export async function evaluateSpeaking(
  prompt: string,
  userTranscript: string
): Promise<SpeakingEvaluation> {
  try {
    const evaluationJson = await chat(
      PROMPTS.evaluateSpeaking,
      `Prompt: ${prompt}\n\nUser's response: ${userTranscript}`
    );

    const evaluation = parseJsonResponse<SpeakingEvaluation>(evaluationJson);

    return evaluation;
  } catch (error) {
    console.error('Error evaluating speaking:', error);
    throw error;
  }
}
