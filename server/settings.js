import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_PROVIDER, findProvider, normalizeBaseUrl, PROTOCOLS } from './providers.js';
import { InputError } from './schema.js';

// Model identifiers include vendor prefixes and tags, e.g. openai/gpt-4o-mini,
// deepseek-ai/DeepSeek-V3, meta/llama-3.1-70b-instruct.
const MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,120}$/;

function environmentSettings(env) {
  const provider = findProvider(env.COURSEFIT_PROVIDER) ? env.COURSEFIT_PROVIDER : DEFAULT_PROVIDER;
  const defaults = findProvider(provider);
  return {
    provider,
    apiKey: env.COURSEFIT_API_KEY || '',
    model: env.COURSEFIT_MODEL || defaults.defaultModel,
    baseUrl: env.COURSEFIT_BASE_URL || '',
    protocol: env.COURSEFIT_PROTOCOL || '',
  };
}

export class SettingsStore {
  constructor(file, env = process.env) {
    this.file = file;
    this.env = env;
    this.settings = environmentSettings(env);
    this.source = this.settings.apiKey ? 'environment' : 'none';
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      // Settings saved before providers existed are legacy provider settings.
      const provider = findProvider(saved?.provider) ? saved.provider : DEFAULT_PROVIDER;
      const defaults = findProvider(provider);
      if (!this.settings.apiKey && typeof saved.apiKey === 'string') {
        this.settings = {
          provider,
          apiKey: saved.apiKey,
          model: typeof saved.model === 'string' && saved.model.trim() ? saved.model : defaults.defaultModel,
          baseUrl: typeof saved.baseUrl === 'string' ? saved.baseUrl : '',
          protocol: typeof saved.protocol === 'string' ? saved.protocol : '',
        };
        this.source = saved.apiKey ? 'disk' : 'none';
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Local settings could not be read. Re-enter your API key in Model.');
    }
  }

  public() {
    const provider = findProvider(this.settings.provider) || findProvider(DEFAULT_PROVIDER);
    return {
      configured: Boolean(this.settings.apiKey),
      model: this.settings.model,
      keySource: this.source,
      provider: provider.id,
      providerName: provider.name,
      baseUrl: this.settings.baseUrl || '',
      protocol: this.settings.protocol || '',
    };
  }

  async save(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InputError('Settings must contain a provider, API key, model and storage preference.');
    const { apiKey, model, rememberKey, provider, baseUrl, protocol } = raw;
    // Keeping the current provider when the request only updates the key.
    const chosen = provider === undefined || provider === null || provider === ''
      ? (findProvider(this.settings.provider) || findProvider(DEFAULT_PROVIDER))
      : findProvider(provider);
    if (!chosen) throw new InputError('Choose a model provider from the list.');
    if (typeof model !== 'string' || !MODEL_PATTERN.test(model.trim())) throw new InputError('Enter a valid model name.');
    if (apiKey !== undefined && (typeof apiKey !== 'string' || /[\r\n]/.test(apiKey) || apiKey.length > 512)) throw new InputError('Enter a valid API key.');
    if (typeof rememberKey !== 'boolean') throw new InputError('Choose whether to remember the key on this device.');
    let resolvedBase = '';
    let resolvedProtocol = '';
    if (chosen.needsBaseUrl) {
      resolvedBase = normalizeBaseUrl(baseUrl);
      resolvedProtocol = PROTOCOLS.some(item => item.id === protocol) ? protocol : 'openai';
    }
    const key = apiKey?.trim() || this.settings.apiKey;
    if (!key) throw new InputError('Enter your API key.');
    const next = { provider: chosen.id, apiKey: key, model: model.trim(), baseUrl: resolvedBase, protocol: resolvedProtocol };
    if (rememberKey) {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temp = `${this.file}.tmp`;
      await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
      await rename(temp, this.file);
    } else {
      await rm(this.file, { force: true });
    }
    this.settings = next;
    this.source = rememberKey ? 'disk' : 'session';
    return this.public();
  }

  async clear() {
    await rm(this.file, { force: true });
    this.settings = environmentSettings(this.env);
    this.source = this.settings.apiKey ? 'environment' : 'none';
    return this.public();
  }
}
