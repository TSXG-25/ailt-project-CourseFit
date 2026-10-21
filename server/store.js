import { randomUUID } from 'node:crypto';
import { InputError, validatePlan } from './schema.js';

export class DraftStore {
  constructor({ ttlMs = 2 * 60 * 60 * 1000, maxEntries = 100, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.drafts = new Map();
    this.confirmations = new Map();
  }

  trim(map) {
    for (const [id, value] of map) if (this.now() - value.createdAt >= this.ttlMs) map.delete(id);
    while (map.size >= this.maxEntries) map.delete(map.keys().next().value);
  }

  create(data, input, source, context = {}) {
    this.trim(this.drafts);
    const draft = { id: randomUUID(), data: structuredClone(data), input, source, createdAt: this.now(), questionRound: context.questionRound || 0, adjustments: structuredClone(context.adjustments || []), notes: structuredClone(context.notes || []), ...(context.originalInput ? { originalInput: context.originalInput, answers: structuredClone(context.answers || {}) } : {}) };
    this.drafts.set(draft.id, draft);
    return structuredClone(draft);
  }

  getDraft(draftId) {
    const draft = this.drafts.get(draftId);
    if (!draft || this.now() - draft.createdAt >= this.ttlMs) throw new InputError('This draft expired. Parse your input or load the example again.', 410);
    return structuredClone(draft);
  }

  confirm({ draftId, data, acknowledged, resolutions }) {
    const draft = this.getDraft(draftId);
    if (acknowledged !== true) throw new InputError('Review and explicitly confirm the courses, section times and preferences first.');
    for (const question of draft.data.clarifications) {
      const answer = resolutions?.[question];
      if (typeof answer !== 'string' || answer.trim().length < 2 || answer.length > 1000) throw new InputError('Answer every clarification and update the structured data before confirming.');
    }
    return this.savePlan(data, resolutions);
  }

  // A Generate/Update request authorizes solving; no extra acknowledgement is
  // required. The solver still reads a separately validated immutable snapshot.
  savePlan(data, resolutions = {}) {
    const confirmed = validatePlan(data);
    this.trim(this.confirmations);
    const id = randomUUID();
    this.confirmations.set(id, { data: structuredClone(confirmed), resolutions: structuredClone(resolutions || {}), createdAt: this.now() });
    return { confirmationId: id, data: confirmed };
  }

  getConfirmed(id) {
    const confirmation = this.confirmations.get(id);
    if (!confirmation || this.now() - confirmation.createdAt >= this.ttlMs) throw new InputError('Confirm your interpretation before finding timetables. The confirmation may have expired.', 409);
    return structuredClone(confirmation.data);
  }
}
