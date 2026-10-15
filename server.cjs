'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),backend=require('./backend.cjs'),deployment=require('./cloud.cjs');
const {cloud,port}=deployment,root=path.join(__dirname,'dist'),workspace=path.join(backend.DATA,'workspace.json');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.glb':'model/gltf-binary','.blend':'application/octet-stream'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function read(req,maxBytes){
 if(!String(req.headers['content-type']).startsWith('application/json'))throw Object.assign(Error('需要 JSON 请求'),{status:415});
 let size=0,chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw Object.assign(Error('请求过大'),{status:413});chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks));}catch{throw Object.assign(Error('JSON 格式错误'),{status:400});}
}
function file(res,target){
 if(!fs.existsSync(target)||!fs.statSync(target).isFile())return json(res,404,{error:'Not found'});
 res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.setHeader('Content-Length',fs.statSync(target).size);
 fs.createReadStream(target).on('error',()=>res.destroy()).pipe(res);
}
let active=0;
http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
 try{
 const route=new URL(req.url,'http://localhost').pathname;
 if(route==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
 if(!deployment.hosts.has(req.headers.host)||(req.headers.origin&&!deployment.origins.has(req.headers.origin))||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Forbidden'});
 if(route==='/api/access'){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  if(deployment.limited(req,'login',8,10*60000))return json(res,429,{error:'尝试过于频繁，请稍后再试'});
  return deployment.login(req,res,await read(req,2000))?json(res,200,{ok:true}):json(res,401,{error:'访问码不正确'});
 }
 if(route==='/api/workspace'){
  if(cloud)return req.method==='GET'?json(res,200,{storage:'browser'}):json(res,405,{error:'云端版请保存在当前浏览器，不接受共享工作区写入'});
  if(req.method==='GET')return json(res,200,fs.existsSync(workspace)?JSON.parse(fs.readFileSync(workspace)):null);
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const data=await read(req,12000000);if(data.formatVersion!==1||typeof data.state?.material!=='string'||!Array.isArray(data.state?.personas)||!Array.isArray(data.state?.branches))return json(res,400,{error:'工作区格式无效'});
  fs.writeFileSync(workspace+'.tmp',JSON.stringify(data,null,2));fs.renameSync(workspace+'.tmp',workspace);return json(res,200,{path:workspace});
 }
 if(route==='/api/status'&&req.method==='GET')return json(res,200,{...await backend.api(route,'GET',{}),cloud,authorized:deployment.authorized(req),storage:cloud?'browser':'local'});
 if(route.startsWith('/api/')){
  if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
  if(cloud&&(route.startsWith('/api/bridge')||route==='/api/settings'))return json(res,403,{error:'云端版请上传聊天文件；模型由部署者配置'});
  const paid=['/api/models','/api/personas','/api/rehearse','/api/review','/api/radar'].includes(route);
  if(cloud&&paid&&!deployment.authorized(req))return json(res,401,{code:'ACCESS_REQUIRED',error:'请先输入作品的 AI 访问码'});
  if(cloud&&deployment.limited(req,paid?'ai':'api',paid?60:100,10*60000))return json(res,429,{error:'请求较多，请稍后再试'});
  if(active>=3)return json(res,429,{error:'正在处理其他请求，请稍后重试'});
  active++;
  try{
   const body=req.method==='POST'?await read(req,route==='/api/upload'?(cloud?15:57)*1024*1024:512000):{};
   if(route!=='/api/upload'&&JSON.stringify(body).length>120000)return json(res,413,{error:'材料超过处理范围，请选择相关片段'});
   return json(res,200,await backend.api(route,req.method,body));
  }finally{active--;}
 }
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 if(route.startsWith('/scene/')){
  const relative=route.slice(7),sceneRoot=path.resolve(__dirname,'dialogue-3d'),target=path.resolve(sceneRoot,relative);
  const allowed=!relative.split('/').includes('..')&&(['index.html','viewer.js','viewer.css'].includes(relative)||/^(assets-v[23]|vendor)\/[a-zA-Z0-9_./-]+\.(js|glb|blend)$/.test(relative));
  if(!allowed||!target.startsWith(sceneRoot+path.sep))return json(res,404,{error:'Not found'});
  if(/\.(glb|js|css)$/.test(relative))res.setHeader('Cache-Control','public, max-age=300');
  return file(res,target);
 }
 const name=route==='/'?'index.html':route.slice(1);
 if(!['index.html','styles.css','chat.css','app.js','preflight.js','backend-ui.js','scene-ui.js'].includes(name))return json(res,404,{error:'Not found'});
 return file(res,path.join(root,name));
 }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'服务处理失败，请检查输入后重试'});else res.destroy();}
}).listen(port,deployment.host,()=>console.log('Read the Room listening on port '+port+' ('+(cloud?'cloud':'local')+')'));
