import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { PARSING_CASES } from '../evaluation/parsing-cases.js';

test('one-round generation API and subsequent adjustments require no confirmation', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'coursefit-generate-'));
  let output = structuredClone(PARSING_CASES[0].expected);
  let calls = 0;
  const server = await createApp({ settingsFile: join(dir, 'settings.json'), env: { COURSEFIT_API_KEY: 'fake-test-only' }, fetchImpl: async () => {
    calls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }));
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  async function generate(body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, ...await response.json() };
  }

  await t.test('complete examples generate locally in one click', async () => {
    const result = await generate({ exampleId: 'balanced-week' });
    assert.equal(result.status, 200);
    assert.equal(result.result.totalFeasible, 8);
    assert.equal(result.draft.questionRound, 1);
    assert.ok(result.confirmationId);
    assert.equal(calls, 0);
  });

  await t.test('complete natural-language input goes directly to a verified result', async () => {
    const result = await generate({ input: PARSING_CASES[0].input });
    assert.equal(result.result.totalFeasible, 1);
    assert.equal(result.result.solutions[0].validated, true);
    assert.equal(calls, 1);
  });

  await t.test('only one question batch, even if the model still has an optional ambiguity after answering', async () => {
    output.clarifications = Array.from({ length: 11 }, (_, i) => `Optional preference detail ${i + 1}?`);
    const initial = await generate({ input: PARSING_CASES[0].input });
    assert.equal(initial.result, undefined);
    assert.equal(initial.draft.data.clarifications.length, 5);
    output.clarifications = ['No break duration given; no break preference applied.'];
    const next = await generate({ draftId: initial.draft.id, answers: { [initial.draft.data.clarifications[0]]: 'No extra preferences.' } });
    assert.equal(next.result.totalFeasible, 1);
    assert.deepEqual(next.draft.data.clarifications, []);
    assert.equal(next.draft.questionRound, 1);
    assert.equal(next.draft.notes.length, 1);
    assert.equal(calls, 3);
    output.clarifications = [];
    output.hardConstraints = [{ type: 'day_off', day: 'Mon', evidence: 'Monday must be free' }];
    const adjusted = await generate({ draftId: next.draft.id, adjustment: 'Monday must be free' });
    assert.equal(adjusted.result.totalFeasible, 0);
    assert.deepEqual(adjusted.draft.data.clarifications, []);
    assert.deepEqual(adjusted.draft.adjustments, ['Monday must be free']);
    assert.equal(adjusted.draft.originalInput, PARSING_CASES[0].input);
    assert.equal(calls, 4);
    assert.equal((await generate({ draftId: adjusted.draft.id, adjustment: '' })).status, 400);
    assert.equal(calls, 4);
    // A model failure leaves the previous immutable plan available.
    const retry = await generate({ draftId: adjusted.draft.id });
    assert.equal(retry.result.totalFeasible, 0);
  });

  await t.test('missing facts produce an actionable result rather than another question page', async () => {
    output = structuredClone(PARSING_CASES[15].expected);
    const initial = await generate({ input: PARSING_CASES[15].input });
    const before = calls;
    const next = await generate({ draftId: initial.draft.id, answers: {} });
    assert.equal(next.result.status, 'needs_data');
    assert.equal(next.draft.data.courses[0].sections[0].meetings.length, 0);
    assert.deepEqual(next.draft.data.clarifications, []);
    assert.equal(calls, before);
  });
});
