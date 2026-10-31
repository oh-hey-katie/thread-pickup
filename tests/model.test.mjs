import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSnapshot, selectQueue, revision, isHidden, isDismissGesture, safeChatUrl, cardIdentity } from '../public/model.js';

const row = (id, options = {}) => ({ id, title: id, updatedAt: '2026-10-29T12:00:00Z', ...options });
const project = { id: 'project-a', name: 'Example' };
const snapshot = rows => validateSnapshot({ version: 1, id: 'test', capturedAt: '2026-10-29T12:00:00Z', chats: rows });

test('shelf includes pins and latest project chats, excludes unfiled recents', () => {
  const data = snapshot([row('pin', { pinned: true }), row('new', { project }), row('old', { project, updatedAt: '2026-10-28T00:00:00Z' }), row('unfiled')]);
  assert.deepEqual(selectQueue(data.chats).map(c => c.id), ['pin', 'new']);
});
test('pin and latest project representative are deduplicated', () => {
  const data = snapshot([row('both', { pinned: true, project }), row('older', { project, updatedAt: '2026-10-28T00:00:00Z' })]);
  assert.deepEqual(selectQueue(data.chats).map(c => c.id), ['both']);
});
test('hiding latest project chat promotes the next available chat', () => {
  const data = snapshot([row('new', { project }), row('old', { project, updatedAt: '2026-10-28T00:00:00Z' })]);
  const hidden = { new: revision(data.chats[0]) };
  assert.deepEqual(selectQueue(data.chats, hidden).map(c => c.id), ['old']);
  assert.equal(data.chats[0].title, 'new');
  delete hidden.new;
  assert.deepEqual(selectQueue(data.chats, hidden).map(c => c.id), ['new']);
});
test('older project approval is surfaced before pins and newer project chats', () => {
  const data = snapshot([row('pin', { pinned: true }), row('new', { project }), row('approval', { project, updatedAt: '2026-10-27T00:00:00Z', approval: { state: 'waiting' } })]);
  assert.deepEqual(selectQueue(data.chats).map(c => c.id), ['approval', 'pin', 'new']);
});
test('multiple approvals retain their own flags', () => {
  const data = snapshot([row('one', { pinned: true, approval: { state: 'waiting' } }), row('two', { project, approval: { state: 'waiting' } })]);
  assert.equal(selectQueue(data.chats).filter(c => c.approval.state === 'waiting').length, 2);
});
test('unknown statuses are never inferred to be pending approvals', () => {
  const data = snapshot([row('one', { pinned: true, status: 'active' })]);
  assert.equal(data.chats[0].approval.state, 'unknown');
});
test('new activity or changed approval resurfaces a hidden conversation', () => {
  const original = snapshot([row('one', { pinned: true })]).chats[0];
  const hidden = { one: revision(original) };
  assert.ok(isHidden(original, hidden));
  assert.ok(!isHidden({ ...original, updatedAt: '2026-10-30T00:00:00Z' }, hidden));
  assert.ok(!isHidden({ ...original, approval: { state: 'waiting', summary: 'Please review' } }, hidden));
});
test('routine status rechecks do not defeat dismissal', () => {
  const original = snapshot([row('one', { pinned: true, approval: { state: 'waiting', summary: 'Review this' } })]).chats[0];
  const hidden = { one: revision(original) };
  assert.ok(isHidden({ ...original, approval: { ...original.approval, checkedAt: '2026-11-01T00:00:00Z' } }, hidden));
});
test('same project keeps its visual identity after replacement', () => {
  assert.deepEqual(cardIdentity(row('a', { project })), cardIdentity(row('b', { project })));
});
test('horizontal swipes dismiss; scrolls, small drags, and diagonals do not', () => {
  assert.ok(isDismissGesture(125, 4, 300)); assert.ok(isDismissGesture(-125, 4, 300));
  assert.ok(!isDismissGesture(10, 0, 300)); assert.ok(!isDismissGesture(80, 120, 300));
  assert.ok(!isDismissGesture(100, 100, 300));
});
test('snapshot validation rejects duplicates, invalid dates, and wrong exports', () => {
  assert.throws(() => snapshot([row('a'), row('a')]), /duplicate/);
  assert.throws(() => snapshot([row('a', { updatedAt: 'yesterday' })]), /valid/);
  assert.throws(() => validateSnapshot([]), /pick up snapshot/);
});
test('snapshot validation keeps text as data and drops unexpected fields', () => {
  const data = snapshot([row('a', { title: '<img src=x onerror=alert(1)>', secret: 'do-not-keep' })]);
  assert.equal(data.chats[0].title, '<img src=x onerror=alert(1)>');
  assert.equal(data.chats[0].secret, undefined);
});
test('only supported original chat links are allowed', () => {
  assert.equal(safeChatUrl('https://chatgpt.com/c/abc-123'), 'https://chatgpt.com/c/abc-123');
  assert.equal(safeChatUrl('codex://threads/abc-123'), 'codex://threads/abc-123');
  for (const url of ['javascript:alert(1)', 'https://evil.test/c/x', 'https://chatgpt.com.evil.test/c/x', 'https://name:password@chatgpt.com/c/x', 'https://chatgpt.com/c/x?token=private', 'file:///tmp/secret']) assert.equal(safeChatUrl(url), null);
});
test('demo is fictional, usable, and has more cards than the first page', async () => {
  const demo = validateSnapshot(JSON.parse(await readFile(new URL('../public/demo.json', import.meta.url), 'utf8')));
  assert.equal(demo.id, 'recall-fictional-demo');
  assert.ok(demo.chats.every(c => c.id.startsWith('demo-') && c.url === null));
  assert.ok(selectQueue(demo.chats).length > 9);
  assert.equal(selectQueue(demo.chats).filter(c => c.approval.state === 'waiting').length, 3);
});
