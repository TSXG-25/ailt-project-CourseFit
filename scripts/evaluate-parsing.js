import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { SettingsStore } from '../server/settings.js';
import { parseInput } from '../server/parser.js';
import { PARSING_CASES } from '../evaluation/parsing-cases.js';
import { compareParsing } from '../evaluation/metrics.js';

const settings = new SettingsStore(fileURLToPath(new URL('../.local/settings.json', import.meta.url)));
await settings.load();
if (!settings.public().configured) {
  console.error(`Parsing evaluation needs a real ${settings.public().providerName} key. Save one with “Remember the key” in the app, or set COURSEFIT_API_KEY in .env. This command evaluates 22 cases with up to 44 paid API calls, including bounded correction attempts; no model accuracy is claimed until it runs.`);
  process.exit(1);
}

const records = [];
let providerRequests = 0;
for (const fixture of PARSING_CASES) {
  try {
    const actual = await parseInput(fixture.input, settings.settings, { fetchImpl: (...args) => { providerRequests++; return fetch(...args); } });
    const metrics = compareParsing(actual, fixture.expected, fixture.ambiguous);
    records.push({ id: fixture.id, ...metrics, actual, expected: fixture.expected });
    console.log(`${fixture.id}: ${metrics.correctFields}/${metrics.totalFields} fields; hard constraints ${metrics.hardCorrect ? 'correct' : 'incorrect'}${fixture.ambiguous ? `; ambiguity ${metrics.ambiguityDetected ? 'flagged' : 'MISSED'}` : ''}`);
  } catch (error) {
    const denominator = compareParsing(fixture.expected, fixture.expected).totalFields;
    records.push({ id: fixture.id, correctFields: 0, totalFields: denominator, hardCorrect: false, ambiguityDetected: fixture.ambiguous ? false : null, error: error.message });
    console.log(`${fixture.id}: safe failure (${error.message})`);
  }
}
const sum = key => records.reduce((total, record) => total + Number(record[key]), 0);
const summary = {
  evaluatedAt: new Date().toISOString(), model: settings.public().model, cases: records.length, requests: providerRequests,
  fieldAccuracy: sum('correctFields') / sum('totalFields'),
  hardConstraintAccuracy: sum('hardCorrect') / records.length,
  ambiguityDetection: records.filter(record => record.ambiguityDetected === true).length / PARSING_CASES.filter(fixture => fixture.ambiguous).length,
  unexpectedClarifications: records.filter(record => record.unexpectedClarification).length,
  failures: records.filter(record => record.error).length,
};
summary.passed = summary.fieldAccuracy >= .95 && summary.hardConstraintAccuracy >= .95 && summary.ambiguityDetection === 1;
const output = fileURLToPath(new URL('../.local/parsing-evaluation.json', import.meta.url));
await mkdir(fileURLToPath(new URL('../.local/', import.meta.url)), { recursive: true });
await writeFile(output, JSON.stringify({ summary, records }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('Detailed results saved in .local/parsing-evaluation.json (excluded from Git).');
if (!summary.passed) process.exitCode = 1;
