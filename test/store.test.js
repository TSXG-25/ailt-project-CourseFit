import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftStore } from '../server/store.js';
import { EXAMPLES } from '../server/examples.js';

test('unconfirmed or fabricated confirmation identifiers cannot reach a plan', () => {
  const store = new DraftStore();
  const draft = store.create(EXAMPLES[0].data, EXAMPLES[0].input, 'example');
  assert.throws(() => store.getConfirmed(draft.id), /Confirm your interpretation/);
  assert.throws(() => store.getConfirmed('fabricated'), /Confirm your interpretation/);
  assert.throws(() => store.confirm({ draftId: draft.id, data: draft.data, acknowledged: false }), /explicitly confirm/);
});

test('confirmed data is immutable relative to caller edits and later confirmations', () => {
  const store = new DraftStore();
  const draft = store.create(EXAMPLES[0].data, '', 'example');
  const first = store.confirm({ draftId: draft.id, data: draft.data, acknowledged: true });
  const original = store.getConfirmed(first.confirmationId);
  draft.data.courses[0].sections[0].meetings[0].start = '11:00';
  first.data.courses[0].name = 'Edited response';
  const retrieved = store.getConfirmed(first.confirmationId); retrieved.courses[0].name = 'Edited retrieval';
  assert.deepEqual(store.getConfirmed(first.confirmationId), original);
});

test('original ambiguity questions cannot be bypassed by deleting them from posted data', () => {
  const store = new DraftStore();
  const draft = store.create(EXAMPLES[2].data, '', 'example');
  const data = { ...draft.data, clarifications: [] };
  assert.throws(() => store.confirm({ draftId: draft.id, data, acknowledged: true, resolutions: {} }), /Answer every clarification/);
  const result = store.confirm({ draftId: draft.id, data, acknowledged: true, resolutions: { [draft.data.clarifications[0]]: 'I choose to remove that preference entirely.' } });
  assert.ok(result.confirmationId);
});

test('expired drafts and confirmations are rejected', () => {
  let now = 1;
  const store = new DraftStore({ ttlMs: 100, now: () => now });
  const draft = store.create(EXAMPLES[0].data, '', 'example');
  const confirmed = store.confirm({ draftId: draft.id, data: draft.data, acknowledged: true });
  now = 101;
  assert.throws(() => store.confirm({ draftId: draft.id, data: draft.data, acknowledged: true }), /draft expired/);
  assert.throws(() => store.getConfirmed(confirmed.confirmationId), /may have expired/);
});
