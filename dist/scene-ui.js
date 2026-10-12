'use strict';
// Keep the viewer mounted between chat renders so model replies do not reload GLBs.
const scenePanel=document.createElement('section');scenePanel.className='panel integrated-scene';scenePanel.hidden=true;
scenePanel.innerHTML='<div class="panel-head"><div><h3>面对面预演</h3><small>固定为你的第一人称视角 · 对方动作随聊天切换</small></div><button class="button small" id="toggleScene">收起场景</button></div><div id="sceneBody"><iframe id="dialogueScene" title="第一人称三维对话场景"></iframe><div class="scene-note"><span id="sceneChatStatus" role="status">对方待机</span><span>角色外观为预设；当前无语音，嘴型为节奏演示。</span></div></div>';
$('#view').before(scenePanel);
let sceneFrame=null,sceneTimer=null,sceneBranch=null,sceneAction='Idle',sceneText='',sceneName='对方',sceneExpanded=true;
function postScene(){sceneFrame?.contentWindow?.postMessage({type:'read-the-room-state',action:sceneAction,name:sceneName,text:sceneText,visible:!scenePanel.hidden&&sceneExpanded},location.origin);}
function sceneState(action,text='',name=currentBranch()?.persona.name||'对方'){
 clearTimeout(sceneTimer);sceneAction=action;sceneText=text;sceneName=name;
 $('#sceneChatStatus').textContent=({Idle:'对方待机',Listen:'正在等待模型回复 · 对方倾听',Talk:'对方回应中',Nod:'对方点头'})[action];postScene();
}
function syncScene(){
 const visible=state.stage===2&&!!currentBranch();scenePanel.hidden=!visible;
 if(!visible){if(sceneAction!=='Idle')sceneState('Idle');else postScene();return;}
 if(!sceneFrame){sceneFrame=$('#dialogueScene');sceneFrame.src='/scene/index.html?embed=1';}
 if(sceneBranch!==state.activeBranch){sceneBranch=state.activeBranch;sceneState('Idle');}
 if(busy)sceneState('Listen');else if(sceneAction==='Listen')sceneState('Idle');
 postScene();
}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===sceneFrame?.contentWindow&&e.data?.type==='read-the-room-scene-ready')postScene();});
$('#toggleScene').onclick=()=>{sceneExpanded=!sceneExpanded;$('#sceneBody').hidden=!sceneExpanded;$('#toggleScene').textContent=sceneExpanded?'收起场景':'展开场景';postScene();};
const sceneRender=render;render=function(){sceneRender();syncScene();};
const sendWithModel=sendMessage;
sendMessage=async function(){
 const branch=currentBranch(),before=branch?.messages.at(-1)?.id;
 await sendWithModel();
 const last=branch?.messages.at(-1);
 if(state.stage===2&&branch?.id===state.activeBranch&&last?.role==='assistant'&&last.id!==before){
  sceneState('Talk',last.text,branch.persona.name);
  sceneTimer=setTimeout(()=>sceneState('Idle'),Math.min(14000,Math.max(3000,last.text.length*85)));
 }
};
syncScene();
