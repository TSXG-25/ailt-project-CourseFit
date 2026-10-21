import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../server/parser.js';

const input = 'COMP2119 A Mon 10:00–12:00';
const raw = {
  courses: [{ id: 'COMP2119', name: 'COMP2119', evidence: 'COMP2119', sections: [{ id: 'A', evidence: 'A Mon 10:00-12:00', meetings: [{ day: 'Mon', start: '10:00', end: '12:00' }] }] }],
  hardConstraints: [], softPreferences: [], clarifications: [],
};
const fetchImpl = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] }));

test('format-only source quote differences do not reject a valid extraction', async () => {
  const plan = await parseInput(input, { apiKey: 'test-only' }, { fetchImpl });
  assert.equal(plan.courses[0].sections[0].evidence, 'A Mon 10:00–12:00');
  assert.deepEqual(plan.courses[0].sections[0].meetings, raw.courses[0].sections[0].meetings);
});

test('whitespace, full-width punctuation and quote typography re-anchor to original text', async () => {
  const original = 'COMP2119\r\n  A: Mon １０：００ – １２：００\nI’d prefer Friday off.';
  const output = structuredClone(raw);
  output.courses[0].sections[0].evidence = 'A: Mon 10:00-12:00';
  output.softPreferences = [{ type: 'day_off', day: 'Fri', evidence: "I'd prefer Friday off." }];
  const calls = [];
  const plan = await parseInput(original, { apiKey: 'test-only' }, { fetchImpl: async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }));
  } });
  assert.equal(calls.length, 1, 'format-only differences do not need another paid model request');
  assert.equal(plan.courses[0].sections[0].evidence, 'A: Mon １０：００ – １２：００');
  assert.equal(plan.softPreferences[0].evidence, 'I’d prefer Friday off.');
  assert.deepEqual(plan.courses[0].sections[0].meetings, raw.courses[0].sections[0].meetings);
});

test('one schema correction attempt can recover a noncanonical model day', async () => {
  const invalid = structuredClone(raw);
  invalid.courses[0].sections[0].meetings[0].day = 'Monday';
  const corrected = structuredClone(raw);
  corrected.courses[0].sections[0].evidence = 'A Mon 10:00–12:00';
  let calls = 0;
  const plan = await parseInput(input, { apiKey: 'test-only' }, { fetchImpl: async (_url, options) => {
    calls++;
    const messages = JSON.parse(options.body).messages;
    if (calls === 2) {
      assert.equal(messages[1].content, input, 'the original input remains available');
      assert.match(messages.at(-1).content, /Day must be Mon/);
      assert.match(messages.at(-1).content, /Do not invent/);
    }
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(calls === 1 ? invalid : corrected) } }] }));
  } });
  assert.equal(calls, 2);
  assert.equal(plan.courses[0].sections[0].meetings[0].day, 'Mon');
});

test('missing source quotes get one correction attempt, never a silent bypass', async () => {
  const missing = structuredClone(raw);
  delete missing.courses[0].sections[0].evidence;
  const corrected = structuredClone(raw);
  corrected.courses[0].sections[0].evidence = 'A Mon 10:00–12:00';
  let calls = 0;
  const plan = await parseInput(input, { apiKey: 'test-only' }, { fetchImpl: async () => {
    calls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(calls === 1 ? missing : corrected) } }] }));
  } });
  assert.equal(calls, 2);
  assert.equal(plan.courses[0].sections[0].evidence, corrected.courses[0].sections[0].evidence);
});

test('a genuinely different time in source evidence is rejected after at most two calls', async () => {
  const invented = structuredClone(raw);
  invented.courses[0].sections[0].evidence = 'A Mon 10:00–13:00';
  let calls = 0;
  await assert.rejects(parseInput(input, { apiKey: 'test-only' }, { fetchImpl: async () => {
    calls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(invented) } }] }));
  } }), /source.quote.*courses\[0\].sections\[0\]/i);
  assert.equal(calls, 2);
});

test('meaning-changing paraphrases and reordered evidence are not formatting matches', async () => {
  const original = `${input}\nI cannot attend Friday.`;
  for (const quote of ['I can attend Friday.', 'Friday. I cannot attend']) {
    const invented = structuredClone(raw);
    invented.softPreferences = [{ type: 'day_off', day: 'Fri', evidence: quote }];
    await assert.rejects(parseInput(original, { apiKey: 'test-only' }, { fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(invented) } }] })) }), /source.quote/i);
  }
});
