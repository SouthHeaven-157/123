'use strict';
const DIMENSIONS=['被冒犯','语气冲','歧义','不可执行','权力否定'];
function radarSVG(scores){
 const cx=170,cy=151,r=99,point=(i,f)=>[cx+Math.sin(i*Math.PI*2/5)*r*f,cy-Math.cos(i*Math.PI*2/5)*r*f];
 const polygon=f=>DIMENSIONS.map((_,i)=>point(i,f).join(',')).join(' ');
 return `<svg class="risk-radar" viewBox="0 0 340 310" role="img" aria-label="${scores?'沟通风险雷达：'+scores.map((n,i)=>DIMENSIONS[i]+n).join('，'):'沟通风险雷达，尚未分析'}">${[.2,.4,.6,.8,1].map(f=>`<polygon points="${polygon(f)}" fill="none" stroke="#dce6d7"/>`).join('')}${DIMENSIONS.map((label,i)=>{const p=point(i,1),l=point(i,1.28);return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#dce6d7"/><text x="${l[0]}" y="${l[1]+4}" text-anchor="middle" fill="#7b8c73" font-size="12">${label}</text>`;}).join('')}${scores?`<polygon points="${scores.map((v,i)=>point(i,Math.max(0,Math.min(100,v))/100).join(',')).join(' ')}" fill="#2e654d25" stroke="#2e654d" stroke-width="2"/>`:''}</svg>`;
}
let radarTimer=null,radarRunning=false,radarActiveKey=null,radarQueued=null,radarWanted=null,radarError=null,rewritePending=false,radarProposal=null;
const radarCache=new Map();
function radarSnapshot(){
 const branch=currentBranch(),draft=$('#chatDraft')?.value??state.draft;
 if(state.stage!==2||!branch||!draft.trim()||draft.length>5000)return null;
 const body={draft,persona:branch.persona,context:branch.context,messages:branch.messages.slice(-12),purpose:state.preflight?.goal||'',position:state.preflight?.position||''};
 return {body,key:JSON.stringify({branch:branch.id,body})};
}
function matchingRadar(){const snap=radarSnapshot();return snap?radarCache.get(snap.key):null;}
function preflightMount(){
 if(state.stage!==2||!currentBranch()||!$('#chatDraft')){radarWanted=null;radarQueued=null;clearTimeout(radarTimer);return;}
 const branch=currentBranch();
 state.preflight={goal:branch.radarContext?.purpose||'',position:branch.radarContext?.position||'',branchId:branch.id};
 if(state.radarAuto===undefined)state.radarAuto=true;
 const chatLayout=$('.chat-layout'),chatPanel=chatLayout.firstElementChild,settings=chatLayout.lastElementChild;
 const layout=document.createElement('div');layout.className='preflight-layout';
 const left=document.createElement('div');left.className='preflight-left';const right=document.createElement('aside');right.className='preflight-right';
 const draft=document.createElement('section');draft.className='panel draft-panel';
 draft.innerHTML=`<div class="panel-head"><div class="head-label"><span class="number-badge">1</span><h3>草稿辅助</h3></div><span class="tag">停笔后自动判研</span></div><div class="draft-controls"><div class="draft-presets"><span>预置草稿：</span><button class="button small" data-preset="reject">说明排期限制</button><button class="button small" data-preset="remind">催对方反馈</button><button class="button small" data-preset="delay">通知延期</button></div><div class="draft-selectors"><div><span>发给谁</span><strong>${esc(branch.persona.name)}</strong><small>依据导入的对象画像及本分支上下文</small></div><div><span>沟通目的（可选）</span><div class="choice-row">${['拒绝','催办','道歉','同步','提要求'].map(g=>`<button class="choice ${state.preflight.goal===g?'active':''}" data-purpose="${g}" aria-pressed="${state.preflight.goal===g}">${g}</button>`).join('')}</div></div><details><summary>补充话语位置（可选）</summary><div class="choice-row">${['我更高','对等','我更被动'].map(g=>`<button class="choice ${state.preflight.position===g?'active':''}" data-position="${g}" aria-pressed="${state.preflight.position===g}">${g}</button>`).join('')}</div></details></div><p class="draft-status" id="draftStatus" role="status"></p></div>`;
 const diagnosis=document.createElement('section');diagnosis.className='panel';
 diagnosis.innerHTML='<div class="panel-head"><div class="head-label"><span class="number-badge">2</span><h3>逐句风险定位</h3></div><span class="tag">Jev 判研</span></div><div class="panel-body" id="sentenceFindings"></div><div class="panel-foot"><span class="subtle">保留事实、立场与承诺边界。</span><button id="rewriteFlagged" class="button primary">AI 改写并用 Jev 复检</button></div><div id="rewriteResult"></div>';
 const radar=document.createElement('section');radar.className='panel radar-panel';
 radar.innerHTML='<div class="panel-head"><div class="head-label"><span class="number-badge">A</span><h3>实时体检雷达</h3></div><span class="tag green">Jev · System One</span></div><div class="panel-body"><div id="radarVisual"></div><div id="radarBars"></div><p id="radarStatus" role="status" aria-live="polite" class="subtle"></p><p id="radarConfidence" class="hint-box"></p><label class="radar-auto"><input id="radarAuto" type="checkbox">停笔 1.5 秒后自动分析</label><button class="button small" id="radarRefresh">立即分析</button><details id="radarDetails"><summary>查看每个维度的依据与置信度</summary><div id="radarDetailBody"></div></details><p class="subtle">结合对象画像、近 12 条对话和补充情境。评分由 Jev 的 0–4 档结果换算为 0–100，不代表真实冒犯概率。自动分析会调用 Jev，可关闭后手动分析。</p></div>';
 chatLayout.replaceWith(layout);layout.append(left,right);left.append(chatPanel,draft,diagnosis);right.append(radar,settings);
 $('#radarAuto').checked=state.radarAuto;chatPanel.querySelector('.panel-head .tag').textContent='AI 模拟回应';preflightUpdate();
}
function paintRadar(){
 if(!$('#radarVisual'))return;
 const snap=radarSnapshot(),result=snap?radarCache.get(snap.key):null,error=radarError&&snap&&radarError.key===snap.key?radarError.message:null;
 const loading=!!snap&&(radarQueued?.key===snap.key||radarActiveKey===snap.key)&&!error;
 $('#radarVisual').innerHTML=radarSVG(result?.scores);
 $('#radarBars').innerHTML=DIMENSIONS.map((label,i)=>`<div class="radar-bar"><span>${label}</span><div><i style="width:${result?result.scores[i]:0}%"></i></div><b>${result?result.scores[i]:'—'}</b></div>`).join('');
 const status=!snap?($('#chatDraft')?.value.length>5000?'草稿超过 5000 字，请缩短后分析。':'等待输入草稿。'):error?error:loading?'Jev 正在判研，请稍候…':result?'已分析当前草稿 · '+result.model:state.radarAuto?'等待停笔后分析…':'自动分析已关闭，点击立即分析。';
 $('#radarStatus').textContent=status;$('#draftStatus').textContent=status;
 $('#radarRefresh').disabled=!snap;$('#rewriteFlagged').disabled=busy||rewritePending||!result;
 $('#radarConfidence').textContent=result?`${result.confidence<.55?'低置信，请结合来源核对。':'判研已完成，请结合实际情境判断。'} 最低维度置信度 ${Math.round(result.confidence*100)}%。${result.evidenceSufficiency<.5?' 对象或背景依据不足，可补充记录及背景后重新分析。':''}`:'未完成判研时不显示零分，避免误认为没有风险。';
 $('#radarDetailBody').innerHTML=result?result.details.map(d=>`<article class="radar-detail"><strong>${esc(d.label)} · ${d.score}</strong><p>${esc(d.reason)}</p><small>Jev 原始分 ${d.nativeScore.toFixed(2)} / 4 · 置信度 ${Math.round(d.confidence*100)}%</small></article>`).join(''):'';
 $('#sentenceFindings').innerHTML=result?(result.findings.length?result.findings.map(f=>`<article class="sentence-finding"><span class="tag">${esc(f.dimension)}</span><p><mark>${esc(f.quote)}</mark></p><small>${esc(f.reason)} · 置信度 ${Math.round((f.confidence||0)*100)}%</small></article>`).join(''):'<p class="subtle">Jev 未定位明显问题；这不保证对方会按预期回应。</p>'):'<p class="subtle">Jev 分析完成后会显示待检查的具体句子。</p>';
 if(result)$('#sentenceFindings').insertAdjacentHTML('beforeend',`<p class="subtle">五维雷达覆盖全文；逐句判研覆盖前 ${result.sentenceCoverage} 句，最多 6 句。</p>`);
 paintProposal(snap);
}
function preflightUpdate(){
 const snap=radarSnapshot();
 if(snap?.key===radarWanted?.key){paintRadar();return;}
 radarWanted=snap;radarQueued=null;radarError=null;clearTimeout(radarTimer);
 if(snap&&state.radarAuto&&!busy&&!radarCache.has(snap.key))radarTimer=setTimeout(()=>enqueueRadar(snap),1500);
 paintRadar();
}
async function enqueueRadar(snap=radarSnapshot(),force=false){
 if(!snap||snap.key!==radarSnapshot()?.key)return;
 radarWanted=snap;radarQueued={...snap,force};radarError=null;paintRadar();
 if(radarRunning)return;radarRunning=true;
 try{while(radarQueued){const job=radarQueued;radarQueued=null;radarActiveKey=job.key;
  try{const result=await api('/api/radar',{...job.body,refresh:job.force});radarCache.set(job.key,result);if(radarCache.size>25)radarCache.delete(radarCache.keys().next().value);}catch(e){if(radarSnapshot()?.key===job.key)radarError={key:job.key,message:e.message+'，可点击立即分析重试。'};}
  radarActiveKey=null;paintRadar();
 }}finally{radarRunning=false;radarActiveKey=null;}
}
function paintProposal(snap){
 if(!$('#rewriteResult'))return;
 if(!radarProposal||radarProposal.key!==snap?.key){$('#rewriteResult').innerHTML='';return;}
 const p=radarProposal;
 $('#rewriteResult').innerHTML=`<div class="rewrite-preview"><span class="eyebrow">AI 改写 → Jev 复检</span><div class="rewrite-diff"><div><small>修改前</small><p>${esc(p.original)}</p></div><div><small>候选表达</small><p>${esc(p.text)}</p></div></div>${p.after?`<div class="score-comparison">${DIMENSIONS.map((d,i)=>`<span>${d} <b>${p.before.scores[i]} → ${p.after.scores[i]}</b></span>`).join('')}</div><p class="subtle">前后均由 ${esc(p.after.model)} 判研。分数不保证下降，采用前请核对事实和边界。</p>`:`<p class="subtle">${p.error?esc(p.error):'正在对候选表达进行 Jev 复检…'}</p>`}<button class="button primary small" id="applyRewrite">采用这版表达</button><button class="button text small" id="dismissRewrite">保留原文</button></div>`;
}
async function rewriteWithRadar(){
 const snap=radarSnapshot(),before=matchingRadar();if(!snap||!before||rewritePending||busy)return;
 rewritePending=true;radarProposal=null;paintRadar();
 try{
  const proposal=await api('/api/review',{persona:snap.body.persona,draft:snap.body.draft,context:{...snap.body.context,purpose:snap.body.purpose,position:snap.body.position},messages:snap.body.messages});
  if(radarSnapshot()?.key!==snap.key)return;
  radarProposal={key:snap.key,original:snap.body.draft,text:proposal.rewrite,before,after:null};paintRadar();
  const after=await api('/api/radar',{...snap.body,draft:proposal.rewrite});
  if(radarSnapshot()?.key===snap.key&&radarProposal?.key===snap.key){radarProposal.after=after;paintRadar();}
 }catch(e){if(radarProposal?.key===snap.key)radarProposal.error=e.message;notify(e.message);}finally{rewritePending=false;paintRadar();}
}
const originalRender=render;render=function(){originalRender();preflightMount();};
document.addEventListener('input',event=>{if(event.target.id==='chatDraft'||event.target.dataset.context)preflightUpdate();});
document.addEventListener('change',event=>{if(event.target.id==='radarAuto'){state.radarAuto=event.target.checked;clearTimeout(radarTimer);radarWanted=null;preflightUpdate();}});
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||!$('#chatDraft'))return;
 if(button.dataset.preset){if(busy)return;state.draft={reject:'这个需求我们排不进去，你们重评优先级吧。',remind:'你怎么总是不反馈？赶紧处理一下！！',delay:'这个交付要延期了，具体时间到时候再说。'}[button.dataset.preset];$('#chatDraft').value=state.draft;preflightUpdate();}
 if(button.dataset.purpose||button.dataset.position){const purpose=!!button.dataset.purpose,key=purpose?'goal':'position',value=button.dataset.purpose||button.dataset.position;state.preflight[key]=value;currentBranch().radarContext={purpose:state.preflight.goal,position:state.preflight.position};const attr=purpose?'data-purpose':'data-position';document.querySelectorAll(`[${attr}]`).forEach(el=>{const selected=el.getAttribute(attr)===value;el.classList.toggle('active',selected);el.setAttribute('aria-pressed',String(selected));});preflightUpdate();}
 if(button.id==='radarRefresh'){clearTimeout(radarTimer);enqueueRadar(radarSnapshot(),true);}
 if(button.id==='rewriteFlagged')rewriteWithRadar();
 if(button.id==='applyRewrite'&&radarProposal?.key===radarSnapshot()?.key){state.draft=radarProposal.text;$('#chatDraft').value=state.draft;radarProposal=null;preflightUpdate();notify('改写已放入草稿，确认后再发送预演。');}
 if(button.id==='dismissRewrite'){radarProposal=null;paintRadar();}
});
preflightMount();
