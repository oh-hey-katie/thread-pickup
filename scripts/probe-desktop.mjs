import {connectDesktop} from '../desktop/client.mjs';
const client=await connectDesktop({proxy:process.argv.includes('--proxy'),experimental:process.argv.includes('--projects')});
try {
 const result=await client.read('thread/list',{limit:20,sortKey:'updated_at',archived:false,useStateDbOnly:true});
 const projects=process.argv.includes('--projects')?await client.read('project/list',{limit:100}):null;
 const matchingProject=projects?.data.find(p=>p.roots?.some(r=>r.path===process.cwd()));
 const members=matchingProject?await client.read('thread/list',{projectId:matchingProject.id,limit:20,useStateDbOnly:true}):null;
 const own=result.data.find(t=>t.cwd===process.cwd()) || result.data[0];
 const metadata=own?await client.read('thread/read',{threadId:own.id}):null;
 let history;
 try {
  const turns=own?await client.read('thread/turns/list',{threadId:own.id,limit:3,itemsView:'summary',sortDirection:'desc'}):null;
  history={readable:!!turns,turnCount:turns?.data?.length,itemTypes:turns?.data?.flatMap(t=>t.items?.map(i=>i.type)||[])};
 } catch(error) { history={readable:false,error:error.message}; }
 console.log(JSON.stringify({experimentalProjects:projects?{count:projects.data?.length,hasMore:!!projects.nextCursor,matchingProject:matchingProject?{name:matchingProject.name,memberCount:members?.data?.length,includesCurrent:members?.data?.some(t=>t.id===own?.id)}:null}:null,count:result.data.length,hasMore:!!result.nextCursor,projectIdCount:result.data.filter(t=>t.projectId).length,folderCount:new Set(result.data.map(t=>t.cwd).filter(Boolean)).size,metadataReadable:!!metadata,history,...(process.argv.includes('--show-titles')?{threads:result.data.map(t=>({id:t.id,name:t.name,projectId:t.projectId,section:t.section,source:t.source,originator:t.originator,updatedAt:t.updatedAt}))}:{})},null,2));
}finally{client.close();}
