# Verification record

Local verification: 21 October 2026 (Hong Kong). This record reflects the simplified generation flow requested after the original proposal.

## Automated checks

- Node.js 22.20.0: 69 tests passed, including HTTP integration checks.
- 18 fixed solver scenarios and 60 seeded cases match the independent exhaustive reference for assignments and scores.
- A 20-course plan with 60 section options on one course solves without old course/section caps.
- 00:00–08:00 and 00:00–08:20 online placeholders need neither weekdays nor clarification. Mixed bundles retain real timed meetings.
- One question batch is bounded to five; missing-course questions are not duplicated. Answers generate directly even when remaining ambiguity needs a note.
- Missing facts are distinct from infeasibility. Neither missing courses nor unavailable semester sections are silently invented or dropped.
- Natural-language refinement replaces an earlier restriction and preserves source/context. Large-search tests verify partial count/ranking labels and prevent false infeasibility claims.
- Source-quote formatting, bounded correction attempts, provider failures, secret redaction/storage, immutable snapshots and expiry remain covered.

## Isolated browser verification

A separate temporary local server, fake credentials and mocked provider were exercised in an isolated headless Chrome profile.

- Complete examples generate in one click, with no confirmation checkbox or requests to legacy confirmation/clarification/solve endpoints.
- All eight main-example calendars and the downloaded JSON match selected solver meetings.
- Complete course text goes directly to results; an ambiguous case displays three questions once and goes directly from answers to generation.
- Natural-language adjustments apply directly. An infeasible result remains adjustable; a failed update preserves the previous calendar and typed edit.
- A 13-course import with 45 section options on one course retains every option. Automatic online-only schedules have a finite empty weekly grid.
- Input, question, result and online layouts were checked at 375px, 768px and 1440px. No page-level horizontal overflow or browser JavaScript errors occurred.
- Keyboard skip navigation, native labels/dialogs and literal HTML text handling were checked. This is not a full assistive-technology audit.

## Authorized live provider regression

Using the already authorized course table and confirmed preferences, the new generation flow completed with two real provider requests, without correction retries. The table and raw responses remain in owner-only temporary diagnostic files outside the repository; no key was logged or changed.

Initial extraction retained all six intended courses, Semester 2 choices, and all 11 CAES9821 sections. AILT9019 and ECON1210 section 2M were automatically treated as online. Missing Semester 2 data for CCST9016 remained visible instead of being invented.

The initial provider response contained two essential issues: CCST9016 availability and the unspecified break duration. A server fallback initially duplicated the availability question; this was fixed and replayed against the saved extraction, producing exactly two questions without another paid request.

Finishing the batch with missing facts produced an actionable result, with no second question screen. An isolated regression adjustment then omitted CCST9016 and replaced the 10:00 restriction with 09:00. This test scenario returned 96 feasible combinations, displayed 20 independently validated options, preserved every unaffected section/time and the days-off preferences, and removed the old boundary. The test adjustment did not alter the student's actual saved preferences or production workspace state.

## Accuracy scope

The 22-case manually specified language evaluation set remains schema/provenance validated, but the full paid model evaluation has not been run. One real catalogue regression does not establish the proposal's field/hard-constraint/ambiguity accuracy targets. Run `npm run evaluate:parsing` to measure all 22 cases, with up to 44 provider requests including correction attempts.

No deployment, Git commit or Git push has been performed.
