import test from 'node:test';import assert from 'node:assert/strict';
import {groupFor,recentContext,desktopSnapshot} from '../desktop/model.mjs';
import {desktopQueue} from '../public/desktop-source.js';
import {revision} from '../public/model.js';
const thread={id:'fictional-a',name:'Fictional chat',cwd:'/work/alpha',updatedAt:1700000000};
const projects=[{id:'project-a',name:'Alpha',roots:[{path:'/work/alpha'}]}];
test('exact folder matches remain labeled folders; canonical assignments are distinct',()=>{
 assert.equal(groupFor(thread,projects).kind,'folder');
 assert.equal(groupFor({...thread,projectId:'project-a'},projects).kind,'project');
 assert.equal(groupFor({...thread,cwd:'/work/alpha/nested'},projects).name,'nested');
 assert.equal(groupFor(thread,[...projects,{id:'b',name:'Other',roots:[{path:'/work/alpha'}]}]).name,'alpha');
});
test('latest completed final reply is used; active/tool text is excluded',()=>{
 const context=recentContext([{status:'inProgress',items:[{type:'agentMessage',text:'unfinished'}]},{status:'completed',items:[{type:'userMessage',content:[{type:'text',text:'Review the draft.'}]},{type:'commandExecution',text:'secret shell output'},{type:'agentMessage',phase:'commentary',text:'checking'},{type:'agentMessage',phase:'final',text:'The draft is ready.'}]}]);
 assert.equal(context.summary,'The draft is ready.');assert.match(context.handoff,/Review the draft/);assert.doesNotMatch(context.handoff,/unfinished|secret shell/);
 assert.equal(recentContext([{status:'inProgress',items:[]}]).hasReply,false);
});
test('desktop snapshots do not invent approvals or include spawned agents',()=>{
 const snap=desktopSnapshot([thread,{...thread,id:'child',parentThreadId:'fictional-a'}],projects);
 assert.equal(snap.chats.length,1);assert.equal(snap.chats[0].approval.state,'unknown');assert.equal(snap.chats[0].project.kind,'folder');assert.equal(snap.chats[0].url,'codex://threads/fictional-a');
});
test('queue replaces hidden group representatives and resurfacing uses saved updates',()=>{
 const snap=desktopSnapshot([thread,{...thread,id:'older',updatedAt:1699999900},{...thread,id:'other',cwd:'/work/beta'}],projects);
 const hidden={[snap.chats[0].id]:revision(snap.chats[0])};
 assert.deepEqual(new Set(desktopQueue(snap.chats,hidden).map(c=>c.id)),new Set(['desktop:older','desktop:other']));
 const updated=desktopSnapshot([{...thread,updatedAt:1700000100}],projects);assert.equal(desktopQueue(updated.chats,hidden).length,1);
});
