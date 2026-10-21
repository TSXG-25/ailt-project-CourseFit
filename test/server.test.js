import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server/app.js';
import { PARSING_CASES } from '../evaluation/parsing-cases.js';

test('HTTP integration: local assets, settings, confirmation gate, solve, safe failure and privacy', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'coursefit-test-'));
  let modelCalls = 0;
  let modelOutput = PARSING_CASES[0].expected;
  const server = await createApp({ settingsFile: join(dir, '.local/settings.json'), env: {}, fetchImpl: async () => {
    modelCalls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(modelOutput) } }] }));
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }

  await t.test('serves local UI and rejects foreign origins and hostnames', async () => {
    const response = await fetch(base);
    assert.equal(response.status, 200); assert.match(await response.text(), /CourseFit/);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal((await fetch(`${base}/api/config`, { headers: { Origin: 'https://foreign.example' } })).status, 403);
    const foreignHostStatus = await new Promise((resolve, reject) => {
      const req = httpRequest(`${base}/api/config`, { headers: { Host: 'foreign.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(foreignHostStatus, 403);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/.local/settings.json`)).status, 404);
  });
  await t.test('example solves require a distinct explicit confirmation', async () => {
    const examples = await request('/api/examples'); assert.equal(examples.data.length, 3);
    const loaded = await request('/api/examples/load', 'POST', { id: 'balanced-week' }); assert.equal(loaded.status, 200);
    const draft = loaded.data;
    assert.equal((await request('/api/solve', 'POST', { confirmationId: draft.id })).status, 409);
    assert.equal((await request('/api/solve', 'POST', { data: draft.data, confirmed: true })).status, 409);
    assert.equal((await request('/api/confirm', 'POST', { draftId: draft.id, data: draft.data, acknowledged: false })).status, 400);
    const confirmed = await request('/api/confirm', 'POST', { draftId: draft.id, data: draft.data, acknowledged: true });
    const solved = await request('/api/solve', 'POST', { confirmationId: confirmed.data.confirmationId });
    assert.equal(solved.status, 200); assert.equal(solved.data.totalFeasible, 8);
    assert.equal(solved.data.solutions[0].score, 2); assert.ok(solved.data.solutions.every(solution => solution.validated));
    assert.equal(modelCalls, 0);
  });
  await t.test('infeasibility is reported without a fabricated timetable', async () => {
    const { data: draft } = await request('/api/examples/load', 'POST', { id: 'unavoidable-clash' });
    const { data: confirmation } = await request('/api/confirm', 'POST', { draftId: draft.id, data: draft.data, acknowledged: true });
    const result = await request('/api/solve', 'POST', { confirmationId: confirmation.confirmationId });
    assert.equal(result.data.totalFeasible, 0); assert.deepEqual(result.data.solutions, []); assert.match(result.data.message, /No feasible schedule found/);
  });
  await t.test('unresolved ambiguity blocks confirmation', async () => {
    const { data: draft } = await request('/api/examples/load', 'POST', { id: 'needs-clarification' });
    const result = await request('/api/confirm', 'POST', { draftId: draft.id, data: { ...draft.data, clarifications: [] }, acknowledged: true });
    assert.equal(result.status, 400); assert.match(result.data.error, /Answer every clarification/);
  });
  await t.test('settings are owner-only, redacted and removable; real parsing needs a key', async () => {
    assert.equal((await request('/api/parse', 'POST', { input: PARSING_CASES[0].input })).status, 503);
    const put = await request('/api/config', 'PUT', { apiKey: 'fake-test-only-key', model: 'test-model', rememberKey: true });
    assert.equal(put.status, 200); assert.equal(put.data.configured, true);
    assert.equal(JSON.stringify(put.data).includes('fake-test-only-key'), false);
    assert.equal((await stat(join(dir, '.local/settings.json'))).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(join(dir, '.local/settings.json'))).apiKey, 'fake-test-only-key');
    const parsed = await request('/api/parse', 'POST', { input: PARSING_CASES[0].input });
    assert.equal(parsed.status, 200); assert.equal(parsed.data.source, 'deepseek'); assert.equal(modelCalls, 1);
    assert.equal(JSON.stringify((await request('/api/config')).data).includes('fake-test-only-key'), false);
    const clear = await request('/api/config', 'DELETE'); assert.equal(clear.data.configured, false);
    await assert.rejects(stat(join(dir, '.local/settings.json')), { code: 'ENOENT' });
  });
  await t.test('malformed bodies and content types return useful errors', async () => {
    assert.equal((await request('/api/config', 'PUT', null)).status, 400);
    assert.equal((await fetch(`${base}/api/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })).status, 400);
    assert.equal((await fetch(`${base}/api/parse`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'text' })).status, 415);
  });
  await t.test('clarification returns a new unconfirmed draft and retains the original source', async () => {
    await request('/api/config', 'PUT', { apiKey: 'test-only', model: 'test-model', rememberKey: false });
    const { data: draft } = await request('/api/examples/load', 'POST', { id: 'needs-clarification' });
    const answers = { [draft.data.clarifications[0]]: 'I prefer no classes before 12:00.' };
    modelOutput = structuredClone(draft.data);
    modelOutput.clarifications = [];
    modelOutput.courses.forEach(course => { course.evidence = draft.input; course.sections.forEach(section => { section.evidence = draft.input; }); });
    modelOutput.softPreferences = [{ type: 'earliest_start', time: '12:00', evidence: answers[draft.data.clarifications[0]] }];
    const updated = await request('/api/clarify', 'POST', { draftId: draft.id, data: draft.data, answers });
    assert.equal(updated.status, 200); assert.notEqual(updated.data.id, draft.id);
    assert.equal(updated.data.originalInput, draft.input);
    assert.ok(updated.data.input.includes(answers[draft.data.clarifications[0]]));
    assert.equal((await request('/api/solve', 'POST', { confirmationId: updated.data.id })).status, 409);
    assert.equal((await request('/api/clarify', 'POST', { draftId: 'expired', data: draft.data, answers })).status, 410);
  });
});
