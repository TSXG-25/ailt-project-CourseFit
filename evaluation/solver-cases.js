const m = (day, start, end) => ({ day, start, end });
const s = (id, ...meetings) => ({ id, meetings });
const c = (id, ...sections) => ({ id, name: id, sections });
const p = (courses, hardConstraints = [], softPreferences = []) => ({ courses, hardConstraints, softPreferences, clarifications: [] });

export const SOLVER_CASES = [
  { name: 'two feasible options ranked by Friday off', count: 2, plan: p([c('A', s('1', m('Mon', '10:00', '11:00')), s('2', m('Fri', '10:00', '11:00'))), c('B', s('1', m('Tue', '10:00', '11:00')))], [], [{ type: 'day_off', day: 'Fri' }]) },
  { name: 'unavoidable overlap returns no solution', count: 0, plan: p([c('A', s('1', m('Mon', '10:00', '12:00'))), c('B', s('1', m('Mon', '11:00', '13:00')))]) },
  { name: 'adjacent classes share an endpoint', count: 1, plan: p([c('A', s('1', m('Mon', '10:00', '12:00'))), c('B', s('1', m('Mon', '12:00', '13:00')))]) },
  { name: 'mutually inconsistent hard constraints', count: 0, plan: p([c('A', s('1', m('Tue', '10:00', '11:00')))], [{ type: 'earliest_start', time: '15:00' }, { type: 'latest_end', time: '09:00' }]) },
  { name: 'multi-meeting bundles cannot hide clashes', count: 1, plan: p([c('A', s('1', m('Mon', '10:00', '11:00'), m('Thu', '14:00', '15:00')), s('2', m('Tue', '10:00', '11:00'))), c('B', s('1', m('Thu', '14:30', '15:30')))]) },
  { name: 'hard earliest and latest boundaries are inclusive', count: 1, plan: p([c('A', s('1', m('Mon', '09:59', '12:00')), s('2', m('Mon', '10:00', '17:00')), s('3', m('Mon', '10:00', '17:01')))], [{ type: 'earliest_start', time: '10:00' }, { type: 'latest_end', time: '17:00' }]) },
  { name: 'blocked period permits an adjacent meeting', count: 1, plan: p([c('A', s('1', m('Tue', '11:00', '12:00')), s('2', m('Tue', '11:30', '12:30')))], [{ type: 'blocked_time', day: 'Tue', start: '12:00', end: '13:00' }]) },
  { name: 'maximum days eliminates a dispersed week', count: 1, plan: p([c('A', s('1', m('Mon', '10:00', '11:00'))), c('B', s('1', m('Mon', '12:00', '13:00')), s('2', m('Tue', '12:00', '13:00')))], [{ type: 'max_days', days: 1 }]) },
  { name: 'a later course fills a hard maximum gap', count: 1, plan: p([c('A', s('1', m('Mon', '09:00', '10:00'), m('Mon', '14:00', '15:00'))), c('B', s('1', m('Mon', '10:00', '14:00')))], [{ type: 'max_gap', minutes: 0 }]) },
  { name: 'equal-weight competing preferences', count: 2, plan: p([c('A', s('1', m('Fri', '14:00', '15:00')), s('2', m('Mon', '09:00', '10:00')))], [], [{ type: 'day_off', day: 'Fri' }, { type: 'earliest_start', time: '12:00' }]) },
  { name: 'weekend meetings and no soft preferences', count: 1, plan: p([c('A', s('1', m('Sun', '19:15', '21:45')))]) },
  { name: 'a section overlapping itself is invalid', count: 0, plan: p([c('A', s('1', m('Mon', '10:00', '12:00'), m('Mon', '11:00', '13:00')))]) },
  { name: 'conditional soft preference counts as one point', count: 2, plan: p([c('A', s('1', m('Mon', '09:00', '10:00'), m('Mon', '15:00', '16:00')), s('2', m('Fri', '09:00', '10:00'), m('Fri', '15:00', '16:00')))], [], [{ type: 'any_of', rules: [{ type: 'max_gap', minutes: 90 }, { type: 'day_off', day: 'Fri' }] }]) },
  { name: 'compound hard gap cannot prune too early', count: 1, plan: p([c('A', s('1', m('Mon', '09:00', '10:00'), m('Mon', '14:00', '15:00'))), c('B', s('1', m('Mon', '10:00', '14:00')))], [{ type: 'all_of', rules: [{ type: 'max_gap', minutes: 0 }, { type: 'day_off', day: 'Fri' }] }]) },
  { name: 'minimum break rejects short gaps and allows its exact boundary', count: 1, plan: p([c('A', s('1', m('Mon', '10:00', '11:00'))), c('B', s('1', m('Mon', '11:15', '12:00')), s('2', m('Mon', '11:30', '12:00')))], [{ type: 'min_break', minutes: 30 }]) },
  { name: 'a soft minimum break ranks separated classes first', count: 2, plan: p([c('A', s('1', m('Mon', '10:00', '11:00'))), c('B', s('1', m('Mon', '11:00', '12:00')), s('2', m('Mon', '12:00', '13:00')))], [], [{ type: 'min_break', minutes: 30 }]) },
  { name: 'an explicitly asynchronous course is selected without a calendar slot', count: 1, plan: p([c('A', { id: '1', asynchronous: true, meetings: [] }), c('B', s('1', m('Tue', '11:00', '12:00')))], [{ type: 'earliest_start', time: '10:00' }]) },
  { name: 'all asynchronous choices produce a valid zero-class-day week', count: 2, plan: p([c('A', { id: '1', asynchronous: true, meetings: [] }, { id: '2', asynchronous: true, meetings: [] })], [], [{ type: 'day_off', day: 'Fri' }]) },
];
