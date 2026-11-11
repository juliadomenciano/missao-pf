import './style.css';
import { start as startSync, markDirty, configured, currentUser, signIn, signUp, signOut, pull } from './sync.js';
import { setupNative, askPermission, scheduleAlert, cancelAlert, isNative } from './native.js';
import { getLessonText } from './lessons.js';
import { initRevisao, applyReminders } from './revisao.js';
import { initExtras } from './extras.js';
import { initCasos } from './casos.js';
import { initQuest, renderQdia, renderSimulados, renderErros, lessonAnswered, aulaEstudada } from './quest.js';

const MAT=[
 {id:'port',n:'Português',b:1,c:'#6aa7ff'},
 {id:'adm',n:'Dir. Administrativo',b:1,c:'#f2b84b'},
 {id:'const',n:'Dir. Constitucional',b:1,c:'#5fd38d'},
 {id:'penal',n:'Penal e Proc. Penal',b:1,c:'#ff7f6e'},
 {id:'dh',n:'Direitos Humanos',b:1,c:'#f78fb3'},
 {id:'leg',n:'Legislação Especial',b:1,c:'#e3a06a'},
 {id:'est',n:'Estatística',b:1,c:'#7ad3f0'},
 {id:'rl',n:'Raciocínio Lógico',b:1,c:'#c4e36b'},
 {id:'info',n:'Informática',b:2,c:'#2fc4c4'},
 {id:'cont',n:'Contabilidade',b:3,c:'#b794f6'},
 {id:'disc',n:'Discursiva',b:0,c:'#d7dbe4'},
 {id:'rev',n:'Revisão geral',b:0,c:'#8f98ab'}
];
const MM=Object.fromEntries(MAT.map(m=>[m.id,m]));
const CICLO_SUGERIDO=[{m:'const',h:3},{m:'adm',h:3},{m:'penal',h:3},{m:'port',h:3},{m:'cont',h:3},{m:'info',h:1}];
const PROVAS=[
 {id:'barra',n:'Barra fixa',meta:15,unit:'s',dir:1,desc:'Suspensão com o queixo acima da barra',ph:'Ex.: 12 (segundos)',c:'#6aa7ff'},
 {id:'imp',n:'Impulsão horizontal',meta:1.56,unit:'m',dir:1,desc:'Salto parado, a partir da linha',ph:'Ex.: 1,48 (metros)',c:'#f2b84b'},
 {id:'nat',n:'Natação 50 m',meta:64,unit:'tempo',dir:-1,desc:'Nadar 50 m em até 1:04',ph:'Ex.: 1:10 (min:seg)',c:'#2fc4c4'},
 {id:'corr',n:'Corrida 12 min',meta:1800,unit:'m',dir:1,desc:'Distância percorrida em 12 minutos',ph:'Ex.: 1650 (metros)',c:'#ff7f6e'}
];
const PM=Object.fromEntries(PROVAS.map(p=>[p.id,p]));
const TREINOS=['Corrida','Natação','Barra e força de costas','Impulsão e pliometria','Musculação','Mobilidade','Outro'];
const DEF={
 cfg:{pomo:{foco:25,pausa:5,longa:15,ciclos:4,som:true,auto:false},meta:18,prova:'',ciclo:[],volta:{n:1,feito:{}},mod:{painel:true,patentes:true,conquistas:true},qdia:{n:5,todas:false}},
 tarefas:{lista:[]},
 aulas:{p:{}},
 taf:{marcas:[],treinos:[]},
 quest:{hist:{},erros:{},qdia:null,sims:[]}
};

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const pad=n=>String(n).padStart(2,'0');
const dkey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const mkey=k=>'log-'+k.slice(0,7);
const fmtH=min=>{min=Math.round(min);const h=Math.floor(min/60),m=min%60;return h?(h+'h'+(m?pad(m):'')):(m+' min')};
const fmtClockH=ms=>{const s=Math.max(0,Math.ceil(ms/1000));const h=Math.floor(s/3600);return (h?h+':':'')+pad(Math.floor(s%3600/60))+':'+pad(s%60)};
const fmtClock=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return pad(Math.floor(s/60))+':'+pad(s%60)};
const fmtDate=k=>{const d=parseKey(k);return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','')};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const matOpts=(sel,incl)=>(incl?'<option value="">Sem matéria</option>':'')+MAT.map(m=>`<option value="${m.id}"${m.id===sel?' selected':''}>${esc(m.n)}</option>`).join('');
const local={get(k){try{return JSON.parse(localStorage.getItem('mpf:'+k))}catch(e){return null}},set(k,v){try{localStorage.setItem('mpf:'+k,JSON.stringify(v))}catch(e){}}};
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),2600)}
function weekStart(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const wd=(x.getDay()+6)%7;return addDays(x,-wd)}

const S={};
const docs={};
function getDoc(name){
  if(S[name])return S[name];
  const base=name.startsWith('log-')?{d:{}}:clone(DEF[name]||{});
  const c=local.get(name);
  S[name]=c?merge(base,c):base;
  return S[name];
}
function merge(base,o){
  if(!o||typeof o!=='object'||Array.isArray(o))return o??base;
  const r=Array.isArray(base)?[]:{...base};
  for(const k in o){r[k]=(base&&typeof base[k]==='object'&&base[k]&&!Array.isArray(base[k]))?merge(base[k],o[k]):o[k]}
  return r;
}
function save(name){
  local.set(name,S[name]);
  markDirty(name);
}
function setSync(st){
  const el=$('#sync');
  const map={
    on:['sync on','sincronizado','Salvo na sua conta: aparece no PC e no celular'],
    busy:['sync','sincronizando…','Enviando e buscando alterações'],
    offline:['sync off','offline','Sem conexão. O que você fizer fica guardado aqui e sobe quando a internet voltar.'],
    local:['sync off','só neste aparelho','Sem conta conectada: os dados ficam só neste aparelho.']
  };
  const m=map[st]||map.local;el.className=m[0];el.textContent=m[1];el.title=m[2];
  renderConta();
}
function applyRemote(name,data){
  if(name===null){renderAll();return}
  const base=name.startsWith('log-')?{d:{}}:clone(DEF[name]||{});
  S[name]=merge(base,clone(data||{}));
  local.set(name,S[name]);
}
function logMonths(){const a=new Set();const ws=weekStart();for(let i=-63;i<=7;i++)a.add(mkey(dkey(addDays(ws,i))));a.add(mkey(dkey()));return [...a]}

function minutesOn(k,m){const d=getDoc(mkey(k)).d[k]||{};return m?(d[m]||0):Object.values(d).reduce((a,b)=>a+b,0)}
function addMinutes(m,min,k=dkey()){
  if(!m||!(min>0))return;
  const name=mkey(k);const L=getDoc(name);
  const day=L.d[k]||(L.d[k]={});day[m]=Math.round(((day[m]||0)+min)*10)/10;
  save(name);
  const c=getDoc('cfg');
  if(c.ciclo.some(x=>x.m===m)){c.volta.feito[m]=Math.round(((c.volta.feito[m]||0)+min)*10)/10;save('cfg')}
  renderAll();
}
function removeMinutes(m,min,k){
  const name=mkey(k);const L=getDoc(name);const day=L.d[k];if(!day||!day[m])return;
  day[m]=Math.max(0,day[m]-min);if(!day[m])delete day[m];
  const c=getDoc('cfg');if(c.volta.feito[m])c.volta.feito[m]=Math.max(0,c.volta.feito[m]-min);
  save(name);save('cfg');renderAll();
}
function weekData(){
  const ws=weekStart();const days=[];const byM={};
  for(let i=0;i<7;i++){const k=dkey(addDays(ws,i));const d=getDoc(mkey(k)).d[k]||{};let t=0;for(const m in d){t+=d[m];byM[m]=(byM[m]||0)+d[m]}days.push({k,t})}
  return {days,byM,total:days.reduce((a,b)=>a+b.t,0)};
}
function streak(){let n=0;let d=new Date();if(!minutesOn(dkey(d)))d=addDays(d,-1);while(minutesOn(dkey(d))>0&&n<400){n++;d=addDays(d,-1)}return n}

function cycleState(){
  const c=getDoc('cfg');const it=c.ciclo.map(x=>({...x,feito:c.volta.feito[x.m]||0,alvo:x.h*60}));
  const next=it.find(x=>x.feito<x.alvo)||null;
  const alvo=it.reduce((a,b)=>a+b.alvo,0),feito=it.reduce((a,b)=>a+Math.min(b.feito,b.alvo),0);
  return {it,next,alvo,feito,done:it.length>0&&!next};
}

let T=local.get('timer')||{fase:'foco',rodando:false,fim:0,rest:null,n:0,m:null,inicioFoco:null};
let audioCtx=null;
function pc(){return getDoc('cfg').pomo}
function faseDur(f){const p=pc();return (f==='foco'?p.foco:f==='pausa'?p.pausa:p.longa)*60000}
function restante(){return T.rodando?T.fim-Date.now():(T.rest??faseDur(T.fase))}
function saveT(){local.set('timer',T)}
function beep(){
  if(!pc().som)return;
  try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const t0=audioCtx.currentTime;
    [0,0.28,0.56].forEach((o,i)=>{const os=audioCtx.createOscillator(),g=audioCtx.createGain();os.type='sine';os.frequency.value=i===2?988:784;g.gain.setValueAtTime(0.0001,t0+o);g.gain.exponentialRampToValueAtTime(0.25,t0+o+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+o+0.24);os.connect(g).connect(audioCtx.destination);os.start(t0+o);os.stop(t0+o+0.26)})}catch(e){}
}
function unlockAudio(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch(e){}}
function pomoMat(){return T.m||$('#pomoMat').value||(cycleState().next||{}).m||'const'}
function startT(){
  unlockAudio();askPermission();
  if(T.fase==='foco'){T.m=$('#pomoMat').value||pomoMat();if(T.rest==null||T.rest===faseDur('foco'))T.inicioFoco=Date.now()}
  T.fim=Date.now()+restante();T.rodando=true;T.rest=null;saveT();armAlert();renderPomo();
}
function pauseT(){T.rest=Math.max(0,T.fim-Date.now());T.rodando=false;saveT();cancelAlert();renderPomo()}
function nextPhase(completedFoco){
  if(T.fase==='foco'){
    if(completedFoco)T.n=(T.n||0)+1;
    T.fase=T.n>=pc().ciclos?'longa':'pausa';
  }else{
    if(T.fase==='longa')T.n=0;
    T.fase='foco';
  }
  T.rest=null;T.rodando=false;T.inicioFoco=null;
}
function completePhase(auto){
  const was=T.fase;
  if(was==='foco'){addMinutes(T.m||pomoMat(),pc().foco);toast(`Foco concluído: +${pc().foco} min em ${MM[T.m]?.n||''}`)}
  else toast('Pausa encerrada. Bora voltar!');
  nextPhase(was==='foco');
  beep();
  if(auto&&pc().auto){T.fim=Date.now()+faseDur(T.fase);T.rodando=true;T.rest=null;if(T.fase==='foco')T.inicioFoco=Date.now()}
  saveT();armAlert();renderPomo();
}
function skipT(){
  if(T.fase==='foco'){const el=elapsedFoco();if(el>=1){addMinutes(T.m||pomoMat(),el);toast(`Registrado: ${fmtH(el)}`)}}
  nextPhase(false);saveT();cancelAlert();renderPomo();
}
function armAlert(){
  if(!T.rodando){cancelAlert();return}
  if(T.fase==='foco')scheduleAlert(T.fim,'Foco concluído! 🎯',`+${pc().foco} min em ${MM[T.m]?.n||'estudo'}. Hora da pausa.`);
  else scheduleAlert(T.fim,'Pausa encerrada','Bora voltar para o foco!');
}
function elapsedFoco(){if(T.fase!=='foco')return 0;const tot=faseDur('foco');return Math.floor((tot-restante())/60000)}
function stopT(){
  if(T.fase==='foco'){const el=elapsedFoco();if(el>=1){addMinutes(T.m||pomoMat(),el);toast(`Registrado: ${fmtH(el)} em ${MM[T.m]?.n||''}`)}else toast('Menos de 1 minuto: nada registrado.')}
  T={fase:'foco',rodando:false,fim:0,rest:null,n:0,m:null,inicioFoco:null};saveT();cancelAlert();renderPomo();
}
function tick(){
  if(T.rodando&&Date.now()>=T.fim){completePhase(true)}
  const r=restante();
  $('#pomoTime').textContent=fmtClock(r);
  const frac=Math.min(1,Math.max(0,r/faseDur(T.fase)));
  $('#ringArc').setAttribute('stroke-dashoffset',String(339.3*(1-frac)));
  const mt=$('#miniTimer');
  if(T.rodando||(T.rest!=null&&T.rest<faseDur(T.fase))){mt.classList.add('show');mt.querySelector('span').textContent=(T.fase==='foco'?'':'Pausa ')+fmtClock(r)+(T.rodando?'':' · pausado');mt.style.setProperty('--c',T.fase==='foco'?(MM[T.m]?.c||'var(--acc)'):'var(--ok)')}else mt.classList.remove('show');
  document.title=T.rodando?`${fmtClock(r)} · ${T.fase==='foco'?(MM[T.m]?.n||'Foco'):'Pausa'}`:'Missão PF · Estudos';
}
function renderPomo(){
  const p=pc();
  const sel=$('#pomoMat');const cur=T.m||sel.value||(cycleState().next||{}).m||'const';
  sel.innerHTML=matOpts(cur);sel.disabled=T.rodando&&T.fase==='foco';
  const col=T.fase==='foco'?(MM[cur]?.c||'var(--acc)'):'var(--ok)';
  $('#ringArc').setAttribute('stroke',col);
  $('#pomoPhase').textContent=T.fase==='foco'?'Foco':T.fase==='pausa'?'Pausa curta':'Pausa longa';
  $('#pomoPhase').style.color=col;
  const n=(T.n||0)%p.ciclos;const filled=T.fase==='longa'?p.ciclos:n;
  $('#pomoSets').innerHTML=Array.from({length:p.ciclos},(_,i)=>`<i class="${i<filled?'on':''}" style="--c:${MM[cur]?.c||'var(--acc)'}"></i>`).join('');
  $('#pStart').textContent=T.rodando?'Pausar':(T.rest!=null&&T.rest<faseDur(T.fase)?'Continuar':'Iniciar');
  $('#pStop').disabled=!(T.fase==='foco'&&(T.rodando||(T.rest!=null&&T.rest<faseDur('foco'))));
  const today=minutesOn(dkey(),cur);
  $('#pomoNote').textContent=`Hoje em ${MM[cur]?.n||''}: ${fmtH(today)}`+(T.fase==='foco'&&!T.rodando?'':'');
  ['Foco','Pausa','Longa','Ciclos'].forEach(k=>{const el=$('#cf'+k);if(document.activeElement!==el)el.value=p[k.toLowerCase()]});
  $('#cfSom').checked=!!p.som;$('#cfAuto').checked=!!p.auto;
  tick();
}

function renderHoje(){
  const now=new Date();
  $('#hojeData').textContent=now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const cs=cycleState();const c=getDoc('cfg');
  const nc=$('#nextCard');
  if(!c.ciclo.length){
    nc.style.setProperty('--c','var(--acc)');
    nc.innerHTML=`<span class="k">Comece por aqui</span><h2>Monte seu ciclo de estudos</h2><p class="muted">O ciclo define a ordem das matérias e quantas horas cada uma recebe por volta. O pomodoro já sugere a próxima matéria a partir dele.</p><div class="row"><button class="btn primary" type="button" id="useSug">Usar o ciclo sugerido da Fase 1</button><button class="btn" type="button" data-go="estudos">Montar o meu</button></div>`;
    $('#useSug').onclick=()=>{c.ciclo=clone(CICLO_SUGERIDO);c.volta={n:1,feito:{}};save('cfg');renderAll();toast('Ciclo da Fase 1 criado.')};
  }else if(cs.done){
    nc.style.setProperty('--c','var(--ok)');
    nc.innerHTML=`<span class="k">Volta ${c.volta.n} concluída</span><h2>Você fechou o ciclo inteiro! 🎯</h2><p class="muted">Comece a próxima volta quando quiser. As horas já registradas continuam no histórico.</p><div class="row"><button class="btn primary" type="button" id="newLap">Começar volta ${c.volta.n+1}</button></div>`;
    $('#newLap').onclick=newLap;
  }else{
    const m=MM[cs.next.m];const falta=cs.next.alvo-cs.next.feito;
    nc.style.setProperty('--c',m.c);
    nc.innerHTML=`<span class="k">Próxima do ciclo · volta ${c.volta.n}</span><h2 style="font-size:24px">${esc(m.n)}</h2><p class="muted num">Faltam ${fmtH(falta)} desta matéria nesta volta. A volta está ${Math.round(cs.feito/cs.alvo*100)}% concluída.</p><div class="bar" style="--c:${m.c}"><i style="width:${Math.min(100,cs.next.feito/cs.next.alvo*100)}%"></i></div><div class="row"><button class="btn primary" type="button" id="goStudy" style="background:${m.c};border-color:${m.c}">Estudar agora</button><button class="btn ghost" type="button" data-go="aulas">Ver aulas</button></div>`;
    $('#goStudy').onclick=()=>{if(!(T.rodando&&T.fase==='foco')){T={fase:'foco',rodando:false,fim:0,rest:null,n:T.n||0,m:cs.next.m,inicioFoco:null};saveT()}go('pomodoro');renderPomo();if(!T.rodando)startT()};
  }
  const w=weekData();const meta=c.meta*60;
  $('#semTxt').textContent=`${fmtH(w.total)} de ${c.meta}h`;
  $('#semBar').style.width=Math.min(100,w.total/meta*100)+'%';
  const mx=Math.max(60,...w.days.map(d=>d.t));const tk=dkey();
  $('#weekChart').innerHTML=w.days.map((d,i)=>`<div class="d${d.k===tk?' today':''}" title="${fmtDate(d.k)}: ${fmtH(d.t)}"><span class="small muted num">${d.t?fmtH(d.t):''}</span><div class="col${d.t?'':' zero'}" style="height:${Math.max(3,d.t/mx*70)}px"></div><span class="lbl">${['seg','ter','qua','qui','sex','sáb','dom'][i]}</span></div>`).join('');
  const hoje=minutesOn(tk);const st=streak();
  let prova='';
  if(c.prova){const dd=Math.ceil((parseKey(c.prova)-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);prova=`<div class="stat"><span class="k">Prova</span><span class="v">${dd>=0?dd+' dias':'passou'}</span><span class="small muted">${fmtDate(c.prova)}</span></div>`}
  else prova=`<div class="stat"><span class="k">Prova</span><span class="v" style="font-size:17px">Sem edital</span><span class="small muted">Defina a data no Ciclo</span></div>`;
  $('#hojeStats').innerHTML=`<div class="stat"><span class="k">Hoje</span><span class="v">${fmtH(hoje)}</span></div><div class="stat"><span class="k">Dias seguidos</span><span class="v">${st}</span></div><div class="stat"><span class="k">Volta do ciclo</span><span class="v">${c.ciclo.length?c.volta.n:'–'}</span></div>${prova}`;
  renderMatBars('#hojeMat',w.byM);
  renderHojeExtra();
  renderTaskList('#hojeTasks','hoje');
  $('#hojeTaf').innerHTML=PROVAS.map(p=>{const b=bestMark(p.id);if(b==null)return `<span class="pill">${p.n}: sem teste</span>`;const ok=p.dir>0?b>=p.meta:b<=p.meta;return `<span class="pill ${ok?'ok':'warn'}">${ok?'✓':'•'} ${p.n}: ${fmtMark(p,b)}</span>`}).join('');
}
function renderMatBars(sel,byM){
  const ent=Object.entries(byM).filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]);
  const el=$(sel);
  if(!ent.length){el.innerHTML='<p class="empty">Nenhum estudo registrado nesta semana ainda.</p>';return}
  const mx=ent[0][1];
  el.innerHTML=ent.map(([m,v])=>{const x=MM[m]||{n:m,c:'#888'};return `<div class="mbar"><span class="n"><span class="dot" style="--c:${x.c}"></span><span>${esc(x.n)}</span></span><div class="bar" style="--c:${x.c}"><i style="width:${v/mx*100}%"></i></div><span class="num small" style="text-align:right">${fmtH(v)}</span></div>`}).join('');
}

let taskFilter='abertas';
function renderTaskList(sel,mode){
  const L=getDoc('tarefas').lista;const tk=dkey();
  let items;
  if(mode==='hoje')items=L.filter(t=>(!t.ok&&(!t.d||t.d<=tk))||(t.ok&&t.okEm===tk));
  else items=L.filter(t=>taskFilter==='todas'||(taskFilter==='feitas'?t.ok:!t.ok));
  items=[...items].sort((a,b)=>(a.ok-b.ok)||((a.d||'9')<(b.d||'9')?-1:1));
  const el=$(sel);
  if(!items.length){el.innerHTML=`<p class="empty">${mode==='hoje'?'Nada pendente para hoje.':'Nenhuma tarefa aqui.'}</p>`;return}
  el.innerHTML=items.map(t=>{const m=MM[t.m];const late=!t.ok&&t.d&&t.d<tk;return `<div class="li${t.ok?' done':''}${late?' late':''}" data-id="${t.id}"><input type="checkbox" ${t.ok?'checked':''} aria-label="Concluir tarefa">${m?`<span class="dot" style="--c:${m.c}" title="${esc(m.n)}"></span>`:''}<span class="t">${esc(t.t)}</span>${t.d&&mode!=='hoje'?`<span class="small ${late?'':'muted'}" style="${late?'color:var(--warn)':''}">${fmtDate(t.d)}</span>`:''}${late&&mode==='hoje'?'<span class="small" style="color:var(--warn)">atrasada</span>':''}<button class="x" type="button" aria-label="Apagar tarefa">×</button></div>`}).join('');
  el.querySelectorAll('.li').forEach(li=>{
    const id=li.dataset.id;
    li.querySelector('input').onchange=e=>{const t=L.find(x=>x.id===id);t.ok=e.target.checked;t.okEm=t.ok?dkey():null;save('tarefas');renderAll()};
    li.querySelector('.x').onclick=()=>{const i=L.findIndex(x=>x.id===id);if(i>=0){L.splice(i,1);save('tarefas');renderAll()}};
  });
}
function addTask(t,m,d){if(!t.trim())return;getDoc('tarefas').lista.push({id:uid(),t:t.trim().slice(0,200),m:m||'',d:d||dkey(),ok:false});save('tarefas');renderAll()}

let editing=null;
function newLap(){const c=getDoc('cfg');c.volta={n:(c.volta.n||1)+1,feito:{}};save('cfg');renderAll();toast(`Volta ${c.volta.n} iniciada.`)}
function renderEstudos(){
  const c=getDoc('cfg');const cs=cycleState();
  $('#voltaN').textContent=c.ciclo.length?`Volta ${c.volta.n}`:'Sem ciclo';
  $('#voltaBar').style.width=cs.alvo?(cs.feito/cs.alvo*100)+'%':'0';
  $('#voltaTxt').textContent=cs.alvo?`${fmtH(cs.feito)} de ${fmtH(cs.alvo)} nesta volta`:'Monte o ciclo para começar.';
  const cl=$('#cycList');
  if(!c.ciclo.length){cl.innerHTML=`<p class="empty">Seu ciclo está vazio.</p><button class="btn primary sm" type="button" id="useSug2" style="justify-self:start">Usar o ciclo sugerido da Fase 1</button>`;$('#useSug2').onclick=()=>{c.ciclo=clone(CICLO_SUGERIDO);c.volta={n:1,feito:{}};save('cfg');renderAll()}}
  else cl.innerHTML=cs.it.map((x,i)=>{const m=MM[x.m];const ok=x.feito>=x.alvo;return `<div class="it${cs.next&&cs.next.m===x.m?' next':''}" style="--c:${m.c}"><span class="ord">${ok?'✓':i+1}</span><div style="display:grid;gap:5px;min-width:0"><b>${esc(m.n)}</b><div class="bar" style="--c:${m.c}"><i style="width:${Math.min(100,x.feito/x.alvo*100)}%"></i></div></div><span class="meta">${fmtH(Math.min(x.feito,x.alvo))} / ${x.h}h</span></div>`}).join('');
  $('#cycNew').hidden=!c.ciclo.length;
  const ed=$('#cycEdit');
  if(editing){
    ed.hidden=false;
    ed.innerHTML=`<p class="muted small">Ordem, matéria e horas por volta. A soma das horas não precisa bater com a semana.</p>`+editing.map((x,i)=>`<div class="r" data-i="${i}"><select aria-label="Matéria">${matOpts(x.m)}</select><input type="number" min="0.5" max="20" step="0.5" value="${x.h}" aria-label="Horas"><button class="btn icon sm" type="button" data-a="up" aria-label="Subir">↑</button><button class="btn icon sm" type="button" data-a="down" aria-label="Descer">↓</button><button class="btn icon sm" type="button" data-a="del" aria-label="Remover">×</button></div>`).join('')+`<div class="row"><button class="btn sm" type="button" id="cycAdd">+ Matéria</button><span class="grow"></span><button class="btn sm ghost" type="button" id="cycCancel">Cancelar</button><button class="btn sm primary" type="button" id="cycSave">Salvar ciclo</button></div>`;
    ed.querySelectorAll('.r').forEach(r=>{const i=+r.dataset.i;
      r.querySelector('select').onchange=e=>editing[i].m=e.target.value;
      r.querySelector('input').oninput=e=>editing[i].h=Math.max(0.5,+e.target.value||1);
      r.querySelectorAll('button').forEach(b=>b.onclick=()=>{const a=b.dataset.a;if(a==='del')editing.splice(i,1);else{const j=a==='up'?i-1:i+1;if(j<0||j>=editing.length)return;[editing[i],editing[j]]=[editing[j],editing[i]]}renderEstudos()});
    });
    $('#cycAdd').onclick=()=>{const used=new Set(editing.map(x=>x.m));editing.push({m:(MAT.find(m=>!used.has(m.id))||MAT[0]).id,h:2});renderEstudos()};
    $('#cycCancel').onclick=()=>{editing=null;renderEstudos()};
    $('#cycSave').onclick=()=>{const seen=new Set();c.ciclo=editing.filter(x=>!seen.has(x.m)&&seen.add(x.m));editing=null;save('cfg');renderAll();toast('Ciclo salvo.')};
  }else{ed.hidden=true;ed.innerHTML=''}
  $('#cycEditBtn').textContent=c.ciclo.length?'Editar ciclo':'Montar meu ciclo';
  if(document.activeElement!==$('#cfMeta'))$('#cfMeta').value=c.meta;
  if(document.activeElement!==$('#cfProva'))$('#cfProva').value=c.prova||'';
  let tot=0,dias=0;for(let i=0;i<28;i++){const t=minutesOn(dkey(addDays(new Date(),-i)));if(t>0){tot+=t;dias++}}
  const w=weekData();
  $('#histStats').innerHTML=`<div class="stat"><span class="k">Semana</span><span class="v">${fmtH(w.total)}</span></div><div class="stat"><span class="k">Últimos 28 dias</span><span class="v">${fmtH(tot)}</span></div><div class="stat"><span class="k">Dias estudados (28)</span><span class="v">${dias}</span></div>`;
  $('#tMat').innerHTML=matOpts($('#tMat').value,true);
  renderTaskList('#taskList','todas');
}

let catalog=null,aulaFiltro='todas',openAula=null;const aulaCache={};
async function loadCatalog(){
  if(catalog)return catalog;
  try{catalog=JSON.parse(await getLessonText('aulas/index.json')).aulas||[]}catch(e){catalog=[];$('#aulaList').innerHTML='<p class="empty">Não consegui carregar a lista de aulas.</p>'}
  return catalog;
}
function aulaProg(id,data){
  const p=getDoc('aulas').p[id]||{};const ck=p.ck||[];const q=p.q||{};
  let ok=0,bad=0,done=0;
  if(data){data.situacoes.forEach((s,si)=>s.itens.forEach((it,ii)=>{const st=q[si+'-'+ii];if(st&&st.done){done++;if(st.v===it.g)ok++;else if(st.v!=='B')bad++}}))}
  else{for(const k in q){const st=q[k];if(st.done){done++;if(st.r==='ok')ok++;else if(st.r==='bad')bad++}}}
  return {ck:ck.filter(Boolean).length,ok,bad,done};
}
async function renderAulas(){
  const list=await loadCatalog();
  const mats=[...new Set(list.map(a=>a.materia))];
  $('#aulaFilter').innerHTML=[`<button type="button" data-f="todas" aria-pressed="${aulaFiltro==='todas'}">Todas</button>`,...mats.map(m=>`<button type="button" data-f="${m}" aria-pressed="${aulaFiltro===m}">${esc(MM[m]?.n||m)}</button>`)].join('');
  $('#aulaFilter').querySelectorAll('button').forEach(b=>b.onclick=()=>{aulaFiltro=b.dataset.f;renderAulas()});
  const show=list.filter(a=>aulaFiltro==='todas'||a.materia===aulaFiltro);
  $('#aulaList').innerHTML=show.length?show.map(a=>{const m=MM[a.materia]||{n:a.materia,c:'#888'};const p=aulaProg(a.id);const nck=6;
    return `<button type="button" class="lcard${a.embreve?' soon':''}" style="--c:${m.c}" data-id="${a.id}" ${a.embreve?'aria-disabled="true"':''}><span class="tag">${esc(m.n)} · Aula ${a.numero}</span><h3>${esc(a.titulo)}</h3><p class="muted small">${esc(a.resumo||'')}</p>${a.embreve?'<span class="pill">Em breve</span>':`<div class="row small"><span class="pill ${p.ck>=nck?'ok':''}">${p.ck>=nck?'✓ Concluída':p.ck+' de '+nck+' etapas'}</span>${p.done?`<span class="pill num">Questões: ${p.ok}✓ ${p.bad}✗ · líquido ${p.ok-p.bad}</span>`:''}</div>`}</button>`}).join(''):'<p class="empty">Nenhuma aula nesta matéria ainda.</p>';
  $('#aulaList').querySelectorAll('.lcard:not(.soon)').forEach(b=>b.onclick=()=>{location.hash='aula-'+b.dataset.id});
}
async function fetchAula(a){
  if(aulaCache[a.id])return aulaCache[a.id];
  const html=await getLessonText(a.arquivo);
  const doc=new DOMParser().parseFromString(html,'text/html');
  const data=JSON.parse(doc.querySelector('script.aula-data').textContent);
  const secs=[...doc.querySelectorAll('article > section')];
  return aulaCache[a.id]={secs,data};
}
async function showAula(id){
  const list=await loadCatalog();const a=list.find(x=>x.id===id&&!x.embreve);
  if(!a){location.hash='aulas';return}
  openAula=id;
  $('#aulasCat').hidden=true;const v=$('#aulaView');v.hidden=false;
  v.innerHTML='<p class="empty">Carregando a aula…</p>';
  let A;try{A=await fetchAula(a)}catch(e){v.innerHTML='<p class="empty">Não consegui carregar esta aula.</p><button class="btn" type="button" onclick="location.hash=\'aulas\'">Voltar</button>';return}
  if(openAula!==id)return;
  const m=MM[a.materia]||{n:a.materia,c:'#888'};
  const P=getDoc('aulas');const p=P.p[id]||(P.p[id]={ck:[],q:{}});p.ck=p.ck||[];p.q=p.q||{};
  const secNames=A.secs.map(s=>s.dataset.sec);
  v.innerHTML=`<div class="lesson">
    <div class="lesson-top">
      <div><button class="btn sm ghost" type="button" id="backAulas">← Aulas</button></div>
      <span class="k" style="color:${m.c}">${esc(m.n)} · Aula ${a.numero}</span>
      <h1>${esc(a.titulo)}</h1>
      <p class="muted">${esc(a.resumo||'')}</p>
      <div class="row small">${a.edital?`<span class="pill">Edital: ${esc(a.edital)}</span>`:''}${a.tempo?`<span class="pill">Tempo sugerido: ${esc(a.tempo)}</span>`:''}<button class="btn sm" type="button" id="aulaTimer" style="border-color:${m.c}">Estudar com pomodoro</button></div>
      <div class="card"><div class="row between small"><b>Seu progresso nesta aula</b><span class="muted num" id="ckTxt"></span></div><div class="bar" style="--c:${m.c}"><i id="ckBar"></i></div><div class="checks" id="ckBox">${A.data.checks.map((c,i)=>`<label><input type="checkbox" data-i="${i}" ${p.ck[i]?'checked':''}> ${esc(c)}</label>`).join('')}</div><div class="estudada" id="estBox"></div></div>
    </div>
    <nav class="secnav" aria-label="Seções da aula">${secNames.map((n,i)=>`<button type="button" data-s="s${i}">${esc(n)}</button>`).join('')}<button type="button" data-s="sfc">Flashcards</button><button type="button" data-s="sq">Questões</button></nav>
    <div id="secs"></div>
    <section id="sfc" style="--c:var(--q)"><h2>Flashcards</h2><div class="row"><span class="muted small">Toque no card para virar.</span><button class="btn sm" type="button" id="fcSh">Embaralhar</button><button class="btn sm" type="button" id="fcRs">Desvirar todos</button></div><div class="fc-grid" id="fcGrid"></div></section>
    <section id="sq" style="--c:var(--q)"><h2>Questões no estilo Cebraspe</h2><p>Julgue cada item como <b>CERTO</b> ou <b>ERRADO</b>, ou deixe em branco. Um acerto vale <b>+1</b>, um erro vale <b>−1</b> e em branco vale <b>0</b>. Ao terminar uma situação, toque em "Corrigir" para ver o gabarito comentado.</p><div id="sits" style="display:grid;gap:18px"></div>
      <div class="score" aria-live="polite"><div><div class="k">Acertos</div><div class="v ok" id="sOk">0</div></div><div><div class="k">Erros</div><div class="v bad" id="sBad">0</div></div><div><div class="k">Em branco</div><div class="v" id="sBl">0</div></div><div><div class="k">Líquido</div><div class="v" id="sNet">0</div></div><div class="grow muted small" id="sMsg"></div><button class="btn sm" type="button" id="qReset">Refazer tudo</button></div>
    </section>
  </div>`;
  const secsEl=v.querySelector('#secs');
  A.secs.forEach((s,i)=>{const c=document.importNode(s,true);c.id='s'+i;c.querySelectorAll('a[href^="http"]').forEach(x=>{x.target='_blank';x.rel='noopener'});secsEl.appendChild(c)});
  v.querySelector('#backAulas').onclick=()=>{location.hash='aulas'};
  v.querySelector('#aulaTimer').onclick=()=>{if(!(T.rodando&&T.fase==='foco')){T={fase:'foco',rodando:false,fim:0,rest:null,n:T.n||0,m:a.materia,inicioFoco:null};saveT()}go('pomodoro');renderPomo()};
  v.querySelectorAll('.secnav button').forEach(b=>b.onclick=()=>{const t=v.querySelector('#'+b.dataset.s);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})});
  const nck=A.data.checks.length;
  const updCk=()=>{const n=p.ck.filter(Boolean).length;v.querySelector('#ckTxt').textContent=`${n} de ${nck}`;v.querySelector('#ckBar').style.width=(n/nck*100)+'%'};
  const updEst=()=>{const eb=v.querySelector('#estBox');eb.innerHTML=p.estudada?`<span class="pill ok">✓ Estudada em ${fmtDate(p.estudada)}</span><button class="btn sm ghost" type="button" id="estOff">Desmarcar</button>`:`<button class="btn sm primary" type="button" id="estOn">Marcar como estudada</button><span class="small muted">Libera a aula para a questão do dia, os simulados "só do que estudei" e as revisões.</span>`;
    const on=eb.querySelector('#estOn');if(on)on.onclick=()=>{p.estudada=dkey();save('aulas');updEst();onEvent('estudada',a.id);toast('Aula marcada como estudada.')};
    const off=eb.querySelector('#estOff');if(off)off.onclick=()=>{delete p.estudada;save('aulas');updEst()}};
  v.querySelectorAll('#ckBox input').forEach(inp=>inp.onchange=()=>{p.ck[+inp.dataset.i]=inp.checked;for(let i=0;i<nck;i++)p.ck[i]=!!p.ck[i];if(!p.estudada&&p.ck.filter(Boolean).length===nck){p.estudada=dkey();onEvent('estudada',a.id);toast('Todas as etapas feitas: aula marcada como estudada.')}save('aulas');updCk();updEst()});
  updCk();updEst();
  const cards=A.data.flashcards;const fg=v.querySelector('#fcGrid');
  const renderFc=l=>{fg.innerHTML='';l.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='fc';b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="fk">${c.k}</span><span class="front">${c.f}</span><span class="back">${c.b}</span>`;b.onclick=()=>{b.classList.toggle('on');b.setAttribute('aria-pressed',b.classList.contains('on'))};fg.appendChild(b)})};
  renderFc(cards);
  v.querySelector('#fcSh').onclick=()=>{const c=[...cards];for(let i=c.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[c[i],c[j]]=[c[j],c[i]]}renderFc(c)};
  v.querySelector('#fcRs').onclick=()=>fg.querySelectorAll('.fc').forEach(e=>{e.classList.remove('on');e.setAttribute('aria-pressed','false')});
  const sitsEl=v.querySelector('#sits');const S2=A.data.situacoes;const total=S2.reduce((x,s)=>x+s.itens.length,0);let num=0;
  const paint=(d,id,it)=>{const st=p.q[id];d.querySelectorAll('.ans button').forEach(b=>{b.setAttribute('aria-pressed',!!(st&&st.v===b.dataset.v));b.disabled=!!(st&&st.done)});d.classList.remove('done','right','wrong','blank');if(st&&st.done){d.classList.add('done');const r=st.v==='B'?'blank':(st.v===it.g?'right':'wrong');d.classList.add(r);d.querySelector('.res').textContent=r==='right'?'Você acertou (+1).':r==='wrong'?'Você errou (−1).':'Em branco (0).'}};
  const refresh=()=>{let ok=0,bad=0,bl=0,done=0;S2.forEach((s,si)=>s.itens.forEach((it,ii)=>{const id=si+'-'+ii;const d=sitsEl.querySelector(`[data-id="${id}"]`);paint(d,id,it);const st=p.q[id];if(st&&st.done){done++;if(st.v==='B')bl++;else if(st.v===it.g)ok++;else bad++}}));const net=ok-bad;v.querySelector('#sOk').textContent=ok;v.querySelector('#sBad').textContent=bad;v.querySelector('#sBl').textContent=bl;const n=v.querySelector('#sNet');n.textContent=net;n.className='v '+(net>0?'ok':net<0?'bad':'');let msg=`Corrigidos: ${done} de ${total}`;if(done===total){const pct=Math.round(net/total*100);msg+=` · Aproveitamento líquido: ${pct}%`+(pct>=70?' (excelente)':pct>=50?' (bom, revise os erros)':' (revise a teoria e refaça)')}v.querySelector('#sMsg').textContent=msg};
  S2.forEach((s,si)=>{
    const box=document.createElement('div');box.className='sit';
    box.innerHTML=`<div class="sit-h"><span class="lbl">Situação ${si+1} · ${esc(s.t)}</span><p>${s.txt}</p></div>`;
    s.itens.forEach((it,ii)=>{num++;const id=si+'-'+ii;const d=document.createElement('div');d.className='item';d.dataset.id=id;
      d.innerHTML=`<div class="st"><span class="n">${num}</span><p>${it.s}</p></div><div class="ans" role="group" aria-label="Resposta do item ${num}"><button type="button" data-v="C" aria-pressed="false">CERTO</button><button type="button" data-v="E" aria-pressed="false">ERRADO</button><button type="button" data-v="B" aria-pressed="false">Em branco</button></div><div class="fb"><span class="res"></span> Gabarito: <b>${it.g==='C'?'CERTO':'ERRADO'}</b>. ${it.c}</div>`;
      d.querySelectorAll('.ans button').forEach(b=>b.onclick=()=>{if(p.q[id]&&p.q[id].done)return;p.q[id]={v:b.dataset.v,done:false};paint(d,id,it);save('aulas')});
      box.appendChild(d)});
    const foot=document.createElement('div');foot.className='item';const btn=document.createElement('button');btn.type='button';btn.className='btn primary';btn.style.cssText='justify-self:start;background:var(--q);border-color:var(--q);color:#16101f';btn.textContent=`Corrigir situação ${si+1}`;
    btn.onclick=()=>{s.itens.forEach((it,ii)=>{const id=si+'-'+ii;const v0=(p.q[id]&&p.q[id].v)||'B';p.q[id]={v:v0,done:true,r:v0==='B'?'bl':(v0===it.g?'ok':'bad'),em:dkey()};lessonAnswered(a.id,id,v0,it.g)});save('aulas');refresh()};
    foot.appendChild(btn);box.appendChild(foot);sitsEl.appendChild(box);
  });
  v.querySelector('#qReset').onclick=()=>{p.q={};save('aulas');refresh()};
  refresh();
  window.scrollTo(0,0);
}

function parseMark(p,s){
  s=String(s).trim().replace(',','.');
  if(p.unit==='tempo'){if(s.includes(':')){const [mm,ss]=s.split(':');return (+mm)*60+(+ss)}return +s}
  return +s;
}
function fmtMark(p,v){
  if(v==null||isNaN(v))return '–';
  if(p.unit==='tempo'){const m=Math.floor(v/60),s=Math.round(v%60);return m+':'+pad(s)}
  if(p.unit==='m'&&p.meta<10)return v.toFixed(2).replace('.',',')+' m';
  if(p.unit==='m')return Math.round(v).toLocaleString('pt-BR')+' m';
  return (Math.round(v*10)/10).toString().replace('.',',')+' s';
}
function marksOf(id){return getDoc('taf').marcas.filter(x=>x.p===id).sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0)}
function bestMark(id){const p=PM[id];const l=marksOf(id);if(!l.length)return null;return l.reduce((b,x)=>b==null?x.v:(p.dir>0?Math.max(b,x.v):Math.min(b,x.v)),null)}
function spark(p,l){
  if(l.length<2)return '';
  const vals=l.map(x=>x.v).concat([p.meta]);const mn=Math.min(...vals),mx=Math.max(...vals);const rg=(mx-mn)||1;
  const W=200,H=46,P=5;const X=i=>P+i*(W-2*P)/(l.length-1);const Y=v=>{const t=(v-mn)/rg;return p.dir>0?H-P-t*(H-2*P):P+t*(H-2*P)};
  const pts=l.map((x,i)=>X(i).toFixed(1)+','+Y(x.v).toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${W}" y1="${Y(p.meta)}" y2="${Y(p.meta)}" stroke="var(--ok)" stroke-dasharray="4 4" stroke-width="1" vector-effect="non-scaling-stroke"/><polyline points="${pts}" fill="none" stroke="${p.c}" stroke-width="2" vector-effect="non-scaling-stroke"/>${l.map((x,i)=>`<circle cx="${X(i)}" cy="${Y(x.v)}" r="2.6" fill="${p.c}"/>`).join('')}</svg>`;
}
function renderTaf(){
  const T2=getDoc('taf');
  $('#tafCards').innerHTML=PROVAS.map(p=>{const l=marksOf(p.id);const b=bestMark(p.id);const last=l[l.length-1];
    let status='<span class="pill">Sem teste ainda</span>';
    if(b!=null){const ok=p.dir>0?b>=p.meta:b<=p.meta;const gap=Math.abs(p.meta-b);status=ok?'<span class="pill ok">✓ Índice atingido</span>':`<span class="pill warn">Faltam ${p.unit==='tempo'?Math.ceil(gap)+' s':fmtMark(p,gap)}</span>`}
    return `<div class="card prova" style="--c:${p.c}"><div class="row between"><h3>${p.n}</h3>${status}</div><p class="hint">${p.desc}. Índice: <b style="color:var(--text)">${fmtMark(p,p.meta)}</b></p><div class="row between"><div><div class="k">Melhor marca</div><div class="best">${fmtMark(p,b)}</div></div>${last?`<div style="text-align:right"><div class="k">Último teste</div><div class="num">${fmtMark(p,last.v)}</div><div class="hint">${fmtDate(last.d)}</div></div>`:''}</div>${spark(p,l)}</div>`}).join('');
  const ml=[...T2.marcas].sort((a,b)=>a.d<b.d?1:-1).slice(0,12);
  $('#marcaList').innerHTML=ml.length?ml.map(x=>{const p=PM[x.p];return `<div class="li" data-id="${x.id}"><span class="dot" style="--c:${p.c}"></span><span class="t">${p.n}: <b>${fmtMark(p,x.v)}</b></span><span class="small muted">${fmtDate(x.d)}</span><button class="x" type="button" aria-label="Apagar marca">×</button></div>`}).join(''):'<p class="empty">Nenhuma marca registrada.</p>';
  $('#marcaList').querySelectorAll('.li').forEach(li=>li.querySelector('.x').onclick=()=>{const i=T2.marcas.findIndex(x=>x.id===li.dataset.id);if(i>=0){T2.marcas.splice(i,1);save('taf');renderAll()}});
  const ws=dkey(weekStart());const sem=T2.treinos.filter(t=>t.d>=ws);
  $('#treinoSem').textContent=`Semana: ${sem.length} treino${sem.length===1?'':'s'} · ${fmtH(sem.reduce((a,b)=>a+(+b.min||0),0))}`;
  const tl=[...T2.treinos].sort((a,b)=>a.d<b.d?1:-1).slice(0,15);
  $('#treinoList').innerHTML=tl.length?tl.map(x=>`<div class="li" data-id="${x.id}"><span class="t"><b>${esc(x.tipo)}</b> · ${fmtH(+x.min||0)}${x.obs?`<br><span class="small muted">${esc(x.obs)}</span>`:''}</span><span class="small muted">${fmtDate(x.d)}</span><button class="x" type="button" aria-label="Apagar treino">×</button></div>`).join(''):'<p class="empty">Nenhum treino registrado.</p>';
  $('#treinoList').querySelectorAll('.li').forEach(li=>li.querySelector('.x').onclick=()=>{const i=T2.treinos.findIndex(x=>x.id===li.dataset.id);if(i>=0){T2.treinos.splice(i,1);save('taf');renderAll()}});
}

function renderTodayLog(){
  const k=dkey();const d=getDoc(mkey(k)).d[k]||{};const ent=Object.entries(d).filter(e=>e[1]>0);
  $('#todayLog').innerHTML=ent.length?'<span class="k">Registrado hoje</span>'+ent.map(([m,v])=>`<div class="li" data-m="${m}" data-v="${v}"><span class="dot" style="--c:${MM[m]?.c}"></span><span class="t">${esc(MM[m]?.n||m)}</span><span class="num small">${fmtH(v)}</span><button class="x" type="button" aria-label="Desfazer registro de hoje">×</button></div>`).join(''):'';
  $('#todayLog').querySelectorAll('.li').forEach(li=>li.querySelector('.x').onclick=()=>{removeMinutes(li.dataset.m,+li.dataset.v,k);toast('Registro de hoje removido.')});
}

const IC={
 home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
 cycle:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 check:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
 x:'<path d="M4 4h16v16H4z"/><path d="M9 9l6 6M15 9l-6 6"/>',
 rev:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
 cards:'<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
 law:'<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
 pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 case:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
 gym:'<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
 chart:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
 medal:'<circle cx="12" cy="15" r="6"/><path d="M8.5 9.5L6 3h4l2 4 2-4h4l-2.5 6.5"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const NAV=[
 ['Estudo',[['hoje','Hoje','home'],['pomodoro','Pomodoro','timer'],['estudos','Ciclo e tarefas','cycle'],['aulas','Aulas','book']]],
 ['Questões',[['qdia','Questão do dia','sun'],['simulados','Simulados','check'],['erros','Caderno de erros','x']]],
 ['Revisão',[['revisao','Revisar hoje','rev'],['flash','Flashcards','cards'],['lei','Lei seca','law']]],
 ['Prática',[['discursiva','Discursiva','pen'],['casos','Casos investigativos','case'],['taf','TAF','gym']]],
 ['Você',[['painel','Desempenho','chart','painel'],['conquistas','Conquistas','medal','conquistas'],['config','Configurações','gear']]]
];
const EXT={};
const TITLES={login:'Entrar'};
NAV.forEach(([,l])=>l.forEach(([id,n])=>TITLES[id]=n));
TITLES.casos='Casos';TITLES.estudos='Ciclo';
const BASE_VIEWS_=['hoje','pomodoro','estudos','aulas','taf','login','qdia','simulados','erros','config'];
const BASE_VIEWS=BASE_VIEWS_;
function viewOk(id){return BASE_VIEWS.includes(id)||(!!EXT[id]&&!['counts','hoje','config','patente','taf'].includes(id))}
function modOn(k){const m=getDoc('cfg').mod||{};return m[k]!==false}
function navCounts(){const q=getDoc('quest');const n={erros:Object.keys(q.erros||{}).length};if(EXT.counts)Object.assign(n,EXT.counts());const qd=q.qdia;if(!qd||qd.d!==dkey()||Object.keys(qd.resp||{}).length<qd.ids.length)n.qdia='•';return n}
function renderNav(){
  const cnt=navCounts();
  $('#tabs').innerHTML=NAV.map(([g,l])=>{const items=l.filter(([id,,,mod])=>viewOk(id)&&(!mod||modOn(mod)));if(!items.length)return '';return `<div class="grp">${g}</div>`+items.map(([id,n,ic])=>`<button type="button" data-v="${id}"${id===cur?' aria-current="page"':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[ic]}</svg>${esc(n)}${cnt[id]?`<span class="cnt${cnt[id]==='•'||cnt[id]>0?' hot':''}">${cnt[id]}</span>`:''}</button>`).join('')}).join('');
  $('#tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{go(b.dataset.v);closeDrawer()});
  const sub=EXT.patente&&modOn('patentes')?EXT.patente():null;$('#dSub').textContent=sub||'Agente da Polícia Federal';
}
function openDrawer(){$('#drawer').classList.add('open');$('#scrim').classList.add('on');$('#menuBtn').setAttribute('aria-expanded','true')}
function closeDrawer(){$('#drawer').classList.remove('open');$('#scrim').classList.remove('on');$('#menuBtn').setAttribute('aria-expanded','false')}
let cur='hoje';
function go(v){if(location.hash.replace('#','')===v)route();else location.hash=v}
function route(){
  let h=location.hash.replace('#','')||'hoje';
  if(needLogin())h='login';
  let aula=null;if(h.startsWith('aula-')){aula=h.slice(5);h='aulas'}
  if(!viewOk(h))h='hoje';
  const changed=cur!==h;cur=h;
  document.querySelectorAll('main > .view').forEach(s=>s.classList.toggle('on',s.id==='v-'+h));
  document.body.classList.toggle('nodrawer',h==='login');
  $('#topTitle').textContent=TITLES[h]||'Missão PF';
  renderNav();
  if(h==='aulas'){if(aula)showAula(aula);else{openAula=null;$('#aulaView').hidden=true;$('#aulaView').innerHTML='';$('#aulasCat').hidden=false;renderAulas()}}
  renderView(h);
  if(changed&&!aula)window.scrollTo(0,0);
}
function renderView(h){
  if(h==='hoje')renderHoje();
  else if(h==='pomodoro'){renderPomo();renderTodayLog()}
  else if(h==='estudos')renderEstudos();
  else if(h==='taf'){renderTaf();if(EXT.taf)EXT.taf()}
  else if(h==='login')renderLogin();
  else if(h==='aulas'&&!openAula&&catalog)renderAulas();
  else if(h==='qdia')renderQdia($('#v-qdia'));
  else if(h==='simulados')renderSimulados($('#v-simulados'));
  else if(h==='erros')renderErros($('#v-erros'));
  else if(h==='config')renderConfig();
  else if(EXT[h])EXT[h]($('#v-'+h));
}
const STATIC_RENDER=new Set(['hoje','pomodoro','estudos','taf','config','login']);
function renderAll(){if(STATIC_RENDER.has(cur)||cur==='aulas')renderView(cur);renderNav();if(cur!=='pomodoro')tick()}

$('#menuBtn').onclick=()=>$('#drawer').classList.contains('open')?closeDrawer():openDrawer();
$('#scrim').onclick=closeDrawer;
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)go(g.dataset.go)});
$('#miniTimer').onclick=()=>go('pomodoro');
$('#pStart').onclick=()=>{T.rodando?pauseT():startT()};
$('#pSkip').onclick=skipT;
$('#pStop').onclick=stopT;
$('#pomoMat').onchange=e=>{if(!(T.rodando&&T.fase==='foco')){T.m=e.target.value;saveT();renderPomo()}};
['Foco','Pausa','Longa','Ciclos'].forEach(k=>$('#cf'+k).addEventListener('change',e=>{const p=pc();const v=Math.round(+e.target.value);const lim={Foco:[5,120],Pausa:[1,30],Longa:[5,60],Ciclos:[2,8]}[k];p[k.toLowerCase()]=Math.min(lim[1],Math.max(lim[0],v||lim[0]));save('cfg');if(!T.rodando&&T.rest!=null&&T.rest>faseDur(T.fase)){T.rest=null;saveT()}renderPomo()}));
$('#cfSom').onchange=e=>{pc().som=e.target.checked;save('cfg');if(e.target.checked){unlockAudio();beep()}};
$('#cfAuto').onchange=e=>{pc().auto=e.target.checked;save('cfg')};
$('#manualForm').onsubmit=e=>{e.preventDefault();const m=$('#manMat').value,min=+$('#manMin').value,d=$('#manData').value||dkey();if(min>0){addMinutes(m,min,d);toast(`Registrado: ${fmtH(min)} em ${MM[m].n}`);renderTodayLog()}};
$('#quickTask').onsubmit=e=>{e.preventDefault();addTask($('#qtTxt').value,'',dkey());$('#qtTxt').value=''};
$('#taskForm').onsubmit=e=>{e.preventDefault();addTask($('#tTxt').value,$('#tMat').value,$('#tData').value||dkey());$('#tTxt').value=''};
$('#taskFilter').querySelectorAll('button').forEach(b=>b.onclick=()=>{taskFilter=b.dataset.f;$('#taskFilter').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderEstudos()});
$('#cycEditBtn').onclick=()=>{const c=getDoc('cfg');editing=c.ciclo.length?clone(c.ciclo):clone(CICLO_SUGERIDO);renderEstudos();$('#cycEdit').scrollIntoView({behavior:'smooth',block:'nearest'})};
$('#cycNew').onclick=newLap;
$('#cfMeta').onchange=e=>{const c=getDoc('cfg');c.meta=Math.min(80,Math.max(1,+e.target.value||18));save('cfg');renderAll()};
$('#cfProva').onchange=e=>{const c=getDoc('cfg');c.prova=e.target.value||'';save('cfg');renderAll()};
$('#mProva').onchange=()=>{const p=PM[$('#mProva').value];$('#mUnit').textContent=p.unit==='tempo'?'Tempo (min:seg)':p.unit==='m'?'Metros':'Segundos';$('#mVal').placeholder=p.ph};
$('#marcaForm').onsubmit=e=>{e.preventDefault();const p=PM[$('#mProva').value];const v=parseMark(p,$('#mVal').value);if(!(v>0)){toast('Valor inválido.');return}getDoc('taf').marcas.push({id:uid(),p:p.id,v,d:$('#mData').value||dkey()});save('taf');$('#mVal').value='';$('#mData').value=dkey();renderAll();const ok=p.dir>0?v>=p.meta:v<=p.meta;toast(ok?`${p.n}: índice atingido! 💪`:`${p.n} registrada.`)};
$('#treinoForm').onsubmit=e=>{e.preventDefault();getDoc('taf').treinos.push({id:uid(),tipo:$('#trTipo').value,min:+$('#trMin').value||0,obs:$('#trObs').value.trim().slice(0,160),d:$('#trData').value||dkey()});save('taf');$('#trObs').value='';renderAll();toast('Treino salvo.')};
window.addEventListener('hashchange',route);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();renderAll()}});

(async function init(){
  ['cfg','tarefas','aulas','taf','quest'].forEach(getDoc);logMonths().forEach(getDoc);
  $('#manMat').innerHTML=matOpts((cycleState().next||{}).m||'const');
  $('#manData').value=dkey();$('#tData').value=dkey();$('#mData').value=dkey();$('#trData').value=dkey();
  $('#mProva').innerHTML=PROVAS.map(p=>`<option value="${p.id}">${p.n}</option>`).join('');$('#mProva').onchange();
  $('#trTipo').innerHTML=TREINOS.map(t=>`<option>${t}</option>`).join('');
  if(T.rodando&&Date.now()>=T.fim)completePhase(false);else if(T.rodando)armAlert();
  setupNative(exit=>{
    const h=location.hash.replace('#','');
    if($('#drawer').classList.contains('open'))closeDrawer();
    else if(h.startsWith('aula-'))go('aulas');
    else if(h&&h!=='hoje'&&h!=='login')go('hoje');
    else exit();
  });
  await startSync({read:n=>S[n]??local.get(n),apply:applyRemote,status:setSync});
  route();
  setInterval(tick,250);
  if(isNative)applyReminders();
})();

function needLogin(){return configured()&&!currentUser()&&!local.get('semConta')}
let loginEmail=local.get('loginEmail')||'',loginModo='entrar';
function authMsg(err){
  const t=String(err&&err.message||err||'');
  if(/invalid login credentials/i.test(t))return 'E-mail ou senha incorretos.';
  if(/email not confirmed/i.test(t))return 'Confirme seu e-mail pelo link que o Supabase enviou e tente de novo.';
  if(/already registered|already been registered/i.test(t))return 'Esse e-mail já tem conta. Use "Entrar".';
  if(/password should be at least|weak/i.test(t))return 'A senha precisa ter pelo menos 6 caracteres.';
  if(/rate limit|too many/i.test(t))return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if(/fetch|network/i.test(t))return 'Sem conexão com a internet.';
  return 'Não deu certo: '+t;
}
function renderLogin(){
  const v=$('#v-login');const novo=loginModo==='criar';
  v.innerHTML=`<div class="card login">
    <div class="brand" style="font-size:24px"><i></i>Missão PF</div>
    <h1>${novo?'Criar conta':'Entrar'}</h1>
    <p class="muted">${novo?'Crie sua conta uma vez. Depois é só entrar com o mesmo e-mail e senha no celular e no PC.':'Entre para salvar seus estudos na nuvem e ver tudo igual no celular e no PC.'}</p>
    <form id="lgForm" class="lgform">
      <label class="f">E-mail<input type="email" id="lgE" required autocomplete="email" value="${esc(loginEmail)}"></label>
      <label class="f">Senha<input type="password" id="lgP" required minlength="6" autocomplete="${novo?'new-password':'current-password'}"></label>
      <button class="btn primary" type="submit">${novo?'Criar conta':'Entrar'}</button>
    </form>
    <p class="small" id="lgMsg" aria-live="polite"></p>
    <button class="btn ghost sm" type="button" id="lgTroca">${novo?'Já tenho conta: entrar':'Primeira vez? Criar conta'}</button>
    <button class="btn ghost sm" type="button" id="lgLocal">Usar sem conta neste aparelho</button>
  </div>`;
  const msg=t=>{v.querySelector('#lgMsg').textContent=t};
  v.querySelector('#lgForm').onsubmit=async e=>{
    e.preventDefault();
    loginEmail=v.querySelector('#lgE').value.trim();local.set('loginEmail',loginEmail);
    const pw=v.querySelector('#lgP').value;
    msg(novo?'Criando conta…':'Entrando…');
    try{
      if(novo){
        const r=await signUp(loginEmail,pw);
        if(!r.session){loginModo='entrar';renderLogin();v.querySelector('#lgMsg').textContent='Conta criada! Abra o e-mail do Supabase e clique no link de confirmação. Depois volte aqui e entre.';return}
      }else await signIn(loginEmail,pw);
      local.set('semConta',false);go('hoje');route();toast('Conta conectada.');
    }catch(err){msg(authMsg(err))}
  };
  v.querySelector('#lgTroca').onclick=()=>{loginModo=novo?'entrar':'criar';renderLogin()};
  v.querySelector('#lgLocal').onclick=()=>{local.set('semConta',true);go('hoje');route()};
}
function renderConta(){
  const el=$('#contaBox');if(!el)return;
  const u=currentUser();
  el.innerHTML=!configured()?`<p class="muted small">Sincronização não configurada nesta versão. Os dados ficam só neste aparelho.</p>`
    :u?`<p class="small">Conectada como <b>${esc(u.email||'')}</b>.</p><div class="row"><button class="btn sm" type="button" id="ctSync">Sincronizar agora</button><button class="btn sm ghost" type="button" id="ctOut">Sair</button></div>`
    :`<p class="small muted">Você está usando sem conta: os dados ficam só neste aparelho.</p><div class="row"><button class="btn sm primary" type="button" id="ctIn">Entrar para sincronizar</button></div>`;
  const b1=el.querySelector('#ctSync');if(b1)b1.onclick=()=>pull();
  const b2=el.querySelector('#ctOut');if(b2)b2.onclick=async()=>{await signOut();local.set('semConta',true);toast('Você saiu. Os dados continuam neste aparelho.');renderConta()};
  const b3=el.querySelector('#ctIn');if(b3)b3.onclick=()=>{local.set('semConta',false);go('login');route()};
}
$('#bkCopy').onclick=async()=>{
  const names=Object.keys(S);const data={v:1,em:new Date().toISOString(),docs:Object.fromEntries(names.map(n=>[n,S[n]]))};
  const txt=JSON.stringify(data);
  try{await navigator.clipboard.writeText(txt);toast('Backup copiado. Cole em um lugar seguro.')}catch(e){$('#bkTxt').value=txt;$('#bkTxt').hidden=false;toast('Copie o texto do backup abaixo.')}
};
$('#bkLoad').onclick=()=>{const t=$('#bkTxt');if(t.hidden){t.hidden=false;t.value='';t.placeholder='Cole aqui o backup e toque em Restaurar de novo';t.focus();return}
  try{const d=JSON.parse(t.value);if(!d||!d.docs)throw 0;for(const n in d.docs){const base=n.startsWith('log-')?{d:{}}:clone(DEF[n]||{});S[n]=merge(base,d.docs[n]);save(n)}t.hidden=true;renderAll();toast('Backup restaurado.')}catch(e){toast('Esse texto não é um backup válido.')}};

function renderHojeExtra(){
  const el=$('#hojeExtra');if(!el)return;
  const q=getDoc('quest');const qd=q.qdia;const hoje=dkey();
  const feitos=qd&&qd.d===hoje?Object.keys(qd.resp||{}).length:0,tot=qd&&qd.d===hoje?qd.ids.length:(getDoc('cfg').qdia||{}).n||5;
  const nErr=Object.keys(q.erros||{}).length;
  let html=`<div class="card accent" style="--c:var(--lib)"><span class="k">Questão do dia</span><h2>${feitos>=tot&&qd&&qd.d===hoje?'Feita ✓':feitos?`${feitos} de ${tot} respondidas`:`${tot} itens esperando você`}</h2><div class="row"><button class="btn sm" type="button" data-go="qdia">${feitos>=tot&&qd&&qd.d===hoje?'Ver':'Responder'}</button>${nErr?`<button class="btn sm ghost" type="button" data-go="erros">Caderno de erros (${nErr})</button>`:''}</div></div>`;
  if(EXT.hoje)html+=EXT.hoje();
  el.innerHTML=html;
}
function renderConfig(){
  const c=getDoc('cfg');c.mod=c.mod||{};c.qdia=c.qdia||{n:5,todas:false};
  const mods=[['painel','Painel de desempenho','Gráficos de horas, acertos por matéria e evolução nos simulados.'],['patentes','Patentes','Você sobe de nível com horas, acertos e simulados.'],['conquistas','Conquistas','Medalhas por marcos do seu estudo e do TAF.']];
  $('#cfgMods').innerHTML=mods.map(([k,n,d])=>`<label class="toggle"><span class="t">${n}<small>${d}</small></span><input class="sw" type="checkbox" data-k="${k}" ${c.mod[k]!==false?'checked':''}></label>`).join('');
  $('#cfgMods').querySelectorAll('input').forEach(i=>i.onchange=()=>{c.mod[i.dataset.k]=i.checked;save('cfg');renderNav()});
  $('#cfgQdia').innerHTML=`<label class="f">Itens por dia<input type="number" id="cqN" min="3" max="20" value="${c.qdia.n}"></label><label class="toggle"><span class="t">Incluir aulas ainda não estudadas<small>Desligado: a questão do dia só usa as aulas marcadas como estudadas.</small></span><input class="sw" type="checkbox" id="cqT" ${c.qdia.todas?'checked':''}></label>`;
  $('#cqN').onchange=e=>{c.qdia.n=Math.max(3,Math.min(20,+e.target.value||5));const q=getDoc('quest');if(q.qdia&&q.qdia.d===dkey()&&!Object.keys(q.qdia.resp||{}).length){q.qdia=null;save('quest')}save('cfg')};
  $('#cqT').onchange=e=>{c.qdia.todas=e.target.checked;const q=getDoc('quest');if(q.qdia&&q.qdia.d===dkey()&&!Object.keys(q.qdia.resp||{}).length){q.qdia=null;save('quest')}save('cfg')};
  if(EXT.config)EXT.config();
  renderConta();
}
function aulaMateria(id){const a=(catalog||[]).find(x=>x.id===id);return a?a.materia:'const'}
const listeners=[];
function onEvent(type,data){listeners.forEach(f=>{try{f(type,data)}catch(e){console.warn(e)}})}
export const ctx={S,getDoc,save,local,$,esc,clone,pad,dkey,parseKey,addDays,weekStart,fmtDate,fmtH,fmtClock,fmtClockH,toast,uid,MM,MAT,PROVAS,PM,go,renderAll,renderNav,loadCatalog,fetchAula,aulaMateria,minutesOn,streak,bestMark,fmtMark,marksOf,addMarca:(p,v,d)=>{getDoc('taf').marcas.push({id:uid(),p,v,d:d||dkey()});save('taf');renderAll()},beep,unlockAudio,isNative,EXT,modOn,onEvent,listen:f=>listeners.push(f),logMonths,registerDoc:(n,d)=>{DEF[n]=d}};
initQuest(ctx);
initRevisao(ctx);
initExtras(ctx);
initCasos(ctx);
