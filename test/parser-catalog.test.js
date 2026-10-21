import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../server/parser.js';
import { validatePlan } from '../server/schema.js';
import { DraftStore } from '../server/store.js';

// Synthetic catalogue with the same structural issues as a pasted university
// table. The user's actual timetable and preferences are not stored in the repo.
function catalogue() {
  const courses = Array.from({ length: 7 }, (_, index) => {
    const id = `COURSE${index + 1}`;
    const sections = Array.from({ length: index === 0 ? 16 : 1 }, (_, sectionIndex) => {
      const semester = sectionIndex < 8 ? 1 : 2;
      const sectionId = `${semester}${String.fromCharCode(65 + sectionIndex % 8)}`;
      return { id: sectionId, semester, meetings: [{ day: 'Mon', start: '10:00', end: '11:00' }], evidence: `${id} ${semester} ${sectionId} MON 10:00 - 11:00` };
    });
    return { id, name: id, evidence: id, sections };
  });
  return {
    input: courses.flatMap(course => course.sections.map(section => section.evidence)).join('\n'),
    raw: { courses, hardConstraints: [], softPreferences: [], clarifications: [] },
  };
}
const response = raw => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] }));

test('a missing semester section is asked once instead of duplicated by server checks', async () => {
  const raw = { courses: [{ id: 'COURSE1', name: 'COURSE1', evidence: 'COURSE1', sections: [] }], hardConstraints: [], softPreferences: [], clarifications: ['COURSE1 has no Semester 2 sections; should it be dropped?'] };
  const plan = await parseInput('COURSE1 has only Semester 1 sections.', { apiKey: 'test-only' }, { fetchImpl: async () => response(raw) });
  assert.equal(plan.clarifications.length, 1);
});

test('large catalogue preserves every course and section without count-limit questions', async () => {
  const { input, raw } = catalogue();
  const plan = await parseInput(input, { apiKey: 'test-only' }, { fetchImpl: async () => response(raw) });
  assert.equal(plan.courses.length, 7);
  assert.equal(plan.courses[0].sections.length, 16);
  assert.equal(plan.courses[0].sections.at(-1).semester, 2);
  assert.equal(plan.clarifications.length, 1);
  assert.match(plan.clarifications[0], /semester/i);
  assert.equal(plan.clarifications.some(question => /at most [68]|limit/i.test(question)), false);
});

test('filtering and resolving an oversized draft still passes the strict confirmation gate', async () => {
  const { input, raw } = catalogue();
  const plan = await parseInput(input, { apiKey: 'test-only' }, { fetchImpl: async () => response(raw) });
  const store = new DraftStore();
  const draft = store.create(plan, input, 'deepseek');
  const data = structuredClone(plan);
  data.courses = data.courses.slice(0, 6).map(course => ({ ...course, sections: course.sections.filter(section => section.semester === 1) }));
  data.clarifications = [];
  assert.throws(() => store.confirm({ draftId: draft.id, data, acknowledged: true }), /Answer every clarification/);
  const resolutions = Object.fromEntries(plan.clarifications.map(question => [question, 'I selected Semester 1 and removed the extra example course.']));
  const result = store.confirm({ draftId: draft.id, data, resolutions, acknowledged: true });
  assert.equal(result.data.courses.length, 6);
  assert.equal(result.data.courses[0].sections.length, 8);
});

test('a confirmed timetable cannot silently combine semesters', () => {
  const { raw } = catalogue();
  const data = { ...raw, courses: [{ ...raw.courses[0], sections: [raw.courses[0].sections[0], raw.courses[0].sections[8]] }] };
  assert.throws(() => validatePlan(data), /only one semester/);
});

test('a midnight online placeholder needs neither a weekday nor a clarification', async () => {
  const raw = { courses: [{ id: 'COURSE1', name: 'COURSE1', evidence: 'COURSE1', sections: [{ id: '1A', semester: 1, evidence: '1A 00:00 - 08:20', meetings: [] }] }], hardConstraints: [], softPreferences: [], clarifications: [] };
  const plan = await parseInput('COURSE1\n1A 00:00 - 08:20', { apiKey: 'test-only' }, { fetchImpl: async () => response(raw) });
  assert.equal(plan.courses[0].sections[0].meetings.length, 0);
  assert.deepEqual(plan.clarifications, []);
  assert.equal(plan.courses[0].sections[0].asynchronous, true);
  assert.equal(validatePlan(plan).courses[0].sections[0].asynchronous, true);
});
