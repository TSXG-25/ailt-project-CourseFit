import { describeRule, toMinutes, validatePlan } from './schema.js';
import { validateSchedule } from './validator.js';

const overlaps = (a, b) => a.day === b.day && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

export function satisfies(meetings, rule) {
  switch (rule.type) {
    case 'earliest_start': return meetings.every(m => toMinutes(m.start) >= toMinutes(rule.time));
    case 'latest_end': return meetings.every(m => toMinutes(m.end) <= toMinutes(rule.time));
    case 'day_off': return meetings.every(m => m.day !== rule.day);
    case 'blocked_time': return meetings.every(m => !overlaps(m, rule));
    case 'max_days': return new Set(meetings.map(m => m.day)).size <= rule.days;
    case 'max_gap':
    case 'min_break': {
      const byDay = new Map();
      for (const m of meetings) {
        if (!byDay.has(m.day)) byDay.set(m.day, []);
        byDay.get(m.day).push(m);
      }
      return [...byDay.values()].every(slots => {
        slots.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        return slots.every((m, i) => {
          if (i === 0) return true;
          const gap = toMinutes(m.start) - toMinutes(slots[i - 1].end);
          return rule.type === 'max_gap' ? gap <= rule.minutes : gap >= rule.minutes;
        });
      });
    }
    case 'any_of': return rule.rules.some(child => satisfies(meetings, child));
    case 'all_of': return rule.rules.every(child => satisfies(meetings, child));
    default: return false;
  }
}

// max_gap can become satisfied when a later course fills a gap. It must never
// prune an incomplete assignment, including when nested in a compound rule.
function canStillSatisfy(meetings, rule) {
  if (rule.type === 'max_gap') return true;
  if (rule.type === 'any_of') return rule.rules.some(child => canStillSatisfy(meetings, child));
  if (rule.type === 'all_of') return rule.rules.every(child => canStillSatisfy(meetings, child));
  return satisfies(meetings, rule);
}

function internallyCompatible(section) {
  return section.meetings.every((m, i) => section.meetings.slice(i + 1).every(other => !overlaps(m, other)));
}

export function scheduleKey(selections) {
  return JSON.stringify([...selections].sort((a, b) => a.courseId.localeCompare(b.courseId)).map(s => [s.courseId, s.sectionId]));
}

export function solveTimetable(raw, { limit = 20, timeBudgetMs = 4000, now = () => performance.now() } = {}) {
  const plan = validatePlan(raw);
  const start = now();
  let searchComplete = true;
  const withinBudget = () => {
    if (now() - start >= timeBudgetMs) searchComplete = false;
    return searchComplete;
  };
  const stats = { visitedNodes: 0, prunedBranches: 0 };
  const solutions = [];
  let totalFeasible = 0;
  const scoreHistogram = {};
  const compatible = (section, meetings) => withinBudget() && internallyCompatible(section)
    && section.meetings.every(m => meetings.every(other => !overlaps(m, other)))
    && plan.hardConstraints.every(rule => canStillSatisfy([...meetings, ...section.meetings], rule));
  const domains = plan.courses.map(course => ({ course, sections: course.sections.filter(section => compatible(section, [])) }));
  const compare = (a, b) => b.score - a.score || a.id.localeCompare(b.id);

  function visit(remaining, chosen, meetings) {
    if (!withinBudget()) return;
    stats.visitedNodes++;
    if (remaining.length === 0) {
      if (!plan.hardConstraints.every(rule => satisfies(meetings, rule))) return;
      totalFeasible++;
      const preferences = plan.softPreferences.map(rule => ({ label: describeRule(rule), satisfied: satisfies(meetings, rule) }));
      const score = preferences.filter(p => p.satisfied).length;
      scoreHistogram[score] = (scoreHistogram[score] || 0) + 1;
      const selections = plan.courses.map(course => ({ courseId: course.id, sectionId: chosen.get(course.id).id }));
      const result = { id: scheduleKey(selections), selections, score, preferences };
      if (solutions.length < limit || compare(result, solutions[solutions.length - 1]) < 0) {
        // Insertion keeps only the best N schedules, while the search still
        // enumerates every feasible combination for exact counts and ranking.
        const position = solutions.findIndex(existing => compare(result, existing) < 0);
        if (position === -1) solutions.push(result);
        else solutions.splice(position, 0, result);
        if (solutions.length > limit) solutions.pop();
      }
      return;
    }
    // Minimum remaining values + forward checking.
    const sorted = [...remaining].sort((a, b) => a.sections.length - b.sections.length || a.course.id.localeCompare(b.course.id));
    const [next, ...rest] = sorted;
    for (const section of next.sections) {
      if (!withinBudget()) return;
      const nextMeetings = [...meetings, ...section.meetings];
      const reduced = rest.map(domain => ({ ...domain, sections: domain.sections.filter(option => compatible(option, nextMeetings)) }));
      if (reduced.some(domain => domain.sections.length === 0)) { stats.prunedBranches++; continue; }
      chosen.set(next.course.id, section);
      visit(reduced, chosen, nextMeetings);
      chosen.delete(next.course.id);
    }
  }

  if (domains.every(domain => domain.sections.length > 0)) visit(domains, new Map(), []);
  const enriched = solutions.map(solution => {
    const validation = validateSchedule(plan, solution.selections);
    if (!validation.valid) throw new Error(`Independent validation failed: ${validation.errors.join(' ')}`);
    const meetings = solution.selections.flatMap(selection => {
      const course = plan.courses.find(c => c.id === selection.courseId);
      const section = course.sections.find(s => s.id === selection.sectionId);
      return section.meetings.map(m => ({ ...m, courseId: course.id, courseName: course.name, sectionId: section.id }));
    });
    const satisfied = solution.preferences.filter(p => p.satisfied).map(p => p.label);
    const missed = solution.preferences.filter(p => !p.satisfied).map(p => p.label);
    const explanation = plan.softPreferences.length === 0
      ? 'This timetable satisfies every hard constraint. No soft preferences were added, so all feasible timetables are tied.'
      : `This timetable satisfies ${solution.score} of ${plan.softPreferences.length} preferences.${satisfied.length ? ` Met: ${satisfied.join('; ')}.` : ''}${missed.length ? ` Trade-offs: ${missed.join('; ')}.` : ' All your preferences fit.'}`;
    return { ...solution, meetings, explanation, validated: true, classDays: new Set(meetings.map(m => m.day)).size };
  });

  return {
    solutions: enriched, totalFeasible, searchComplete, scoreHistogram, totalPreferences: plan.softPreferences.length,
    stats: { ...stats, durationMs: Math.round((now() - start) * 10) / 10 },
    message: !searchComplete ? 'Search time reached. These are the best valid options found so far; other combinations may exist.' : totalFeasible ? null : 'No feasible schedule found. Your section options and hard constraints cannot all be satisfied. Describe an adjustment below to try again.',
  };
}
