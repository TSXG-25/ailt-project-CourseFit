import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { PROVIDERS, PROTOCOLS, findProvider, resolveProvider, buildChatRequest, readChatText, fetchModels } from '../server/providers.js';
import { SettingsStore } from '../server/settings.js';
import { modelJSON } from '../server/parser.js';
import { createApp } from '../server/app.js';

const messages = [{ role: 'system', content: 'Return JSON.' }, { role: 'user', content: 'hello' }];

test('the registry only contains providers reachable with a single API key', () => {
  const ids = PROVIDERS.map(provider => provider.id);
  assert.equal(new Set(ids).size, ids.length, 'provider ids must be unique');
  assert.ok(findProvider('deepseek'), 'DeepSeek stays supported');
  for (const id of ['azure', 'vertex', 'bedrock', 'cloudflare']) assert.equal(findProvider(id), null, `${id} needs more than a key`);
  for (const provider of PROVIDERS) {
    assert.ok(['openai', 'anthropic', 'gemini'].includes(provider.protocol), `${provider.id} protocol`);
    assert.ok(['bearer', 'x-api-key', 'google-key'].includes(provider.auth), `${provider.id} auth`);
    assert.ok(['international', 'china', 'custom'].includes(provider.group), `${provider.id} group`);
    if (provider.needsBaseUrl) continue;
    assert.match(provider.chatUrl, /^https:\/\//, `${provider.id} chat URL`);
    assert.match(provider.modelsUrl, /^https:\/\//, `${provider.id} models URL`);
  }
  assert.ok(PROVIDERS.filter(provider => provider.group === 'international').length >= 9);
  assert.ok(PROVIDERS.filter(provider => provider.group === 'china').length >= 9);
});

test('chat requests follow the protocol of the selected provider', () => {
  const deepseek = buildChatRequest(resolveProvider({ provider: 'deepseek' }), { messages, model: 'deepseek-flash', maxTokens: 100, apiKey: 'k' });
  assert.equal(deepseek.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(deepseek.headers.Authorization, 'Bearer k');
  assert.deepEqual(deepseek.body.response_format, { type: 'json_object' });
  assert.deepEqual(deepseek.body.thinking, { type: 'disabled' });

  const openai = buildChatRequest(resolveProvider({ provider: 'openai' }), { messages, model: 'gpt-4o-mini', maxTokens: 100, apiKey: 'k' });
  assert.equal(openai.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(openai.body.thinking, undefined, 'DeepSeek-only fields stay with DeepSeek');

  const anthropic = buildChatRequest(resolveProvider({ provider: 'anthropic' }), { messages, model: 'claude-sonnet-4-5', maxTokens: 100, apiKey: 'k' });
  assert.equal(anthropic.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(anthropic.headers['x-api-key'], 'k');
  assert.equal(anthropic.headers['anthropic-version'], '2023-06-01');
  assert.equal(anthropic.body.system, 'Return JSON.');
  assert.deepEqual(anthropic.body.messages, [{ role: 'user', content: 'hello' }]);
  assert.equal(anthropic.body.max_tokens, 100);

  const gemini = buildChatRequest(resolveProvider({ provider: 'gemini' }), { messages, model: 'gemini-2.5-flash', maxTokens: 100, apiKey: 'k' });
  assert.equal(gemini.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(gemini.headers['x-goog-api-key'], 'k');
  assert.deepEqual(gemini.body.systemInstruction, { parts: [{ text: 'Return JSON.' }] });
  assert.deepEqual(gemini.body.contents, [{ role: 'user', parts: [{ text: 'hello' }] }]);
  assert.equal(gemini.body.generationConfig.responseMimeType, 'application/json');
});

test('assistant turns map onto each protocol role', () => {
  const reply = [...messages, { role: 'assistant', content: '{"a":1}' }];
  const openai = buildChatRequest(resolveProvider({ provider: 'openai' }), { messages: reply, model: 'm', maxTokens: 10, apiKey: 'k' });
  assert.equal(openai.body.messages[2].role, 'assistant');
  const gemini = buildChatRequest(resolveProvider({ provider: 'gemini' }), { messages: reply, model: 'm', maxTokens: 10, apiKey: 'k' });
  assert.equal(gemini.body.contents[1].role, 'model');
});

test('responses are read per protocol, and truncated output is rejected', () => {
  assert.deepEqual(readChatText(resolveProvider({ provider: 'openai' }), { choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }), { text: '{}', complete: true });
  assert.deepEqual(readChatText(resolveProvider({ provider: 'anthropic' }), { stop_reason: 'end_turn', content: [{ text: '{}' }] }), { text: '{}', complete: true });
  assert.deepEqual(readChatText(resolveProvider({ provider: 'gemini' }), { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] }), { text: '{}', complete: true });
  assert.equal(readChatText(resolveProvider({ provider: 'openai' }), { choices: [{ finish_reason: 'length', message: { content: '{}' } }] }).complete, false);
});

test('custom endpoints require a base URL and can choose a protocol', () => {
  const openai = resolveProvider({ provider: 'custom', baseUrl: 'https://gateway.example.com/v1/' });
  assert.equal(openai.chatUrl, 'https://gateway.example.com/v1/chat/completions');
  assert.equal(openai.modelsUrl, 'https://gateway.example.com/v1/models');
  const anthropic = resolveProvider({ provider: 'custom', baseUrl: 'https://gateway.example.com', protocol: 'anthropic' });
  assert.equal(anthropic.chatUrl, 'https://gateway.example.com/v1/messages');
  assert.equal(anthropic.auth, 'x-api-key');
  assert.throws(() => resolveProvider({ provider: 'custom' }), /base URL/i);
  assert.throws(() => resolveProvider({ provider: 'custom', baseUrl: 'ftp://gateway.example.com' }), /http:\/\/ or https:\/\//i);
  assert.ok(PROTOCOLS.some(item => item.id === 'openai'));
});

test('model listings are read per protocol and failures stay recoverable', async () => {
  const openai = await fetchModels({ provider: 'openai', apiKey: 'k' }, { fetchImpl: async () => new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] })) });
  assert.deepEqual(openai.models, ['gpt-4o', 'gpt-4o-mini']);
  assert.equal(openai.providerName, 'OpenAI');

  const gemini = await fetchModels({ provider: 'gemini', apiKey: 'k' }, { fetchImpl: async () => new Response(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash' }] })) });
  assert.deepEqual(gemini.models, ['gemini-2.5-flash']);

  await assert.rejects(fetchModels({ provider: 'openai', apiKey: '' }, { fetchImpl: async () => new Response('{}') }), /Enter your API key/);
  await assert.rejects(fetchModels({ provider: 'openai', apiKey: 'k' }, { fetchImpl: async () => new Response('{}', { status: 401 }) }), /rejected this API key.*type the model name/s);
  await assert.rejects(fetchModels({ provider: 'openai', apiKey: 'k' }, { fetchImpl: async () => new Response('{}', { status: 402 }) }), /insufficient balance/);
  await assert.rejects(fetchModels({ provider: 'openai', apiKey: 'k' }, { fetchImpl: async () => new Response('{}', { status: 429 }) }), /rate-limiting/);
  await assert.rejects(fetchModels({ provider: 'openai', apiKey: 'k' }, { fetchImpl: async () => new Response('{}') }), /returned no models/);
});

test('settings keep the provider, accept prefixed model names and migrate old files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'coursefit-providers-'));
  const file = join(dir, 'settings.json');
  const store = new SettingsStore(file, {});
  await store.save({ provider: 'openrouter', apiKey: 'key', model: 'openai/gpt-4o-mini', rememberKey: true });
  assert.equal(store.public().provider, 'openrouter');
  assert.equal(store.public().model, 'openai/gpt-4o-mini');
  assert.equal(JSON.parse(await readFile(file)).provider, 'openrouter');

  const reopened = new SettingsStore(file, {});
  await reopened.load();
  assert.equal(reopened.public().provider, 'openrouter');

  const legacyFile = join(dir, 'legacy.json');
  await writeFile(legacyFile, JSON.stringify({ apiKey: 'legacy', model: 'deepseek-flash' }));
  const legacy = new SettingsStore(legacyFile, {});
  await legacy.load();
  assert.equal(legacy.public().provider, 'deepseek', 'settings saved before providers existed stay DeepSeek');

  const env = new SettingsStore(join(dir, 'env.json'), { COURSEFIT_PROVIDER: 'anthropic', COURSEFIT_API_KEY: 'k' });
  assert.equal(env.public().provider, 'anthropic');
  assert.equal(env.public().configured, true);

  await assert.rejects(store.save({ provider: 'openai', apiKey: 'k', model: 'bad name', rememberKey: false }), /valid model name/);
  await assert.rejects(store.save({ provider: 'not-a-provider', apiKey: 'k', model: 'm', rememberKey: false }), /Choose a model provider/);
  await rm(dir, { recursive: true, force: true });
});

test('modelJSON sends the request to the selected provider', async () => {
  let seen = null;
  const output = await modelJSON(messages, { provider: 'anthropic', apiKey: 'k', model: 'claude-sonnet-4-5' }, {
    fetchImpl: async (url, options) => {
      seen = { url, method: options.method, headers: options.headers };
      return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ text: '{"ok":1}' }] }));
    },
  });
  assert.deepEqual(output, { ok: 1 });
  assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(seen.method, 'POST');
  assert.equal(seen.headers['x-api-key'], 'k');
});

test('HTTP: providers are listed and models are fetched only on request', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'coursefit-http-'));
  let listingCalls = 0;
  const server = await createApp({ settingsFile: join(dir, 'settings.json'), env: {}, fetchImpl: async url => {
    listingCalls++;
    if (String(url).includes('/models')) return new Response(JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2' }] }));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }));
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async response => ({ status: response.status, data: await response.json() }));

  const providers = await call('/api/providers');
  assert.equal(providers.status, 200);
  assert.ok(providers.data.providers.length > 30);
  assert.ok(providers.data.providers.some(item => item.group === 'international' && item.id === 'openai'));
  assert.ok(providers.data.providers.some(item => item.group === 'china' && item.id === 'deepseek'));
  assert.ok(providers.data.providers.some(item => item.needsBaseUrl && item.id === 'custom'));
  assert.ok(JSON.stringify(providers.data).includes('Anthropic'));

  assert.equal(listingCalls, 0, 'listing is not fetched until the user asks');
  const models = await call('/api/models', 'POST', { provider: 'openai', apiKey: 'k' });
  assert.equal(models.status, 200);
  assert.deepEqual(models.data.models, ['m1', 'm2']);
  assert.equal(listingCalls, 1);

  const missingBase = await call('/api/models', 'POST', { provider: 'custom', apiKey: 'k' });
  assert.equal(missingBase.status, 400);
  assert.match(missingBase.data.error, /base URL/i);
  const empty = await call('/api/models', 'POST', { provider: 'deepseek' });
  assert.equal(empty.status, 400, 'no key means no listing');
  assert.match(empty.data.error, /Enter your API key/);
});
