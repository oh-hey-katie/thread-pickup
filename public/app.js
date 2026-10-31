import {desktopQueue,fetchDesktop} from './desktop-source.js';
import { validateSnapshot, selectQueue, revision, isHidden, cardIdentity, isDismissGesture, PAGE_SIZE, MAX_BYTES } from './model.js';
import {browserConnection, CONNECTION_KEY, chooseBrowserSnapshot, browserQueue, emptyBrowserSnapshot, browserStatus} from './browser-source.js';

const $ = id => document.getElementById(id);
// Keep the original storage namespace so existing imports and hidden cards survive the rename.
const KEYS = { mode: 'recall:v1:mode', imported: 'recall:v1:imported', hidden: id => `recall:v1:hidden:${id}` };
let snapshot, demo, local, imported, dismissed = {}, mode = 'demo', selectedId, undoStack = [], dismissing = false, sourceVersion = 0;
let desktopData=null, desktopBusy=false, desktopAvailable=false, desktopTimer;
let browserState = {tabs:{}}, preferredTab = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storage = {
  read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { $('storage-warning').textContent = 'Browser storage is unavailable or full. Changes work for this visit but may not survive a reload.'; $('storage-warning').hidden = false; return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* The current session still works. */ } },
};

const el = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};
const origin = chat => mode === 'desktop' ? 'Desktop' : chat.source === 'chatgpt' ? 'ChatGPT' : chat.source === 'codex' ? 'Codex' : 'Conversation';
const dateLabel = value => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const hiddenChats = () => snapshot.chats.filter(chat => isHidden(chat, dismissed));

function safeDismissals(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) => key.length <= 200 && typeof value === 'string' && value.length < 4000));
}

function activate(source, name) {
  sourceVersion += 1;
  snapshot = source; mode = name; $('demo-guide').hidden=name!=='demo'; undoStack = []; dismissing = false;
  dismissed = safeDismissals(storage.read(KEYS.hidden(snapshot.id)));
  $('toast').hidden = true;
  storage.write(KEYS.mode, name);
  render();
}

function card(chat, lead) {
  const identity = cardIdentity(chat);
  const approval = chat.approval.state === 'waiting';
  const article = el('article', `chat-card${approval ? ' has-approval' : ''}${lead ? ' lead' : ''}`);
  article.dataset.id = chat.id;
  article.dataset.color = identity.color;
  article.setAttribute('aria-label', chat.title);
  const open = el('button', 'card-body'); open.type = 'button';
  open.setAttribute('aria-label', `View ${chat.title}`);
  const category = `${chat.pinned ? 'Pinned' : approval ? 'Approval' : mode === 'desktop' ? (chat.project?.kind==='folder'?'Folder':chat.project?'Project':'Recent chat') : mode === 'browser' ? 'Project chat' : 'Latest in project'} / ${chat.project?.name || origin(chat)}`;
  open.append(el('span', 'card-meta', category), el('h2', '', chat.title));
  open.append(el('p', chat.summary ? '' : 'card-summary-empty', chat.summary || 'Open this conversation to pick up the context.'));
  if (chat.nextStep && !approval && mode !== 'desktop') {
    const handoff = el('div', 'card-handoff');
    handoff.append(el('span', 'handoff-label', 'Pick up here'), el('span', 'handoff-copy', chat.nextStep));
    open.append(handoff);
  }
  open.addEventListener('click', () => showDetail(chat.id));
  article.append(open);
  const bottom = el('div', 'card-bottom');
  bottom.append(el('span', 'origin', origin(chat)));
  article.append(bottom);
  if (approval) {
    const ribbon = el('button', 'approval-ribbon'); ribbon.type = 'button';
    ribbon.setAttribute('aria-label', `Review approval context for ${chat.title}${chat.approval.summary ? `: ${chat.approval.summary}` : ''}`);
    ribbon.append(el('span', 'approval-label', 'Approval review ↗'),
      el('strong', 'approval-request', chat.approval.summary || 'Open the original chat to read the request.'),
      el('small', 'approval-reported', `Reported ${dateLabel(chat.approval.checkedAt)}`));
    ribbon.addEventListener('click', () => showDetail(chat.id)); article.append(ribbon);
  }
  const hide = el('button', 'hide-card', '×'); hide.type = 'button'; hide.setAttribute('aria-label', `Hide ${chat.title} from shelf`); hide.title = 'Hide from shelf';
  hide.addEventListener('click', () => dismiss(chat.id, article)); article.append(hide);
  attachSwipe(article, chat);
  return article;
}

function render() {
  const queue = mode === 'desktop' ? desktopQueue(snapshot.chats,dismissed) : mode === 'browser' ? browserQueue(snapshot.chats, dismissed) : selectQueue(snapshot.chats, dismissed);
  const visible = queue.slice(0, PAGE_SIZE);
  $('board').replaceChildren(...visible.map((chat, index) => card(chat, index === 0 && chat.approval.state === 'waiting')));
  $('empty').hidden = visible.length > 0;
  const hidden = hiddenChats();
  const connectionStatus = mode === 'browser' ? browserStatus(snapshot,chooseBrowserSnapshot(browserState,preferredTab)?.[1].closed) : null;
  $('hidden-count').textContent = hidden.length;
  $('restore-all').hidden = !hidden.length;
  $('empty-message').textContent = hidden.length ? 'You’ve set these conversations aside. They’re still in Hidden whenever you want them.' : 'There are no pinned or project conversations in this snapshot. Add a snapshot with pins or project membership to fill the shelf.';
  $('empty').querySelector('h2').textContent = connectionStatus && !hidden.length ? connectionStatus.title : 'A little breathing room.';
  if (connectionStatus && !hidden.length) $('empty-message').textContent = connectionStatus.message;
  $('source-label').textContent = mode === 'desktop' ? 'Connected to local desktop history' : mode === 'browser' ? 'Automatic browser connection · preview' : mode === 'demo' ? 'Fictional demo' : mode === 'local' ? 'Your local snapshot' : 'Imported snapshot';
  $('queue-label').textContent = `${visible.length} on shelf${queue.length > visible.length ? ` · ${queue.length - visible.length} in line` : ''}`;
  const approvals = queue.filter(chat => chat.approval.state === 'waiting').length;
  const collectionLabel = mode === 'desktop' ? 'Your desktop conversations' : connectionStatus ? connectionStatus.label : mode === 'demo' ? 'Fictional demo' : 'Kept close';
  $('board-label').textContent = approvals ? `${collectionLabel} / ${approvals} approval${approvals === 1 ? '' : 's'} reported` : collectionLabel;
  $('snapshot-label').textContent = mode === 'desktop' ? `Checked · ${new Date(snapshot.capturedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : mode === 'browser' ? `Last observed · ${new Date(snapshot.capturedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : `Snapshot · ${dateLabel(snapshot.capturedAt)}`;
  if (snapshot.id === 'browser-empty' && mode === 'browser') $('snapshot-label').textContent = 'No capture received';
  renderHidden(); renderSources();
}

function showDetail(id) {
  const chat = snapshot.chats.find(row => row.id === id); if (!chat) return;
  selectedId = id;
  $('detail-title').textContent = chat.title;
  $('detail-category').textContent = `${chat.pinned ? 'Pinned' : chat.project?.kind==='folder' ? 'Working folder' : chat.project ? 'Project conversation' : 'Conversation'} / ${chat.project?.name || origin(chat)}`;
  $('detail-summary').textContent = chat.handoff || chat.summary || 'There isn’t enough saved chat content to say what was finished.';
  $('detail-summary-label').textContent = mode === 'desktop' ? 'Where you left off · saved reply' : mode === 'browser' ? 'What the browser could read' : 'Where you left off';
  $('detail-next').textContent = chat.nextStep || 'Open the original chat to see the last reply and continue from there.';
  $('summary-source').open = false;
  $('detail-evidence').textContent = chat.evidence || 'Based on the imported snapshot; summaries are not independently verified by pick up.';
  $('approval-detail').hidden = chat.approval.state !== 'waiting';
  if (chat.approval.state === 'waiting') {
    $('approval-summary').textContent = chat.approval.summary || 'This chat reports a pending approval. Read the exact request in the original chat before deciding.';
    $('approval-date').textContent = `Reported ${dateLabel(chat.approval.checkedAt)} · pick up cannot execute approvals`;
  }
  $('open-chat').hidden = !chat.url;
  $('no-link').hidden = Boolean(chat.url);
  if (chat.url) $('open-chat').href = chat.url; else $('open-chat').removeAttribute('href');
  $('open-chat').target=chat.url?.startsWith('codex:')?'_self':'_blank';
  if (!$('detail-dialog').open) $('detail-dialog').showModal();
  if(mode === 'desktop') {
    $('open-chat').textContent='Continue in desktop ↗';
    fetchDesktop('/api/chat/'+encodeURIComponent(id)).then(detail=>{
      if(mode!=='desktop'||selectedId!==id||!$('detail-dialog').open)return;
      $('detail-summary').textContent=detail.handoff;
    }).catch(()=>{if(selectedId===id)$('detail-evidence').textContent+=' The latest detail check failed; showing the last available text.';});
  } else $('open-chat').textContent='Open original chat ↗';
}

async function dismiss(id, article, direction = 1) {
  if (dismissing) return;
  const chat = snapshot.chats.find(row => row.id === id); if (!chat || isHidden(chat, dismissed)) return;
  dismissing = true;
  const versionAtStart = sourceVersion;
  const oldIndex = [...$('board').children].findIndex(node => node.dataset.id === id);
  const revisionBefore = dismissed[id];
  if (article && !reducedMotion.matches) {
    article.classList.remove('dragging'); article.classList.add('leaving');
    article.style.transform = `translateX(${direction * Math.min(article.offsetWidth, 300)}px)`;
    await new Promise(resolve => setTimeout(resolve, 190));
  }
  if (sourceVersion !== versionAtStart) return;
  dismissed = { ...dismissed, [id]: revision(chat) };
  undoStack.push({ id, previous: revisionBefore });
  storage.write(KEYS.hidden(snapshot.id), dismissed);
  render(); dismissing = false;
  $('toast-message').textContent = `“${chat.title}” hidden from your shelf.`;
  $('undo-button').hidden = false; $('toast').hidden = false;
  const target = $('board').children[Math.max(0, Math.min(oldIndex, $('board').children.length - 1))];
  if (target) target.querySelector('.card-body').focus({ preventScroll: true }); else $('restore-all').focus({ preventScroll: true });
}

function attachSwipe(article, chat) {
  let gesture = null, suppressClick = false;
  article.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('.hide-card,.approval-ribbon') || dismissing) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, active: false };
  });
  article.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    gesture.dx = event.clientX - gesture.x; gesture.dy = event.clientY - gesture.y;
    if (!gesture.active && Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) { gesture = null; return; }
    if (!gesture.active && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5) {
      gesture.active = true; article.setPointerCapture(event.pointerId); article.classList.add('dragging');
    }
    if (gesture.active) {
      event.preventDefault(); article.style.transform = `translateX(${gesture.dx}px)`;
      article.style.opacity = String(Math.max(0.4, 1 - Math.abs(gesture.dx) / (article.offsetWidth * 1.4)));
    }
  });
  function finish(event, cancelled = false) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const current = gesture; gesture = null;
    if (article.hasPointerCapture(event.pointerId)) article.releasePointerCapture(event.pointerId);
    article.classList.remove('dragging'); article.style.opacity = ''; article.style.transform = '';
    if (!current.active) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    if (!cancelled && isDismissGesture(current.dx, current.dy, article.offsetWidth)) dismiss(chat.id, article, Math.sign(current.dx));
  }
  article.addEventListener('pointerup', event => finish(event));
  article.addEventListener('pointercancel', event => finish(event, true));
  article.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
}

function restore(id) {
  delete dismissed[id]; storage.write(KEYS.hidden(snapshot.id), dismissed); render();
  if (!hiddenChats().length && $('hidden-dialog').open) $('hidden-dialog').close();
}

function renderHidden() {
  const list = $('hidden-list'); list.replaceChildren();
  const hidden = hiddenChats();
  if (!hidden.length) { list.append(el('p', 'help', 'Nothing hidden. A swipe or the × on a card will set a conversation aside.')); return; }
  for (const chat of hidden) {
    const row = el('div', 'hidden-item'), copy = el('div');
    copy.append(el('p', '', chat.title), el('small', '', chat.project?.name || origin(chat)));
    const button = el('button', '', 'Restore'); button.type = 'button'; button.setAttribute('aria-label', `Restore ${chat.title}`); button.onclick = () => restore(chat.id);
    row.append(copy, button); list.append(row);
  }
}

function renderSources() {
  $('source-description').textContent = `${snapshot.name || 'Conversation snapshot'} · captured ${dateLabel(snapshot.capturedAt)}.`;
  $('coverage').textContent = snapshot.coverage || 'Only conversations supplied by this snapshot are available.';
  $('use-local').hidden = !local || mode === 'local';
  $('use-demo').hidden = mode === 'demo';
  $('forget-import').hidden = !imported;
  $('use-browser').hidden = !browserConnection || mode === 'browser';
  $('browser-controls').hidden = !browserConnection;
  $('source-note').querySelector('strong').textContent = mode === 'browser' ? 'Automatic capture · limited coverage' : 'Snapshot, not a live connection';
  $('source-note').querySelector('p').textContent = mode === 'browser' ? 'This preview reads rendered ChatGPT pages. It does not use private APIs, generate AI summaries, or execute approvals. Captured text stays in this Chrome session.' : 'This source is a saved list of conversations. It does not update automatically or execute approvals.';
  $('selection-help').textContent = mode === 'browser' ? 'Pins come first, then one observed chat per project in sidebar order. That order is not a verified activity timestamp.' : 'Pins come first, plus the latest available conversation per project. Waiting approvals rise to the top.';
  $('use-desktop').hidden=!desktopAvailable||mode==='desktop';
  $('desktop-source-info').hidden=mode!=='desktop';
  if(mode==='desktop') {
    $('source-note').querySelector('strong').textContent='Automatic desktop reader · local only';
    $('source-note').querySelector('p').textContent='Reads saved local conversations every 10 seconds while the shelf is open. Chat text stays in memory and is not uploaded or saved by Thread Pickup. No AI requests or subscription charges.';
    $('selection-help').textContent='Pinned-section chats first, then the latest chat per project or working folder, plus standalone chats. “Folder” means the exact desktop project assignment is unavailable. Live approvals and running status are not connected.';
    $('desktop-source-info').textContent=`${desktopData?.connection.conversationCount||0} conversations read · ${desktopData?.connection.projectCount||0} project records · ${desktopData?.connection.folderGroups||0} folder groups. Regular cloud ChatGPT chats and remote computers are not included.`;
  }
}

function refreshBrowserSource() {
  const selected = chooseBrowserSnapshot(browserState,preferredTab);
  const options = Object.entries(browserState.tabs || {}).map(([id,entry])=>{
    const label = entry.snapshot.chats.find(c=>c.url===entry.pageUrl)?.title || `ChatGPT tab ${id}`;
    const option = el('option','',`${label}${entry.closed ? ' (closed · last capture)' : ''}`);
    option.value = id; return option;
  });
  $('browser-tab').replaceChildren(...options);
  if (selected) { preferredTab = selected[0]; $('browser-tab').value = preferredTab; }
  const next = selected ? validateSnapshot(selected[1].snapshot) : emptyBrowserSnapshot();
  if (mode === 'browser' && snapshot?.id === next.id) {
    sourceVersion += 1; dismissing = false; snapshot = next; render();
    if ($('detail-dialog').open) {
      if (snapshot.chats.some(c=>c.id===selectedId)) showDetail(selectedId); else $('detail-dialog').close();
    }
  } else {
    $('detail-dialog').close(); activate(next,'browser');
  }
}
$('use-browser').onclick = () => { refreshBrowserSource(); $('sources-dialog').close(); };
$('browser-tab').onchange = event => { preferredTab = event.target.value; refreshBrowserSource(); };
$('clear-browser').onclick = async () => { await chrome.storage.session.remove(CONNECTION_KEY); browserState = {tabs:{}}; preferredTab = null; refreshBrowserSource(); };

$('hide-detail').onclick = () => { $('detail-dialog').close(); dismiss(selectedId, [...$('board').children].find(node => node.dataset.id === selectedId)); };
$('undo-button').onclick = () => {
  const previous = undoStack.pop(); if (!previous) return;
  if (previous.previous === undefined) delete dismissed[previous.id]; else dismissed[previous.id] = previous.previous;
  storage.write(KEYS.hidden(snapshot.id), dismissed); render();
  $('toast-message').textContent = 'Conversation restored.'; $('undo-button').hidden = !undoStack.length;
  const restored = [...$('board').children].find(node => node.dataset.id === previous.id); restored?.querySelector('.card-body').focus({ preventScroll: true });
};
$('toast-close').onclick = () => { $('toast').hidden = true; };
$('restore-all').onclick = () => { dismissed = {}; storage.write(KEYS.hidden(snapshot.id), dismissed); render(); };
$('hidden-button').onclick = () => { renderHidden(); $('hidden-dialog').showModal(); };
$('source-button').onclick = () => { renderSources(); $('sources-dialog').showModal(); };
document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
$('use-demo').onclick = () => { activate(demo, 'demo'); connectionLabel('Fictional demo · safe to share'); $('demo-guide').hidden=false; $('sources-dialog').close(); };
$('use-local').onclick = () => { if (local) activate(local, 'local'); $('sources-dialog').close(); };
$('forget-import').onclick = () => { if (imported) storage.remove(KEYS.hidden(imported.id)); storage.remove(KEYS.imported); imported = null; activate(local || demo, local ? 'local' : 'demo'); $('sources-dialog').close(); };
$('import-file').onchange = async event => {
  const file = event.target.files?.[0]; if (!file) return;
  $('import-error').hidden = true;
  try {
    if (file.size > MAX_BYTES) throw new Error('Choose a snapshot smaller than 5 MB.');
    const parsed = validateSnapshot(JSON.parse(await file.text()));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parsed.chats.map(chat => chat.id).sort().join('\n')));
    parsed.id = `import:${[...new Uint8Array(digest)].slice(0,12).map(n => n.toString(16).padStart(2,'0')).join('')}`;
    imported = parsed; storage.write(KEYS.imported, imported); activate(imported, 'imported'); $('sources-dialog').close();
  } catch (error) {
    $('import-error').textContent = error instanceof SyntaxError ? 'This file is not valid JSON. Download the example to see the expected format.' : error.message;
    $('import-error').hidden = false;
  } finally { event.target.value = ''; }
};

async function readJson(path) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`Snapshot unavailable (${response.status}).`);
  return validateSnapshot(await response.json());
}

function connectionLabel(message,state='connected') {
  $('connection-status').textContent=message;$('connection-status').dataset.state=state;
}
async function refreshDesktop({initial=false}={}) {
  if(desktopBusy)return;desktopBusy=true;
  if(initial)connectionLabel('Finding your desktop conversations…','loading');
  try {
    const data=await fetchDesktop();const next=validateSnapshot(data.snapshot);
    desktopData=data;desktopAvailable=true;
    const unchanged=mode==='desktop'&&snapshot&&JSON.stringify(snapshot.chats)===JSON.stringify(next.chats);
    if(initial||mode==='desktop') {
      if(unchanged){snapshot=next;$('snapshot-label').textContent=`Checked · ${new Date(next.capturedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;}
      else if(mode==='desktop'&&snapshot?.id===next.id){sourceVersion++;snapshot=next;render();}
      else activate(next,'desktop');
      connectionLabel(`Connected · ${data.connection.conversationCount} chats · refreshes automatically`);
      $('retry-desktop').hidden=true;
    }
  } catch {
    if(initial||mode==='desktop') {
      connectionLabel('Desktop reader unavailable · retry when ready','error');$('retry-desktop').hidden=false;
      if(initial&&!snapshot){activate({version:1,id:'desktop-empty',name:'Desktop connection',capturedAt:new Date().toISOString(),chats:[]},'desktop');$('empty').querySelector('h2').textContent='Let’s connect your desktop.';$('empty-message').textContent='Start Thread Pickup with npm start. You’ll need ChatGPT Desktop or Codex installed on this computer.';}
    }
  } finally {desktopBusy=false;}
}
$('retry-desktop').onclick=()=>refreshDesktop({initial:mode!=='desktop'});
$('use-desktop').onclick=()=>{activate(desktopData.snapshot,'desktop');refreshDesktop();$('sources-dialog').close();};
async function start() {
  demo=await readJson('./demo.json');
  const demoOnly=new URLSearchParams(location.search).has('demo');
  const isLoopback=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  try {const saved=storage.read(KEYS.imported);if(saved)imported=validateSnapshot(saved);}catch{imported=null;}
  if(browserConnection) {
    browserState=(await chrome.storage.session.get(CONNECTION_KEY))[CONNECTION_KEY]||{tabs:{}};
    refreshBrowserSource();
    chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='session'||!changes[CONNECTION_KEY])return;browserState=changes[CONNECTION_KEY].newValue||{tabs:{}};if(mode==='browser')refreshBrowserSource();});
  } else if(demoOnly||!isLoopback) {
    activate(demo,'demo');connectionLabel('Fictional demo · safe to share');
  } else {
    await refreshDesktop({initial:true});
    desktopTimer=setInterval(()=>{if(mode==='desktop')refreshDesktop();},10000);
    window.addEventListener('focus',()=>{if(mode==='desktop')refreshDesktop();});
  }
  $('connection-status').hidden=browserConnection;
  $('demo-guide').hidden=mode!=='demo';
}
start().catch(()=>{connectionLabel('Unable to load the shelf','error');$('retry-desktop').hidden=false;});
