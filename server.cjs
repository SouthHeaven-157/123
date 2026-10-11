const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'dist');
const workspace=path.join(__dirname,'data','workspace.json');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const host=req.headers.host;
  if(!['127.0.0.1:4173','localhost:4173'].includes(host)){res.writeHead(403);return res.end('Forbidden');}
  if(req.headers.origin&&!['http://127.0.0.1:4173','http://localhost:4173'].includes(req.headers.origin)){res.writeHead(403);return res.end('Forbidden');}
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  const route=new URL(req.url,'http://127.0.0.1:4173').pathname;
  if(route==='/api/workspace'){
    if(req.method==='GET'){res.setHeader('Content-Type','application/json');return res.end(fs.existsSync(workspace)?fs.readFileSync(workspace):'null');}
    if(req.method!=='POST'){res.writeHead(405);return res.end();}
    if(!String(req.headers['content-type']).startsWith('application/json')){res.writeHead(415);return res.end();}
    let chunks=[],size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size>12*1024*1024){res.writeHead(413);res.end();req.destroy();}else chunks.push(chunk);});
    req.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks));if(data.formatVersion!==1||typeof data.state?.material!=='string'||!Array.isArray(data.state?.personas)||!Array.isArray(data.state?.branches))throw Error('Invalid workspace');fs.mkdirSync(path.dirname(workspace),{recursive:true});fs.writeFileSync(workspace+'.tmp',JSON.stringify(data,null,2),'utf8');fs.renameSync(workspace+'.tmp',workspace);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({path:workspace}));}catch{res.writeHead(400);res.end('Invalid workspace');}});return;
  }
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  const name=route==='/'?'index.html':route.slice(1);
  const files=['index.html','styles.css','chat.css','app.js','preflight.js'];
  if(!files.includes(name)){res.writeHead(404);return res.end('Not found');}
  res.setHeader('Content-Type',types[path.extname(name)]);
  fs.createReadStream(path.join(root,name)).pipe(res);
});
server.listen(4173,'127.0.0.1',()=>console.log('Read the Room: http://127.0.0.1:4173'));
