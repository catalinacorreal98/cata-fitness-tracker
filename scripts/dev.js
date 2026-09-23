import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { handler } from '../lib/handler.js';
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
const allowed=new Set(['auth','data','goals','exercises','sync','cron','logout']);
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost:3000');
  const api=url.pathname.match(/^\/api\/([a-z]+)$/);
  if(api&&allowed.has(api[1]))return handler(api[1])(req,res);
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','app.js','style.css','app.css','favicon.svg'].includes(name)){res.writeHead(404);return res.end('Not found');}
  try{res.setHeader('Content-Type',mime[name.slice(name.lastIndexOf('.'))]);res.end(await readFile(new URL('../public/'+name,import.meta.url)));}catch{res.writeHead(500);res.end('Unable to load app');}
}).listen(3000,'127.0.0.1',()=>console.log('Local tracker: http://localhost:3000 — no Calendar access without configuration and sign-in.'));
