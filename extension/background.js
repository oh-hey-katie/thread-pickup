import {acceptSender, makeSnapshot} from './sync-model.js';
// Session storage is inaccessible to content scripts by default and disappears on browser exit.
const KEY = 'thread-pickup-live';
let writes = Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if (message?.type !== 'observe' || !acceptSender(sender)) return;
  writes = writes.catch(()=>{}).then(async()=>{
    const stored = (await chrome.storage.session.get(KEY))[KEY] || {tabs:{}};
    const id = String(sender.tab.id);
    if (!message.observation) { delete stored.tabs[id]; }
    else {
      if (message.observation.pageUrl !== sender.url) throw new Error('Navigation changed during capture.');
      stored.tabs[id] = makeSnapshot(message.observation,stored.tabs[id],new Date().toISOString(),sender.tab.id);
    }
    // Bound memory even when many ChatGPT tabs are open.
    const entries = Object.entries(stored.tabs).sort((a,b)=>b[1].snapshot.capturedAt.localeCompare(a[1].snapshot.capturedAt)).slice(0,8);
    stored.tabs = Object.fromEntries(entries);
    stored.latest = id;
    await chrome.storage.session.set({[KEY]:stored});
    respond({ok:true});
  }).catch(()=>respond({ok:false}));
  return true;
});
chrome.tabs.onRemoved.addListener(id=>{
  writes = writes.catch(()=>{}).then(async()=>{
    const stored = (await chrome.storage.session.get(KEY))[KEY];
    if (!stored) return;
    if (!stored.tabs[String(id)]) return;
    // Keep the last observation useful after the source tab closes, within this browser session.
    stored.tabs[String(id)].closed = true;
    await chrome.storage.session.set({[KEY]:stored});
  });
});
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:chrome.runtime.getURL('index.html')}));
