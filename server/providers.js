import { InputError } from './schema.js';

export const DEFAULT_PROVIDER = 'deepseek';

// Protocols a custom endpoint can speak.
export const PROTOCOLS = [
  { id: 'openai', name: 'OpenAI compatible' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'gemini', name: 'Gemini' },
];

// Every entry below is reachable with a single API key and nothing else.
// Providers that also need a resource name, deployment, project or signed
// requests (Azure OpenAI, Vertex AI, Bedrock, Cloudflare) are deliberately
// absent: they belong to the Custom endpoint.
export const PROVIDERS = [
  { id: 'openai', keyHint: 'sk-…', name: 'OpenAI', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.openai.com/v1/chat/completions', modelsUrl: 'https://api.openai.com/v1/models', defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic', keyHint: 'sk-ant-…', name: 'Anthropic', group: 'international', protocol: 'anthropic', auth: 'x-api-key', jsonMode: 'prompt', chatUrl: 'https://api.anthropic.com/v1/messages', modelsUrl: 'https://api.anthropic.com/v1/models', defaultModel: 'claude-sonnet-4-5' },
  { id: 'gemini', keyHint: 'AIza…', name: 'Google Gemini', group: 'international', protocol: 'gemini', auth: 'google-key', jsonMode: 'response_mime', chatUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent', modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models', defaultModel: 'gemini-2.5-flash' },
  { id: 'mistral', name: 'Mistral', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.mistral.ai/v1/chat/completions', modelsUrl: 'https://api.mistral.ai/v1/models', defaultModel: 'mistral-small-latest' },
  { id: 'groq', keyHint: 'gsk_…', name: 'Groq', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.groq.com/openai/v1/chat/completions', modelsUrl: 'https://api.groq.com/openai/v1/models', defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'cerebras', keyHint: 'csk_…', name: 'Cerebras', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.cerebras.ai/v1/chat/completions', modelsUrl: 'https://api.cerebras.ai/v1/models', defaultModel: 'llama3.1-70b' },
  { id: 'xai', keyHint: 'xai-…', name: 'xAI (Grok)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.x.ai/v1/chat/completions', modelsUrl: 'https://api.x.ai/v1/models', defaultModel: 'grok-3' },
  { id: 'openrouter', keyHint: 'sk-or-v1-…', name: 'OpenRouter', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://openrouter.ai/api/v1/chat/completions', modelsUrl: 'https://openrouter.ai/api/v1/models', defaultModel: 'openai/gpt-4o-mini' },
  { id: 'nvidia', keyHint: 'nvapi-…', name: 'NVIDIA NIM', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://integrate.api.nvidia.com/v1/chat/completions', modelsUrl: 'https://integrate.api.nvidia.com/v1/models?limit=500', defaultModel: 'meta/llama-3.1-70b-instruct' },
  { id: 'moonshot-global', keyHint: 'sk-…', name: 'Moonshot AI (Global)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.moonshot.ai/v1/chat/completions', modelsUrl: 'https://api.moonshot.ai/v1/models', defaultModel: 'kimi-k2' },
  { id: 'minimax-global', keyHint: 'eyJ… (JWT)', name: 'MiniMax (Global)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.minimax.io/v1/chat/completions', modelsUrl: 'https://api.minimax.io/v1/models', defaultModel: 'MiniMax-Text-01' },
  { id: 'glm-zai', keyHint: 'sk-…', name: 'Zhipu GLM (Z.ai)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.z.ai/api/paas/v4/chat/completions', modelsUrl: 'https://api.z.ai/api/paas/v4/models', defaultModel: 'glm-4.6' },
  { id: 'bailian-intl', keyHint: 'sk-…', name: 'Alibaba Cloud Bailian (Singapore)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', modelsUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models', defaultModel: 'qwen-plus' },
  { id: 'kimi-coding-global', name: 'Kimi For Coding (Overseas)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', note: 'membership', chatUrl: 'https://api.kimi.ai/coding/v1/chat/completions', modelsUrl: 'https://api.kimi.ai/coding/v1/models', defaultModel: 'k3' },
  { id: 'xiaomi-plan-sgp', keyHint: 'tp-… / ttp-…', name: 'Xiaomi MiMo (Singapore)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', note: 'subscription', chatUrl: 'https://token-plan-sgp.xiaomimimo.com/v1/chat/completions', modelsUrl: 'https://token-plan-sgp.xiaomimimo.com/v1/models', defaultModel: 'mimo-v2.6' },
  { id: 'xiaomi-plan-ams', keyHint: 'tp-… / ttp-…', name: 'Xiaomi MiMo (Amsterdam)', group: 'international', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', note: 'subscription', chatUrl: 'https://token-plan-ams.xiaomimimo.com/v1/chat/completions', modelsUrl: 'https://token-plan-ams.xiaomimimo.com/v1/models', defaultModel: 'mimo-v2.6' },

  { id: 'deepseek', keyHint: 'sk-…', name: 'DeepSeek', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', extraBody: { thinking: { type: 'disabled' } }, chatUrl: 'https://api.deepseek.com/chat/completions', modelsUrl: 'https://api.deepseek.com/models', defaultModel: 'deepseek-flash' },
  { id: 'bailian-cn', keyHint: 'sk-…', name: 'Alibaba Cloud Bailian (Beijing)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelsUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models', defaultModel: 'qwen-plus' },
  { id: 'bailian-coding-plan', keyHint: 'Coding Plan key', name: 'Alibaba Cloud Bailian (Coding Plan)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', note: 'fixed monthly fee', chatUrl: 'https://coding.dashscope.aliyuncs.com/v1/chat/completions', modelsUrl: 'https://coding.dashscope.aliyuncs.com/v1/models', defaultModel: 'qwen3.5-plus' },
  { id: 'bailian-token-plan', keyHint: 'sk-sp-…', name: 'Alibaba Cloud Bailian (Token Plan)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', note: 'prepaid monthly Credits', chatUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions', modelsUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/models', defaultModel: 'qwen3.5-plus' },
  { id: 'hunyuan', keyHint: 'sk-…', name: 'Tencent Hunyuan', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', modelsUrl: 'https://api.hunyuan.cloud.tencent.com/v1/models', defaultModel: 'hunyuan-turbos-latest' },
  { id: 'ark', keyHint: 'xxxxxxxx-xxxx-… (UUID)', name: 'Volcengine Ark (Doubao)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelsUrl: 'https://ark.cn-beijing.volces.com/api/v3/models', defaultModel: 'doubao-seed-1-6' },
  { id: 'qianfan', keyHint: 'bce-v3/ALTAK-…/…', name: 'Baidu Qianfan', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://qianfan.baidubce.com/v2/chat/completions', modelsUrl: 'https://qianfan.baidubce.com/v2/models', defaultModel: 'ernie-4.0-turbo-8k-latest' },
  { id: 'moonshot-cn', keyHint: 'sk-…', name: 'Moonshot AI (China)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.moonshot.cn/v1/chat/completions', modelsUrl: 'https://api.moonshot.cn/v1/models', defaultModel: 'kimi-k2' },
  { id: 'minimax-cn', keyHint: 'eyJ… (JWT)', name: 'MiniMax (China)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.minimaxi.com/v1/chat/completions', modelsUrl: 'https://api.minimaxi.com/v1/models', defaultModel: 'MiniMax-Text-01' },
  { id: 'glm-cn', keyHint: '{id}.{secret}', name: 'Zhipu GLM (BigModel)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', modelsUrl: 'https://open.bigmodel.cn/api/paas/v4/models', defaultModel: 'glm-4.6' },
  { id: 'kimi-coding-cn', name: 'Kimi For Coding (China)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', note: 'membership', chatUrl: 'https://api.kimi.com/coding/v1/chat/completions', modelsUrl: 'https://api.kimi.com/coding/v1/models', defaultModel: 'k3' },
  { id: 'siliconflow', keyHint: 'sk-…', name: 'SiliconFlow', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.siliconflow.cn/v1/chat/completions', modelsUrl: 'https://api.siliconflow.cn/v1/models', defaultModel: 'deepseek-ai/DeepSeek-V3' },
  { id: 'stepfun', name: 'StepFun', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.stepfun.com/v1/chat/completions', modelsUrl: 'https://api.stepfun.com/v1/models', defaultModel: 'step-3.5-flash' },
  { id: 'lingyiwanwu', name: '01.Ai (Yi)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.lingyiwanwu.com/v1/chat/completions', modelsUrl: 'https://api.lingyiwanwu.com/v1/models', defaultModel: 'yi-large' },
  { id: 'longcat', name: 'Meituan LongCat', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.longcat.chat/openai/v1/chat/completions', modelsUrl: 'https://api.longcat.chat/openai/v1/models', defaultModel: 'LongCat-Flash-Chat' },
  { id: 'antling', name: 'Ant Ling', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.ant-ling.com/v1/chat/completions', modelsUrl: 'https://api.ant-ling.com/v1/models', defaultModel: 'Ling-1T' },
  { id: 'iflytek', name: 'iFlytek Spark', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://spark-api-open.xf-yun.com/v1/chat/completions', modelsUrl: 'https://spark-api-open.xf-yun.com/v1/models', defaultModel: 'spark-x' },
  { id: 'xiaomi', keyHint: 'sk-…', name: 'Xiaomi MiMo', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: 'https://api.xiaomimimo.com/v1/chat/completions', modelsUrl: 'https://api.xiaomimimo.com/v1/models', defaultModel: 'mimo-v2.6' },
  { id: 'xiaomi-plan-cn', keyHint: 'tp-… / ttp-…', name: 'Xiaomi MiMo (China)', group: 'china', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', note: 'subscription', chatUrl: 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions', modelsUrl: 'https://token-plan-cn.xiaomimimo.com/v1/models', defaultModel: 'mimo-v2.6' },

  { id: 'custom', name: 'Custom', group: 'custom', protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', needsBaseUrl: true },
];

export function findProvider(id) {
  return PROVIDERS.find(provider => provider.id === id) || null;
}

export function normalizeBaseUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new InputError('Enter the base URL for this custom endpoint.', 400);
  const url = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new InputError('Enter a base URL starting with http:// or https://.', 400);
  return url;
}

// Resolves a stored setting into a concrete endpoint description. Custom
// endpoints take their protocol from the saved choice, defaulting to the
// OpenAI-compatible shape most gateways expose.
export function resolveProvider({ provider, baseUrl, protocol } = {}) {
  const id = typeof provider === 'string' && provider ? provider : DEFAULT_PROVIDER;
  const found = findProvider(id);
  if (!found) throw new InputError('Choose a model provider from the list.', 400);
  if (!found.needsBaseUrl) return found;
  const base = normalizeBaseUrl(baseUrl);
  const chosen = PROTOCOLS.some(item => item.id === protocol) ? protocol : 'openai';
  if (chosen === 'anthropic') return { ...found, protocol: 'anthropic', auth: 'x-api-key', jsonMode: 'prompt', chatUrl: `${base}/v1/messages`, modelsUrl: `${base}/v1/models`, defaultModel: '' };
  if (chosen === 'gemini') return { ...found, protocol: 'gemini', auth: 'google-key', jsonMode: 'response_mime', chatUrl: `${base}/models/{MODEL}:generateContent`, modelsUrl: `${base}/models`, defaultModel: '' };
  return { ...found, protocol: 'openai', auth: 'bearer', jsonMode: 'response_format', chatUrl: `${base}/chat/completions`, modelsUrl: `${base}/models`, defaultModel: '' };
}

export function authHeaders(resolved, apiKey) {
  if (resolved.auth === 'x-api-key') return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' };
  if (resolved.auth === 'google-key') return { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

export function buildChatRequest(resolved, { messages, model, maxTokens, apiKey }) {
  const headers = authHeaders(resolved, apiKey);
  if (resolved.protocol === 'anthropic') {
    const system = messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n');
    const rest = messages.filter(message => message.role !== 'system').map(message => ({ role: message.role, content: message.content }));
    const body = { model, max_tokens: maxTokens, temperature: 0, messages: rest };
    if (system) body.system = system;
    return { url: resolved.chatUrl, headers, body };
  }
  if (resolved.protocol === 'gemini') {
    const system = messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n');
    const contents = messages.filter(message => message.role !== 'system').map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
    const generationConfig = { temperature: 0, maxOutputTokens: maxTokens };
    if (resolved.jsonMode === 'response_mime') generationConfig.responseMimeType = 'application/json';
    const body = { contents, generationConfig };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return { url: resolved.chatUrl.replace('{MODEL}', encodeURIComponent(model)), headers, body };
  }
  const body = { model, messages, max_tokens: maxTokens, temperature: 0 };
  if (resolved.jsonMode === 'response_format') body.response_format = { type: 'json_object' };
  if (resolved.extraBody) Object.assign(body, resolved.extraBody);
  return { url: resolved.chatUrl, headers, body };
}

export function readChatText(resolved, envelope) {
  if (resolved.protocol === 'anthropic') {
    const text = (envelope?.content || []).map(part => part?.text || '').join('');
    return { text, complete: envelope?.stop_reason === 'end_turn' };
  }
  if (resolved.protocol === 'gemini') {
    const candidate = envelope?.candidates?.[0];
    const text = (candidate?.content?.parts || []).map(part => part?.text || '').join('');
    return { text, complete: candidate?.finishReason === 'STOP' };
  }
  const choice = envelope?.choices?.[0];
  return { text: choice?.message?.content, complete: choice?.finish_reason === 'stop' };
}

function modelIds(protocol, envelope) {
  const raw = protocol === 'gemini'
    ? (envelope?.models || []).map(item => String(item?.name || item?.id || '').replace(/^models\//, ''))
    : (envelope?.data || []).map(item => String(item?.id || item?.name || ''));
  return [...new Set(raw.map(item => item.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Lists models for a provider without storing the key anywhere. Any failure is
// recoverable: the caller falls back to a typed model name.
export async function fetchModels({ provider, apiKey, baseUrl, protocol } = {}, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const resolved = resolveProvider({ provider, baseUrl, protocol });
  if (!apiKey || !String(apiKey).trim()) throw new InputError('Enter your API key, then check available models.', 400);
  let response;
  try {
    response = await fetchImpl(resolved.modelsUrl, { headers: authHeaders(resolved, String(apiKey).trim()), signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new InputError(`${resolved.name} took too long to list models. Type the model name instead.`, 504);
    throw new InputError(`Cannot reach ${resolved.name}. Check your connection, or type the model name instead.`, 502);
  }
  if (!response.ok) {
    const reasons = {
      401: `${resolved.name} rejected this API key. Check the key, or type the model name instead.`,
      402: `Your ${resolved.name} account has insufficient balance. Type the model name instead.`,
      403: `${resolved.name} refused this request; the key may not be allowed to list models. Type the model name instead.`,
      429: `${resolved.name} is rate-limiting requests. Wait a moment, or type the model name instead.`,
    };
    throw new InputError(reasons[response.status] || `${resolved.name} could not list models (HTTP ${response.status}). Type the model name instead.`, 502);
  }
  let envelope;
  try { envelope = await response.json(); }
  catch { throw new InputError(`${resolved.name} returned an unreadable model list. Type the model name instead.`, 502); }
  const models = modelIds(resolved.protocol, envelope);
  if (!models.length) throw new InputError(`${resolved.name} returned no models. Type the model name instead.`, 502);
  return { provider: resolved.id, providerName: resolved.name, models };
}
