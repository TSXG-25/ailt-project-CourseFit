# Architecture

CourseFit uses Node.js 22.13+ built-ins, browser-native JavaScript/CSS and PDF.js for local PDF reading. The language step extracts data; a deterministic solver generates and ranks timetables. Install dependencies with `npm ci`; there is no build pipeline or database.

## Generation flow

```mermaid
flowchart LR
  A[Course text and preferences] --> B[Model JSON extraction]
  N[Screenshot or PDF] --> O[Browser reads PDF text and renders sparse pages]
  O --> P{Image needs visual reading?}
  P -->|Yes| Q[Model transcription]
  P -->|No| B
  Q --> B
  B --> C[Schema and source checks]
  C --> D{Essential questions?}
  D -->|Yes, once| E[One batch of up to five questions]
  E --> F[Apply answers]
  F --> G[Generate directly]
  D -->|No| G
  H[Complete local example] --> G
  G --> I[Immutable validated snapshot]
  I --> J[Budgeted CSP search]
  J --> K[Independent validation]
  K --> L[Ranked weekly grids]
  L --> M[Natural-language adjustment]
  M --> B
```

The browser never requires a confirmation checkbox. A Generate or Update request authorizes solving. `workflow.js` separates factual blockers from infeasibility: unavailable semester sections or genuinely missing times produce `status: "needs_data"` and an adjustment box, not fabricated times or another question screen. Optional unresolved interpretations appear as notes.

## Plan and online normalization

The four required plan arrays are `courses`, `hardConstraints`, `softPreferences` and `clarifications`. Courses have unique codes and section IDs; each section contains all required weekly meetings. Section metadata can include `semester: 1 | 2` and `asynchronous: true`.

There are no course, section or meeting count caps. Generation rejects mixed semesters and unknown meeting facts. The public text budget is 100,000 characters. Uploads support up to 8 files, 20 MB per file and 30 MB total; PDF text is extracted in the browser for up to 100 pages. A request can include up to 8 compressed visual pages (8 MB total), and JSON request bodies are limited to 12 MB. Provider context/output limits still apply.

Schema normalization recognizes 00:00–08:00 and 00:00–08:20 catalogue slots as online placeholders, including missing-day rows and equivalent unpadded times. Purely online sections use `asynchronous: true, meetings: []`. In mixed bundles, only the online placeholder is removed; real weekly meetings remain. Other missing times are never assumed online.

Every model-extracted course, section and rule needs a short contiguous `evidence` quote. The parser anchors quotes to the supplied source, accepting formatting-only whitespace, dash, quotation-mark and full-width ASCII variations. This does not independently prove the semantic accuracy of extracted times. Examples are pre-parsed and need no model call.

Original PDFs are read in the browser and are not uploaded as PDF files. Text is extracted locally; screenshots and scanned pages needing visual reading are compressed as JPEG and sent with the course text to the selected provider. The app does not save original files. The in-memory draft retains extracted text and visual transcriptions for review. A quote check against an image transcription does not prove that the transcription matches the image, so users should compare recognized names and times with the original.

## One question round and adjustments

The prompt requests concise, consolidated questions, usually 3–5 for an ambiguous catalogue and fewer when sufficient. Deterministic checks cover missing facts and mixed semesters, avoid duplicating missing-course questions, and bound the displayed batch to five without discarding issues.

After answering or skipping optional questions, generation clears the question queue and exposes unresolved notes or factual blockers. It never opens another required question round. No course is silently omitted to make a schedule feasible.

Adjustments send the original source plus the current plan and latest requested change. The current plan is authoritative: superseded restrictions must be removed, unaffected courses/sections/preferences retained, and previously removed courses must not be restored from the original text. Sources, answers and adjustments are retained separately, avoiding recursive prompt growth. A failed update preserves the previous browser result and edit text.

## Search and independent checks

Each course is a variable and sections are its domain. Backtracking uses minimum remaining values and forward checking. Internally overlapping sections are excluded. Online sections are selected without adding calendar intervals.

Earliest/latest times, blocked intervals, day off, minimum break and maximum class days can prune partial assignments. Maximum gap cannot: a later course might fill a gap. This holds inside AND/OR rules.

The search keeps at most 20 candidates and has a four-second budget. Completed searches return exact counts, score frequencies and ordering. If the budget is reached, `searchComplete: false` means feasible counts are lower bounds and ranking covers explored combinations only. No-result partial searches are distinguished from proven infeasibility. Equal scores use deterministic course/section identifiers.

Every returned candidate passes `validator.js`, which independently resolves membership, checks overlaps using arrival/departure events and evaluates hard rules. Departures precede arrivals at the same minute, allowing adjacent classes unless a break rule forbids them.

The independent exhaustive reference in `evaluation/reference.js` does not import solver search, pruning or scoring. Fixed cases have manually specified feasible counts.

## HTTP interface

| Endpoint | Contract |
| --- | --- |
| `GET /api/health` | Server health. |
| `GET /api/config` | Provider, model and redacted key status. |
| `PUT /api/config` | Save provider, key, model, base URL and protocol locally or in session; does not call the provider. |
| `DELETE /api/config` | Remove saved settings, restoring environment defaults. |
| `GET /api/providers` | Available providers (id, name, group, key hint, whether a base URL is required, default model) and selectable protocols. |
| `POST /api/models` | `{provider,apiKey?,baseUrl?,protocol?}` lists models for a provider without storing the key; falls back to a typed model name on any failure. Returns `{provider,providerName,models}`. |
| `GET /api/examples` | Example descriptions and original text. |
| `POST /api/generate` | `{input,attachments?}` starts from typed text and optional browser-extracted files; `{exampleId}` loads an example; `{draftId,answers}` applies the single question batch; `{draftId,adjustment}` updates a result. Returns `{draft,result?,confirmationId?}`. |
| `POST /api/explain` | `{confirmationId,scheduleId}` adds optional commentary about verified facts. |

The snapshot identifier retains its legacy `confirmationId` name internally; there is no additional confirmation UI. Lower-level `/api/parse`, `/api/examples/load`, `/api/clarify`, `/api/confirm` and `/api/solve` remain for compatibility and module-level integration checks. The browser loads `/api/config`, `/api/examples` and `/api/providers` on startup, uses `/api/models` to populate the model picker, and uses `/api/generate` throughout for extraction, solving and adjustments.

Drafts, snapshots and cached results are bounded to 100 entries and expire after two hours. A server restart removes them. Keys are never returned or included in exports. Saved files use owner-only permissions and stay outside the static allowlist and Git.

## Model and local server boundary

Only one provider request runs at a time. Requests use the provider's configured HTTPS endpoint, JSON mode and a 90-second timeout. Invalid schema or quotes receive at most one correction attempt. Empty, malformed or truncated JSON fails safely. Provider bodies and credentials never enter client error messages.

The server binds to IPv4 loopback and rejects foreign hosts/origins. Mutation endpoints require JSON. There is no multi-user authentication; this is a local workspace, not a public hosted service. Optional model commentary is labelled and never changes solver facts or scores.
