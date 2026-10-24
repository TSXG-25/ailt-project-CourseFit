const $ = selector => document.querySelector(selector);
const e = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COLORS = [
  ['#e7edff', '#425daa', '#7995ed'], ['#f0eafb', '#75549c', '#b199d5'],
  ['#e3f3ec', '#326f57', '#74b89a'], ['#fff0db', '#8c6228', '#dcaf66'],
  ['#fce8ef', '#9b4966', '#dc94ad'], ['#e4f2f8', '#356a80', '#80b6ce'],
];
const ICONS = {
  settings: '<path d="m9 3 .5 2a7 7 0 0 1 5 0L15 3l3 2-1 2a7 7 0 0 1 2.5 4l2 .5v3l-2 .5a7 7 0 0 1-2.5 4l1 2-3 2-.5-2a7 7 0 0 1-5 0L9 23l-3-2 1-2a7 7 0 0 1-2.5-4l-2-.5v-3l2-.5A7 7 0 0 1 7 7L6 5z" transform="translate(0 -1) scale(.96)"/><circle cx="12" cy="12" r="3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  back: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  leaf: '<path d="M19 4c-9-2-16 3-14 10 2 6 10 5 12 0 1-3 1-6 2-10Z"/><path d="M4 21 15 9m-7 8-1-5m4 1h5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
  remove: '<path d="m7 7 10 10M7 17 17 7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  minus: '<path d="M5 12h14"/>',
  print: '<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.calendar}</svg>`;
const colorStyle = index => { const [bg, ink, border] = COLORS[index % COLORS.length]; return `--course-bg:${bg};--course-ink:${ink};--course-border:${border}`; };
const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const state = { step: 0, input: '', examples: [], config: { configured: false }, draft: null, plan: null, resolutions: {}, adjustment: '', confirmationId: null, result: null, selected: 0, busy: false, explanations: {}, explaining: null };
const FONT_SCALES = { small: 0.9, medium: 1, large: 1.15, xlarge: 1.3 };
const FONT_KEYS = ['small', 'medium', 'large', 'xlarge'];
const FONT_LABELS = { small: 'Small', medium: 'Medium', large: 'Large', xlarge: 'Extra large' };
const FONT_KEY_DEFAULT = 'medium';
const FONT_STORAGE_KEY = 'coursefit.fontSize';
const FONT_STORAGE_KEY_LEGACY = 'coursefit.fontScale';
const FONT_GROUPS = ['button', 'title', 'other'];
function readFontSettings() {
  try { return JSON.parse(localStorage.getItem(FONT_STORAGE_KEY)) || {}; } catch { return {}; }
}
function applyFontSize(group, key) {
  const scale = FONT_SCALES[key] ?? FONT_SCALES[FONT_KEY_DEFAULT];
  document.documentElement.style.setProperty(`--font-scale-${group}`, String(scale));
}
function applyAllFontSizes() {
  const saved = readFontSettings();
  for (const group of FONT_GROUPS) applyFontSize(group, saved[group] ?? FONT_KEY_DEFAULT);
}
function migrateLegacyFontSize() {
  const legacy = localStorage.getItem(FONT_STORAGE_KEY_LEGACY);
  if (!legacy || localStorage.getItem(FONT_STORAGE_KEY)) return;
  const key = FONT_KEYS.includes(legacy) ? legacy : FONT_KEY_DEFAULT;
  const settings = {};
  for (const group of FONT_GROUPS) settings[group] = key;
  localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(settings));
}
function fontIndex(key) { const index = FONT_KEYS.indexOf(key); return index < 0 ? FONT_KEYS.indexOf(FONT_KEY_DEFAULT) : index; }
function fontKeyAt(value) { return FONT_KEYS[Number(value)] ?? FONT_KEY_DEFAULT; }
function updateFontSizeLabel(input) {
  input.setAttribute('aria-valuetext', FONT_LABELS[fontKeyAt(input.value)]);
}

async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new Error('Cannot reach the local CourseFit server. Check that npm start is still running, then try again.'); }
  const output = await response.json();
  if (!response.ok) throw new Error(output.error || 'The request could not be completed.');
  return output;
}

function announce(message) { $('#status').textContent = message; }
function clearError() { $('#main-message').hidden = true; $('#main-message').textContent = ''; }
function showError(error) {
  const target = $('#main-message');
  target.textContent = error.message || String(error);
  target.hidden = false;
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
}
function focusHeading() { $('#page-title')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
function updateConnection() {
  const dot = $('#connection-dot');
  dot.classList.toggle('connected', state.config.configured);
  dot.setAttribute('aria-label', state.config.configured ? 'DeepSeek configured' : 'DeepSeek not configured');
  const modelLabel = $('#model-label');
  modelLabel.textContent = state.config.configured ? state.config.model : 'Model';
  $('#open-model').setAttribute('aria-label', state.config.configured ? `Model, DeepSeek configured (${state.config.model})` : 'Model, connect DeepSeek');
}
function renderSteps() {
  const titles = ['Your courses', 'A few details', 'Your timetable'];
  const hints = ['Paste your courses & preferences', 'One quick round, if needed', 'Compare & fine-tune'];
  $('#steps').innerHTML = titles.map((title, i) => `<button type="button" class="step ${i === state.step ? 'active' : ''} ${i < state.step ? 'complete' : ''}" data-action="step" data-index="${i}" ${i === state.step ? 'aria-current="step"' : ''} ${state.busy || (i === 1 && (!state.draft || state.draft.questionRound === 1)) || (i === 2 && !state.result) ? 'disabled' : ''}><span class="step-number">${i < state.step ? icon('check') : i + 1}</span><span><span class="step-title">${title}</span><span class="step-hint">${hints[i]}</span></span></button>`).join('');
}
function heading(title, subtitle, meta = '') {
  return `<div class="page-heading"><div><h1 id="page-title" tabindex="-1">${title}</h1><p>${subtitle}</p></div>${meta}</div>`;
}

function editableDraftText(draft) {
  const answers = Object.entries(draft.answers || {});
  return `${draft.originalInput || draft.input}${answers.length ? `\n\nMy clarification answers:\n${answers.map(([question, answer]) => `${question}\n${answer}`).join('\n\n')}` : ''}${draft.adjustments?.length ? `\n\nMy later adjustments (latest overrides earlier preferences):\n${draft.adjustments.join('\n')}` : ''}`;
}

function renderInput() {
  const placeholder = `COMP2119 Data Structures\n  A: Mon 10:00–12:00 and Wed 10:00–11:00\n  B: Tue 14:00–16:00 and Thu 14:00–15:00\nMATH1853 Linear Algebra\n  A: Mon 13:00–15:00\n  B: Fri 09:00–11:00\n\nI cannot attend before 10:00.\nI would prefer Friday off.`;
  return `${heading('Make room for a better week.', 'Your courses. Your preferences. A timetable that brings them together.', `<div class="heading-meta">${icon('shield')}Generate your week. Fine-tune as you go.</div>`)}
  <div class="input-layout">
    <form class="panel panel-pad" id="input-form">
      <div class="panel-title"><h2>Start with your shortlist</h2><span class="pill">Your full shortlist</span></div>
      <p class="panel-description">Add each course, its available sections and what a good week looks like for you.</p>
      ${state.draft?.source === 'example' ? '<p class="notice notice-info" style="margin-bottom:18px">You are editing an example. Use Clear input before pasting your own course catalogue.</p>' : ''}
      <div class="input-label"><label for="course-input">Courses, section times & preferences</label><div class="input-tools"><button class="text-button" type="button" data-action="clear-input">Clear input</button><button class="text-button" type="button" data-action="format">Use this format</button></div></div>
      <textarea id="course-input" maxlength="100000" required placeholder="${e(placeholder)}" ${state.busy ? 'disabled' : ''}>${e(state.input)}</textarea>
      <div class="input-toolbar"><span>Include every lecture and tutorial in each section.</span><span id="character-count">${state.input.length.toLocaleString()} / 100,000</span></div>
      <div class="privacy-note">${icon('lock')}<span>Use course information only. Leave out personal details. Generating your timetable sends this text to DeepSeek; examples stay local.</span></div>
      <div class="form-actions"><button type="button" class="button button-secondary" data-action="examples" ${state.busy ? 'disabled' : ''}>${icon('calendar')}Try an example</button><button class="button button-primary" id="parse-button" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner" aria-hidden="true"></span>Reading your input…' : `Generate my timetable${icon('arrow')}`}</button></div>
      <p class="field-help" style="margin-bottom:0;margin-top:16px">${state.config.configured ? `DeepSeek is configured (${e(state.config.model)}). A few questions if needed, then straight to your timetable.` : 'No API key yet? Try a pre-parsed example, or connect DeepSeek in Model.'}</p>
    </form>
    <aside class="input-aside">
      <section class="panel preview-panel" aria-label="Illustrative weekly timetable, not a generated result">
        <span class="pill" style="background:#dfe6fc;color:#4d619b">A glimpse of your next week</span>
        <h2 class="preview-title">A little more breathing room.</h2><p class="preview-subtitle">An example of what you can create.</p>
        <div class="mini-calendar" aria-hidden="true"><div class="mini-days">${DAYS.slice(0, 5).map(day => `<span>${day}</span>`).join('')}</div><div class="mini-tracks">
          <div class="mini-track"><div class="mini-event" style="top:6px;height:61px">COMP2119<small>10:00–12:00</small></div><div class="mini-event lilac" style="top:106px;height:65px">MATH1853<small>13:00–15:00</small></div></div>
          <div class="mini-track"><div class="mini-event mint" style="top:6px;height:61px">STAT2601<small>10:00–12:00</small></div></div>
          <div class="mini-track"><div class="mini-event" style="top:6px;height:31px">COMP2119</div></div>
          <div class="mini-track"><div class="mini-event sand" style="top:6px;height:61px">AILT9019<small>10:00–12:00</small></div></div>
          <div class="mini-track"><div class="free-day">${icon('leaf')}Your day off</div></div>
        </div></div>
        <div class="preview-footnote">${icon('check')}Clash-free classes. Time for everything else.</div>
      </section>
      <section class="how-panel"><h3>A good fit starts with what matters to you.</h3>
        <div class="benefit"><span class="benefit-icon">${icon('edit')}</span><div><strong>Say it in your own words</strong><p>“I can't start before 10. A free Friday would be nice.”</p></div></div>
        <div class="benefit"><span class="benefit-icon">${icon('shield')}</span><div><strong>You're always in control</strong><p>Answer a few questions once, then fine-tune your generated week.</p></div></div>
        <div class="benefit"><span class="benefit-icon">${icon('calendar')}</span><div><strong>See the options that fit</strong><p>Compare valid weeks, ranked by the preferences they satisfy.</p></div></div>
      </section>
    </aside>
  </div>`;
}

function describe(rule) {
  if (rule.type === 'earliest_start') return `No classes before ${rule.time}`;
  if (rule.type === 'latest_end') return `Finish classes by ${rule.time}`;
  if (rule.type === 'day_off') return `${rule.day} free`;
  if (rule.type === 'blocked_time') return `Keep ${rule.day} ${rule.start}–${rule.end} free`;
  if (rule.type === 'max_gap') return `Gaps of at most ${rule.minutes} minutes`;
  if (rule.type === 'min_break') return `At least ${rule.minutes} minutes between classes`;
  if (rule.type === 'max_days') return `Classes on at most ${rule.days} days`;
  return `${rule.type === 'any_of' ? 'Either' : 'Together'}: ${(rule.rules || []).map(describe).join(rule.type === 'any_of' ? ' OR ' : ' AND ')}`;
}
function renderPlanDetails() {
  return `<details class="panel plan-details"><summary>View interpreted courses & preferences</summary><div class="plan-detail-body">
    <p class="field-help">00:00–08:00 / 08:20 catalogue slots are online classes and do not occupy the grid.</p>
    ${state.plan.courses.map(course => `<details><summary>${e(course.id)} · ${course.sections.length} section options</summary><ul>${course.sections.map(section => `<li><strong>${e(section.id)}</strong>${section.semester ? ` · Semester ${section.semester}` : ''}: ${section.asynchronous ? 'Online · no fixed weekly meetings' : section.meetings.length ? section.meetings.map(m => `${e(m.day)} ${e(m.start)}–${e(m.end)}`).join('; ') : 'Meeting details missing'}</li>`).join('')}</ul></details>`).join('')}
    <p><strong>Must-haves:</strong> ${e(state.plan.hardConstraints.map(describe).join('; ') || 'Clash-free classes')}</p>
    <p><strong>Nice-to-haves:</strong> ${e(state.plan.softPreferences.map(describe).join('; ') || 'None specified')}</p>
    <details><summary>Your original input</summary><pre>${e(editableDraftText(state.draft))}</pre></details>
    ${state.draft.adjustments?.length ? `<p><strong>Your adjustments:</strong> ${e(state.draft.adjustments.join(' · '))}</p>` : ''}
  </div></details>`;
}

function renderReview() {
  const questions = state.draft.data.clarifications;
  return `<div class="question-workspace">${heading("A few details, then you're set.", 'One quick round. Your answers go straight into your timetable.')}
    <form id="review-form" class="panel panel-pad question-form">
      <div class="panel-title"><h2>What matters for your week?</h2><span class="pill">${questions.length} ${questions.length === 1 ? 'question' : 'questions'} · one round</span></div>
      <p class="panel-description">Answer the details you know. Leave anything optional blank; unresolved course data will be shown with your result.</p>
      <div class="clarification-list">${questions.map((question, i) => `<label for="answer-${i}"><span class="question-number">${i + 1}</span>${e(question)}<textarea id="answer-${i}" data-question="${i}" maxlength="1000" rows="2" placeholder="Your answer">${e(state.resolutions[question] || '')}</textarea></label>`).join('')}</div>
      <div class="form-actions"><button type="button" class="button button-quiet" data-action="step" data-index="0">${icon('back')}Edit input</button><button type="submit" class="button button-primary" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner" aria-hidden="true"></span>Building your week…' : `Generate my timetable${icon('arrow')}`}</button></div>
      <p class="field-help">No extra confirmation. Answers are applied with DeepSeek; solving runs locally.</p>
    </form>${renderPlanDetails()}</div>`;
}

function renderRefinement() {
  return `<form id="refinement-form" class="panel panel-pad refinement-panel">
    <div class="panel-title"><h2>Fine-tune your timetable</h2><span class="pill">Keep the conversation going</span></div>
    <label for="adjustment-input">What would you like to change?</label>
    <div class="refinement-controls"><textarea id="adjustment-input" maxlength="2000" rows="2" required placeholder="e.g. Allow 09:00 classes, keep Friday free if possible, and leave 30 minutes between classes." ${state.busy ? 'disabled' : ''}>${e(state.adjustment)}</textarea><button type="submit" class="button button-primary" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner" aria-hidden="true"></span>Updating…' : `Update timetable${icon('arrow')}`}</button></div>
    <p class="field-help">Changes apply directly. Everything else stays as it is. ${state.config.configured ? 'Uses DeepSeek.' : 'Connect DeepSeek in Model to apply an adjustment.'}</p>
  </form>`;
}

function renderNotes() {
  return state.draft.notes?.length ? `<details class="notice notice-amber result-notes"><summary>Interpretation notes (${state.draft.notes.length})</summary><ul>${state.draft.notes.map(note => `<li>${e(note)}</li>`).join('')}</ul></details>` : '';
}

function renderCalendar(schedule) {
  const meetings = schedule.meetings;
  let dayCount = 5;
  if (meetings.some(m => m.day === 'Sun')) dayCount = 7;
  else if (meetings.some(m => m.day === 'Sat')) dayCount = 6;
  const start = meetings.length ? Math.min(8 * 60, Math.floor(Math.min(...meetings.map(m => minute(m.start))) / 60) * 60) : 8 * 60;
  const end = meetings.length ? Math.max(18 * 60, Math.ceil(Math.max(...meetings.map(m => minute(m.end))) / 60) * 60) : 18 * 60;
  const height = (end - start) / 60 * 64;
  const times = [];
  for (let time = start; time <= end; time += 60) times.push(`<span style="top:${(time - start) / 60 * 64}px">${String(time / 60).padStart(2, '0')}:00</span>`);
  return `<div class="calendar-scroll" tabindex="0" role="region" aria-label="Weekly timetable; scroll horizontally on small screens"><div class="calendar" style="--days:${dayCount}">
    <div class="calendar-days"><span>Time</span>${DAY_NAMES.slice(0, dayCount).map(day => `<span>${day}</span>`).join('')}</div>
    <div class="calendar-body"><div class="calendar-times" style="height:${height}px">${times.join('')}</div>${DAYS.slice(0, dayCount).map(day => {
      const daily = meetings.filter(meeting => meeting.day === day);
      return `<div class="day-track" style="height:${height}px" aria-label="${DAY_NAMES[DAYS.indexOf(day)]}">${daily.length ? daily.map(meeting => {
        const courseIndex = state.plan.courses.findIndex(course => course.id === meeting.courseId);
        const duration = minute(meeting.end) - minute(meeting.start);
        const label = `${meeting.courseId}, ${meeting.courseName}, section ${meeting.sectionId}, ${day} ${meeting.start}–${meeting.end}`;
        return `<div class="calendar-event ${duration < 45 ? 'compact' : ''}" style="${colorStyle(courseIndex)};top:${(minute(meeting.start) - start) / 60 * 64}px;height:${Math.max(1, duration / 60 * 64 - 3)}px" title="${e(label)}" aria-label="${e(label)}"><strong>${e(meeting.courseId)}</strong><span>${e(meeting.start)}–${e(meeting.end)}</span><span>Section ${e(meeting.sectionId)}</span>${duration >= 90 ? `<span>${e(meeting.courseName)}</span>` : ''}</div>`;
      }).join('') : '<span class="calendar-free">No classes</span>'}</div>`;
    }).join('')}</div></div></div>
    <div class="calendar-legend">${state.plan.courses.map((course, i) => `<span class="legend-item" style="${colorStyle(i)}"><i class="legend-dot" aria-hidden="true"></i>${e(course.id)}</span>`).join('')}</div>`;
}

function renderResults() {
  const result = state.result;
  if (!result.solutions.length) {
    const missing = result.status === 'needs_data';
    const incomplete = result.searchComplete === false;
    return `${heading(missing ? 'A few course details are still missing.' : incomplete ? 'This search needs a little more room.' : "Let's find another way to fit.", 'Describe a change below and CourseFit will update your plan directly.')}
      ${renderRefinement()}<section class="panel no-results"><div class="no-results-symbol">${icon('calendar')}</div><span class="pill pill-amber">${missing ? 'Course details needed' : incomplete ? 'Search incomplete' : 'No feasible schedule found'}</span>
      <h2 style="margin-top:15px">${missing ? 'Keep your course data accurate.' : incomplete ? 'No option found within this search.' : 'These pieces need a little more room.'}</h2>
      <p>${e(result.message)}</p>
      ${result.blockers?.length ? `<ul>${result.blockers.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : '<p>Try relaxing a start-time restriction, changing a day-off preference, or adding another available section.</p>'}
      </section>${renderNotes()}${renderPlanDetails()}`;
  }
  const schedule = result.solutions[state.selected];
  const displayed = result.solutions.length;
  const explanation = state.explanations[schedule.id];
  const allHard = state.plan.hardConstraints.length;
  return `<div class="page-heading result-heading"><div><h1 id="page-title" tabindex="-1">A good fit for your week.</h1><div class="result-count"><span><strong style="color:var(--ink)">${result.searchComplete === false ? 'At least ' : ''}${result.totalFeasible.toLocaleString()}</strong> feasible ${result.totalFeasible === 1 ? 'timetable' : 'timetables'}${result.totalFeasible > displayed ? `; top ${displayed} shown` : ''}</span><span class="pill pill-green">${icon('shield')}Clash-free & independently checked</span></div></div><button type="button" class="button button-secondary" data-action="focus-refinement">${icon('edit')}Fine-tune this week</button></div>
  ${renderRefinement()}${renderNotes()}${result.searchComplete === false ? `<p class="notice notice-info">${e(result.message)} Ranking covers the combinations explored so far.</p>` : ''}
  <div class="results-layout"><aside class="panel ranking-panel"><div class="ranking-header"><h2>Your options</h2><p>One point per preference. Equal scores are tied.</p></div><div class="alternatives" aria-label="Ranked timetable options">${result.solutions.map((option, i) => `<button type="button" class="alternative ${i === state.selected ? 'selected' : ''}" data-action="select-result" data-index="${i}" aria-pressed="${i === state.selected}"><span class="alternative-top"><strong>Option ${String(i + 1).padStart(2, '0')}</strong><span class="score">${option.score} / ${result.totalPreferences}</span></span><small>${option.classDays} class ${option.classDays === 1 ? 'day' : 'days'}${option.meetings.every(m => m.day !== 'Fri') ? ' · Friday free' : ''}</small><span class="alternative-dots" aria-hidden="true">${option.preferences.map(p => `<i class="${p.satisfied ? 'met' : ''}"></i>`).join('')}</span></button>`).join('')}</div><div class="ranking-foot">All ${state.plan.courses.length} courses included in every option.</div></aside>
  <section class="panel calendar-panel"><div class="calendar-heading"><div><h2>Option ${String(state.selected + 1).padStart(2, '0')}<span class="muted" style="font-weight:400"> / Weekly timetable</span></h2><p>${schedule.classDays} class days. Times are local and repeat weekly.</p></div><div class="calendar-actions"><button type="button" class="button button-quiet" data-action="download" aria-label="Download selected timetable as JSON">${icon('download')}Save</button><button type="button" class="button button-quiet" data-action="print">${icon('print')}Print</button></div></div>
  ${renderCalendar(schedule)}
  <div class="preference-panel"><div class="panel-title"><h3>How this week fits you</h3><span class="pill pill-green">${schedule.score} / ${result.totalPreferences} preferences</span></div><p>${allHard ? `${allHard === 1 ? 'Your hard constraint is' : `All ${allHard} hard constraints are`} satisfied.` : 'Every class is clash-free.'} ${result.totalPreferences ? 'Here is where this option meets your preferences.' : 'No soft preferences were set, so every feasible timetable is tied.'}</p>
  ${allHard ? `<ul class="preference-checks">${state.plan.hardConstraints.map(rule => `<li><span class="met">${icon('check')}</span><span>${e(describe(rule))}<span class="muted"> — required, met</span></span></li>`).join('')}</ul>` : ''}
  ${schedule.preferences.length ? `<ul class="preference-checks">${schedule.preferences.map(preference => `<li><span class="${preference.satisfied ? 'met' : 'missed'}">${icon(preference.satisfied ? 'check' : 'minus')}</span><span>${e(preference.label)}<span class="muted"> — ${preference.satisfied ? 'met' : 'not met'}</span></span></li>`).join('')}</ul>` : ''}
  <p style="line-height:1.8">${e(schedule.explanation)}</p>
  ${explanation ? `<div class="ai-explanation"><span class="pill">${icon('sparkle')}DeepSeek commentary</span><p>${e(explanation)}</p><span class="field-help">The verified preference checks above remain the source of truth.</span></div>` : `<button type="button" class="text-button" style="font-size:calc(0.733rem * var(--font-scale-button));margin-top:12px" data-action="explain" ${state.explaining ? 'disabled' : ''}>${state.explaining === schedule.id ? 'DeepSeek is writing an explanation…' : state.config.configured ? 'Explain this week with DeepSeek' : 'Connect DeepSeek for a more detailed explanation'}</button>`}
  </div>
  <details class="meeting-list"><summary>View every selected section & meeting</summary><ul>${[...schedule.meetings].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || minute(a.start) - minute(b.start)).map(m => `<li>${e(m.day)} ${e(m.start)}–${e(m.end)} — ${e(m.courseId)} ${e(m.courseName)}, section ${e(m.sectionId)}</li>`).join('')}${schedule.selections.filter(selection => state.plan.courses.find(course => course.id === selection.courseId)?.sections.find(section => section.id === selection.sectionId)?.asynchronous).map(selection => `<li>${e(selection.courseId)}, section ${e(selection.sectionId)} — no fixed weekly meetings (asynchronous)</li>`).join('')}</ul></details>
  </section></div>${renderPlanDetails()}`;
}

function render({ focus = false } = {}) {
  renderSteps();
  $('#app').innerHTML = state.step === 0 ? renderInput() : state.step === 1 ? renderReview() : renderResults();
  if (state.busy && state.step === 1) $('#review-form').querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = true; });
  updateConnection();
  if (focus) focusHeading();
}

function applyGenerated(output) {
  state.draft = output.draft;
  state.plan = structuredClone(output.draft.data);
  state.resolutions = {};
  state.result = output.result || null;
  state.confirmationId = output.confirmationId || null;
  state.selected = 0;
  state.explanations = {};
  state.step = output.result ? 2 : 1;
  announce(output.result ? (output.result.solutions.length ? 'Your timetable is ready. You can fine-tune it below.' : output.result.message) : 'A few details need your input. Answer once to generate your timetable.');
}

async function loadExample(id) {
  if (state.busy) return;
  state.busy = true;
  try {
    const output = await api('/api/generate', { method: 'POST', body: { exampleId: id } });
    applyGenerated(output); state.input = output.draft.input; state.adjustment = '';
    $('#examples-dialog').close(); clearError();
  } finally { state.busy = false; render({ focus: true }); }
}

function openExamples() {
  $('#example-options').innerHTML = state.examples.map((example, i) => `<button type="button" class="example-option" data-action="load-example" data-id="${e(example.id)}">${icon(['leaf', 'calendar', 'edit'][i])}<span><strong>${e(example.name)}</strong><small>${e(example.description)}</small></span><span class="arrow" aria-hidden="true">›</span></button>`).join('') || '<p class="notice notice-error">Examples could not be loaded. Check that the local server is running and refresh.</p>';
  $('#examples-dialog').showModal();
}
function openModel() {
  $('#api-key').value = '';
  $('#api-key').placeholder = state.config.configured ? 'A key is configured. Leave blank to keep it.' : 'Enter your DeepSeek API key';
  $('#model-name').value = state.config.model || 'deepseek-flash';
  $('#remember-key').checked = state.config.keySource === 'disk' || !state.config.configured;
  $('#key-help').textContent = state.config.configured ? `Key source: ${state.config.keySource === 'disk' ? 'saved on this device' : state.config.keySource === 'environment' ? 'environment variable' : 'current server session'}. The key itself is never returned to the browser.` : 'Your key is never returned to the browser or included in exports.';
  $('#forget-key').disabled = !state.config.configured;
  $('#model-error').hidden = true;
  $('#model-dialog').showModal();
}

function openPreferences() {
  const saved = readFontSettings();
  for (const group of FONT_GROUPS) {
    const input = $(`#font-size-${group}`);
    input.value = String(fontIndex(saved[group] ?? FONT_KEY_DEFAULT));
    updateFontSizeLabel(input);
  }
  $('#preferences-dialog').showModal();
}

async function parseForm() {
  if (state.busy) return;
  state.input = $('#course-input').value;
  if (!state.input.trim()) throw new Error('Enter your courses and section times, or try an example.');
  if (!state.config.configured) { openModel(); return; }
  state.busy = true; clearError(); render(); announce('DeepSeek is interpreting your courses and preferences.');
  try {
    applyGenerated(await api('/api/generate', { method: 'POST', body: { input: state.input } }));
    state.adjustment = '';
  } finally { state.busy = false; render({ focus: true }); }
}

async function solveForm() {
  if (state.busy) return;
  const hasAnswers = Object.values(state.resolutions).some(answer => answer.trim());
  if (hasAnswers && !state.config.configured) { openModel(); return; }
  state.busy = true; clearError(); render(); announce('Applying your answers and generating your timetable.');
  try {
    applyGenerated(await api('/api/generate', { method: 'POST', body: { draftId: state.draft.id, answers: state.resolutions } }));
  } finally { state.busy = false; render({ focus: true }); }
}

async function refineForm() {
  if (state.busy) return;
  state.adjustment = $('#adjustment-input').value;
  if (!state.adjustment.trim()) return;
  if (!state.config.configured) { openModel(); return; }
  state.busy = true; clearError(); render(); announce('Updating your timetable from your adjustment.');
  try {
    applyGenerated(await api('/api/generate', { method: 'POST', body: { draftId: state.draft.id, adjustment: state.adjustment } }));
    state.adjustment = '';
  } finally { state.busy = false; render(); }
}

async function explainSchedule() {
  if (!state.config.configured) { openModel(); return; }
  if (state.explaining) return;
  const schedule = state.result.solutions[state.selected];
  state.explaining = schedule.id; render();
  try {
    const output = await api('/api/explain', { method: 'POST', body: { confirmationId: state.confirmationId, scheduleId: schedule.id } });
    state.explanations[schedule.id] = output.explanation;
    announce('DeepSeek commentary is ready.');
  } finally { state.explaining = null; render(); }
}

function downloadSchedule() {
  const schedule = state.result.solutions[state.selected];
  const file = { application: 'CourseFit', note: 'Based on user-provided data. Does not check registration, seat availability, dates or travel time.', courses: state.plan.courses.map(({ id, name }) => ({ id, name })), hardConstraints: state.plan.hardConstraints, softPreferences: state.plan.softPreferences, schedule };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'coursefit-timetable.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function action(button) {
  const type = button.dataset.action;
  const i = Number(button.dataset.index);
  if (state.busy) return;
  if (type === 'step') {
    if (i === 0 && state.draft) state.input = editableDraftText(state.draft);
    state.step = i; clearError(); render({ focus: true }); return;
  }
  if (type === 'examples') { openExamples(); return; }
  if (type === 'clear-input') {
    state.input = ''; state.draft = null; state.plan = null; state.result = null; state.confirmationId = null; state.resolutions = {}; state.adjustment = ''; state.explanations = {};
    clearError(); render(); $('#course-input').focus(); return;
  }
  if (type === 'load-example') { await loadExample(button.dataset.id); return; }
  if (type === 'format') {
    if (state.input.trim()) { openExamples(); return; }
    state.input = state.examples[0]?.input || ''; render(); $('#course-input').focus(); return;
  }
  if (type === 'select-result') { state.selected = i; clearError(); render(); announce(`Option ${i + 1} selected. ${state.result.solutions[i].explanation}`); return; }
  if (type === 'focus-refinement') { $('#adjustment-input').focus(); $('#refinement-form').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (type === 'download') { downloadSchedule(); return; }
  if (type === 'print') { window.print(); return; }
  if (type === 'explain') await explainSchedule();
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) document.getElementById(close.dataset.close).close();
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) action(button).catch(error => {
    if ($('#examples-dialog').open) $('#examples-dialog').close();
    showError(error);
  });
});

document.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'course-input') {
    state.input = target.value;
    $('#character-count').textContent = `${state.input.length.toLocaleString()} / 100,000`;
    if (state.draft && state.input !== editableDraftText(state.draft)) {
      state.draft = null; state.plan = null; state.result = null; state.confirmationId = null; state.explanations = {}; renderSteps();
    }
  }
  if (target.id === 'adjustment-input') state.adjustment = target.value;
  if (target.dataset.question !== undefined) state.resolutions[state.draft.data.clarifications[Number(target.dataset.question)]] = target.value;
});

document.addEventListener('submit', event => {
  if (event.target.id === 'input-form') { event.preventDefault(); parseForm().catch(showError); }
  if (event.target.id === 'review-form') { event.preventDefault(); solveForm().catch(showError); }
  if (event.target.id === 'refinement-form') { event.preventDefault(); refineForm().catch(showError); }
});

$('#open-model').addEventListener('click', openModel);
$('#model-icon').innerHTML = icon('sparkle');
$('#open-settings').addEventListener('click', openPreferences);
$('#settings-icon').innerHTML = icon('settings');
$('#open-about').addEventListener('click', () => $('#about-dialog').showModal());
for (const group of FONT_GROUPS) {
  $(`#font-size-${group}`).addEventListener('input', event => {
    const key = fontKeyAt(event.target.value);
    applyFontSize(group, key);
    const settings = readFontSettings();
    settings[group] = key;
    localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(settings));
    updateFontSizeLabel(event.target);
  });
}
$('#model-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#save-model'); button.disabled = true; button.textContent = 'Saving…'; $('#model-error').hidden = true;
  try {
    state.config = await api('/api/config', { method: 'PUT', body: { apiKey: $('#api-key').value, model: $('#model-name').value.trim(), rememberKey: $('#remember-key').checked } });
    $('#api-key').value = ''; $('#model-dialog').close(); render(); announce('Model settings saved. The connection has not yet been tested; generate a timetable to use it.');
  } catch (error) { $('#model-error').textContent = error.message; $('#model-error').hidden = false; }
  finally { button.disabled = false; button.textContent = 'Save key'; }
});
$('#forget-key').addEventListener('click', async () => {
  $('#forget-key').disabled = true;
  try {
    state.config = await api('/api/config', { method: 'DELETE' });
    $('#api-key').value = ''; $('#model-dialog').close(); render();
    announce(state.config.configured ? 'Saved key removed. An environment variable still provides a key; remove it from .env to disconnect completely.' : 'Saved key removed. DeepSeek is disconnected.');
  } catch (error) { $('#model-error').textContent = error.message; $('#model-error').hidden = false; }
  finally { $('#forget-key').disabled = !state.config.configured; }
});

migrateLegacyFontSize();
applyAllFontSizes();
render();
const initial = await Promise.allSettled([api('/api/config'), api('/api/examples')]);
if (initial[0].status === 'fulfilled') state.config = initial[0].value;
if (initial[1].status === 'fulfilled') state.examples = initial[1].value;
render();
for (const result of initial) if (result.status === 'rejected') showError(result.reason);
