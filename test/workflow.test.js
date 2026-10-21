import test from 'node:test';
import assert from 'node:assert/strict';
import { batchQuestions, refineInput } from '../server/parser.js';
import { validatePlan } from '../server/schema.js';
import { generateResult } from '../server/workflow.js';
import { solveTimetable } from '../server/solver.js';

const course = (id, sections = [{ id: 'A', asynchronous: true, meetings: [] }]) => ({ id, name: id, sections });
const plan = courses => ({ courses, hardConstraints: [], softPreferences: [], clarifications: [] });

test('course and section counts have no old product caps, in validation and solving', () => {
  const data = plan(Array.from({ length: 20 }, (_, i) => course(`C${i}`)));
  data.courses[0].sections = Array.from({ length: 60 }, (_, i) => ({ id: `S${i}`, asynchronous: true, meetings: [] }));
  assert.equal(validatePlan(data).courses[0].sections.length, 60);
  const result = solveTimetable(data);
  assert.equal(result.searchComplete, true);
  assert.equal(result.totalFeasible, 60);
  assert.equal(result.solutions[0].selections.length, 20);
  assert.equal(result.solutions[0].meetings.length, 0);
});

test('online placeholders with and without days are automatic, while real meetings stay scheduled', () => {
  for (const end of ['08:00', '08:20']) {
    const data = plan([course('ONLINE', [{ id: 'A', meetings: [{ start: '00:00', end }] }])]);
    const generated = generateResult(data);
    assert.equal(generated.result.totalFeasible, 1);
    assert.equal(generated.data.courses[0].sections[0].asynchronous, true);
    assert.deepEqual(generated.result.solutions[0].meetings, []);
  }
  const mixed = plan([course('MIXED', [{ id: 'A', meetings: [{ start: '0:00', end: '8:00' }, { day: 'Tue', start: '10:00', end: '11:00' }] }])]);
  assert.equal(generateResult(mixed).result.solutions[0].meetings.length, 1);
});

test('question grouping is bounded without dropping any issue', () => {
  const original = Array.from({ length: 17 }, (_, i) => `Issue ${i}: supply the missing information.`);
  const grouped = batchQuestions([...original, original[0]]);
  assert.equal(grouped.length, 5);
  for (const question of original) assert.ok(grouped.some(group => group.includes(question)));
  assert.deepEqual(batchQuestions([]), []);
});

test('a final pass returns a result and notes instead of launching a second question batch', () => {
  const data = { ...plan([course('ONLINE')]), clarifications: ['Break duration was not specified; no minimum-break rule was applied.'] };
  const generated = generateResult(data);
  assert.equal(generated.result.totalFeasible, 1);
  assert.deepEqual(generated.data.clarifications, []);
  assert.deepEqual(generated.notes, data.clarifications);
});

test('missing course facts are reported distinctly and never silently dropped or invented', () => {
  const data = plan([course('KNOWN'), course('MISSING', [])]);
  const generated = generateResult(data);
  assert.equal(generated.result.status, 'needs_data');
  assert.match(generated.result.blockers[0], /MISSING/);
  assert.equal(generated.data.courses.length, 2);
  assert.deepEqual(generated.result.solutions, []);
  assert.deepEqual(generated.data.clarifications, []);
});

test('large searches report a partial count instead of claiming exact ranking or infeasibility', () => {
  const data = plan(Array.from({ length: 8 }, (_, i) => course(`C${i}`, Array.from({ length: 10 }, (_, j) => ({ id: `S${j}`, asynchronous: true, meetings: [] })))));
  let tick = 0;
  const result = solveTimetable(data, { timeBudgetMs: 2000, now: () => tick++ });
  assert.equal(result.searchComplete, false);
  assert.ok(result.totalFeasible > 0 && result.totalFeasible < 100_000_000);
  assert.ok(result.solutions.every(option => option.validated));
  assert.match(result.message, /other combinations may exist/);
  const empty = solveTimetable(data, { timeBudgetMs: 0 });
  assert.equal(empty.searchComplete, false);
  assert.equal(empty.totalFeasible, 0);
  assert.doesNotMatch(empty.message, /No feasible schedule/);
});

test('refinement replaces prior restrictions, preserves current courses and records the adjustment', async () => {
  const data = plan([course('C1', [{ id: 'A', evidence: 'C1 A Mon 09:00–10:00', meetings: [{ day: 'Mon', start: '09:00', end: '10:00' }] }])]);
  data.courses[0].evidence = 'C1';
  data.hardConstraints = [{ type: 'earliest_start', time: '10:00', evidence: 'No classes before 10:00' }];
  const draft = { data, originalInput: 'C1 A Mon 09:00–10:00. No classes before 10:00.', adjustments: ['Keep Friday free if possible.'] };
  const changed = structuredClone(data);
  changed.hardConstraints = [{ type: 'earliest_start', time: '09:00', evidence: 'Allow 09:00 classes' }];
  let calls = 0;
  const updated = await refineInput(draft, 'Allow 09:00 classes', { apiKey: 'fake-test-only' }, { fetchImpl: async (_url, options) => {
    calls++;
    const messages = JSON.parse(options.body).messages;
    assert.match(messages[0].content, /Do not start another question round/);
    assert.match(messages[1].content, /CURRENT PLAN \(authoritative/);
    assert.match(messages[1].content, /Remove or replace superseded rules/);
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(changed) } }] }));
  } });
  assert.equal(calls, 1);
  assert.equal(updated.data.hardConstraints[0].time, '09:00');
  assert.deepEqual(updated.adjustments, ['Keep Friday free if possible.', 'Allow 09:00 classes']);
  assert.equal(generateResult(updated.data).result.totalFeasible, 1);
  assert.equal(draft.data.hardConstraints[0].time, '10:00');
});
