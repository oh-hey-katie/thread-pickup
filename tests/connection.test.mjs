import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSnapshot,acceptSender} from '../extension/sync-model.js';
import {revision,selectQueue} from '../public/model.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const at = '2026-10-30T12:00:00Z';
const later = '2026-10-30T12:05:00Z';
const item = {id:'chatgpt:test-a',title:'Fictional design chat',url:'https://chatgpt.com/c/test-a',pinned:true,order:0};
const observation = () => ({pageUrl:item.url,currentId:item.id,chats:[item],turns:[{role:'assistant',text:'The draft is ready.'}],atBottom:true,recognized:true});
test('only top-level ChatGPT content scripts can deliver observations',()=>{
 assert.equal(acceptSender({frameId:0,tab:{id:1},url:item.url}),true);
 for(const sender of [{frameId:1,tab:{id:1},url:item.url},{frameId:0,tab:{id:1},url:'https://chatgpt.com.evil.test/'},{url:item.url}]) assert.equal(acceptSender(sender),false);
});
test('extractor normalizes project URLs without accepting foreign, shared or query links',async()=>{
 const context = vm.createContext({URL});
 vm.runInContext(await readFile(new URL('../extension/capture.js',import.meta.url),'utf8'),context);
 const parse = context.ThreadPickupCapture.chatUrl;
 assert.equal(parse('/g/g-p-fiction/c/test-a').url,item.url);
 for(const link of ['https://evil.test/c/test-a','/share/test-a','/c/test-a?x=1','/c/test-a#foo','https://me:secret@chatgpt.com/c/test-a']) assert.equal(parse(link),null);
});
test('captures excerpts with attribution, never invents approvals or AI summaries',()=>{
 const result = makeSnapshot(observation(),null,at,4).snapshot;
 assert.match(result.chats[0].summary,/Visible excerpt/);
 assert.match(result.chats[0].handoff,/ChatGPT: “The draft is ready.”/);
 assert.equal(result.chats[0].approval.state,'unknown');
 assert.equal(result.id,'browser-tab:4');
});
test('unchanged pages preserve revisions; a new reply resurfaces hidden cards',()=>{
 const first = makeSnapshot(observation(),null,at,4);
 const second = makeSnapshot(observation(),first,later,4);
 assert.equal(revision(first.snapshot.chats[0]),revision(second.snapshot.chats[0]));
 const changed = observation(); changed.turns[0].text='The revised draft is ready.';
 const third = makeSnapshot(changed,second,later,4);
 const hidden = {[item.id]:revision(first.snapshot.chats[0])};
 assert.equal(selectQueue(second.snapshot.chats,hidden).length,0);
 assert.equal(selectQueue(third.snapshot.chats,hidden).length,1);
});
test('missing replies and older viewports are explicitly qualified',()=>{
 const input=observation(); input.turns=[{role:'user',text:'Review the draft.'},{role:'assistant',text:'This response could not load',unavailable:true}];input.atBottom=false;
 const chat=makeSnapshot(input,null,at).snapshot.chats[0];
 assert.match(chat.handoff,/could not load/);assert.match(chat.evidence,/older exchange/);
 assert.doesNotMatch(chat.summary,/ChatGPT:/);
});
test('streaming responses are not summarized and metadata-only pages do not inherit excerpts',()=>{
 const input=observation();input.streaming=true;
 assert.match(makeSnapshot(input,null,at).snapshot.chats[0].summary,/responding/);
 const old=makeSnapshot(observation(),null,at);
 const home={...observation(),pageUrl:'https://chatgpt.com/',currentId:null,turns:[]};
 assert.match(makeSnapshot(home,old,later).snapshot.chats[0].summary,/No readable/);
});
test('page replacement removes absent chats and an unpin removes an unfiled card',()=>{
 const old=makeSnapshot(observation(),null,at);
 assert.equal(makeSnapshot({...observation(),chats:[]},old,later).snapshot.chats.length,0);
 const input=observation();input.chats=[{...item,pinned:false}];
 assert.equal(selectQueue(makeSnapshot(input,old,later).snapshot.chats).length,0);
});
test('malformed metadata, unsafe links, and duplicate rows are bounded',()=>{
 const input=observation(); input.chats=[item,item,{...item,id:'bad',url:'javascript:alert(1)'},{...item,id:'chatgpt:other'}];
 const result=makeSnapshot(input,null,at).snapshot;
 assert.equal(result.chats.length,1);
 assert.throws(()=>makeSnapshot({...input,pageUrl:'https://evil.test'},null,at));
 assert.throws(()=>makeSnapshot({...input,chats:Array(501).fill(item)},null,at));
});
test('browser queue uses observed sidebar order instead of inventing project activity',async()=>{
 globalThis.location = {protocol:'http:'};
 const {browserQueue,chooseBrowserSnapshot} = await import('../public/browser-source.js');
 const rows = makeSnapshot({...observation(),chats:[
  {...item,id:'chatgpt:z',url:'https://chatgpt.com/c/z',pinned:false,project:{id:'p',name:'Example'},order:0},
  {...item,id:'chatgpt:a',url:'https://chatgpt.com/c/a',pinned:false,project:{id:'p',name:'Example'},order:1},
  item
 ]},null,at).snapshot.chats;
 assert.deepEqual(browserQueue(rows,{}).map(c=>c.id),[item.id,'chatgpt:z']);
 assert.deepEqual(browserQueue(rows,{'chatgpt:z':revision(rows[0])}).map(c=>c.id),[item.id,'chatgpt:a']);
 assert.equal(chooseBrowserSnapshot({latest:'2',tabs:{'1':{},'2':{}}},'1')[0],'1');
 assert.equal(chooseBrowserSnapshot({latest:'2',tabs:{'2':{}}},'1')[0],'2');
 assert.equal(chooseBrowserSnapshot({tabs:{}},null),null);
});
test('background capture survives discovery errors and unchanged polls do not resend',async()=>{
 const timers=[], sent=[];
 const context=vm.createContext({
  document:{visibilityState:'hidden',body:{},addEventListener(){}},location:{href:item.url},
  window:{addEventListener(){}},MutationObserver:class{observe(){}},
  ThreadPickupCapture:{read:()=>observation()},
  ThreadPickupDiscovery:{step(){throw new Error('Unsupported project layout');}},
  chrome:{runtime:{sendMessage:async message=>{sent.push(message);return {ok:true};}}},
  setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},setInterval(){},
 });
 vm.runInContext(await readFile(new URL('../extension/observe.js',import.meta.url),'utf8'),context);
 await timers[0]();
 assert.equal(sent.length,1);
 assert.equal(sent[0].observation.currentId,item.id);
 await timers[0]();
 assert.equal(sent.length,1);
});
test('closing the source tab retains its last capture and marks it closed',async()=>{
 let onMessage,onRemoved,notify;
 let state={};
 const originalChrome=globalThis.chrome;
 globalThis.chrome={
  runtime:{onMessage:{addListener(fn){onMessage=fn;}},getURL:p=>p},
  tabs:{onRemoved:{addListener(fn){onRemoved=fn;}},create(){}},
  action:{onClicked:{addListener(){}}},
  storage:{session:{async get(){return state;},async set(next){state=structuredClone(next);notify?.();}}},
 };
 try {
  await import('../extension/background.js');
  await new Promise(resolve=>onMessage({type:'observe',observation:observation()},{frameId:0,tab:{id:4},url:item.url},r=>{assert.equal(r.ok,true);resolve();}));
  const captured=state['thread-pickup-live'].tabs['4'].snapshot.capturedAt;
  await new Promise(resolve=>{notify=resolve;onRemoved(4);});
  const retained=state['thread-pickup-live'].tabs['4'];
  assert.equal(retained.closed,true);
  assert.equal(retained.snapshot.chats[0].id,item.id);
  assert.equal(retained.snapshot.capturedAt,captured);
 } finally {globalThis.chrome=originalChrome;}
});
test('an unconnected shelf does not look like an empty synced account',async()=>{
 globalThis.location={protocol:'http:'};
 const {browserStatus,emptyBrowserSnapshot}=await import('../public/browser-source.js');
 assert.equal(browserStatus(emptyBrowserSnapshot()).label,'Not connected yet');
 assert.equal(browserStatus(makeSnapshot(observation(),null,at).snapshot,true).label,'Last capture · source tab closed');
 assert.equal(browserStatus(makeSnapshot({...observation(),chats:[]},null,at).snapshot).title,'No eligible chats in this capture');
});
