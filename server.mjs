import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
const port=Number(process.env.PORT||3000), key=process.env.OPENAI_API_KEY, password=process.env.APP_PASSWORD;
let last=0, busy=false; const attempts=[];
function auth(req){if(!password)return false;const a=Buffer.from(req.headers.authorization||'');const b=Buffer.from('Basic '+Buffer.from('raposa:'+password).toString('base64'));return a.length===b.length&&timingSafeEqual(a,b);}
const paths={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/raposa.webp':['raposa.b64','image/webp'],'/manifest.webmanifest':['manifest.webmanifest','application/manifest+json']};
http.createServer(async(req,res)=>{
res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','microphone=(self)');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
if(req.url==='/health'){res.end('OK');return;}
if(password&&!auth(req)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Raposa"'});res.end('Acesso privado');return;}
try{
const url=new URL(req.url,'http://localhost');
if(req.method==='GET'&&Object.hasOwn(paths,url.pathname)){const [file,type]=paths[url.pathname];let body=await readFile(new URL('./public/'+file,import.meta.url));if(file.endsWith('.b64'))body=Buffer.from(body.toString().trim(),'base64');res.writeHead(200,{'Content-Type':type});res.end(body);return;}
if(req.method==='GET'&&url.pathname==='/config'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({realtime:!!(key&&password)}));return;}
if(req.method==='POST'&&url.pathname==='/session'){
if(!key||!password){res.writeHead(503);res.end('Conversa IA ainda não ativada. Use Testar voz.');return;}
if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'){res.writeHead(403);res.end();return;}
while(attempts.length&&attempts[0]<Date.now()-3600000)attempts.shift();
if(busy||Date.now()-last<2000||attempts.length>=12){res.writeHead(429);res.end('Limite temporário de sessões.');return;}
busy=true;last=Date.now();attempts.push(last);
try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>65536){res.writeHead(413);res.end();return;}chunks.push(c);}
const sdp=Buffer.concat(chunks).toString();if(!sdp.startsWith('v=0')){res.writeHead(400);res.end('SDP inválido');return;}
const f=new FormData();f.set('sdp',sdp);f.set('session',JSON.stringify({type:'realtime',model:process.env.OPENAI_REALTIME_MODEL||'gpt-realtime-2.1-mini',instructions:'Você é uma assistente virtual representada por uma raposa. Responda em português brasileiro, ou em inglês quando solicitado. Não afirme acesso à conta ou memória do ChatGPT.',audio:{output:{voice:process.env.OPENAI_VOICE||'marin'}}}));
const r=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:'Bearer '+key},body:f,signal:AbortSignal.timeout(30000)});const body=await r.text();res.writeHead(r.status,{'Content-Type':r.ok?'application/sdp':'text/plain; charset=utf-8'});res.end(r.ok?body:'OpenAI HTTP '+r.status+'. Confira a configuração da API.');
}finally{busy=false;}return;}
res.writeHead(404);res.end('Não encontrado');
}catch(e){console.error(e.message);if(!res.headersSent)res.writeHead(500);res.end('Erro no servidor');}
}).listen(port,'0.0.0.0',()=>console.log('Raposa Virtual: '+port));
