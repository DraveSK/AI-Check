import type { AIExplainRequest, AIExplainResult, AIProvider } from './types';
import { buildPrompt, parseStructuredAnalysis, toAIExplainResult } from './types';

export const geminiProvider: AIProvider = {
  id: 'gemini',
  async explain(request: AIExplainRequest): Promise<AIExplainResult> {
    if (!request.apiKey) throw new Error('Gemini requires an API key.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${request.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(request) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text().catch(() => '')}`);
    const body = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
    const text = body.candidates[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini response had no text content.');
    return toAIExplainResult(parseStructuredAnalysis(text), request.model);
  },
};
