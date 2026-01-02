const TELEGRAM_API = 'https://api.telegram.org';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  return token;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface MessageResult {
  message_id: number;
  [key: string]: any;
}

// Send text message
export async function sendMessage(chatId: number, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<MessageResult | null> {
  const url = `${TELEGRAM_API}/bot${getBotToken()}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
      }),
    });

    const data = await response.json() as TelegramResponse<MessageResult>;

    if (data.ok && data.result) {
      return data.result;
    } else {
      console.error('Failed to send message:', data.description);
      return null;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

// Send voice message
export async function sendVoice(chatId: number, audioBuffer: Buffer): Promise<MessageResult | null> {
  const url = `${TELEGRAM_API}/bot${getBotToken()}/sendVoice`;

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());

    // Create a Blob from the buffer
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' });
    formData.append('voice', blob, 'audio.ogg');

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json() as TelegramResponse<MessageResult>;

    if (data.ok && data.result) {
      return data.result;
    } else {
      console.error('Failed to send voice:', data.description);
      return null;
    }
  } catch (error) {
    console.error('Error sending voice:', error);
    return null;
  }
}

// Download file from Telegram
export async function downloadFile(fileId: string): Promise<Buffer | null> {
  try {
    // Get file path
    const fileUrl = `${TELEGRAM_API}/bot${getBotToken()}/getFile?file_id=${fileId}`;
    const fileResponse = await fetch(fileUrl);
    const fileData = await fileResponse.json() as TelegramResponse<{ file_path: string }>;

    if (!fileData.ok || !fileData.result?.file_path) {
      console.error('Failed to get file path');
      return null;
    }

    // Download file
    const downloadUrl = `${TELEGRAM_API}/file/bot${getBotToken()}/${fileData.result.file_path}`;
    const downloadResponse = await fetch(downloadUrl);

    if (!downloadResponse.ok) {
      console.error('Failed to download file');
      return null;
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading file:', error);
    return null;
  }
}

// Format vocabulary list for display
export function formatVocabularyList(words: Array<{ dutch: string; english: string }>): string {
  if (words.length === 0) {
    return '';
  }

  let text = '📚 *Today\'s words:*\n\n';

  for (const word of words) {
    text += `• **${word.dutch}** — ${word.english}\n`;
  }

  return text;
}
