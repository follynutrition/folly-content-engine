import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
      },
    });

    const image = response.generatedImages?.[0];
    if (!image?.image?.imageBytes) {
      return res.status(500).json({ error: 'No image generated' });
    }

    // Return base64 image data
    return res.status(200).json({
      imageData: image.image.imageBytes,
      mimeType: 'image/png',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
