import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopService} from '../desktop/service.mjs';import {isLocalRequest} from '../desktop/server.mjs';
test('local API refuses other sites and DNS rebinding hosts',()=>{
 const request=headers=>({headers});const valid={host:'127.0.0.1:4173','x-thread-pickup':'1','sec-fetch-site':'same-origin'};
 assert.equal(isLocalRequest(request(valid),4173,{api:true}),true);
 for(const patch of [{host:'evil.test:4173'},{origin:'https://evil.test'},{'x-thread-pickup':undefined},{'sec-fetch-site':'cross-site'}])assert.equal(isLocalRequest(request({...valid,...patch}),4173,{api:true}),false);
});
test('automatic reads observe updated history and cache unchanged excerpt reads',async()=>{
 let now=0,updatedAt=1700000000,reads=0;
 const client={close(){},async read(method){if(method==='project/list')return {data:[]};if(method==='thread/list')return {data:[{id:'example',name:'Example',cwd:'/work/example',updatedAt}]};reads++;return {data:[{status:'completed',items:[{type:'agentMessage',text:`Reply ${updatedAt}`}]}]};}};
 const svc=createDesktopService({connect:async()=>client,now:()=>now});
 try {
  const first=await svc.refresh();assert.equal(reads,1);await svc.refresh();assert.equal(reads,1);
  now=11000;await svc.refresh();assert.equal(reads,1);
  updatedAt++;now=22000;const next=await svc.refresh();assert.equal(reads,2);assert.notEqual(first.snapshot.chats[0].summary,next.snapshot.chats[0].summary);
  await assert.rejects(svc.detail('desktop:unknown'),/not in/);
 }finally{svc.close();}
});
test('reader reconnects after service failure instead of staying stuck',async()=>{
 let connections=0;const svc=createDesktopService({connect:async()=>{connections++;return {close(){},async read(method){if(connections===1)throw new Error('disconnected');return {data:[]};}};}});
 try{await assert.rejects(svc.refresh(),/disconnected/);assert.equal((await svc.refresh()).connection.state,'connected');assert.equal(connections,2);}finally{svc.close();}
});
