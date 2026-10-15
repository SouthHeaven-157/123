'use strict';
const crypto=require('node:crypto');
const cloud=process.env.APP_MODE==='cloud';
const port=Number(process.env.PORT||4173);
const configured=process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL;
if(cloud&&!configured)throw Error('Cloud deployment requires PUBLIC_URL or RENDER_EXTERNAL_URL');
const publicURL=new URL(configured||`http://127.0.0.1:${port}`);
if(cloud&&publicURL.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(publicURL.hostname))throw Error('PUBLIC_URL must use HTTPS');
const localOrigins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
const origins=new Set(cloud?[publicURL.origin]:localOrigins);
const hosts=new Set([...origins].map(o=>new URL(o).host));
const accessCode=process.env.API_ACCESS_CODE||'';
if(cloud&&accessCode.length<16)throw Error('Set API_ACCESS_CODE to a private value of at least 16 characters');
const buckets=new Map();
function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function signature(value){return crypto.createHmac('sha256',accessCode).update(value).digest('hex');}
function authorized(req){
 if(!cloud)return true;
 const token=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('rtr_access='))?.slice(11)||'';
 const [expires,mac,...extra]=token.split('.');
 return !extra.length&&/^\d+$/.test(expires)&&Number(expires)>Date.now()&&Number(expires)<Date.now()+9*3600000&&equal(mac,signature(expires));
}
function login(req,res,body){
 if(!accessCode||typeof body.code!=='string'||!equal(body.code,accessCode))return false;
 const expires=String(Date.now()+8*3600000);
 res.setHeader('Set-Cookie',`rtr_access=${expires}.${signature(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${publicURL.protocol==='https:'?'; Secure':''}`);
 return true;
}
function limited(req,scope,max,windowMs){
 // Only trust proxy addresses on Render, where traffic arrives through its proxy.
 const address=process.env.RENDER?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
 const key=scope+':'+address,now=Date.now();let entry=buckets.get(key);
 if(!entry||entry.until<now){entry={count:0,until:now+windowMs};buckets.set(key,entry);}
 if(buckets.size>2000){for(const [k,v] of buckets)if(v.until<now)buckets.delete(k);if(buckets.size>2000)buckets.delete(buckets.keys().next().value);}
 return ++entry.count>max;
}
module.exports={cloud,port,host:process.env.HOST||(cloud?'0.0.0.0':'127.0.0.1'),origins,hosts,authorized,login,limited,publicURL};
