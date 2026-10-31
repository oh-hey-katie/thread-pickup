import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDesktopService} from './service.mjs';
const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain'};
export function isLocalRequest(req,port,{api=false}={}) {
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return false;
 if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return false;
 if(api && (req.headers['x-thread-pickup']!=='1'||(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))))return false;
 return true;
}
export function createShelfServer({port=4173,service=createDesktopService()}={}) {
 const server=createServer(async(req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  const api=route.startsWith('/api/');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'none'");
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(!isLocalRequest(req,port,{api})){json(403,{error:'Local access only.'});return;}
  if(!['GET','HEAD'].includes(req.method)){json(405,{error:'Read-only service.'});return;}
  try {
   if(route==='/api/desktop'){json(200,await service.refresh());return;}
   if(route.startsWith('/api/chat/')){
    const id=decodeURIComponent(route.slice('/api/chat/'.length));
    if(!/^desktop:[\w-]{1,200}$/.test(id)){json(400,{error:'Invalid conversation.'});return;}
    json(200,await service.detail(id));return;
   }
   if(api){json(404,{error:'Not found.'});return;}
   const relative=route==='/'?'index.html':decodeURIComponent(route.slice(1));
   const file=path.resolve(publicRoot,relative);
   if(!file.startsWith(publicRoot)||relative.split('/').some(p=>p.startsWith('.'))||!types[path.extname(file)]){res.writeHead(404);res.end();return;}
   const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){
   // Keep internal paths and app-server diagnostics out of the page and logs.
   if(api)json(503,{error:'Could not read local desktop history. Check that ChatGPT Desktop or Codex is installed, then retry. Your last successful shelf is kept on screen.'});
   else{res.writeHead(404);res.end('Not found.');}
  }
 });
 server.on('close',()=>service.close());return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4173);
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a port between 1024 and 65535.');
 const server=createShelfServer({port});
 server.listen(port,'127.0.0.1',()=>console.log(`Thread Pickup: http://127.0.0.1:${port}/\nSafe fictional demo: http://127.0.0.1:${port}/?demo=1\nLocal history only. No uploads or AI requests. Keep this terminal open; Ctrl+C stops the reader.`));
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Stop the older preview or choose another PORT.`:'Could not start the local shelf.');process.exitCode=1;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
