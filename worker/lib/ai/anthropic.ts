import type { AIExplainRequest, AIExplainResult, AIProvider } from './types';
import { buildPrompt, parseStructuredAnalysis, toAIExplainResult } from './types';

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  async explain(request: AIExplainRequest): Promise<AIExplainResult> {
    if (!request.apiKey) throw new Error('Anthropic requires an API key.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(request) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error (${res.status}): ${await res.text().catch(() => '')}`);
    const body = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = body.content.find((c) => c.type === 'text')?.text;
    if (!text) throw new Error('Anthropic response had no text content.');
    return toAIExplainResult(parseStructuredAnalysis(text), request.model);
  },
};
