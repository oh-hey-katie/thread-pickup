export const MAX_CHATS = 5000;
export const MAX_BYTES = 5 * 1024 * 1024;
export const PAGE_SIZE = 9;

const text = (value, max, fallback = '') => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export function safeChatUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol === 'https:' && url.hostname === 'chatgpt.com' && !url.port && /^\/c\/[a-zA-Z0-9-]+$/.test(url.pathname)) return url.href;
    if (url.protocol === 'codex:' && url.hostname === 'threads' && /^\/[a-zA-Z0-9-]+$/.test(url.pathname)) return url.href;
  } catch { /* An invalid or unsupported link is simply omitted. */ }
  return null;
}

export function validateSnapshot(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.chats)) throw new Error('Use a pick up snapshot with version 1 and a chats array.');
  if (input.chats.length > MAX_CHATS) throw new Error(`A snapshot can contain at most ${MAX_CHATS} chats.`);
  const capturedAt = timestamp(input.capturedAt);
  if (!capturedAt) throw new Error('The snapshot needs a valid capturedAt date.');
  const seen = new Set();
  const chats = input.chats.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Chat ${index + 1} is not an object.`);
    const id = text(row.id, 200);
    const title = text(row.title, 300);
    const updatedAt = timestamp(row.updatedAt);
    if (!id || !title || !updatedAt) throw new Error(`Chat ${index + 1} needs an id, title, and valid updatedAt date.`);
    if (seen.has(id)) throw new Error(`Chat ${index + 1} has a duplicate id.`);
    seen.add(id);
    const project = row.project && text(row.project.id, 200) ? { id: text(row.project.id, 200), name: text(row.project.name, 100, 'Untitled project') || 'Untitled project', ...(row.project.kind === 'folder' ? {kind:'folder'} : {}) } : null;
    const approval = row.approval?.state === 'waiting' ? {
      state: 'waiting',
      summary: text(row.approval.summary, 1000),
      checkedAt: timestamp(row.approval.checkedAt) || capturedAt,
    } : { state: 'unknown' };
    return { id, title, updatedAt, pinned: row.pinned === true,
      pinOrder: Number.isFinite(row.pinOrder) ? row.pinOrder : 999,
      project, source: ['chatgpt', 'codex'].includes(row.source) ? row.source : 'other',
      summary: text(row.summary, 1200), handoff: text(row.handoff, 1800), nextStep: text(row.nextStep, 1200),
      evidence: text(row.evidence, 500), url: safeChatUrl(row.url), approval };
  });
  return { version: 1, id: text(input.id, 200, 'imported') || 'imported', name: text(input.name, 100, 'Imported snapshot'), capturedAt, coverage: text(input.coverage, 1000), chats };
}

export function revision(chat) {
  // A changed approval must resurface even if the conversation timestamp did not change.
  return JSON.stringify([chat.updatedAt, chat.approval.state, chat.approval.summary || '']);
}

export function isHidden(chat, dismissed) { return dismissed[chat.id] === revision(chat); }
const newest = (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id);

export function selectQueue(chats, dismissed = {}) {
  const available = chats.filter(chat => !isHidden(chat, dismissed));
  const selected = new Map(available.filter(chat => chat.pinned).map(chat => [chat.id, chat]));
  const projects = new Set();
  for (const chat of [...available].sort(newest)) {
    if (chat.project && !projects.has(chat.project.id)) {
      projects.add(chat.project.id);
      selected.set(chat.id, chat);
    }
    // A waiting approval in an older project thread still deserves a place in the queue.
    if (chat.approval.state === 'waiting' && (chat.pinned || chat.project)) selected.set(chat.id, chat);
  }
  return [...selected.values()].sort((a, b) => {
    const approvalDifference = Number(b.approval.state === 'waiting') - Number(a.approval.state === 'waiting');
    if (approvalDifference) return approvalDifference;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) return a.pinOrder - b.pinOrder || newest(a, b);
    return newest(a, b);
  });
}

export function isDismissGesture(dx, dy, width) {
  return Math.abs(dx) >= Math.max(72, Math.min(width * 0.28, 130)) && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function cardIdentity(chat) {
  const key = chat.project?.id || chat.id;
  let hash = 2166136261;
  for (const letter of key) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  const value = hash >>> 0;
  return { color: value % 5, pattern: value % 4 };
}
