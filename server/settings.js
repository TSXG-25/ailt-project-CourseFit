import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_MODEL } from './parser.js';
import { InputError } from './schema.js';

export class SettingsStore {
  constructor(file, env = process.env) {
    this.file = file;
    this.env = env;
    this.settings = { apiKey: env.DEEPSEEK_API_KEY || '', model: env.DEEPSEEK_MODEL || DEFAULT_MODEL };
    this.source = this.settings.apiKey ? 'environment' : 'none';
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      if (!this.settings.apiKey && typeof saved.apiKey === 'string') {
        this.settings = { apiKey: saved.apiKey, model: saved.model || DEFAULT_MODEL };
        this.source = saved.apiKey ? 'disk' : 'none';
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Local settings could not be read. Re-enter your API key in Settings.');
    }
  }

  public() {
    return { configured: Boolean(this.settings.apiKey), model: this.settings.model, keySource: this.source };
  }

  async save(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InputError('Settings must contain an API key, model and storage preference.');
    const { apiKey, model, rememberKey } = raw;
    if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(model)) throw new InputError('Enter a valid DeepSeek model name.');
    if (apiKey !== undefined && (typeof apiKey !== 'string' || /[\r\n]/.test(apiKey) || apiKey.length > 512)) throw new InputError('Enter a valid API key.');
    if (typeof rememberKey !== 'boolean') throw new InputError('Choose whether to remember the key on this device.');
    const key = apiKey?.trim() || this.settings.apiKey;
    if (!key) throw new InputError('Enter your DeepSeek API key.');
    const next = { apiKey: key, model };
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
    this.settings = { apiKey: this.env.DEEPSEEK_API_KEY || '', model: this.env.DEEPSEEK_MODEL || DEFAULT_MODEL };
    this.source = this.settings.apiKey ? 'environment' : 'none';
    return this.public();
  }
}
