import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';
const STT_MODEL = process.env.OPENAI_STT_MODEL || 'whisper-1';

// Chat completion helper
export async function chat(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || '';
}

// Text-to-Speech helper
export async function textToSpeech(text: string): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: 'alloy',
    input: text,
  });

  // Convert the response to a buffer
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

// Speech-to-Text helper (Whisper)
export async function transcribeAudio(audioBuffer: Buffer, filename: string = 'audio.oga'): Promise<string> {
  // Create a File-like object from the buffer
  const file = new File([new Uint8Array(audioBuffer)], filename, { type: 'audio/ogg' });

  const response = await openai.audio.transcriptions.create({
    model: STT_MODEL,
    file: file,
    language: 'nl', // Dutch
  });

  return response.text;
}

// Helper to parse JSON responses from OpenAI
export function parseJsonResponse<T>(response: string): T {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try to parse directly
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to parse JSON response:', response);
    throw new Error('Invalid JSON response from OpenAI');
  }
}
