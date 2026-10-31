import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {connectDesktop} from '../desktop/client.mjs';
function fakeServer({silent=false}={}) {
 const requests=[];let stopped=false;
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
 child.stdin=new Writable({write(chunk,encoding,done){
  const msg=JSON.parse(chunk.toString());requests.push(msg);
  if(msg.id&&!silent)queueMicrotask(()=>child.stdout.write(JSON.stringify({id:msg.id,result:msg.method==='thread/list'?{data:[{id:'fictional'}],nextCursor:null}:{}})+'\n'));
  done();
 }});
 child.kill=()=>{stopped=true;child.emit('exit',0);child.stdout.end();child.stderr.end();};
 return {requests,spawnProcess:()=>child,get stopped(){return stopped;}};
}
test('desktop reader initializes then permits only read methods',async()=>{
 const server=fakeServer();const client=await connectDesktop({spawnProcess:server.spawnProcess});
 try {
  const result=await client.read('thread/list',{limit:20,useStateDbOnly:true});assert.equal(result.data[0].id,'fictional');
  for(const method of ['turn/start','thread/resume','thread/delete','command/exec','account/login/start','project/import','project/update'])assert.throws(()=>client.read(method,{}),/Only read/);
  assert.deepEqual(server.requests.map(r=>r.method),['initialize','initialized','thread/list']);
 }finally{client.close();}
 assert.equal(server.stopped,true);
});
test('unresponsive desktop handshake times out and cleans up',async()=>{
 const server=fakeServer({silent:true});
 await assert.rejects(connectDesktop({spawnProcess:server.spawnProcess,timeoutMs:20}),/Timed out/);
 assert.equal(server.stopped,true);
});
test('closed desktop connection rejects further reads',async()=>{
 const server=fakeServer();const client=await connectDesktop({spawnProcess:server.spawnProcess});client.close();
 await assert.rejects(client.read('thread/list',{}),/closed/);
});
