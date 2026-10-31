import {connectDesktop} from './client.mjs';
import {desktopSnapshot,recentContext} from './model.mjs';
import {access} from 'node:fs/promises';
import {constants} from 'node:fs';
export async function findBinary() {
 if(process.env.THREAD_PICKUP_CODEX)return process.env.THREAD_PICKUP_CODEX;
 if(process.platform==='darwin')for(const file of ['/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex','/Applications/Codex.app/Contents/Resources/codex']){
  try{await access(file,constants.X_OK);return file;}catch{}
 }
 return 'codex';
}
export function createDesktopService({connect=connectDesktop,now=()=>Date.now()}={}) {
 let client,flight,last,closed=false;
 const contexts=new Map();
 async function refresh() {
  if(closed)throw new Error('Desktop reader stopped.');
  if(flight)return flight;
  if(last&&now()-last.time<8000)return last.value;
  flight=(async()=>{
   try {
    client ||= await connect({binary:await findBinary(),experimental:true});
    let threads=[],cursor,partial=false;
    for(let page=0;page<5;page++){
     const result=await client.read('thread/list',{limit:20,sortKey:'updated_at',archived:false,useStateDbOnly:true,...(cursor?{cursor}:{})});
     threads.push(...result.data);cursor=result.nextCursor;if(!cursor)break;if(page===4)partial=true;
    }
    threads=[...new Map(threads.map(t=>[t.id,t])).values()].filter(t=>!t.parentThreadId&&!t.ephemeral);
    let projects=[],projectError=false;
    try{const result=await client.read('project/list',{limit:100});projects=result.data;}catch{projectError=true;}
    const ids=new Set(threads.map(t=>t.id));for(const key of contexts.keys())if(!ids.has(key))contexts.delete(key);
    // Bounded saved-text reads, cached by actual update timestamp. No model calls.
    const representatives=new Map();
    for(const t of threads)if(t.section?.name==='Pinned'||!representatives.has(t.cwd||t.id))representatives.set(t.section?.name==='Pinned'?t.id:t.cwd||t.id,t);
    const toRead=[...representatives.values()].slice(0,30);
    let excerptErrors=0;
    for(let i=0;i<toRead.length;i+=3)await Promise.all(toRead.slice(i,i+3).map(async t=>{
     if(contexts.get(t.id)?.updatedAt===t.updatedAt)return;
     try{const result=await client.read('thread/turns/list',{threadId:t.id,limit:3,itemsView:'summary',sortDirection:'desc'});contexts.set(t.id,{...recentContext(result.data),updatedAt:t.updatedAt});}catch{excerptErrors++;}
    }));
    const checkedAt=new Date(now()).toISOString();
    const snapshot=desktopSnapshot(threads,projects,contexts,{checkedAt,partial});
    const value={snapshot,connection:{state:'connected',checkedAt,conversationCount:threads.length,projectCount:projects.length,folderGroups:new Set(snapshot.chats.filter(c=>c.project?.kind==='folder').map(c=>c.project.id)).size,partial,projectError,excerptErrors}};
    last={time:now(),value};return value;
   }catch(error){client?.close();client=null;throw error;}
   finally{flight=null;}
  })();return flight;
 }
 async function detail(id){
  const data=await refresh();const chat=data.snapshot.chats.find(c=>c.id===id);if(!chat)throw new Error('Conversation is not in the current local history.');
  const threadId=id.slice('desktop:'.length);
  const result=await client.read('thread/turns/list',{threadId,limit:3,itemsView:'summary',sortDirection:'desc'});
  return {...chat,...recentContext(result.data)};
 }
 return {refresh,detail,close(){closed=true;client?.close();client=null;}};
}
