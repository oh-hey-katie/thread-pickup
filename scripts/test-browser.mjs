import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const routes = {'/extension/discovery.js':'../extension/discovery.js','/':'../tests/fixtures/connection.html','/extension/capture.js':'../extension/capture.js','/extension/observe.js':'../extension/observe.js','/extension/sync-model.js':'../extension/sync-model.js','/extension/model.js':'../public/model.js'};
createServer(async(req,res)=>{try {if (!routes[req.url]){res.writeHead(404);res.end();return;} res.setHeader('Content-Type',req.url==='/'?'text/html':'text/javascript');res.end(await readFile(new URL(routes[req.url],import.meta.url)));}catch{res.writeHead(500);res.end();}}).listen(4174,'127.0.0.1',()=>console.log('Fictional connection test: http://127.0.0.1:4174/'));
