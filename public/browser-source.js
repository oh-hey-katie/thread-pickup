import {isHidden} from './model.js';
export const browserConnection = location.protocol === 'chrome-extension:' && !!globalThis.chrome?.storage?.session;
export const CONNECTION_KEY = 'thread-pickup-live';
export function chooseBrowserSnapshot(state, preferred) {
  const entries = Object.entries(state?.tabs || {});
  return entries.find(([id])=>id===preferred) || entries.find(([id])=>id===state?.latest) || entries[0] || null;
}
export function browserQueue(chats, dismissed) {
  const available = chats.filter(c=>!isHidden(c,dismissed));
  const chosen = new Map(available.filter(c=>c.pinned).map(c=>[c.id,c]));
  const projects = new Set();
  for (const chat of available) if (chat.project && !projects.has(chat.project.id)) {
    projects.add(chat.project.id); chosen.set(chat.id,chat);
  }
  return [...chosen.values()].sort((a,b)=>Number(b.pinned)-Number(a.pinned) || a.pinOrder-b.pinOrder);
}
export function emptyBrowserSnapshot() {
  return {version:1,id:'browser-empty',name:'Automatic browser connection',capturedAt:new Date().toISOString(),chats:[],coverage:'Open ChatGPT in Chrome after installing the extension. Only rendered pinned and project chats are observed. This is not a complete account sync.'};
}
export function browserStatus(snapshot, closed = false) {
  if (snapshot.id === 'browser-empty') return {
    title:'Waiting for the first capture',
    message:'No chat data has arrived yet. Open or reload ChatGPT in the Chrome profile where Thread Pickup is installed.',
    label:'Not connected yet',
  };
  return {
    title:'No eligible chats in this capture',
    message:'The connection received a page, but it did not contain recognizable pinned or project chats. Expand the ChatGPT sidebar or a project to make those chats available.',
    label:closed ? 'Last capture · source tab closed' : 'Observed in ChatGPT · partial view',
  };
}
