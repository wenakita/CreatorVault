import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { logger } from '@/lib/logger';

// Robustly retrieve API Key, handling environments where process might be undefined
const getApiKey = (): string => {
  try {
    // Check for standard Node/Container env
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
    // Fallback for Vite/Modern bundlers (optional support)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    logger.warn('Environment check failed.', e);
  }
  return '';
};

const apiKey = getApiKey();

// We create a new instance per call to ensure latest key usage
const getAI = () => new GoogleGenAI({ apiKey });

export const generateCreativeText = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    logger.error('CRITICAL: API Key is missing. Please check README.md for setup instructions.');
    throw new Error("API Key configuration missing. Check console for details.");
  }
  
  const ai = getAI();
  const fullPrompt = `You are a creative assistant for a premium content creator. 
  Generate a creative, inspiring, and high-quality response for the following request: ${prompt}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: fullPrompt,
    });
    return response.text || "No content generated.";
  } catch (error) {
    logger.error('Text generation error', error);
    throw error;
  }
};

export const generateCreativeImage = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    logger.error('CRITICAL: API Key is missing. Please check README.md for setup instructions.');
    throw new Error("API Key configuration missing. Check console for details.");
  }
  
  const ai = getAI();
  try {
    // Using gemini-2.5-flash-image for generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        // Just standard generation, model handles image output structure
      }
    });

    // Extract base64 image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    logger.error('Image generation error', error);
    throw error;
  }
};

export const suggestVaultName = async (): Promise<string> => {
    if (!apiKey) return "Untitled Vault";
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Generate a short, single, abstract, cool, one-word name for a digital creative vault. Just the word.",
        });
        return response.text?.trim() || "Nexus";
    } catch (e) {
        return "Sanctuary";
    }
}