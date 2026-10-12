'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),backend=require('./backend.cjs');
const root=path.join(__dirname,'dist'),workspace=path.join(__dirname,'data','workspace.json'),port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function read(req){if(!String(req.headers['content-type']).startsWith('application/json'))throw Object.assign(Error('需要 JSON 请求'),{status:415});let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>57*1024*1024)throw Object.assign(Error('请求过大'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks));}catch{throw Object.assign(Error('JSON 格式错误'),{status:400});}}
let active=0;
http.createServer(async(req,res)=>{
 const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)||(req.headers.origin&&!origins.includes(req.headers.origin))||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Forbidden'});
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 try{const route=new URL(req.url,origins[0]).pathname;
 if(route==='/api/workspace'){
  if(req.method==='GET')return json(res,200,fs.existsSync(workspace)?JSON.parse(fs.readFileSync(workspace)):null);
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const data=await read(req);if(data.formatVersion!==1||typeof data.state?.material!=='string'||!Array.isArray(data.state?.personas)||!Array.isArray(data.state?.branches))return json(res,400,{error:'工作区格式无效'});
  fs.writeFileSync(workspace+'.tmp',JSON.stringify(data,null,2));fs.renameSync(workspace+'.tmp',workspace);return json(res,200,{path:workspace});
 }
 if(route.startsWith('/api/')){if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});const body=req.method==='POST'?await read(req):{};if(JSON.stringify(body).length>120000&&route!=='/api/upload')return json(res,413,{error:'材料超过处理范围，请选择相关片段'});if(active>=3)return json(res,429,{error:'正在处理其他请求，请稍后重试'});active++;try{return json(res,200,await backend.api(route,req.method,body));}finally{active--;}}
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 if(route.startsWith('/scene/')){
  const relative=route.slice(7),sceneRoot=path.resolve(__dirname,'dialogue-3d'),file=path.resolve(sceneRoot,relative);
  const allowed=!relative.split('/').includes('..')&&(['index.html','viewer.js','viewer.css'].includes(relative)||/^(assets-v[23]|vendor)\/[a-zA-Z0-9_./-]+\.(js|glb|blend)$/.test(relative));
  if(!allowed||!file.startsWith(sceneRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'Not found'});
  const sceneTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.blend':'application/octet-stream'};
  res.setHeader('Content-Type',sceneTypes[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);return;
 }
 const name=route==='/'?'index.html':route.slice(1);if(!['index.html','styles.css','chat.css','app.js','preflight.js','backend-ui.js','scene-ui.js'].includes(name))return json(res,404,{error:'Not found'});
 res.setHeader('Content-Type',types[path.extname(name)]);fs.createReadStream(path.join(root,name)).pipe(res);
 }catch(e){json(res,e.status||500,{error:e.status?e.message:'本地服务处理失败，请检查输入后重试'});}
}).listen(port,'127.0.0.1',()=>console.log(`Read the Room: http://127.0.0.1:${port}`));
