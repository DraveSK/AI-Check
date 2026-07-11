import type { AIExplainRequest, AIExplainResult, AIProvider } from './types';
import { buildPrompt, parseStructuredAnalysis, toAIExplainResult } from './types';

/**
 * Local inference, no API key. Note the deployment implication: a Worker
 * running on Cloudflare's edge cannot reach `http://localhost:11434` on
 * a user's laptop — Ollama only works end-to-end when the whole API is
 * self-hosted on the same network as the Ollama instance (see
 * docs/OPEN_CORE.md). This is documented, not silently broken: a request
 * with no reachable baseUrl fails with a clear upstream_error, not a
 * hang.
 */
export const ollamaProvider: AIProvider = {
  id: 'ollama',
  async explain(request: AIExplainRequest): Promise<AIExplainResult> {
    const baseUrl = request.baseUrl ?? 'http://localhost:11434';
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: 'user', content: buildPrompt(request) }],
        stream: false,
        format: 'json',
      }),
    });
    if (!res.ok) throw new Error(`Ollama error (${res.status}): ${await res.text().catch(() => '')}`);
    const body = (await res.json()) as { message: { content: string } };
    if (!body.message?.content) throw new Error('Ollama response had no content.');
    return toAIExplainResult(parseStructuredAnalysis(body.message.content), request.model);
  },
};
