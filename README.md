# CourseFit

Your semester, in balance. CourseFit turns shortlisted courses, available sections and plain-English preferences into ranked, clash-free weekly timetables.

Built for AILT9019. The application runs locally, with an English interface and a configurable model for language parsing. The constraint solver, ranking, independent validation and pre-parsed examples work without a model API key.

## Start

Install [Node.js 22 or later](https://nodejs.org/en/download), open a terminal in this repository, and run:

```sh
npm start
```

Open **[http://127.0.0.1:3000](http://127.0.0.1:3000)**. No dependency installation, database or build command is required. Keep the terminal running; press Ctrl+C to stop.

1. Paste your course catalogue and preferences, then select **Generate my timetable**, or **Try an example** without a key.
2. If essential details are unclear, answer one batch of up to five questions. Answers go straight into generation; there is no confirmation checkbox.
3. Compare the options and use **Fine-tune your timetable** to describe changes in ordinary language. You can also save or print the selected week.

To use your own plain-English input, open **Settings**, enter an API key for your chosen provider, and save. The default model is `deepseek-flash`; change it if your account uses a different supported model. Saving settings stores the configuration; the first parse request tests the connection. Obtain a key from your provider.

**Remember the key on this device** saves it in `.local/settings.json`, with owner-only file permissions. Uncheck it to keep it only for the current server session. **Forget saved key** deletes the saved key. Keys supplied by an environment variable must also be removed from that environment to disconnect completely.

For environment-based configuration, copy `.env.example` to `.env` and fill in the values. To use another port, set `PORT=3001` in `.env` and restart. `.env` and `.local/` are excluded from Git.

## Example input

```text
COMP2119 Data Structures
  A: Mon 10:00–12:00 and Wed 10:00–11:00
  B: Tue 14:00–16:00 and Thu 14:00–15:00
MATH1853 Linear Algebra
  A: Mon 13:00–15:00
  B: Fri 09:00–11:00

I cannot attend before 10:00.
I would prefer Friday off.
If possible, keep gaps between consecutive classes to at most 90 minutes.
```

Provide complete alternative **section bundles**: all meetings in section A are required together. If lectures and tutorials have independent choices, list the complete allowed bundles yourself. The parser asks for clarification rather than inventing combinations or times.

There is **no course-count, section-count or meeting-count limit**. Use explicit days and 24-hour local times. Meetings repeat weekly and must start and end on the same day. Monday through Sunday are supported. Back-to-back classes are allowed unless you request a minimum break; no travel buffer is assumed.

You can paste **Sem / Sub-class / Day / Time** tables. Rows with the same section code form one required meeting bundle. Specify a semester in your input, or answer the semester question in the single question batch. Missing sections in that semester are reported rather than replaced with another semester's data.

Catalogue placeholders **00:00–08:00** and **00:00–08:20** automatically mean **online classes with no fixed weekly meeting**, even without a weekday. These sections remain selected courses but occupy no calendar slot. Other unknown times are never invented.

Questions are optional to answer, and only asked once. Remaining ambiguity appears as interpretation notes with the result. Essential missing course data blocks generation and is listed with the same adjustment box, so you can supply times or explicitly omit an unavailable course without restarting. Use **Clear input** before replacing an example with your own catalogue.

The input text budget is 100,000 characters; provider context/output limits still apply. Search has a four-second budget rather than course/section caps.

## Preferences and scoring

The plan distinguishes hard **must-haves** from soft **nice-to-haves**. Describe which restrictions are essential and which are flexible. Later adjustments replace superseded rules while retaining unaffected courses and preferences.

| Rule | Meaning |
| --- | --- |
| No classes before | Every meeting starts at or after the specified time. |
| Finish classes by | Every meeting ends at or before the specified time. |
| Keep a day free | No meeting on that day. |
| Keep a time free | No overlap with a specified day and interval. |
| Maximum gap | Each gap between consecutive classes on the same day is at most N minutes. A day with one class satisfies this. |
| Minimum break | Each gap between consecutive classes on the same day is at least N minutes. A day with one class satisfies this. |
| Maximum class days | Meetings occupy at most N distinct days per week. |
| Either condition (OR) | At least one child condition holds. |
| All conditions (AND) | Every child condition holds. |

For example, “avoid gaps over 90 minutes unless Friday is free” can be one OR preference containing **maximum gap 90 minutes** and **Friday free**. Compound rules earn one point as a whole, not one per child.

Every hard constraint must hold. Only feasible timetables are ranked. Each satisfied soft preference earns **one point**; no weights are used. Equal scores are tied and ordered consistently by course/section identifiers. The UI displays up to 20 options. Completed searches show exact feasible counts and rankings. If the search budget is reached, counts are labelled “at least” and ranking covers only explored combinations; a partial search with no results is never reported as proof of infeasibility. With no soft preferences, all feasible timetables are tied.

If no combination works, the app displays **No feasible schedule found** with a natural-language adjustment box. It never substitutes a timetable that violates a hard constraint.

## Data checks and privacy

- Model output is untrusted data. The server validates its structure and source quotes before review. Harmless whitespace, dash, quotation-mark and full-width character differences are matched back to an actual substring of your original input. Changed words, numbers or missing source quotes are not silently accepted. Invalid structure or quotes get at most **one correction request**, then fail with a specific error if still invalid. Source quotes help trace an extraction; they cannot prove that the model interpreted every time correctly.
- Unclear data appears in one batch of up to five questions. Applying answers generates directly; remaining issues are notes or missing-data blockers, never another required question round.
- **Generate** and **Update timetable** authorize generation. The server saves a validated immutable snapshot internally, with no repeated acknowledgement step. Current plan data is authoritative for adjustments, so older restrictions are not restored accidentally.
- An independent overlap and hard-constraint validator checks every returned timetable. The displayed meeting data is derived from the selected sections.
- Parsing, answering questions and natural-language adjustments send course data to your provider's chat endpoint (the default DeepSeek setup uses `https://api.deepseek.com/chat/completions`). Optional model commentary sends the selected timetable and verified preference results. Complete examples and deterministic explanations do not call a model.
- Do not enter names, student IDs, emails or other personal identifiers. Course data and generated snapshots are held in memory for up to two hours, with bounded storage, and disappear on server restart. Downloads are saved only when you select Save. API keys are never returned by server endpoints or included in timetable exports.
- The server binds to `127.0.0.1`, rejects foreign hosts/origins, and only exposes explicitly allowed public assets. It is a single-user local application, not a multi-user hosted service.

CourseFit does not recommend courses, enrol students, check live seats, verify university rules, or guarantee registration. Dates, alternating teaching weeks, holidays, time zones and campus travel times are outside this prototype.

## Verify

```sh
npm test
```

The dependency-free Node test suite covers 18 fixed solver scenarios against an independent exhaustive enumerator, 60 seeded additional cases, snapshot expiry/immutability, uncapped catalogue import, online placeholders, minimum breaks, one-round generation, direct adjustments and search deadlines, model correction limits, data provenance checks, HTTP flows, secret storage/redaction and safe failure.

The fixed language evaluation set contains **22 manually prepared requests and expected representations**, including 5 deliberately ambiguous cases. To measure the real model:

```sh
npm run evaluate:parsing
```

This uses a key saved with **Remember the key** or supplied through `.env` and evaluates **22 cases**, making **22–44 paid model requests** if all cases reach the provider, including at most one correction request per case. The report records actual request counts, field extraction accuracy, exact hard-constraint accuracy, ambiguity detection, unexpected clarification counts and safe failures in `.local/parsing-evaluation.json`. Targets are ≥95%, ≥95% and 100%, respectively. Source-quote wording and question wording are excluded from semantic accuracy.

**Fixed-set model accuracy has not yet been measured.** A separately authorized real catalogue regression passed, but it does not establish the proposal's accuracy targets. Mock provider tests validate integration and failure handling. See [verification notes](docs/verification.md) for completed checks and remaining validation.

## Project layout

```text
public/       Responsive English UI; no external runtime assets
server/       Local HTTP API, parser, generation workflow, snapshot store, solver and validator
evaluation/   Fixed language/solver cases, evaluation metrics and exhaustive oracle
test/         Node unit and HTTP integration tests
scripts/      Real-model parsing evaluation
docs/         Architecture, design and verification notes
```

See [architecture](docs/architecture.md) for API and implementation details. MCP packaging, offline model integration, preference weights, detailed infeasibility diagnosis and a public project webpage remain optional follow-up work.

## Implementation references

- [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/) — JSON mode, explicit JSON prompt and handling incomplete/empty content.
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) — endpoint, request fields and thinking switch.
- [DeepSeek API setup](https://api-docs.deepseek.com/) — current model names and API endpoint. Model names can change; Settings keeps this configurable.
