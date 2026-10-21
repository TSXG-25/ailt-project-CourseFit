import test from 'node:test';
import assert from 'node:assert/strict';
import { solveTimetable } from '../server/solver.js';
import { validateSchedule, independentlySatisfies } from '../server/validator.js';
import { validatePlan } from '../server/schema.js';
import { SOLVER_CASES } from '../evaluation/solver-cases.js';
import { EXAMPLES } from '../server/examples.js';
import { exhaustiveReference } from '../evaluation/reference.js';

for (const fixture of SOLVER_CASES) {
  test(`CSP vs exhaustive reference: ${fixture.name}`, () => {
    const original = structuredClone(fixture.plan);
    const actual = solveTimetable(fixture.plan, { limit: 262144 });
    const expected = exhaustiveReference(fixture.plan);
    assert.equal(actual.totalFeasible, fixture.count);
    assert.deepEqual(actual.solutions.map(solution => ({ key: solution.id, score: solution.score })), expected);
    assert.deepEqual(fixture.plan, original, 'search must not mutate the confirmed data');
    for (const solution of actual.solutions) {
      assert.equal(validateSchedule(fixture.plan, solution.selections).valid, true);
      assert.equal(solution.validated, true);
      assert.equal(solution.score, fixture.plan.softPreferences.filter(rule => independentlySatisfies(solution.meetings, rule)).length);
      const selectedMeetings = solution.selections.flatMap(selection => {
        const course = fixture.plan.courses.find(c => c.id === selection.courseId);
        return course.sections.find(s => s.id === selection.sectionId).meetings.map(m => ({ ...m, courseId: course.id, courseName: course.name, sectionId: selection.sectionId }));
      });
      assert.deepEqual(solution.meetings, selectedMeetings, 'display data must exactly match the selected sections');
    }
  });
}

test('top N preserves exact feasible count and ranking', () => {
  const plan = EXAMPLES[0].data;
  const result = solveTimetable(plan, { limit: 2 });
  const reference = exhaustiveReference(plan);
  assert.equal(result.totalFeasible, reference.length);
  assert.deepEqual(result.solutions.map(s => ({ key: s.id, score: s.score })), reference.slice(0, 2));
});

test('seeded combinations agree with the exhaustive oracle', () => {
  let seed = 9019;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const time = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  for (let scenario = 0; scenario < 60; scenario++) {
    const courses = Array.from({ length: 3 }, (_, i) => ({ id: `C${i}`, name: `Course ${i}`, sections: Array.from({ length: 3 }, (_, j) => {
      const start = 480 + random(18) * 30;
      return { id: `S${j}`, meetings: [{ day: ['Mon', 'Tue', 'Wed'][random(3)], start: time(start), end: time(start + 30 + random(3) * 30) }] };
    }) }));
    const rules = [{ type: 'earliest_start', time: '10:00' }, { type: 'max_gap', minutes: 90 }, { type: 'max_days', days: 2 }, { type: 'day_off', day: 'Wed' }];
    const plan = { courses, hardConstraints: [rules[random(rules.length)]], softPreferences: [rules[random(rules.length)], rules[random(rules.length)]], clarifications: [] };
    const result = solveTimetable(plan, { limit: 100 });
    assert.deepEqual(result.solutions.map(s => ({ key: s.id, score: s.score })), exhaustiveReference(plan), `scenario ${scenario}`);
  }
});

test('reject malformed, duplicated and unresolved plans', () => {
  const plan = structuredClone(EXAMPLES[0].data);
  plan.courses[0].sections[0].meetings[0].start = '25:00';
  assert.throws(() => solveTimetable(plan), /24-hour time/);
  const oversized = structuredClone(EXAMPLES[0].data);
  oversized.courses.push(...structuredClone(oversized.courses));
  assert.throws(() => validatePlan(oversized), /Course codes must be unique/);
  assert.throws(() => solveTimetable(EXAMPLES[2].data), /Resolve every clarification/);
});

test('independent validator rejects invented and duplicate selections', () => {
  const plan = EXAMPLES[0].data;
  assert.equal(validateSchedule(plan, [{ courseId: 'FAKE', sectionId: 'A' }]).valid, false);
  assert.equal(validateSchedule(plan, Array.from({ length: 4 }, () => ({ courseId: 'COMP2119', sectionId: 'A' }))).valid, false);
});
