import test from 'node:test';
import assert from 'node:assert/strict';
import { clarifyInput } from '../server/parser.js';
import { validatePlan } from '../server/schema.js';
import { DraftStore } from '../server/store.js';

const question = 'Which semester are you planning, and does COURSE1 have fixed meeting times?';
const draft = { input: 'COURSE1\n1A 00:00-08:20\n2B 00:00-08:20', data: { courses: [{ id: 'COURSE1', name: 'COURSE1', sections: [{ id: '1A', semester: 1, meetings: [] }, { id: '2B', semester: 2, meetings: [] }] }], hardConstraints: [], softPreferences: [], clarifications: [question] } };
const settings = { apiKey: 'test-only' };
const output = { courses: [{ id: 'COURSE1', name: 'COURSE1', evidence: 'COURSE1', sections: [{ id: '2B', semester: 2, asynchronous: true, meetings: [], evidence: 'COURSE1 has no fixed meetings' }] }], hardConstraints: [], softPreferences: [], clarifications: [] };
const response = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));

test('clarification answers update the draft while preserving the original source and confirmation gate', async () => {
  const answer = 'Semester 2 only. COURSE1 has no fixed meetings; it is asynchronous.';
  const updated = await clarifyInput(draft, draft.data, { [question]: answer }, settings, { fetchImpl: async (_url, options) => {
    const input = JSON.parse(options.body).messages[1].content;
    assert.ok(input.includes(draft.input)); assert.ok(input.includes(answer));
    assert.match(input, /explicit answers override older ambiguous data/);
    return response(output);
  } });
  assert.equal(updated.originalInput, draft.input);
  assert.equal(updated.data.courses[0].sections[0].semester, 2);
  assert.equal(updated.data.courses[0].sections[0].asynchronous, true);
  assert.equal(updated.answers[question], answer);
  const store = new DraftStore();
  const nextDraft = store.create(updated.data, updated.input, 'deepseek', updated);
  assert.equal(store.getDraft(nextDraft.id).originalInput, draft.input);
  assert.throws(() => store.getConfirmed(nextDraft.id), /Confirm your interpretation/);
  const confirmed = store.confirm({ draftId: nextDraft.id, data: updated.data, acknowledged: true });
  assert.equal(confirmed.data.courses[0].sections[0].asynchronous, true);
});

test('empty answers are rejected without calling a model', async () => {
  let called = false;
  await assert.rejects(clarifyInput(draft, draft.data, {}, settings, { fetchImpl: async () => { called = true; return response(output); } }), /at least one clarification/);
  assert.equal(called, false);
});

test('a second follow-up preserves answers without recursively appending the whole previous draft', async () => {
  const first = await clarifyInput(draft, draft.data, { [question]: 'Semester 2 only. COURSE1 has no fixed meetings.' }, settings, { fetchImpl: async () => response({ ...output, clarifications: ['How many minutes of break do you prefer?'] }) });
  const second = await clarifyInput(first, first.data, { 'How many minutes of break do you prefer?': 'At least 30 minutes, as a soft preference.' }, settings, { fetchImpl: async (_url, options) => {
    const input = JSON.parse(options.body).messages[1].content;
    assert.ok(input.startsWith(draft.input));
    assert.ok(input.includes('At least 30 minutes'));
    assert.equal(input.includes(first.input), false);
    return response({ ...output, softPreferences: [{ type: 'min_break', minutes: 30, evidence: 'At least 30 minutes' }] });
  } });
  assert.equal(Object.keys(second.answers).length, 2);
  assert.equal(second.data.softPreferences[0].type, 'min_break');
});

test('no fixed meeting flag cannot disguise missing times or overlap with timed meetings', () => {
  const data = structuredClone(output);
  delete data.courses[0].sections[0].asynchronous;
  assert.throws(() => validatePlan(data), /meeting times/);
  data.courses[0].sections[0].asynchronous = true;
  data.courses[0].sections[0].meetings = [{ day: 'Mon', start: '10:00', end: '11:00' }];
  assert.throws(() => validatePlan(data), /cannot also contain weekly meeting times/);
});
