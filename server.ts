import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));

// Ensure Gemini client uses user-agent as per SKILL.md
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Backup storage directory
const BACKUP_DIR = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Storage API for persistent backup & audit
app.post('/api/storage/backup', (req, res) => {
  try {
    const { workbookData } = req.body;
    if (!workbookData) {
      return res.status(400).json({ error: 'Missing workbookData' });
    }
    const backupFile = path.join(BACKUP_DIR, 'project_xl_backup.json');
    fs.writeFileSync(backupFile, JSON.stringify(workbookData, null, 2), 'utf-8');
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('Backup error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storage/restore', (_req, res) => {
  try {
    const backupFile = path.join(BACKUP_DIR, 'project_xl_backup.json');
    if (!fs.existsSync(backupFile)) {
      return res.json({ found: false });
    }
    const content = fs.readFileSync(backupFile, 'utf-8');
    res.json({ found: true, workbookData: JSON.parse(content) });
  } catch (err: any) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Gemini Multi-turn Chat API
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages, systemInstruction, model = 'gemini-3.8-flash' } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }

    // Supported models: gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite
    const allowedModels = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    const chosenModel = allowedModels.includes(model) ? model : 'gemini-3.8-flash';

    // Format contents for generateContent
    // Map previous messages to Gemini contents structure
    const contents = (messages || []).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    const response = await ai.models.generateContent({
      model: chosenModel,
      contents,
      config: {
        systemInstruction: systemInstruction || 'You are the PROJECT XL Intelligent Spreadsheet & Automation Assistant.',
      },
    });

    const reply = response.text || '';
    res.json({ reply });
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    res.status(500).json({ error: err.message || 'Error generating Gemini response' });
  }
});

// Gemini Text-to-Speech (TTS) using gemini-3.8-flash-tts
app.post('/api/gemini/tts', async (req, res) => {
  try {
    const { text, voice = 'Kore', style = 'Clear, professional spreadsheet assistant' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    // Use gemini-3.8-flash-tts as explicitly instructed
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 500),
              speechMetadata: {
                style,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
          },
        },
      },
    });

    // In unary call, inlineData.data is full WAV base64
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      return res.status(500).json({ error: 'No audio returned from Gemini TTS' });
    }

    res.json({ audioBase64: audioData, mimeType: 'audio/wav' });
  } catch (err: any) {
    console.error('Gemini TTS error:', err);
    res.status(500).json({ error: err.message || 'TTS generation failed' });
  }
});

// Gemini Image Generation using gemini-3-pro-image-preview with 1K, 2K, 4K affordance
app.post('/api/gemini/generate-image', async (req, res) => {
  try {
    const { prompt, imageSize = '1K', aspectRatio = '1:1' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    // Valid size affordances: 1K, 2K, 4K
    const validSizes = ['1K', '2K', '4K'];
    const chosenSize = validSizes.includes(imageSize) ? imageSize : '1K';

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || '1:1',
          imageSize: chosenSize as '1K' | '2K' | '4K',
        },
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'No image data returned from image generation model.' });
    }

    res.json({ imageUrl, size: chosenSize });
  } catch (err: any) {
    console.error('Gemini Image Gen error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate image' });
  }
});

// Start Express server and connect Vite in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`PROJECT XL server running on http://0.0.0.0:${port}`);
  });
}

startServer();
