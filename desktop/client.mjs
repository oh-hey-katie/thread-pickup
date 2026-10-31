import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

const READ_METHODS = new Set(['thread/list','thread/read','thread/turns/list','project/list','project/read']);
// A narrow client: no turn/start, resume, writes, tool calls, or credential handling.
export async function connectDesktop({binary=process.env.THREAD_PICKUP_CODEX || 'codex',proxy=false,timeoutMs=12000,spawnProcess=spawn,experimental=false}={}) {
  const child=spawnProcess(binary,['app-server',...(proxy?['proxy']:['--stdio'])],{stdio:['pipe','pipe','pipe']});
  const pending=new Map();let sequence=0, closed=false;
  // Do not expose application diagnostics: they can contain local paths or account context.
  child.stderr.resume();
  function fail(error){for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();}
  child.stdin.on('error',()=>fail(new Error('Desktop input stream closed.')));
  child.on('error',()=>fail(new Error('Cannot start the Codex command. Check its installation or THREAD_PICKUP_CODEX.')));
  child.on('exit',()=>{closed=true;fail(new Error('Desktop connection closed. Ensure the desktop service is running.'));});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    let message;try{message=JSON.parse(line);}catch{return;}
    if(message.method){
      if(message.id!==undefined&&!child.stdin.destroyed)child.stdin.write(JSON.stringify({id:message.id,error:{code:-32601,message:'Read-only client: requests unsupported'}})+'\n');
      return;
    }
    const p=pending.get(message.id);if(!p)return;
    pending.delete(message.id);clearTimeout(p.timer);
    if(message.error)p.reject(new Error(`Desktop API error ${message.error.code}: ${message.error.message}`));else p.resolve(message.result);
  });
  function rpc(method,params){
    if(closed)return Promise.reject(new Error('Desktop connection is closed.'));
    return new Promise((resolve,reject)=>{
      const id=++sequence;
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timed out waiting for ${method}.`));},timeoutMs);
      pending.set(id,{resolve,reject,timer});
      child.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){clearTimeout(timer);pending.delete(id);reject(new Error('Cannot write to desktop connection.'));}});
    });
  }
  function close(){closed=true;fail(new Error('Desktop connection closed.'));lines.close();child.stdin.end();child.kill();}
  try {
    await rpc('initialize',{clientInfo:{name:'thread_pickup_probe',title:'Thread Pickup read-only connection test',version:'0.1.0'},...(experimental?{capabilities:{experimentalApi:true}}:{})});
    child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
    return {read(method,params){if(!READ_METHODS.has(method))throw new Error('Only read methods are permitted.');return rpc(method,params);},close};
  }catch(error){close();throw error;}
}
