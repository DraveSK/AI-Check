import type { AIProvider } from './types';
import { anthropicProvider } from './anthropic';
import { openaiProvider, openrouterProvider, azureOpenAIProvider } from './openaiCompatible';
import { geminiProvider } from './gemini';
import { ollamaProvider } from './ollama';

export * from './types';

/** Every supported vendor implements the same AIProvider interface (see
 * ./types.ts) — adding a new one is a new file plus one line here, never
 * a change to the pipeline that calls it (worker/routes/analyze.ts). */
const PROVIDERS: Record<AIProvider['id'], AIProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  openrouter: openrouterProvider,
  'azure-openai': azureOpenAIProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

export function getAIProvider(id: AIProvider['id']): AIProvider {
  return PROVIDERS[id];
}
