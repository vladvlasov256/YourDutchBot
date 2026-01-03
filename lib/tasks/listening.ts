import { chat, parseJsonResponse, textToSpeech } from '../openai.js';
import { PROMPTS } from '../../config/prompts.js';
import { NewsArticle } from '../gnews.js';
import { ListeningTask, TaskQuestion, VocabularyWord } from '../storage.js';

export async function generateListeningTask(article: NewsArticle): Promise<{ task: ListeningTask; audioBuffer: Buffer }> {
  try {
    // Step 1: Generate short Dutch text for listening (50-80 words)
    const listeningText = await chat(
      PROMPTS.generateListeningText,
      `Article title: ${article.title}\n\nArticle content: ${article.description}\n\n${article.content}`
    );

    if (!listeningText) {
      throw new Error('Failed to generate listening text');
    }

    // Step 2: Generate listening questions (2 questions)
    const questionsJson = await chat(
      PROMPTS.generateListeningQuestions,
      listeningText
    );

    const questions = parseJsonResponse<TaskQuestion[]>(questionsJson);

    if (!questions || questions.length === 0) {
      throw new Error('Failed to generate questions');
    }

    // Step 3: Extract vocabulary
    const vocabularyJson = await chat(
      PROMPTS.extractVocabulary,
      listeningText
    );

    const vocabulary = parseJsonResponse<VocabularyWord[]>(vocabularyJson);
    const words = vocabulary.map(v => `${v.dutch}:${v.english}`);

    // Step 4: Convert text to speech
    const audioBuffer = await textToSpeech(listeningText);

    // Return the complete listening task
    const task: ListeningTask = {
      audioUrl: '', // Will be set after uploading to Telegram
      transcript: listeningText,
      questions: questions.slice(0, 2), // Ensure only 2 questions
      words,
    };

    return { task, audioBuffer };
  } catch (error) {
    console.error('Error generating listening task:', error);
    throw error;
  }
}
