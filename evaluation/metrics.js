// Compare semantic fields, ignoring evidence wording, clarification wording,
// object key order and order within unordered course/rule/meeting arrays.
function normalizeRule(rule) {
  const { evidence, ...fields } = rule;
  if (fields.rules) fields.rules = fields.rules.map(normalizeRule).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
}
function fieldsFor(plan) {
  const fields = new Map();
  for (const course of plan.courses) {
    fields.set(`course/${course.id}/id`, course.id);
    fields.set(`course/${course.id}/name`, course.name);
    for (const section of course.sections) {
      const prefix = `course/${course.id}/section/${section.id}`;
      fields.set(`${prefix}/id`, section.id);
      const meetings = [...section.meetings].sort((a, b) => `${a.day}/${a.start}/${a.end}`.localeCompare(`${b.day}/${b.start}/${b.end}`));
      meetings.forEach((meeting, i) => {
        for (const property of ['day', 'start', 'end']) fields.set(`${prefix}/meeting/${i}/${property}`, meeting[property]);
      });
    }
  }
  for (const group of ['hardConstraints', 'softPreferences']) {
    const rules = plan[group].map(normalizeRule).map(rule => JSON.stringify(rule)).sort();
    // Each semantic rule (including its parameters and grouping) is one field.
    rules.forEach((rule, i) => fields.set(`${group}/${i}`, rule));
  }
  return fields;
}

export function compareParsing(actual, expected, ambiguous = false) {
  const a = fieldsFor(actual), b = fieldsFor(expected);
  const keys = new Set([...a.keys(), ...b.keys()]);
  const correctFields = [...keys].filter(key => a.has(key) && b.has(key) && a.get(key) === b.get(key)).length;
  const hard = plan => plan.hardConstraints.map(normalizeRule).map(rule => JSON.stringify(rule)).sort();
  return {
    correctFields, totalFields: keys.size,
    hardCorrect: JSON.stringify(hard(actual)) === JSON.stringify(hard(expected)),
    ambiguityDetected: ambiguous ? actual.clarifications.length > 0 : null,
    unexpectedClarification: !ambiguous && actual.clarifications.length > 0,
  };
}
