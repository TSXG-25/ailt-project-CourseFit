import test from 'node:test';
import assert from 'node:assert/strict';
import { modelJSON, parseInput } from '../server/parser.js';
import { PARSING_CASES } from '../evaluation/parsing-cases.js';
import { compareParsing } from '../evaluation/metrics.js';
import { validatePlan } from '../server/schema.js';

const settings = { apiKey: 'test-key-never-real', model: 'test-model' };
const envelope = (value, finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason, message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] }), { status: 200 });

test('all 22 evaluation gold representations are schema-valid and exact quotes', () => {
  assert.ok(PARSING_CASES.length >= 20);
  for (const fixture of PARSING_CASES) {
    validatePlan(fixture.expected, { allowIncomplete: true });
    const check = item => {
      assert.ok(fixture.input.includes(item.evidence), `${fixture.id} evidence: ${item.evidence}`);
      item.rules?.forEach(check);
    };
    fixture.expected.courses.forEach(course => { check(course); course.sections.forEach(check); });
    [...fixture.expected.hardConstraints, ...fixture.expected.softPreferences].forEach(check);
  }
});

test('mock provider verifies the parsing boundary, not real model accuracy', async () => {
  for (const fixture of PARSING_CASES) {
    const actual = await parseInput(fixture.input, settings, { fetchImpl: async () => envelope(fixture.expected) });
    const metrics = compareParsing(actual, fixture.expected, fixture.ambiguous);
    assert.equal(metrics.correctFields, metrics.totalFields, fixture.id);
    assert.equal(metrics.hardCorrect, true, fixture.id);
    if (fixture.ambiguous) assert.equal(actual.clarifications.length > 0, true, fixture.id);
  }
});

test('JSON request uses the documented DeepSeek endpoint, mode and system boundary', async () => {
  await parseInput(PARSING_CASES[0].input, settings, { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key-never-real');
    const body = JSON.parse(options.body);
    assert.equal(body.response_format.type, 'json_object'); assert.equal(body.model, 'test-model');
    assert.equal(body.thinking.type, 'disabled');
    assert.equal(body.messages[0].role, 'system'); assert.equal(body.messages[1].role, 'user');
    assert.equal(body.messages[1].content, PARSING_CASES[0].input);
    return envelope(PARSING_CASES[0].expected);
  } });
});

test('model source quotes cannot refer to material outside the input', async () => {
  const invented = structuredClone(PARSING_CASES[0].expected);
  invented.courses[0].sections[0].evidence = 'Invented course time not found in the request';
  await assert.rejects(parseInput(PARSING_CASES[0].input, settings, { fetchImpl: async () => envelope(invented) }), /source quote.*courses\[0\].sections\[0\]/);
});

test('truncated, empty and malformed model output fail safely', async () => {
  for (const [value, finish] of [['{}', 'length'], ['', 'stop'], ['not JSON', 'stop'], [{}, 'stop']]) {
    await assert.rejects(parseInput('COMP2119 A Mon 10:00-12:00', settings, { fetchImpl: async () => envelope(value, finish) }), /No timetable was updated/);
  }
});

test('missing data always creates a clarification', async () => {
  const actual = await parseInput('Need a timetable.', settings, { fetchImpl: async () => envelope({ courses: [], hardConstraints: [], softPreferences: [], clarifications: [] }) });
  assert.ok(actual.clarifications.length > 0);
});

test('missing key, invalid text, provider failures and timeout are actionable', async () => {
  await assert.rejects(parseInput('course', {}), /Connect DeepSeek/);
  await assert.rejects(parseInput(' ', settings), /1 and 100,000/);
  await assert.rejects(parseInput('x'.repeat(100001), settings), /1 and 100,000/);
  await assert.rejects(modelJSON([], settings, { fetchImpl: async () => new Response('secret-provider-error', { status: 401 }) }), error => /rejected this API key/.test(error.message) && !error.message.includes('secret'));
  await assert.rejects(modelJSON([], settings, { fetchImpl: async () => { throw new DOMException('secret', 'TimeoutError'); } }), /took too long/);
});

test('metrics penalize fabricated courses, wrong hard classification and missing ambiguity', () => {
  const expected = PARSING_CASES[2].expected;
  const wrong = structuredClone(expected);
  wrong.softPreferences = wrong.hardConstraints; wrong.hardConstraints = [];
  const metrics = compareParsing(wrong, expected);
  assert.ok(metrics.correctFields < metrics.totalFields); assert.equal(metrics.hardCorrect, false);
  const extra = structuredClone(expected); extra.courses.push({ ...extra.courses[0], id: 'FAKE' });
  const extraMetrics = compareParsing(extra, expected);
  assert.ok(extraMetrics.correctFields < extraMetrics.totalFields);
  assert.equal(compareParsing(wrong, expected, true).ambiguityDetected, false);
});
