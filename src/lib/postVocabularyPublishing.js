import { normalizePostResponse } from './postResponse.js';
import { normalizePostGlossary } from './postGlossary.js';

function publishedPostId(confirmation, payload) {
  let result;
  try { result = normalizePostResponse(confirmation); } catch { return ''; }
  const post = result.item || result.post || result.reel || result;
  const id = post.id || post.postId || post.reelId || payload?.id || payload?.postId || payload?.reelId;
  return typeof id === 'string' && id.trim() && id.length <= 200 && (payload?.body || payload?.title) ? id : '';
}

// Only enrich an accepted write. A failed optional AI step must never invite a
// duplicate publication or turn an already-saved edit into a failed edit.
export async function preparePublishedVocabulary(confirmation, payload, generate) {
  const id = publishedPostId(confirmation, payload);
  if (!id) return;
  try { await generate(id); } catch { /* The post is saved; definitions are optional. */ }
}

const MAX_PENDING = 20;
const MAX_AGE = 7 * 86400000;
const RETRY_DELAYS = [5000, 20000, 60000];
const POLL_DELAYS = [4000, 8000, 16000, 30000, 30000, 30000];
const permanentFailure = error => [400, 401, 403, 404, 405, 410, 422].includes(error?.response?.status);
export const vocabularyOutboxKey = account => `smarty-word-preparation-v1:${encodeURIComponent(account)}`;

// Persist only post ids, never post text, definitions or credentials. Once the
// server acknowledges its durable queue, there is no browser-owned AI job.
export function createVocabularyPublisher({ enqueue, readStatus, onReady = () => {},
  storage, now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  canRun = () => true } = {}) {
  let account = '', epoch = 0, sequence = 0, running = false, wake = null;
  let jobs = new Map();
  const polls = new Map();
  const current = (owner, version) => account === owner && epoch === version;
  const persist = () => {
    if (!account) return;
    try {
      const values = [...jobs.values()].map(({ id, createdAt }) => ({ id, createdAt }));
      if (values.length) storage?.setItem(vocabularyOutboxKey(account), JSON.stringify(values));
      else storage?.removeItem(vocabularyOutboxKey(account));
    } catch { /* Storage may be unavailable; the current session still works. */ }
  };
  const notify = (owner, version, id, result) => {
    if (!current(owner, version)) return;
    const glossary = normalizePostGlossary(result?.postGlossary);
    if (result?.status === 'ready' && glossary) onReady({ account: owner, postId: id, postGlossary: glossary });
  };
  const poll = (id, ticket, owner, version, attempt = 0) => {
    if (!current(owner, version) || attempt >= POLL_DELAYS.length) return;
    const timer = schedule(async () => {
      if (polls.get(id)?.ticket !== ticket || !current(owner, version)) return;
      polls.delete(id);
      if (!canRun()) return; // The next normal feed load already contains saved meanings.
      try {
        const result = await readStatus(id);
        if (!current(owner, version) || jobs.has(id) || (polls.has(id) && polls.get(id).ticket !== ticket)) return;
        if (result?.status === 'ready') { notify(owner, version, id, result); return; }
        if (['unavailable', 'failed', 'cancelled'].includes(result?.status)) return;
      } catch (error) { if (permanentFailure(error)) return; }
      poll(id, ticket, owner, version, attempt + 1);
    }, POLL_DELAYS[attempt]);
    polls.set(id, { timer, ticket });
  };
  const stopTimers = () => {
    if (wake !== null) cancel(wake);
    wake = null;
    for (const value of polls.values()) cancel(value.timer);
    polls.clear();
  };
  const pump = async () => {
    if (!account || running || !jobs.size || !canRun()) return;
    if (wake !== null) cancel(wake);
    wake = null;
    const owner = account, version = epoch;
    const batch = [...jobs.values()].filter(job => job.attempts < 3 && job.due <= now()).slice(0, 2);
    running = true;
    await Promise.all(batch.map(async job => {
      try {
        const result = await enqueue(job.id);
        if (!current(owner, version) || jobs.get(job.id)?.ticket !== job.ticket) return;
        if (result?.status !== 'ready' && !['queued', 'preparing'].includes(result?.status)) throw new Error('Word preparation was not acknowledged');
        jobs.delete(job.id); persist();
        if (result.status === 'ready') notify(owner, version, job.id, result);
        else poll(job.id, job.ticket, owner, version);
      } catch (error) {
        if (!current(owner, version) || jobs.get(job.id)?.ticket !== job.ticket) return;
        if (permanentFailure(error)) jobs.delete(job.id);
        else {
          job.attempts++;
          const retryAfter = Math.min(300000, Math.max(0, Number(error?.response?.headers?.['retry-after']) || 0) * 1000);
          job.due = now() + Math.max(RETRY_DELAYS[job.attempts - 1], retryAfter);
        }
        persist();
      }
    }));
    if (!current(owner, version)) return;
    running = false;
    const due = [...jobs.values()].filter(job => job.attempts < 3).map(job => job.due);
    if (due.length) wake = schedule(() => { wake = null; void pump(); }, Math.max(0, Math.min(...due) - now()));
  };
  return {
    activate(nextAccount) {
      const clean = typeof nextAccount === 'string' ? nextAccount.trim() : '';
      if (clean === account) { void pump(); return; }
      stopTimers(); epoch++; account = clean; running = false; jobs = new Map();
      if (!account) return;
      try {
        const saved = JSON.parse(storage?.getItem(vocabularyOutboxKey(account)) || '[]');
        if (Array.isArray(saved)) for (const value of saved.slice(-MAX_PENDING)) {
          if (typeof value?.id === 'string' && value.id.trim() && value.id.length <= 200
              && Number.isFinite(value.createdAt) && value.createdAt <= now() && now() - value.createdAt < MAX_AGE) {
            jobs.set(value.id, { id: value.id, createdAt: value.createdAt, due: now(), attempts: 0, ticket: ++sequence });
          }
        }
      } catch { /* A corrupt outbox must not block startup or publishing. */ }
      persist(); void pump();
    },
    submit(confirmation, payload) {
      const id = publishedPostId(confirmation, payload);
      if (!account || !id) return false;
      if (polls.has(id)) { cancel(polls.get(id).timer); polls.delete(id); }
      // Keep the newest actions if this device has been offline for a long time.
      if (jobs.size >= MAX_PENDING) jobs.delete(jobs.keys().next().value);
      jobs.set(id, { id, createdAt: now(), due: now(), attempts: 0, ticket: ++sequence });
      persist(); void pump();
      return true;
    },
    resume() { void pump(); },
    deactivate() { stopTimers(); epoch++; account = ''; running = false; jobs = new Map(); },
  };
}
