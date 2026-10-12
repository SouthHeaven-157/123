const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary','.blend':'application/octet-stream','.png':'image/png'};
http.createServer((req,res)=>{
  if(!['127.0.0.1:4174','localhost:4174'].includes(req.headers.host)){res.writeHead(403);return res.end();}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1:4174').pathname);}catch{res.writeHead(400);return res.end();}
  const relative=route==='/'?'index.html':route.slice(1),file=path.resolve(root,relative);
  const permitted=['index.html','viewer.css','viewer.js','manifest.json','manifest-v2.json','manifest-v3.json'].includes(relative)||/^(assets|assets-v[23]|previews|previews-v[23]|vendor)\//.test(relative);
  if(!permitted||!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');res.setHeader('Content-Type',types[path.extname(file)]||'text/plain; charset=utf-8');res.setHeader('Content-Length',fs.statSync(file).size);
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
}).listen(4174,'127.0.0.1',()=>console.log('3D dialogue preview: http://127.0.0.1:4174'));
