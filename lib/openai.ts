import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

function getModel(type: 'chat' | 'tts' | 'stt'): string {
  if (type === 'chat') {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }
  if (type === 'tts') {
    return process.env.OPENAI_TTS_MODEL || 'tts-1';
  }
  return process.env.OPENAI_STT_MODEL || 'whisper-1';
}

// Chat completion helper
export async function chat(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: getModel('chat'),
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
  const response = await getOpenAI().audio.speech.create({
    model: getModel('tts'),
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

  const response = await getOpenAI().audio.transcriptions.create({
    model: getModel('stt'),
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
