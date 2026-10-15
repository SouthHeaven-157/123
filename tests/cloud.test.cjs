'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),data=path.join(root,'qa','cloud-test-data'),port=Number(process.env.TEST_PORT||4193),code='test-only-access-code-for-cloud';
fs.mkdirSync(data,{recursive:true});
const child=spawn(process.execPath,['server.cjs'],{cwd:root,env:{...process.env,APP_MODE:'cloud',PORT:String(port),PUBLIC_URL:`http://127.0.0.1:${port}`,API_ACCESS_CODE:code,DATA_DIR:data,PYTHON_EXE:process.env.TEST_PYTHON||process.env.PYTHON_EXE||'python3',DMX_API_KEY:'',JEV_API_KEY:''},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
function request(route,{method='GET',body,cookie,host,origin}={}){return new Promise((resolve,reject)=>{const raw=body===undefined?undefined:JSON.stringify(body);const req=http.request({host:'127.0.0.1',port,path:route,method,headers:{...(raw?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}:{}),...(cookie?{Cookie:cookie}:{}),...(host?{Host:host}:{}),...(origin?{Origin:origin}:{})}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let json;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,headers:res.headers,json,text});});});req.on('error',reject);req.end(raw);});}
async function ready(){for(let i=0;i<70;i++){if(child.exitCode!==null)throw Error(logs);try{if((await request('/healthz')).status===200)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Server not ready: '+logs);}
test('Cloud deployment isolates workspaces and gates paid model calls',async t=>{
 t.after(()=>child.kill());await ready();
 const status=await request('/api/status');assert.equal(status.status,200);assert.equal(status.json.cloud,true);assert.equal(status.json.authorized,false);assert.equal(status.json.uploadLimitMB,10);assert(!('inbox' in status.json));assert(!('dropFolder' in status.json));
 assert.equal((await request('/api/workspace')).json.storage,'browser');
 assert.equal((await request('/api/workspace',{method:'POST',body:{state:{material:'visitor-private-records'}}})).status,405);
 assert(!fs.existsSync(path.join(data,'workspace.json')));
 assert.equal((await request('/api/rehearse',{method:'POST',body:{}})).status,401);
 assert.equal((await request('/api/radar',{method:'POST',body:{}})).status,401);
 assert.equal((await request('/api/access',{method:'POST',body:{code:'wrong-code'}})).status,401);
 const access=await request('/api/access',{method:'POST',body:{code}});assert.equal(access.status,200);const cookie=access.headers['set-cookie'][0].split(';')[0];assert(access.headers['set-cookie'][0].includes('HttpOnly'));assert(!cookie.includes(code));
 assert.equal((await request('/api/status',{cookie})).json.authorized,true);
 assert.equal((await request('/api/rehearse',{method:'POST',cookie,body:{}})).status,400);
 assert.equal((await request('/api/status',{cookie:cookie+'tampered'})).json.authorized,false);
 assert.equal((await request('/api/settings',{method:'POST',cookie,body:{model:'other'}})).status,403);
 assert.equal((await request('/api/bridge')).status,403);
 assert.equal((await request('/api/status',{host:'evil.example'})).status,403);
 assert.equal((await request('/api/access',{method:'POST',origin:'https://evil.example',body:{code}})).status,403);
 for(const name of ['/.env.local','/.env.example','/data/workspace.json','/server.cjs'])assert.equal((await request(name)).status,404);
 assert.equal((await request('/')).status,200);assert.equal((await request('/scene/viewer.js')).status,200);
 const model=await request('/scene/assets-v3/interview.glb');assert.equal(model.status,200);assert.equal(model.headers['content-type'],'model/gltf-binary');
 const material='我：这周需要讨论排期。\n林予：先说清楚影响，再确认方案。';
 const upload=await request('/api/upload',{method:'POST',body:{name:'fixture.txt',base64:Buffer.from(material).toString('base64')}});assert.equal(upload.status,200);assert.equal(upload.json.count,2);
 const zip=path.join(data,'fixture.zip');
 execFileSync(process.env.TEST_PYTHON||process.env.PYTHON_EXE||'python3',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED); z.writestr("聊天记录.txt",sys.argv[2]); z.close()',zip,material],{windowsHide:true});
 const zipped=await request('/api/upload',{method:'POST',body:{name:'fixture.zip',base64:fs.readFileSync(zip).toString('base64')}});assert.equal(zipped.status,200);assert.equal(zipped.json.count,2);
 assert.equal(fs.readdirSync(data).filter(n=>/^[a-f0-9-]{36}\.(zip|txt)$/.test(n)).length,0);
 assert.equal((await request('/api/upload',{method:'POST',body:{name:'too-big.txt',base64:Buffer.alloc(10*1024*1024+1).toString('base64')}})).status,413);
 let denied;for(let i=0;i<9;i++)denied=await request('/api/access',{method:'POST',body:{code:'incorrect'}});assert.equal(denied.status,429);
});
