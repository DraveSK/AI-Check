import type { AIExplainRequest, AIExplainResult, AIProvider } from './types';
import { buildPrompt, parseStructuredAnalysis, toAIExplainResult } from './types';

/**
 * OpenAI, OpenRouter, and Azure OpenAI all speak the same
 * `/chat/completions` shape — one implementation, parameterized by base
 * URL and auth header, instead of three near-duplicate files. Ollama is
 * close enough to reuse this too (see ollama.ts).
 */
function openaiCompatibleProvider(id: 'openai' | 'openrouter' | 'azure-openai', defaultBaseUrl: string, authHeader: (apiKey: string) => Record<string, string>): AIProvider {
  return {
    id,
    async explain(request: AIExplainRequest): Promise<AIExplainResult> {
      if (!request.apiKey) throw new Error(`${id} requires an API key.`);
      const baseUrl = request.baseUrl ?? defaultBaseUrl;
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(request.apiKey) },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: 'user', content: buildPrompt(request) }],
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) throw new Error(`${id} API error (${res.status}): ${await res.text().catch(() => '')}`);
      const body = (await res.json()) as { choices: { message: { content: string } }[] };
      const text = body.choices[0]?.message?.content;
      if (!text) throw new Error(`${id} response had no content.`);
      return toAIExplainResult(parseStructuredAnalysis(text), request.model);
    },
  };
}

export const openaiProvider = openaiCompatibleProvider('openai', 'https://api.openai.com/v1', (key) => ({ Authorization: `Bearer ${key}` }));

export const openrouterProvider = openaiCompatibleProvider('openrouter', 'https://openrouter.ai/api/v1', (key) => ({ Authorization: `Bearer ${key}` }));

/** Azure requires a per-resource base URL (no sensible default) — callers
 * must supply `baseUrl` (the user's Azure OpenAI resource endpoint,
 * stored alongside their key in Settings) or this throws clearly rather
 * than silently hitting the wrong host. */
export const azureOpenAIProvider: AIProvider = {
  id: 'azure-openai',
  async explain(request: AIExplainRequest): Promise<AIExplainResult> {
    if (!request.baseUrl) throw new Error('Azure OpenAI requires a resource base URL — set it in Settings.');
    return openaiCompatibleProvider('azure-openai', request.baseUrl, (key) => ({ 'api-key': key })).explain(request);
  },
};
