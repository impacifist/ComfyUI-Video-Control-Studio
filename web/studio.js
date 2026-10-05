import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';
import { DEFAULT_LANGUAGE } from './locale.js';

const defaults={modes:['canny'],output:'canny',start:0,duration:5,fps:24,max_side:768,test:false,test_time:0,hands:true,face:false,feet:false,threshold:.3,low:.2,high:.5,depth_invert:false,batch_size:1};
const words={
 en:{advanced:'Advanced settings',extract:'Extract segment',test:'Test one frame',start:'Start (seconds)',duration:'Duration (0 = rest)',fps:'Output FPS (0 = source)',max_side:'Maximum side',test_time:'Test time in segment (seconds)',hands:'Hands',face:'Face',feet:'Feet',threshold:'Pose confidence',low:'Canny low',high:'Canny high',depth_invert:'Invert depth',batch_size:'Inference batch size',output:'Control output',original:'Original',pose:'Pose',depth:'Depth',canny:'Canny',empty:'Connect Load Video, select modes, then extract.',dirty:'Settings changed. Extract again to update the outputs.',queued:'Queued: this node and its inputs only.',advancedNote:'Pose: single-person SDPose. Depth: per-frame DA3, shared contrast across the segment. No tracking or temporal smoothing.',previewNote:'A/B is a preview only. The output is the clean selected control map. Preview files are temporary.',single:'ONE-FRAME TEST — run Extract segment for a full control video.',play:'Play / pause',back:'Previous frame',next:'Next frame',split:'Comparison divider',seek:'Timeline',swap:'Swap A/B',in:'Set start here',out:'Set end here',save:'Save preset',presets:'Presets',presetName:'Preset name',poseModel:'Pose checkpoint',depthModel:'Depth checkpoint',failure:'Missing preview. Extract again.',runError:'Cannot queue this node. Use ComfyUI Run if it is inside a subgraph.',stale:'Showing previous extraction.'},
 ko:{advanced:'세부 설정',extract:'선택 구간 추출',test:'한 프레임 시험',start:'시작 시간 (초)',duration:'구간 길이 (0 = 나머지)',fps:'출력 FPS (0 = 원본)',max_side:'최대 변 길이',test_time:'구간 내 시험 위치 (초)',hands:'손',face:'얼굴',feet:'발',threshold:'포즈 신뢰도',low:'Canny 낮은 임계값',high:'Canny 높은 임계값',depth_invert:'Depth 반전',batch_size:'추론 배치 크기',output:'Control output',original:'원본',pose:'포즈',depth:'깊이',canny:'윤곽선',empty:'Load Video를 연결하고 추출 종류를 선택하세요.',dirty:'설정이 변경됐습니다. 다시 추출하면 출력에 반영됩니다.',queued:'이 노드와 필요한 입력만 실행 대기 중입니다.',advancedNote:'Pose: 단일 인물 SDPose. Depth: 프레임별 DA3, 구간 전체 명암 범위 공유. 인물 추적·시간축 안정화는 포함하지 않습니다.',previewNote:'A/B 화면은 확인용입니다. 출력은 선택한 추출 결과만 전달합니다. 미리보기 파일은 임시 저장됩니다.',single:'한 프레임 시험 결과 — 전체 제어 영상은 선택 구간 추출을 실행하세요.',play:'재생 / 일시정지',back:'이전 프레임',next:'다음 프레임',split:'비교선 위치',seek:'영상 시간',swap:'A/B 바꾸기',in:'현재 위치를 시작으로',out:'현재 위치를 끝으로',save:'프리셋 저장',presets:'프리셋',presetName:'프리셋 이름',poseModel:'포즈 체크포인트',depthModel:'Depth 체크포인트',failure:'미리보기가 없습니다. 다시 추출하세요.',runError:'노드를 실행할 수 없습니다. 서브그래프 내부에서는 ComfyUI 실행을 사용하세요.',stale:'이전 추출 결과를 표시 중입니다.'}
};
const controllers=new WeakMap();
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
function install(node){
 if(controllers.has(node))return;
 const storage=node.widgets.find(w=>w.name==='settings_json');
 const poseWidget=node.widgets.find(w=>w.name==='pose_checkpoint'),depthWidget=node.widgets.find(w=>w.name==='depth_checkpoint');
 for(const w of [storage,poseWidget,depthWidget]){w.type='hidden';w.hidden=true;w.computeSize=()=>[0,-4];w.draw=()=>{};}
 let cfg=structuredClone(defaults),manifest=null,frame=0,split=.5,playing=false,lastTime=0,clockFrame=0,raf=0,playbackRun=0,disposed=false,drawVersion=0;
 let lang=(node.properties?.vcs_language||DEFAULT_LANGUAGE)==='ko'?'ko':'en';
 const t=key=>words[lang][key]||key;
 const root=element('div','vcs');
 const header=element('div','row header');header.append(element('strong','', 'Video Control Studio'));
 const language=element('select');language.setAttribute('aria-label','Language');for(const[k,v]of [['en','English'],['ko','한국어']])language.add(new Option(v,k));language.value=lang;header.append(language);root.append(header);
 const labeled=[];
 const label=(el,key,attr=null)=>{labeled.push([el,key,attr]);if(attr)el.setAttribute(attr,t(key));else el.textContent=t(key);return el;};
 const modes=element('div','row');const modeInputs={};
 for(const key of ['pose','depth','canny']){const l=element('label');const input=element('input');input.type='checkbox';input.dataset.mode=key;modeInputs[key]=input;l.append(input,label(element('span'),key));modes.append(l);input.onchange=()=>{cfg.modes=Object.keys(modeInputs).filter(k=>modeInputs[k].checked);if(!cfg.modes.includes(cfg.output))cfg.output=cfg.modes[0]||'canny';refreshOutput();write();};}
 root.append(modes);
 const settings=element('div','fields');const inputs={};
 function field(key,parent,min,max,step){const l=element('label','field');l.append(label(element('span'),key));const input=element('input');input.type='number';input.min=min;input.max=max;input.step=step;input.dataset.setting=key;input.onchange=()=>{cfg[key]=Number(input.value);write();};inputs[key]=input;l.append(input);parent.append(l);}
 field('start',settings,0,86400,.1);field('duration',settings,0,86400,.1);root.append(settings);
 const screen=element('div','screen');const canvas=element('canvas');canvas.width=768;canvas.height=432;const ctx=canvas.getContext('2d');
 const badgeA=element('span','badge a','A'),badgeB=element('span','badge b','B');screen.append(canvas,badgeA,badgeB);root.append(screen);
 const compare=element('div','row');const a=element('select'),b=element('select');a.setAttribute('aria-label','A');b.setAttribute('aria-label','B');a.className=b.className='stretch';const swap=label(element('button'), 'swap');compare.append(a,swap,b);root.append(compare);
 const divider=element('input');divider.type='range';divider.min=0;divider.max=100;divider.value=50;divider.style.width='100%';label(divider,'split','aria-label');root.append(divider);
 divider.oninput=()=>{split=Number(divider.value)/100;draw();};
 let pointer=null;canvas.onpointerdown=e=>{e.stopPropagation();pointer=e.pointerId;canvas.setPointerCapture(pointer);moveDivider(e);};
 function moveDivider(e){if(pointer!==e.pointerId)return;const r=canvas.getBoundingClientRect();split=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));divider.value=Math.round(split*100);draw();}
 canvas.onpointermove=moveDivider;canvas.onpointerup=canvas.onpointercancel=()=>{pointer=null;};
 const transport=element('div','row');
 function button(text,key,fn){const e=element('button','',text);label(e,key,'aria-label');label(e,key,'title');e.onclick=fn;return e;}
 const play=button('▶','play',()=>{if(!manifest)return;playing=!playing;const run=++playbackRun;play.textContent=playing?'Ⅱ':'▶';lastTime=performance.now();clockFrame=frame;if(playing)raf=requestAnimationFrame(()=>tick(run));else cancelAnimationFrame(raf);});
 const seek=element('input');seek.type='range';seek.min=0;seek.max=0;seek.step=1;seek.value=0;label(seek,'seek','aria-label');const time=element('span','time');
 function go(n){if(!manifest)return;playing=false;cancelAnimationFrame(raf);play.textContent='▶';frame=Math.max(0,Math.min(manifest.count-1,n));draw();}
 seek.oninput=()=>go(Number(seek.value));transport.append(play,button('◀','back',()=>go(frame-1)),button('▶|','next',()=>go(frame+1)),seek,time);root.append(transport);
 const marks=element('div','row');const markIn=label(element('button'),'in'),markOut=label(element('button'),'out');marks.append(markIn,markOut);root.append(marks);
 markIn.onclick=()=>{if(!manifest||manifest.test)return;const oldEnd=cfg.duration?cfg.start+cfg.duration:null;cfg.start=manifest.start+frame/manifest.fps;if(oldEnd!==null)cfg.duration=Math.max(1/manifest.fps,oldEnd-cfg.start);reloadFields();write();};
 markOut.onclick=()=>{if(!manifest||manifest.test)return;cfg.duration=Math.max(1/manifest.fps,manifest.start+(frame+1)/manifest.fps-cfg.start);reloadFields();write();};
 const outputRow=element('label','row');outputRow.append(label(element('span'),'output'));const output=element('select');output.dataset.setting='output';outputRow.append(output);root.append(outputRow);output.onchange=()=>{cfg.output=output.value;write();};
 const actions=element('div','row');const test=label(element('button'),'test'),extract=label(element('button','primary'),'extract');actions.append(test,extract);root.append(actions);
 const advanced=element('details');advanced.open=true;advanced.append(label(element('summary'),'advanced'));const advFields=element('div','fields');advanced.append(advFields);
 field('fps',advFields,0,120,1);field('max_side',advFields,64,4096,32);field('test_time',advFields,0,86400,.1);field('batch_size',advFields,1,16,1);field('threshold',advFields,0,1,.01);field('low',advFields,.01,.99,.01);field('high',advFields,.01,.99,.01);
 for(const key of ['hands','face','feet','depth_invert']){const l=element('label','row');const input=element('input');input.type='checkbox';inputs[key]=input;input.onchange=()=>{cfg[key]=input.checked;write();};l.append(input,label(element('span'),key));advFields.append(l);}
 for(const[w,key]of [[poseWidget,'poseModel'],[depthWidget,'depthModel']]){const l=element('label','field');l.append(label(element('span'),key));const select=element('select');const values=typeof w.options.values==='function'?w.options.values():w.options.values;for(const value of values||[])select.add(new Option(value,value));select.value=w.value;select.onchange=()=>{w.value=select.value;write();};l.append(select);advFields.append(l);w.vcsSelect=select;}
 advanced.append(label(element('p','note'),'advancedNote'));root.append(advanced);
 const presets=element('div','row');const preset=element('select');label(preset,'presets','aria-label');const presetName=element('input','preset-name');presetName.type='text';label(presetName,'presetName','placeholder');const save=label(element('button'),'save');presets.append(preset,presetName,save);root.append(presets);
 const status=element('div','status');status.setAttribute('role','status');root.insertBefore(status,advanced);root.append(label(element('p','note'),'previewNote'));
 const cache=new Map();
 function image(kind,index){const key=kind+':'+index;if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const ref=manifest.streams[kind][index];if(!ref)throw new Error(`Invalid preview frame: ${index} / ${manifest.count}`);const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(t('failure')));img.src=api.apiURL('/view?'+new URLSearchParams(ref));});cache.set(key,promise);while(cache.size>64)cache.delete(cache.keys().next().value);return promise;}
 function drawImage(img){const scale=Math.min(canvas.width/img.width,canvas.height/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);}
 async function draw(){const version=++drawVersion;if(!manifest){ctx.fillStyle='#0b1119';ctx.fillRect(0,0,768,432);ctx.fillStyle='#a7bacd';ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillText(t('empty'),384,220);return;}
  seek.value=frame;time.textContent=`${(frame/manifest.fps).toFixed(2)}s · ${frame+1}/${manifest.count}`;badgeA.textContent='A · '+t(a.value);badgeB.textContent='B · '+t(b.value);
  try{const [left,right]=await Promise.all([image(a.value,frame),image(b.value,frame)]);if(version!==drawVersion||disposed)return;ctx.fillStyle='#000';ctx.fillRect(0,0,768,432);drawImage(right);ctx.save();ctx.beginPath();ctx.rect(0,0,768*split,432);ctx.clip();ctx.fillStyle='#000';ctx.fillRect(0,0,768,432);drawImage(left);ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(768*split,0);ctx.lineTo(768*split,432);ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(768*split-5,198,10,36);
  }catch(err){if(!disposed&&version===drawVersion){status.textContent=err.message;status.classList.add('error');playing=false;play.textContent='▶';cancelAnimationFrame(raf);}}}
 // RAF's timestamp may precede the click that started playback. Use one clock.
 async function tick(run){if(!playing||disposed||run!==playbackRun)return;const elapsed=Math.max(0,performance.now()-lastTime);const next=(clockFrame+Math.floor(elapsed*manifest.fps/1000))%manifest.count;if(next!==frame){frame=next;await draw();}if(playing&&!disposed&&run===playbackRun)raf=requestAnimationFrame(()=>tick(run));}
 a.onchange=b.onchange=()=>draw();swap.onclick=()=>{const temp=a.value;a.value=b.value;b.value=temp;draw();};
 function write(){storage.value=JSON.stringify(cfg);status.classList.remove('error');status.textContent=t('dirty');node.graph?.change();}
 function refreshOutput(){output.replaceChildren(...cfg.modes.map(m=>new Option(words.en[m],m)));output.value=cfg.output;}
 function reloadFields(){for(const[key,input]of Object.entries(inputs)){if(input.type==='checkbox')input.checked=cfg[key];else input.value=cfg[key];}for(const[key,input]of Object.entries(modeInputs))input.checked=cfg.modes.includes(key);refreshOutput();}
 function refreshPresets(){preset.replaceChildren(new Option(t('presets'),''));for(const name of Object.keys(node.properties.vcs_presets||{}))preset.add(new Option(name,name));}
 save.onclick=()=>{const name=presetName.value.trim();if(!name)return;node.properties.vcs_presets={...node.properties.vcs_presets,[name]:structuredClone({...cfg,test:false})};refreshPresets();preset.value=name;node.graph?.change();};
 preset.onchange=()=>{const saved=node.properties.vcs_presets?.[preset.value];if(saved){cfg={...defaults,...structuredClone(saved)};reloadFields();write();}};
 async function run(single){test.disabled=extract.disabled=true;try{cfg.test=false;write();const graph=await app.graphToPrompt();const target=String(node.id);if(!graph.output[target]||graph.output[target].class_type!=='VideoControlStudio')throw new Error(t('runError'));graph.output[target].inputs.settings_json=JSON.stringify({...cfg,test:single});const isolated={};function collect(id){if(isolated[id])return;const entry=graph.output[id];if(!entry)throw new Error(t('runError'));isolated[id]=entry;for(const value of Object.values(entry.inputs)){if(Array.isArray(value)&&value.length===2&&Number.isInteger(value[1])&&graph.output[String(value[0])])collect(String(value[0]));}}collect(target);await api.queuePrompt(0,{output:isolated,workflow:graph.workflow});status.textContent=t('queued');}catch(e){status.textContent=e.message||String(e);status.classList.add('error');}finally{test.disabled=extract.disabled=false;}}
 test.onclick=()=>run(true);extract.onclick=()=>run(false);
 function reload(){try{const parsed=JSON.parse(storage.value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||(parsed.modes!==undefined&&!Array.isArray(parsed.modes)))throw new Error('Invalid settings JSON');cfg={...defaults,...parsed,test:false};storage.value=JSON.stringify(cfg);test.disabled=extract.disabled=false;status.classList.remove('error');status.textContent=t('empty');}catch{status.textContent='Invalid settings JSON';status.classList.add('error');test.disabled=extract.disabled=true;return;}reloadFields();poseWidget.vcsSelect.value=poseWidget.value;depthWidget.vcsSelect.value=depthWidget.value;refreshPresets();draw();}
 language.onchange=()=>{lang=language.value;node.properties.vcs_language=lang;for(const[el,key,attr]of labeled){if(attr)el.setAttribute(attr,t(key));else el.textContent=t(key);}refreshOutput();refreshPresets();if(manifest){const av=a.value,bv=b.value;a.replaceChildren(...Object.keys(manifest.streams).map(k=>new Option(t(k),k)));b.replaceChildren(...Object.keys(manifest.streams).map(k=>new Option(t(k),k)));a.value=av;b.value=bv;}status.textContent=manifest?.test?t('single'):manifest?`${manifest.width} × ${manifest.height} · ${manifest.fps.toFixed(3)} FPS · ${manifest.count} frames`:t('empty');draw();node.graph?.change();};
 root.addEventListener('pointerdown',e=>e.stopPropagation());root.addEventListener('keydown',e=>e.stopPropagation());root.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
 const content=element('div','vcs-content');content.append(...root.childNodes);root.append(content);
 const contentHeight=()=>content.offsetHeight?Math.ceil(content.offsetHeight+28):1300;
 const widget=node.addDOMWidget('vcs_editor','VCS_'+crypto.randomUUID(),root,{serialize:false,hideOnZoom:false,getMinHeight:contentHeight});widget.serialize=false;
 function minimumSize(){return [640,Math.max(node.computeSize()[1],contentHeight()+170)];}
 let sizingFrame=0;
 function fitContents(){cancelAnimationFrame(sizingFrame);sizingFrame=requestAnimationFrame(()=>{if(disposed||!root.isConnected)return;const [w,h]=minimumSize();if(node.size[0]<w||node.size[1]<h){node.setSize([Math.max(w,node.size[0]),Math.max(h,node.size[1])]);node.graph?.setDirtyCanvas(true,true);}});}
 const oldResize=node.onResize;node.onResize=function(size){oldResize?.call(this,size);const [w,h]=minimumSize();size[0]=Math.max(w,size[0]);size[1]=Math.max(h,size[1]);fitContents();};
 const observer=new ResizeObserver(fitContents);observer.observe(content);
 node.setSize([Math.max(640,node.size[0]),Math.max(1470,node.size[1])]);
 play.disabled=true;seek.disabled=true;
 const oldExecuted=node.onExecuted;node.onExecuted=function(data){oldExecuted?.call(this,data);const result=data.vcs?.[0];if(!result)return;playing=false;cancelAnimationFrame(raf);play.textContent='▶';manifest=result;cache.clear();frame=0;seek.max=manifest.count-1;play.disabled=seek.disabled=manifest.count<2;for(const sel of [a,b])sel.replaceChildren(...Object.keys(manifest.streams).map(k=>new Option(t(k),k)));a.value='original';b.value=manifest.output;markIn.disabled=markOut.disabled=manifest.test;status.classList.remove('error');status.textContent=manifest.test?t('single'):`${manifest.width} × ${manifest.height} · ${manifest.fps.toFixed(3)} FPS · ${manifest.count} frames`;draw();};
 const oldConfigure=node.onConfigure;node.onConfigure=function(...args){const r=oldConfigure?.apply(this,args);lang=(this.properties.vcs_language||DEFAULT_LANGUAGE)==='ko'?'ko':'en';language.value=lang;reload();language.onchange();return r;};
 const oldRemoved=node.onRemoved;node.onRemoved=function(...args){disposed=true;playing=false;cancelAnimationFrame(raf);cancelAnimationFrame(sizingFrame);observer.disconnect();cache.clear();root.remove();return oldRemoved?.apply(this,args);};
 controllers.set(node,{reload});reload();
}
app.registerExtension({name:'VideoControlStudio.Editor',setup(){const link=element('link');link.rel='stylesheet';link.href=new URL('./studio.css',import.meta.url).href;document.head.append(link);},nodeCreated(node){if(node.comfyClass==='VideoControlStudio')install(node);},loadedGraphNode(node){controllers.get(node)?.reload();}});
