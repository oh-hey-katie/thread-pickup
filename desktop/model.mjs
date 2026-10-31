import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateSnapshot} from '../public/model.js';
const plain = (value,max=1600) => String(value||'').replace(/<[^>]*>/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*`#]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,20);
export function groupFor(thread,projects) {
 const assigned=projects.find(p=>p.id===thread.projectId);
 if(assigned)return {id:`project:${assigned.id}`,name:assigned.name,kind:'project'};
 if(!thread.cwd)return null;
 // Exact folder matching only. Never invent canonical project membership from a parent folder.
 const matches=projects.filter(p=>p.roots?.some(r=>path.normalize(r.path)===path.normalize(thread.cwd)));
 return {id:`folder:${hash(thread.cwd)}`,name:matches.length===1?matches[0].name:path.basename(thread.cwd),kind:'folder'};
}
export function recentContext(turns) {
 const completed=turns.filter(t=>t.status==='completed');
 for(const turn of completed) {
  const items=turn.items||[];
  const replies=items.filter(i=>i.type==='agentMessage'&&typeof i.text==='string'&&i.text.trim());
  const final=replies.filter(i=>i.phase==='final').at(-1)||replies.at(-1);
  const request=items.find(i=>i.type==='userMessage');
  const userText=(request?.content||[]).filter(c=>c.type==='text').map(c=>c.text).join(' ');
  if(final)return {summary:plain(final.text,270),handoff:`Last saved reply\n${plain(final.text,1250)}${userText?'\n\nYour request\n'+plain(userText,380):''}`,hasReply:true};
 }
 return {summary:'Open this chat to pick up the conversation.',handoff:'No completed reply was available in the recent saved history. Open the original chat to see the full context.',hasReply:false};
}
export function desktopSnapshot(threads,projects,contexts=new Map(),{checkedAt=new Date().toISOString(),partial=false}={}) {
 const chats=threads.filter(t=>!t.parentThreadId&&!t.ephemeral&&/^[\w-]+$/.test(t.id)).map(t=>{
  const context=contexts.get(t.id)||recentContext([]);
  const project=groupFor(t,projects);
  const updatedAt=new Date(t.updatedAt*1000).toISOString();
  return {id:`desktop:${t.id}`,title:t.name||'Untitled conversation',url:`codex://threads/${t.id}`,source:'codex',project,pinned:t.section?.name==='Pinned',pinOrder:t.sectionEnteredAt||0,updatedAt,
   summary:context.summary,handoff:context.handoff,nextStep:'Open this conversation in the desktop app and continue where you left off.',approval:{state:'unknown'},
   evidence:`Read from saved local history. Latest completed reply is shown as an excerpt, not an AI summary. ${project?.kind==='folder'?'Grouped by working folder; desktop project assignment is unavailable. ':''}Running state and pending approvals are not available through this reader.`};
 });
 return validateSnapshot({version:1,id:'desktop-local-v1',name:'Your local desktop conversations',capturedAt:checkedAt,coverage:`${partial?'A bounded sample of':'Loaded'} local conversation history. Includes supported desktop Work and Codex records. Regular cloud ChatGPT chats and remote computers are not connected. Folder groups are used where desktop project assignment is unavailable.`,chats});
}
