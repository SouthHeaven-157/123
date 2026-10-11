'use strict';
// Reference-image features. Local heuristics demonstrate interaction, not model predictions.
const DIMENSIONS=['被冒犯','语气冲','歧义','不可执行','权力否定'];
const RULES=[
  {pattern:/你们重评优先级吧|自己看着办|别来烦|你怎么总是|你们怎么总是/g,dimension:0,score:65,reason:'可能被理解为把问题或协调责任推给对方。'},
  {pattern:/必须马上|立刻|赶紧|闭嘴|搞清楚|[!！]{2,}/g,dimension:1,score:60,reason:'命令式或连续感叹号可能增加催促感。'},
  {pattern:/这个再看看|到时候再说|差不多|尽快|处理一下/g,dimension:2,score:55,reason:'时间、范围或期望动作不够具体。'},
  {pattern:/你们重评优先级吧|自己看着办|处理一下|随便你/g,dimension:3,score:55,reason:'没有明确要确认的事项或接下来的动作。'},
  {pattern:/你说了不算|你懂什么|不归你管|轮不到你/g,dimension:4,score:75,reason:'直接否定对方参与讨论或决定的资格。'}
];
function inspectDraft(text){
  const scores=DIMENSIONS.map(()=>0),findings=[];
  const sentences=text.match(/[^。！？!?\n]+[。！？!?]*|\n/g)||[];
  let offset=0;
  sentences.forEach((sentence,index)=>{
    const hits=[];
    RULES.forEach(rule=>{rule.pattern.lastIndex=0;let match;while((match=rule.pattern.exec(sentence))!==null){scores[rule.dimension]=Math.max(scores[rule.dimension],rule.score);hits.push({start:match.index,end:match.index+match[0].length,dimension:rule.dimension,reason:rule.reason});}});
    if(hits.length)findings.push({sentence,index,offset,hits});
    offset+=sentence.length;
  });
  return {scores,findings};
}
function markedSentence(f){const hits=[...f.hits].sort((a,b)=>a.start-b.start);let out='',end=0;for(const h of hits){if(h.start<end)continue;out+=esc(f.sentence.slice(end,h.start))+`<mark>${esc(f.sentence.slice(h.start,h.end))}</mark>`;end=h.end;}return out+esc(f.sentence.slice(end));}
function radarSVG(scores){
  const cx=170,cy=151,r=99;
  const point=(i,f)=>[cx+Math.sin(i*Math.PI*2/5)*r*f,cy-Math.cos(i*Math.PI*2/5)*r*f];
  const polygon=f=>DIMENSIONS.map((_,i)=>point(i,f).join(',')).join(' ');
  return `<svg class="risk-radar" viewBox="0 0 340 310" role="img" aria-label="启发式演示雷达：${scores.map((n,i)=>DIMENSIONS[i]+n).join('，')}">${[.2,.4,.6,.8,1].map(f=>`<polygon points="${polygon(f)}" fill="none" stroke="#dce6d7"/>`).join('')}${DIMENSIONS.map((label,i)=>{const p=point(i,1),l=point(i,1.28);return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#dce6d7"/><text x="${l[0]}" y="${l[1]+4}" text-anchor="middle" fill="#7b8c73" font-size="12" stroke="none">${label}</text>`;}).join('')}<polygon points="${scores.map((v,i)=>point(i,v/100).join(',')).join(' ')}" fill="#2e654d25" stroke="#2e654d" stroke-width="2"/></svg>`;
}
function preflightMount(){
  if(state.stage!==2||!currentBranch()||!$('#chatDraft'))return;
  const chatLayout=$('.chat-layout'),chatPanel=chatLayout.firstElementChild,settings=chatLayout.lastElementChild;
  state.preflight=state.preflight||{goal:'拒绝',position:'对等',original:null,proposal:null};
  if(state.preflight.branchId!==state.activeBranch||state.preflight.original!==state.draft){state.preflight.original=null;state.preflight.proposal=null;}
  state.preflight.branchId=state.activeBranch;
  const layout=document.createElement('div');layout.className='preflight-layout';
  const left=document.createElement('div');left.className='preflight-left';
  const right=document.createElement('aside');right.className='preflight-right';
  const draft=document.createElement('section');draft.className='panel draft-panel';
  draft.innerHTML=`<div class="panel-head"><div class="head-label"><span class="number-badge">1</span><h3>草稿辅助</h3></div><span class="tag">输入时实时检查</span></div><div class="draft-controls"><div class="draft-presets"><span>预置草稿：</span><button class="button small" data-preset="reject">说明排期限制</button><button class="button small" data-preset="remind">催对方反馈</button><button class="button small" data-preset="delay">通知延期</button></div><div class="draft-selectors"><div><span>发给谁</span><strong>${esc(currentBranch().persona.name)}</strong><small>来自导入记录 · 对象在聊天窗口切换</small></div><div><span>沟通目的（可选）</span><div class="choice-row">${['拒绝','催办','道歉','同步','提要求'].map(g=>`<button class="choice ${state.preflight.goal===g?'active':''}" data-purpose="${g}" aria-pressed="${state.preflight.goal===g}">${g}</button>`).join('')}</div></div><details><summary>补充话语位置（可选）</summary><div class="choice-row">${['我更高','对等','我更被动'].map(g=>`<button class="choice ${state.preflight.position===g?'active':''}" data-position="${g}" aria-pressed="${state.preflight.position===g}">${g}</button>`).join('')}</div></details></div><p class="draft-status" id="draftStatus" role="status"></p></div>`;
  const diagnosis=document.createElement('section');diagnosis.className='panel';
  diagnosis.innerHTML=`<div class="panel-head"><div class="head-label"><span class="number-badge">2</span><h3>逐句风险定位</h3></div><span class="tag amber">启发式演示</span></div><div class="panel-body" id="sentenceFindings"></div><div class="panel-foot"><span class="subtle">只改命中片段，事实与立场由你复核。</span><button id="rewriteFlagged" class="button primary">改写命中句并复检 ${icon('spark')}</button></div><div id="rewriteResult"></div>`;
  const radar=document.createElement('section');radar.className='panel radar-panel';
  radar.innerHTML=`<div class="panel-head"><div class="head-label"><span class="number-badge">A</span><h3>实时体检雷达</h3></div><span class="tag amber">规则演示</span></div><div class="panel-body"><div id="radarVisual"></div><div id="radarBars"></div><div class="hint-box"><strong>这些数值是什么？</strong><br>固定措辞规则的演示指数，不是冒犯概率或 Jev 判断。不随人格、目的和权力位置改变，未命中也不表示没有风险。</div><p class="subtle" style="margin-top:15px">判断依据：局部文本规则 · 模型置信度：尚未提供</p><button class="button small" disabled title="需要接入真实模型后才能复核">低置信模型复核 · 待接入</button></div>`;
  chatLayout.replaceWith(layout);layout.append(left,right);left.append(chatPanel,draft,diagnosis);right.append(radar,settings);
  chatPanel.querySelector('.panel-head .tag').textContent='模拟回应 · 规则演示';
  preflightUpdate();
}
function preflightUpdate(){
  if(!$('#radarVisual'))return;
  const text=$('#chatDraft').value,result=inspectDraft(text);
  $('#radarVisual').innerHTML=radarSVG(result.scores);
  $('#radarBars').innerHTML=result.scores.map((score,i)=>`<div class="radar-bar"><span>${DIMENSIONS[i]}</span><div><i style="width:${score}%"></i></div><b>${score}</b></div>`).join('');
  $('#draftStatus').textContent=!text.trim()?'● 等待输入…':result.findings.length?`● 命中 ${result.findings.length} 句待检查措辞；请结合对象和上下文判断。`:'● 未命中当前演示规则，不代表表达没有风险。';
  $('#sentenceFindings').innerHTML=result.findings.length?result.findings.map(f=>`<article class="sentence-finding"><span class="tag">第 ${f.index+1} 句</span><p>${markedSentence(f)}</p><div>${[...new Set(f.hits.map(h=>h.reason))].map(reason=>`<small>${esc(reason)}</small>`).join('')}</div></article>`).join(''):`<p class="subtle">${text.trim()?'暂未发现命中规则的片段。完整语境与特定人格判断将在模型接入后提供。':'输入草稿后，这里会定位可能引发误读的具体措辞。'}</p>`;
  $('#rewriteFlagged').disabled=busy||!result.findings.length;
  const proposal=state.preflight.proposal,original=state.preflight.original;
  if(proposal&&original!==null){
    const before=inspectDraft(original).scores,after=inspectDraft(proposal).scores;
    $('#rewriteResult').innerHTML=`<div class="rewrite-preview"><span class="eyebrow">改写 → 同规则复检</span><div class="rewrite-diff"><div><small>修改前</small><p>${esc(original)}</p></div><div><small>候选表达</small><p>${esc(proposal)}</p></div></div><div class="score-comparison">${DIMENSIONS.map((d,i)=>`<span>${d} <b>${before[i]} → ${after[i]}</b></span>`).join('')}</div><p class="subtle">数值下降仅表示命中措辞减少。请检查事实、责任与边界，不能据此保证沟通成功。</p><button class="button primary small" id="applyRewrite">采用这版表达</button><button class="button text small" id="dismissRewrite">保留原文</button></div>`;
  }else $('#rewriteResult').innerHTML='';
}
function rewriteHits(text){return text.replace(/你们重评优先级吧/g,'请确认需要调整的已排期需求，我们再据此评估安排').replace(/自己看着办/g,'请先提出可选方案，我们再确认下一步').replace(/你说了不算/g,'这件事的决策范围需要进一步确认').replace(/你懂什么/g,'我们对这件事的理解可能不同，可以先对齐依据').replace(/轮不到你/g,'我们先确认参与讨论的职责范围').replace(/不归你管/g,'我们先明确各自的职责范围').replace(/你们怎么总是|你怎么总是/g,'这次为什么会').replace(/必须马上|立刻|赶紧/g,'请').replace(/[!！]{2,}/g,'。').replace(/处理一下/g,'确认需要处理的事项和下一步').replace(/这个再看看/g,'这个需要进一步评估，下一步待确认').replace(/到时候再说/g,'具体安排仍待确认').replace(/差不多/g,'具体范围仍待确认').replace(/尽快/g,'在双方确认的时间内').replace(/别来烦/g,'我暂时无法继续讨论，后续时间待确认').replace(/闭嘴/g,'请先让我说明当前观点').replace(/搞清楚/g,'先对齐具体信息').replace(/随便你/g,'请说明你的选择，我们再确认');}
const originalRender=render;
render=function(){originalRender();preflightMount();};
document.addEventListener('input',event=>{if(event.target.id==='chatDraft'){state.preflight.proposal=null;state.preflight.original=null;preflightUpdate();}});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!$('#chatDraft'))return;
  if(button.dataset.preset){if(busy)return;const presets={reject:'这个需求我们排不进去，你们重评优先级吧。',remind:'你怎么总是不反馈？赶紧处理一下！！',delay:'这个交付要延期了，具体时间到时候再说。'};state.draft=presets[button.dataset.preset];$('#chatDraft').value=state.draft;state.preflight.proposal=null;state.preflight.original=null;preflightUpdate();}
  if(button.dataset.purpose||button.dataset.position){const key=button.dataset.purpose?'goal':'position',value=button.dataset.purpose||button.dataset.position;state.preflight[key]=value;const attr=key==='goal'?'data-purpose':'data-position';document.querySelectorAll(`[${attr}]`).forEach(el=>{const selected=el.getAttribute(attr)===value;el.classList.toggle('active',selected);el.setAttribute('aria-pressed',String(selected));});notify('已记录可选场景。当前规则指数不使用这些选项；待模型接入后参与判断。');}
  if(button.id==='rewriteFlagged'){const text=$('#chatDraft').value;state.preflight.original=text;state.preflight.proposal=rewriteHits(text);preflightUpdate();}
  if(button.id==='applyRewrite'){state.draft=state.preflight.proposal;$('#chatDraft').value=state.draft;state.preflight.proposal=null;state.preflight.original=null;preflightUpdate();notify('候选表达已放入草稿。确认后点击“发送并预演”。');}
  if(button.id==='dismissRewrite'){state.preflight.proposal=null;state.preflight.original=null;preflightUpdate();}
});
preflightMount();
