import { chat, parseJsonResponse } from '../openai.js';
import { PROMPTS } from '../../config/prompts.js';
import { NewsArticle } from '../gnews.js';
import { ReadingTask, TaskQuestion, VocabularyWord } from '../storage.js';

export async function generateReadingTask(article: NewsArticle): Promise<ReadingTask> {
  try {
    // Step 1: Adapt article to A2 Dutch
    const adaptedText = await chat(
      PROMPTS.adaptArticle,
      `Article title: ${article.title}\n\nArticle content: ${article.description}\n\n${article.content}`
    );

    if (!adaptedText) {
      throw new Error('Failed to adapt article');
    }

    // Step 2: Generate reading questions
    const questionsJson = await chat(
      PROMPTS.generateReadingQuestions,
      adaptedText
    );

    const questions = parseJsonResponse<TaskQuestion[]>(questionsJson);

    if (!questions || questions.length === 0) {
      throw new Error('Failed to generate questions');
    }

    // Step 3: Extract vocabulary
    const vocabularyJson = await chat(
      PROMPTS.extractVocabulary,
      adaptedText
    );

    const vocabulary = parseJsonResponse<VocabularyWord[]>(vocabularyJson);
    const words = vocabulary.map(v => `${v.dutch}:${v.english}`);

    // Return the complete reading task
    return {
      articleTitle: article.title,
      articleUrl: article.url,
      content: adaptedText,
      questions: questions.slice(0, 3), // Ensure only 3 questions
      words,
    };
  } catch (error) {
    console.error('Error generating reading task:', error);
    throw error;
  }
}
