import type { AIInsight, CleanupItem } from '../../../src/types';

/**
 * AI provider interface — see docs/SCANNER_DESIGN.md §AI. AI explains,
 * it never decides: `explain()` takes an already-final cleanup list and
 * returns prose plus structured insights, nothing more. There is no
 * method here that lets a provider add, remove, or reclassify a
 * recommendation.
 */
export interface AIExplainRequest {
  device: { platform: string; osVersion: string };
  healthScore: number;
  reclaimableBytes: number;
  cleanupItems: CleanupItem[];
  model: string;
  apiKey?: string; // absent for 'ollama' (local, no key needed)
  baseUrl?: string; // for 'ollama' / self-hosted / azure resource endpoint
}

export interface AIExplainResult {
  headline: string;
  summary: string;
  insights: AIInsight[];
  model: string;
}

export interface AIProvider {
  id: 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'azure-openai' | 'ollama';
  explain(request: AIExplainRequest): Promise<AIExplainResult>;
}

/** The exact JSON shape every provider is instructed to return. Keeping
 * one shared shape (rather than parsing free-form prose per vendor) is
 * what "avoid free-form parsing whenever possible" means in practice. */
export interface StructuredAnalysis {
  headline: string;
  summary: string;
  insights: { title: string; detail: string; tone: 'opportunity' | 'positive' | 'security' | 'info' }[];
}

export function buildPrompt(request: AIExplainRequest): string {
  const items = request.cleanupItems
    .map((i) => `- ${i.label}: ${(i.bytes / 1024 ** 3).toFixed(1)} GB (${i.risk}${i.command ? `, \`${i.command}\`` : ''})`)
    .join('\n');
  return `You are AI Check, a privacy-first device inspection assistant. You are given a device's storage cleanup recommendations, already decided by deterministic rules — you do not decide what to clean up, you only explain it in friendly, concise language.

Device: ${request.device.platform}, ${request.device.osVersion}
Reclaimable space: ${(request.reclaimableBytes / 1024 ** 3).toFixed(1)} GB

Cleanup recommendations:
${items || '(none above the size threshold)'}

Respond with ONLY a JSON object matching this exact shape, no other text:
{"headline": string, "summary": string, "insights": [{"title": string, "detail": string, "tone": "opportunity"|"positive"|"security"|"info"}]}`;
}

/** Parses and validates a provider's raw text response against
 * StructuredAnalysis. Throws on anything else — the caller treats a
 * parse failure as an upstream error, not a partial success (see
 * docs/SCANNER_DESIGN.md §AI "returns prose... cannot alter the
 * recommendation list"). */
export function parseStructuredAnalysis(raw: string): StructuredAnalysis {
  const jsonText = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  const parsed: unknown = JSON.parse(jsonText);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as StructuredAnalysis).headline !== 'string' ||
    typeof (parsed as StructuredAnalysis).summary !== 'string' ||
    !Array.isArray((parsed as StructuredAnalysis).insights)
  ) {
    throw new Error('AI response did not match the expected structured shape.');
  }
  return parsed as StructuredAnalysis;
}

export function toAIExplainResult(analysis: StructuredAnalysis, model: string): AIExplainResult {
  return {
    headline: analysis.headline,
    summary: analysis.summary,
    model,
    insights: analysis.insights.map((insight, index) => ({
      id: `ai-${index}`,
      icon: insight.tone,
      title: insight.title,
      detail: insight.detail,
    })),
  };
}
