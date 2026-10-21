export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const RULE_TYPES = ['earliest_start', 'latest_end', 'day_off', 'blocked_time', 'max_gap', 'min_break', 'max_days', 'any_of', 'all_of'];

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InputError';
    this.status = status;
  }
}

function requireThat(condition, message) {
  if (!condition) throw new InputError(message);
}

function text(value, name, max = 120) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${name} must be 1–${max} characters.`);
  return value.trim();
}

function list(value, name, min, max = Infinity) {
  requireThat(Array.isArray(value) && value.length >= min && value.length <= max, Number.isFinite(max) ? `${name} must contain ${min}–${max} items.` : `${name} must contain at least ${min} items.`);
  return value;
}

export function toMinutes(value) {
  requireThat(typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value), 'Use a valid 24-hour time, such as 10:30.');
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function day(value) {
  requireThat(DAYS.includes(value), 'Day must be Mon, Tue, Wed, Thu, Fri, Sat or Sun.');
  return value;
}

function meeting(raw) {
  requireThat(raw && typeof raw === 'object', 'Each meeting needs a day, start and end.');
  const result = { day: day(raw.day), start: raw.start, end: raw.end };
  requireThat(toMinutes(result.start) < toMinutes(result.end), 'A meeting must end after it starts, on the same day.');
  return result;
}

function unique(values, name) {
  requireThat(new Set(values.map(value => value.toLowerCase())).size === values.length, `${name} must be unique (case-insensitive).`);
}

function evidence(raw) {
  return typeof raw.evidence === 'string' && raw.evidence.length <= 1500 ? { evidence: raw.evidence } : {};
}

export function validateRule(raw, depth = 0) {
  requireThat(raw && RULE_TYPES.includes(raw.type), 'Unsupported preference. Choose a supported rule type.');
  const result = { type: raw.type, ...evidence(raw) };
  if (['earliest_start', 'latest_end'].includes(raw.type)) {
    toMinutes(raw.time);
    result.time = raw.time;
  } else if (raw.type === 'day_off') {
    result.day = day(raw.day);
  } else if (raw.type === 'blocked_time') {
    Object.assign(result, meeting(raw));
  } else if (raw.type === 'max_gap' || raw.type === 'min_break') {
    requireThat(Number.isInteger(raw.minutes) && raw.minutes >= 0 && raw.minutes <= 1439, 'Gap or break duration must be 0–1439 whole minutes.');
    result.minutes = raw.minutes;
  } else if (raw.type === 'max_days') {
    requireThat(Number.isInteger(raw.days) && raw.days >= 1 && raw.days <= 7, 'Maximum class days must be 1–7.');
    result.days = raw.days;
  } else {
    requireThat(depth < 2, 'Compound preferences can be at most three levels deep.');
    result.rules = list(raw.rules, 'Compound preference', 2, 5).map(rule => validateRule(rule, depth + 1));
  }
  return result;
}

export function validatePlan(raw, { allowIncomplete = false } = {}) {
  requireThat(raw && typeof raw === 'object', 'A structured timetable is required.');
  const courses = list(raw.courses, 'Courses', allowIncomplete ? 0 : 1).map((course, i) => {
    requireThat(course && typeof course === 'object', 'Each course needs a code, name and sections.');
    const id = text(course.id, `Course ${i + 1} code`, 32);
    const sections = list(course.sections, `${id} sections`, allowIncomplete ? 0 : 1).map(section => {
      requireThat(section && typeof section === 'object', `${id} needs valid section objects.`);
      requireThat(section.semester === undefined || section.semester === 1 || section.semester === 2, 'Semester must be 1 or 2 when provided.');
      requireThat(section.asynchronous === undefined || typeof section.asynchronous === 'boolean', 'No fixed meeting must be an explicit true or false value.');
      const supplied = list(section.meetings, `${id} meeting times`, 0);
      // University catalogue placeholders are online classes, including rows
      // without a weekday. They never occupy an eight-hour calendar slot.
      const isOnline = slot => /^0{1,2}:00$/.test(slot?.start) && /^0?8:(?:00|20)$/.test(slot?.end);
      const placeholder = supplied.some(isOnline) || (!supplied.length && /\b0{1,2}:00\s*[-–—−]\s*0?8:(?:00|20)\b/.test(section.evidence || ''));
      const meetings = supplied.filter(slot => !isOnline(slot)).map(meeting);
      const asynchronous = section.asynchronous === true || (placeholder && meetings.length === 0);
      requireThat(!asynchronous || meetings.length === 0, 'A section marked as having no fixed meetings cannot also contain weekly meeting times.');
      requireThat(allowIncomplete || asynchronous || meetings.length > 0, `${id} meeting times must contain at least 1 items.`);
      return {
        id: text(section.id, `${id} section code`, 32),
        meetings,
        ...evidence(section),
        ...(section.semester === undefined ? {} : { semester: section.semester }),
        ...(asynchronous ? { asynchronous: true } : {}),
      };
    });
    unique(sections.map(section => section.id), `${id} section codes`);
    return { id, name: text(course.name, `${id} name`), sections, ...evidence(course) };
  });
  unique(courses.map(course => course.id), 'Course codes');
  if (!allowIncomplete) {
    const semesters = new Set(courses.flatMap(course => course.sections.map(section => section.semester).filter(Boolean)));
    requireThat(semesters.size <= 1, 'Keep sections from only one semester.');
  }
  const hardConstraints = list(raw.hardConstraints, 'Hard constraints', 0, 20).map(rule => validateRule(rule));
  const softPreferences = list(raw.softPreferences, 'Soft preferences', 0, 20).map(rule => validateRule(rule));
  const clarifications = list(raw.clarifications, 'Clarifications', 0, 50).map(item => text(item, 'Clarification', 3000));
  requireThat(new Set(clarifications).size === clarifications.length, 'Clarification questions must be unique.');
  if (!allowIncomplete) requireThat(clarifications.length === 0, 'Resolve every clarification before solving.');
  return { courses, hardConstraints, softPreferences, clarifications };
}

export function describeRule(rule) {
  switch (rule.type) {
    case 'earliest_start': return `No classes before ${rule.time}`;
    case 'latest_end': return `Finish classes by ${rule.time}`;
    case 'day_off': return `${rule.day} free`;
    case 'blocked_time': return `Keep ${rule.day} ${rule.start}–${rule.end} free`;
    case 'max_gap': return `Gaps of at most ${rule.minutes} minutes`;
    case 'min_break': return `At least ${rule.minutes} minutes between classes`;
    case 'max_days': return `Classes on at most ${rule.days} days`;
    case 'any_of': return `Either: ${rule.rules.map(describeRule).join(' OR ')}`;
    case 'all_of': return `Together: ${rule.rules.map(describeRule).join(' AND ')}`;
    default: throw new InputError('Unsupported preference.');
  }
}
