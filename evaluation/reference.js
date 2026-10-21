// Independent exhaustive Cartesian-product oracle. This module never imports the CSP
// solver, its pruning predicates or its scoring function.
import { independentlySatisfies } from '../server/validator.js';
const minutes = time => time.split(':').reduce((hour, minute) => hour * 60 + Number(minute), 0);

export function exhaustiveReference(plan) {
  let combinations = [[]];
  for (const course of plan.courses) combinations = combinations.flatMap(partial => course.sections.map(section => [...partial, { course, section }]));
  const valid = [];
  for (const combination of combinations) {
    const meetings = combination.flatMap(({ section }) => section.meetings);
    let clash = false;
    for (let i = 0; i < meetings.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = meetings[i], b = meetings[j];
        if (a.day === b.day && Math.max(minutes(a.start), minutes(b.start)) < Math.min(minutes(a.end), minutes(b.end))) clash = true;
      }
    }
    if (clash || !plan.hardConstraints.every(rule => independentlySatisfies(meetings, rule))) continue;
    const key = JSON.stringify(combination.map(({ course, section }) => [course.id, section.id]).sort(([a], [b]) => a.localeCompare(b)));
    valid.push({ key, score: plan.softPreferences.filter(rule => independentlySatisfies(meetings, rule)).length });
  }
  return valid.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}
