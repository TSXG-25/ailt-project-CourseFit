// Kept independent of the search and ranking modules: a sweep-line overlap
// check and separate rule evaluator form the final boundary before display.
import { DAYS } from './schema.js';

const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export function independentlySatisfies(meetings, rule) {
  if (rule.type === 'earliest_start') return meetings.every(m => minute(m.start) >= minute(rule.time));
  if (rule.type === 'latest_end') return meetings.every(m => minute(m.end) <= minute(rule.time));
  if (rule.type === 'day_off') return !meetings.some(m => m.day === rule.day);
  if (rule.type === 'blocked_time') {
    return !meetings.some(m => m.day === rule.day && minute(m.start) < minute(rule.end) && minute(rule.start) < minute(m.end));
  }
  if (rule.type === 'max_days') return new Set(meetings.map(m => m.day)).size <= rule.days;
  if (rule.type === 'max_gap' || rule.type === 'min_break') {
    for (const day of DAYS) {
      const slots = meetings.filter(m => m.day === day).sort((a, b) => minute(a.start) - minute(b.start));
      for (let i = 1; i < slots.length; i++) {
        const gap = minute(slots[i].start) - minute(slots[i - 1].end);
        if (rule.type === 'max_gap' ? gap > rule.minutes : gap < rule.minutes) return false;
      }
    }
    return true;
  }
  if (rule.type === 'any_of') return rule.rules.some(child => independentlySatisfies(meetings, child));
  if (rule.type === 'all_of') return rule.rules.every(child => independentlySatisfies(meetings, child));
  return false;
}

export function validateSchedule(plan, selections) {
  const errors = [];
  if (selections.length !== plan.courses.length) errors.push('Select exactly one section per course.');
  const selectedIds = new Set();
  const meetings = [];
  for (const selection of selections) {
    const course = plan.courses.find(c => c.id === selection.courseId);
    const section = course?.sections.find(s => s.id === selection.sectionId);
    if (!section || selectedIds.has(selection.courseId)) {
      errors.push(`Invalid or duplicate section for ${selection.courseId}.`);
      continue;
    }
    selectedIds.add(selection.courseId);
    meetings.push(...section.meetings);
  }
  for (const day of DAYS) {
    // Endpoints at the same minute process departures first; adjacent classes are valid.
    const events = meetings.filter(m => m.day === day).flatMap(m => [[minute(m.start), 1], [minute(m.end), -1]]);
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let active = 0;
    for (const [, delta] of events) {
      active += delta;
      if (active > 1) { errors.push(`Overlapping meetings on ${day}.`); break; }
    }
  }
  plan.hardConstraints.forEach((rule, i) => {
    if (!independentlySatisfies(meetings, rule)) errors.push(`Hard constraint ${i + 1} is not satisfied.`);
  });
  return { valid: errors.length === 0, errors };
}
