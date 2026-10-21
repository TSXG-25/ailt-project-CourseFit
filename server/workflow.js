import { validatePlan } from './schema.js';
import { solveTimetable } from './solver.js';

export function generateResult(raw) {
  const data = validatePlan(raw, { allowIncomplete: true });
  const notes = [...data.clarifications];
  data.clarifications = [];
  const blockers = [];
  if (!data.courses.length) blockers.push('No course data was supplied. Add your courses and available meeting times.');
  const semesters = new Set(data.courses.flatMap(course => course.sections.map(section => section.semester).filter(Boolean)));
  if (semesters.size > 1) blockers.push('The current options span both semesters. Specify the semester in an adjustment below.');
  for (const course of data.courses) {
    if (!course.sections.length) blockers.push(`${course.id} has no available sections in the selected data. Supply sections or ask to leave this course out.`);
    else {
      const missing = course.sections.filter(section => !section.asynchronous && !section.meetings.length);
      if (missing.length) blockers.push(`${course.id}: missing meeting times for ${missing.map(section => section.id).join(', ')}. Supply the times or ask to leave these options out.`);
    }
  }
  // Missing factual data is distinct from mathematical infeasibility. Do not
  // invent a class or silently omit a selected course just to produce a grid.
  const result = blockers.length ? {
    status: 'needs_data', blockers, solutions: [], totalFeasible: 0,
    totalPreferences: data.softPreferences.length, searchComplete: true,
    message: 'Some course details are missing. Add an adjustment below to continue.',
  } : { status: 'solved', ...solveTimetable(data) };
  return { data, notes, result };
}
