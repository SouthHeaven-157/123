import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $=s=>document.querySelector(s);
const definitions={
 interview:{label:'INTERVIEW ROOM',roles:{Host:'对方 · 面试官',Partner:'我 · 候选人'},scenario:'围绕经历与能力，练习面试中的表达。',lines:[['Host','可以介绍一下，你在这个项目中负责的部分吗？'],['Partner','我负责前端交互与原型验证。我想先讲一个具体例子。'],['Host','好的，也请说明当时遇到的困难和你的处理方式。']]},
 meeting:{label:'MEETING ROOM',roles:{Host:'对方 · 项目负责人',Partner:'我 · 协作同事'},scenario:'面对临时需求，先对齐取舍，再确认下一步。',lines:[['Partner','目前排期已满，新增需求需要确认优先级。'],['Host','你可以给出两个方案，并说明对原计划的影响吗？'],['Partner','可以。我们先评估拆分交付和调整已有任务这两个方向。']]},
 school:{label:'SCHOOL CORRIDOR',roles:{Host:'对方 · 老师',Partner:'我 · 学生'},scenario:'课间的一次交流，练习把困难与请求说清楚。',lines:[['Partner','老师，我想和您聊一下最近小组合作的情况。'],['Host','可以，先说说你遇到了什么具体困难。'],['Partner','我们分工还不够明确，我希望一起确认每个人负责的部分。']]}
};
const viewport=$('#viewport');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
viewport.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','固定在用户眼睛位置的第一人称对话场景');
const world=new THREE.Scene();world.background=new THREE.Color('#e9ede3');
world.add(new THREE.HemisphereLight(0xf6f9ff,0xaaa397,1.1));
const key=new THREE.DirectionalLight(0xffeed1,3);key.position.set(-4,8,5);key.castShadow=true;key.shadow.mapSize.set(1536,1536);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:30});key.shadow.normalBias=.025;world.add(key);
const fill=new THREE.DirectionalLight(0xdce9ff,1.3);fill.position.set(5,4,-3);world.add(fill);
const ceilingLight=new THREE.PointLight(0xffefd9,16,10,2);ceilingLight.position.set(0,2.4,0);world.add(ceilingLight);world.add(key.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe9ede3,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.22;ground.receiveShadow=true;world.add(ground);
const camera=new THREE.PerspectiveCamera(45,1,.05,100);camera.position.set(5,4,6);
const loader=new GLTFLoader();let root=null,mixer=null,clips=[],sceneId='interview',loadEpoch=0,ready=false,timer=null,sequenceEpoch=0,automaticMouth=true;
const active={Host:null,Partner:null},states={Host:'Idle',Partner:'Idle'};
let externalVisible=true;
const mouths={Host:[],Partner:[]},eyes={Host:[],Partner:[]};
const clock=new THREE.Clock();let elapsed=0,frames=0,statsTime=0;
function fit(){const {width,height}=viewport.getBoundingClientRect();if(width<=0||height<=0)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
new ResizeObserver(fit).observe(viewport);fit();
function disposeTree(tree){tree.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();}});}
function setControlsEnabled(enabled){for(const el of document.querySelectorAll('[data-camera],[data-action],#speaker,#mouth,#blink,#play'))el.disabled=!enabled;}
function shot(){if(!root)return;const source=root.getObjectByName('Camera_FirstPerson');if(!source)throw Error('缺少第一人称镜头');source.updateWorldMatrix(true,false);source.getWorldPosition(camera.position);source.getWorldQuaternion(camera.quaternion);camera.fov=source.fov;camera.updateProjectionMatrix();}
function refreshButtons(){document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===states[$('#speaker').value]));}
function setAction(role,action){if(!ready||!['Host','Partner'].includes(role)||!['Idle','Listen','Talk','Nod'].includes(action))return false;const clip=clips.find(c=>c.name===role+'_'+action);if(!clip)return false;const next=mixer.clipAction(clip);if(active[role]!==next){active[role]?.fadeOut(.2);next.reset().setEffectiveWeight(1).fadeIn(.2).play();active[role]=next;}states[role]=action;refreshButtons();return true;}
function setMouth(role,value){for(const mesh of mouths[role]||[])mesh.morphTargetInfluences[mesh.morphTargetDictionary.mouthOpen]=THREE.MathUtils.clamp(Number(value)||0,0,1);}
function stop(){clearTimeout(timer);sequenceEpoch++;$('#caption').hidden=true;$('#stop').disabled=true;$('#play').disabled=!ready;automaticMouth=true;for(const role of ['Host','Partner']){setAction(role,'Idle');setMouth(role,0);}$('#mouth').value='0';$('#mouthValue').value='0%';}
async function loadScene(id){if(!definitions[id])return;const epoch=++loadEpoch;stop();ready=false;setControlsEnabled(false);$('#loading').hidden=false;$('#loading').textContent='正在准备对话空间…';$('#loadStatus').textContent='正在载入模型…';
 try{const gltf=await loader.loadAsync('assets-v3/'+id+'.glb');if(epoch!==loadEpoch){disposeTree(gltf.scene);return;}
  if(root){mixer.stopAllAction();mixer.uncacheRoot(root);world.remove(root);disposeTree(root);}root=gltf.scene;world.add(root);root.updateMatrixWorld(true);sceneId=id;clips=gltf.animations;mixer=new THREE.AnimationMixer(root);
  for(const role of ['Host','Partner']){active[role]=null;mouths[role]=[];eyes[role]=[];}
  root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;for(const mat of Array.isArray(o.material)?o.material:[o.material]){if(mat.name==="suit"||mat.name==="lapel"){mat.sheen=.12;mat.sheenColor?.setRGB(.06,.075,.11);mat.sheenRoughness=.85;}}const role=o.name.startsWith('Host')?'Host':o.name.startsWith('Partner')?'Partner':null;if(role==='Partner')o.visible=false;if(role&&o.morphTargetDictionary){if('mouthOpen' in o.morphTargetDictionary)mouths[role].push(o);if('blink' in o.morphTargetDictionary)eyes[role].push(o);}});
  const lighting={interview:[[-1.3,2.1,.3],[0,1,-.5],[0,2.4,0]],meeting:[[-2.5,2.2,.6],[0,1,-.4],[0,2.65,.15]],school:[[-1.4,2.4,5],[.3,1.3,3.45],[0,2.9,4.5]]}[id];key.position.fromArray(lighting[0]);key.target.position.fromArray(lighting[1]);ceilingLight.position.fromArray(lighting[2]);key.intensity=2.2;fill.intensity=.35;
  ready=true;setControlsEnabled(true);setAction('Host','Idle');setAction('Partner','Idle');shot();$('#loading').hidden=true;$('#loadStatus').textContent='第一人称 · 视角固定';$('#sceneLabel').textContent=definitions[id].label;$('#scenario').textContent=definitions[id].scenario;
  for(const option of $('#speaker').options)option.textContent=definitions[id].roles[option.value];
  document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('active',b.dataset.scene===id));
  $('#blendLink').href='assets-v3/'+id+'.blend';$('#glbLink').href='assets-v3/'+id+'.glb';
  $('#modelStats').textContent='1 个对话对象 · '+clips.length+' 组动作';
  window.dispatchEvent(new CustomEvent('dialogue-ready',{detail:{scene:id,clips:clips.map(c=>c.name)}}));
 }catch(error){if(epoch!==loadEpoch)return;$('#loadStatus').textContent='载入失败';$('#loading').textContent='模型载入失败，请刷新重试。'+error.message;console.error(error);}
}
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>loadScene(b.dataset.scene));
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>shot(b.dataset.camera));
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{stop();automaticMouth=true;setAction($('#speaker').value,b.dataset.action);setAction($('#speaker').value==='Host'?'Partner':'Host',b.dataset.action==='Talk'?'Listen':'Idle');});
$('#speaker').onchange=()=>{automaticMouth=true;$('#mouth').value=0;$('#mouthValue').value='0%';refreshButtons();};
$('#mouth').oninput=()=>{automaticMouth=false;setMouth($('#speaker').value,$('#mouth').value);$('#mouthValue').value=Math.round($('#mouth').value*100)+'%';};
$('#stop').onclick=stop;
$('#play').onclick=()=>{stop();const epoch=sequenceEpoch;$('#play').disabled=true;$('#stop').disabled=false;let index=0;const lines=definitions[sceneId].lines;function advance(){if(epoch!==sequenceEpoch||!ready)return;if(index>=lines.length){stop();return;}const [role,line]=lines[index++];setAction(role,'Talk');setAction(role==='Host'?'Partner':'Host','Listen');$('#caption').hidden=false;$('#captionSpeaker').textContent=definitions[sceneId].roles[role];$('#captionText').textContent=line;timer=setTimeout(advance,4800);}advance();};
// Integration contract: imported persona/model responses can drive this renderer.
window.dialogueStage={setAction,setMouth,loadScene,shot,stop,getState:()=>({scene:sceneId,ready,perspective:'first-person',cameraPosition:camera.position.toArray(),cameraRotation:camera.quaternion.toArray(),states:{...states},clips:clips.map(c=>c.name),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,morphs:{Host:mouths.Host.length,Partner:mouths.Partner.length}})};
window.addEventListener('dialogue-state',e=>{const d=e.detail||{};if(d.action)setAction(d.speaker,d.action);if(d.mouthOpen!==undefined){automaticMouth=false;setMouth(d.speaker,d.mouthOpen);}});
renderer.setAnimationLoop(()=>{const rawDelta=clock.getDelta();if(!externalVisible||document.hidden)return;const dt=Math.min(rawDelta,.05);elapsed+=dt;mixer?.update(dt);
 for(const [index,role] of ['Host','Partner'].entries()){
  if(automaticMouth)setMouth(role,states[role]==='Talk'?.12+.65*Math.abs(Math.sin(elapsed*9+index)*Math.sin(elapsed*5)):0);
  const blinkPhase=(elapsed+index*1.67)%4.3;const blink=$('#blink').checked&&blinkPhase<.18?Math.sin(blinkPhase/.18*Math.PI):0;for(const mesh of eyes[role])mesh.morphTargetInfluences[mesh.morphTargetDictionary.blink]=blink;
 }
 renderer.render(world,camera);frames++;statsTime+=rawDelta;if(statsTime>=1){$('#renderStats').textContent=Math.round(frames/statsTime)+' FPS · '+renderer.info.render.calls+' 次绘制';frames=0;statsTime=0;}
});
const embedded=new URLSearchParams(location.search).get('embed')==='1';
let externalState={action:'Idle',name:'对方',text:''};
function applyExternal(){
 if(!embedded||!ready)return;
 stop();setAction('Host',externalState.action);
 $('#caption').hidden=!externalState.text;$('#captionSpeaker').textContent=externalState.name;$('#captionText').textContent=externalState.text;
}
if(embedded){
 document.documentElement.classList.add('embedded');
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='read-the-room-state')return;
  const d=e.data;
  if(!['Idle','Listen','Talk','Nod'].includes(d.action))return;
  externalVisible=d.visible!==false;
  externalState={action:d.action,name:String(d.name||'对方').slice(0,80),text:String(d.text||'').slice(0,5000)};applyExternal();
 });
 window.addEventListener('dialogue-ready',()=>{applyExternal();parent.postMessage({type:'read-the-room-scene-ready',scene:sceneId},location.origin);});
}
loadScene('interview');
