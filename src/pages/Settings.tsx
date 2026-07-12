import { useEffect, useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { apiFetch } from '../lib/apiFetch';

type AIProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'azure-openai' | 'ollama';

const PROVIDER_LABEL: Record<AIProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  'azure-openai': 'Azure OpenAI',
  ollama: 'Ollama (self-hosted, no key)',
};

const PROVIDER_MODEL_HINT: Partial<Record<AIProviderId, string>> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  openrouter: 'openai/gpt-4o-mini',
  'azure-openai': 'your-deployment-name',
};

interface StoredProvider {
  provider: AIProviderId;
  addedAt: string;
}

/**
 * BYO AI provider key management — the admin-facing counterpart to
 * worker/routes/providers.ts and worker/routes/settings.ts. Only
 * meaningful in `cloud-api` mode (mock/local-report have no server to
 * store a key on). See docs/API.md §BYO API Keys — the key is accepted
 * once, encrypted server-side, and never sent back to this page again.
 */
export function SettingsPage() {
  const isCloudApi = import.meta.env.VITE_PROVIDER_MODE === 'cloud-api';
  const [providers, setProviders] = useState<StoredProvider[] | null>(null);
  const [preferred, setPreferred] = useState<{ provider: string | null; model: string | null }>({ provider: null, model: null });
  const [form, setForm] = useState<{ provider: AIProviderId; apiKey: string }>({ provider: 'anthropic', apiKey: '' });
  const [modelInput, setModelInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [list, settings] = await Promise.all([
      apiFetch<StoredProvider[]>('/api/v1/providers'),
      apiFetch<{ preferredAiProvider: string | null; preferredAiModel: string | null }>('/api/v1/settings'),
    ]);
    setProviders(list);
    setPreferred({ provider: settings.preferredAiProvider, model: settings.preferredAiModel });
  }

  useEffect(() => {
    if (!isCloudApi) return;
    refresh().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings.'));
  }, [isCloudApi]);

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      await apiFetch('/api/v1/providers', { method: 'POST', body: JSON.stringify(form) });
      setForm({ provider: form.provider, apiKey: '' });
      await refresh();
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to save the key.');
    }
  }

  async function removeKey(provider: AIProviderId) {
    await apiFetch(`/api/v1/providers/${provider}`, { method: 'DELETE' });
    await refresh();
  }

  async function makeDefault(provider: AIProviderId) {
    const model = provider === preferred.provider ? preferred.model ?? '' : modelInput || PROVIDER_MODEL_HINT[provider] || '';
    await apiFetch('/api/v1/settings', { method: 'PUT', body: JSON.stringify({ preferredAiProvider: provider, preferredAiModel: model }) });
    await refresh();
  }

  if (!isCloudApi) {
    return (
      <>
        <PageTitle title="Settings" copy="Configure how AI Check inspects and protects your devices." />
        <Card>
          <p className="changes-empty">
            AI provider keys are managed on a hosted instance. Set <code>VITE_PROVIDER_MODE=cloud-api</code> and sign in to
            configure one — see docs/DEPLOYMENT.md.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Settings" copy="Bring your own AI provider key — used only to generate the AI Report, never for anything else." />

      <Card>
        <div className="card-head">
          <div>
            <h2>AI providers</h2>
            <p>Your key is encrypted at rest and never sent back to this page.</p>
          </div>
        </div>

        {providers === null ? (
          <p className="changes-empty">Loading…</p>
        ) : providers.length === 0 ? (
          <p className="changes-empty">No AI provider configured yet.</p>
        ) : (
          providers.map((p) => (
            <div className="row" key={p.provider}>
              <span className="file">
                <span className="row-icon">
                  <KeyRound size={15} />
                </span>
                {PROVIDER_LABEL[p.provider]}
              </span>
              <span className="row-sub">Added {new Date(p.addedAt).toLocaleDateString()}</span>
              {preferred.provider === p.provider ? (
                <Pill tone="green">Default</Pill>
              ) : (
                <button className="ghost" onClick={() => makeDefault(p.provider)}>
                  Make default
                </button>
              )}
              <button className="icon-button" onClick={() => removeKey(p.provider)} title="Remove key">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}

        <form onSubmit={addKey} className="settings-form">
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as AIProviderId })}>
            {(Object.keys(PROVIDER_LABEL) as AIProviderId[]).map((id) => (
              <option key={id} value={id}>
                {PROVIDER_LABEL[id]}
              </option>
            ))}
          </select>
          {form.provider !== 'ollama' && (
            <input
              type="password"
              required
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="API key"
            />
          )}
          <input
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            placeholder={PROVIDER_MODEL_HINT[form.provider] ?? 'model name'}
          />
          <button type="submit" className="button primary" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save key'}
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
      </Card>
    </>
  );
}
