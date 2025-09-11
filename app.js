// ----- utilities -----
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ----- state -----
const defaultState = {
  player: { level: 1, xp: 0, xpNext: 50 },
  attrs: { Physical:0, Psyche:0, Intellect:0, Financial:0, Social:0, Spiritual:0 },
  quests: [],
  lastId: 0
};
let state = load();
function load(){ try{ return JSON.parse(localStorage.getItem('shadowhud-full')) || structuredClone(defaultState);}catch(e){ return structuredClone(defaultState);} }
function save(){ localStorage.setItem('shadowhud-full', JSON.stringify(state)); }

// ----- XP curve + rank mapping -----
function xpToNext(level){ return Math.round(40 + 6*level + 0.6*level*level); } // gentle → steep
function rankForLevel(l){
  if (l < 15) return 'E';
  if (l < 30) return 'D';
  if (l < 45) return 'C';
  if (l < 60) return 'B';
  if (l < 75) return 'A';
  return 'S';
}
function grantXP(amount){
  const p = state.player;
  if (p.level >= 100) return;
  p.xp += Math.max(0, amount|0);
  while (p.level < 100 && p.xp >= p.xpNext){
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpToNext(p.level);
  }
  if (p.level >= 100){ p.level = 100; p.xp = p.xpNext; }
  save(); renderLevel();
}
function renderLevel(){
  const p = state.player;
  $('#level-num').textContent = p.level;
  const rk = rankForLevel(p.level);
  $('#rank-text').textContent = rk;
  $('#rank-badge').textContent = rk;
  $('#xp-cur').textContent = p.xp;
  $('#xp-next').textContent = p.xpNext;
  $('#xp-fill').style.width = Math.max(0, Math.min(100, (p.xp/p.xpNext)*100)) + '%';
}

// ----- nav -----
function show(name){
  $$('.screen').forEach(s=>s.classList.remove('visible'));
  $('#screen-'+name).classList.add('visible');
  $$('.tab').forEach(t=>t.classList.remove('active'));
  if(name==='character') $('#tab-character').classList.add('active');
  if(name==='quests') $('#tab-quests').classList.add('active');
}
$('#tab-character').onclick=()=>{ $('#appbar-title').textContent='Character'; show('character'); };
$('#tab-quests').onclick=()=>{ $('#appbar-title').textContent='Quests'; show('quests'); };
$('#tab-journey').onclick=()=>alert('Journey coming soon');
$('#tab-store').onclick=()=>alert('Store coming soon');
$('#tab-focus').onclick=()=>alert('Focus coming soon');
$('#btn-plus').onclick=()=>{ resetForm(); show('create'); $('#appbar-title').textContent='New Quest'; };
$('#btn-cancel').onclick=()=>{ show('quests'); $('#appbar-title').textContent='Quests'; };

// ----- radar -----
const radarLabels = ["Financial","Physical","Psyche","Intellect","Social","Spiritual"];
function renderRadar(){
  const svg = $('#radar'); svg.innerHTML='';
  const rings=5, R=48;
  for(let i=1;i<=rings;i++){
    const r=R*i/rings;
    svg.appendChild(polygon(r, '#222'));
  }
  radarLabels.forEach((lab,i)=>{
    const a = (Math.PI*2/radarLabels.length)*i - Math.PI/2;
    const x=Math.cos(a)*R, y=Math.sin(a)*R;
    line(0,0,x,y,'#222');
    const tx=Math.cos(a)*(R+12), ty=Math.sin(a)*(R+12);
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',tx); t.setAttribute('y',ty);
    t.setAttribute('fill','#a0a0a0'); t.setAttribute('font-size','5'); t.setAttribute('text-anchor','middle');
    t.textContent=lab; svg.appendChild(t);
  });
  const points = radarLabels.map((lab,i)=>{
    const val = Math.max(0, Math.min(100, state.attrs[lab]||0));
    const a = (Math.PI*2/radarLabels.length)*i - Math.PI/2;
    const r = (val/100)*R;
    return [Math.cos(a)*r, Math.sin(a)*r];
  });
  const path = document.createElementNS('http://www.w3.org/2000/svg','polygon');
  path.setAttribute('points', points.map(p=>p.join(',')).join(' '));
  path.setAttribute('fill','#4da3ff22'); path.setAttribute('stroke','#4da3ff'); path.setAttribute('stroke-width','1.5');
  svg.appendChild(path);

  function polygon(r, stroke){
    const pts = radarLabels.map((_,i)=>{
      const a=(Math.PI*2/radarLabels.length)*i - Math.PI/2;
      return [Math.cos(a)*r, Math.sin(a)*r];
    });
    const g=document.createElementNS('http://www.w3.org/2000/svg','polygon');
    g.setAttribute('points', pts.map(p=>p.join(',')).join(' '));
    g.setAttribute('fill','none'); g.setAttribute('stroke',stroke); g.setAttribute('stroke-width','0.6');
    return g;
  }
  function line(x1,y1,x2,y2,stroke){
    const l=document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke',stroke); l.setAttribute('stroke-width','0.6');
    svg.appendChild(l);
  }
}
function renderTiles(){
  const grid = $('#attr-grid'); grid.innerHTML='';
  const order = ["Physical","Psyche","Intellect","Social","Spiritual","Financial"];
  for(const lab of order){
    const tile = document.createElement('div'); tile.className='tile';
    tile.innerHTML = `<div class="n">${state.attrs[lab]||0}</div><div class="l">${lab.toUpperCase()}</div>`;
    // long press edit
    let timer=null;
    const start=()=>timer=setTimeout(()=>editAttr(lab),500);
    const stop=()=>{if(timer) clearTimeout(timer);};
    tile.addEventListener('mousedown',start); tile.addEventListener('touchstart',start);
    ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>tile.addEventListener(ev,stop));
    grid.appendChild(tile);
  }
}
function editAttr(lab){
  const cur = state.attrs[lab]||0;
  const val = prompt(`${lab} value (0-100)`, String(cur));
  if(val===null) return;
  const n = Math.max(0, Math.min(100, Number(val)||0));
  state.attrs[lab]=n; save(); renderRadar(); renderTiles();
}

// ----- quests -----
function currentFilter(){ return document.querySelector('.chip.active')?.dataset.filter || 'all'; }
$$('.chip').forEach(c=>c.onclick=()=>{ $$('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); renderQuests(c.dataset.filter); });

function renderQuests(filter='all'){
  const list=$('#quest-list'); list.innerHTML='';
  const now=Date.now();
  const filtered=state.quests.filter(q=>{
    if(filter==='all') return true;
    if(filter==='active') return !q.completed && !(q.deadline && now>q.deadline);
    if(filter==='completed') return q.completed;
    if(filter==='expired') return q.deadline && now>q.deadline && !q.completed;
  });
  $('#empty-note').style.display = filtered.length? 'none':'block';

  for(const q of filtered){
    const node=document.createElement('div'); node.className='card quest';
    node.innerHTML = `
      <div class="q-top">
        <div class="q-title">${q.title}</div>
        <div class="q-xp">+${q.xp||0} XP</div>
      </div>
      <div class="q-sub"></div>
      <div class="q-progress"><div class="q-fill" style="width:0%"></div></div>
      <div class="q-actions">
        <button class="btn small complete">Done</button>
        <button class="btn small ghost pause hidden">Pause</button>
        <button class="btn small ghost resume hidden">Resume</button>
        <button class="btn small ghost inc hidden">+1</button>
        <button class="btn small ghost dec hidden">−1</button>
        <div class="spacer"></div>
        <button class="btn small ghost edit">Edit</button>
        <button class="btn small ghost delete">Delete</button>
      </div>`;

    const sub=node.querySelector('.q-sub');
    const fill=node.querySelector('.q-fill');
    const btnC=node.querySelector('.complete');
    const btnP=node.querySelector('.pause');
    const btnR=node.querySelector('.resume');
    const btnI=node.querySelector('.inc');
    const btnD=node.querySelector('.dec');
    const btnE=node.querySelector('.edit');
    const btnDel=node.querySelector('.delete');

    if(q.type==='timer'){
      const rem = timerRemaining(q);
      const pct = Math.max(0,Math.min(1,1-rem/q.durationMs));
      fill.style.width = (pct*100)+'%';
      sub.textContent = (q.paused?'Paused — ':'') + formatTime(rem);
      (q.paused?btnR:btnP).classList.remove('hidden');
    } else if(q.type==='counter'){
      const pct = Math.min(1, (q.count||0)/q.target);
      fill.style.width = (pct*100)+'%';
      sub.textContent = `Count ${q.count||0}/${q.target}`;
      btnI.classList.remove('hidden'); btnD.classList.remove('hidden');
    } else if(q.type==='checklist'){
      const done = (q.done||[]).filter(Boolean).length;
      const total = (q.items||[]).length;
      const pct = total? done/total : 0;
      fill.style.width = (pct*100)+'%';
      sub.textContent = `${done}/${total} items`;
    }

    btnC.onclick = () => {
      if (!q.completed){
        q.completed = true;
        grantXP(q.xp || 0);
        if (q.repeat && q.repeat !== 'none'){ // recreate next occurrence
          const next = structuredClone(q);
          next.id = ++state.lastId;
          next.completed = false;
          if(q.type==='timer'){
            const now = Date.now();
            next.startTs = now; next.endTs = now + (q.durationMs||0); next.paused=false; delete next.pauseTs;
          }
          if(q.type==='counter'){ next.count = 0; }
          if(q.type==='checklist'){ next.done = (q.items||[]).map(()=>false); }
          if(q.deadline){
            const d=new Date(q.deadline);
            if(q.repeat==='daily') d.setDate(d.getDate()+1);
            if(q.repeat==='weekly') d.setDate(d.getDate()+7);
            next.deadline = d.getTime();
          }
          state.quests.push(next);
        }
        save(); renderQuests(filter);
      }
    };
    if(btnP) btnP.onclick = ()=>{ q.paused=true; q.pauseTs=Date.now(); save(); renderQuests(filter); };
    if(btnR) btnR.onclick = ()=>{ if(q.paused){ const pausedFor=Date.now()-(q.pauseTs||Date.now()); q.endTs+=pausedFor; q.paused=false; save(); renderQuests(filter);} };
    if(btnI) btnI.onclick = ()=>{ q.count=Math.min(q.target,(q.count||0)+1); if(q.count>=q.target && !q.completed){ q.completed=true; grantXP(q.xp||0); } save(); renderQuests(filter); };
    if(btnD) btnD.onclick = ()=>{ q.count=Math.max(0,(q.count||0)-1); save(); renderQuests(filter); };
    btnE.onclick = ()=>{ populateForm(q); show('create'); $('#appbar-title').textContent='New Quest'; };
    btnDel.onclick = ()=>{ state.quests = state.quests.filter(x=>x.id!==q.id); save(); renderQuests(filter); };

    list.appendChild(node);
  }
}

// ----- timers/helpers -----
setInterval(()=>{
  let touched=false;
  for(const q of state.quests){
    if(q.type==='timer' && !q.completed && !q.paused && timerRemaining(q)<=0){
      q.completed=true; grantXP(q.xp||0); touched=true;
    }
  }
  if(touched){ save(); renderQuests(currentFilter()); }
}, 1000);

function timerRemaining(q){
  if(q.paused) return Math.max(0, q.endTs-(q.pauseTs||Date.now()));
  return Math.max(0, q.endTs-Date.now());
}
function formatTime(ms){
  const s=Math.ceil(ms/1000); const m=Math.floor(s/60);
  const ss=(''+(s%60)).padStart(2,'0'); const mm=(''+(m%60)).padStart(2,'0'); const hh=Math.floor(m/60);
  return hh>0?`${hh}:${mm}:${ss}`:`${m}:${ss}`;
}

// ----- form -----
function resetForm(){
  const f = $('#quest-form');
  f.dataset.editing='';
  $('#q-title').value=''; $('#q-desc').value=''; $('#q-type').value='timer';
  $('#q-duration').value=30; $('#q-target').value=10; $('#q-items').value='';
  $('#q-deadline').value=''; $('#q-repeat').value='none'; $('#q-xp').value=25;
  updateTypeFields();
}
function populateForm(q){
  const f = $('#quest-form'); f.dataset.editing=String(q.id);
  $('#q-title').value=q.title; $('#q-desc').value=q.desc||''; $('#q-type').value=q.type;
  $('#q-duration').value=Math.round((q.durationMs||0)/60000)||30;
  $('#q-target').value=q.target||10;
  $('#q-items').value=(q.items||[]).join(', ');
  $('#q-deadline').value=q.deadline? new Date(q.deadline).toISOString().slice(0,16):'';
  $('#q-repeat').value=q.repeat||'none'; $('#q-xp').value=q.xp||25;
  updateTypeFields();
}
$('#q-type').onchange = updateTypeFields;
function updateTypeFields(){
  const t = $('#q-type').value;
  $$('.if').forEach(el=>el.classList.remove('show'));
  $$('.if.'+t).forEach(el=>el.classList.add('show'));
}
document.querySelector('#quest-form').addEventListener('submit', (ev)=>{
  ev.preventDefault();
  const editingId = $('#quest-form').dataset.editing;
  const t = $('#q-type').value;
  const quest = {
    id: editingId? Number(editingId): ++state.lastId,
    title: $('#q-title').value.trim(),
    desc: $('#q-desc').value.trim(),
    type: t,
    repeat: $('#q-repeat').value,
    xp: Number($('#q-xp').value)||0,
    completed:false
  };
  const deadlineStr = $('#q-deadline').value;
  quest.deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;
  if(t==='timer'){
    const mins=Math.max(1, Number($('#q-duration').value)||30);
    const now=Date.now(); quest.durationMs=mins*60000;
    if(editingId){
      const ex=state.quests.find(x=>x.id===quest.id); const remaining=ex? timerRemaining(ex): quest.durationMs;
      quest.startTs=now; quest.endTs=now+remaining; quest.paused=ex?.paused||false;
    }else{ quest.startTs=now; quest.endTs=now+quest.durationMs; }
  }
  if(t==='counter'){
    quest.target=Math.max(1, Number($('#q-target').value)||10);
    quest.count = editingId? (state.quests.find(x=>x.id===quest.id)?.count||0):0;
  }
  if(t==='checklist'){
    quest.items = $('#q-items').value.split(',').map(s=>s.trim()).filter(Boolean);
    quest.done = editingId? (state.quests.find(x=>x.id===quest.id)?.done||quest.items.map(()=>false)) : quest.items.map(()=>false);
  }
  if(editingId){
    const idx=state.quests.findIndex(x=>x.id===quest.id); state.quests[idx]=quest;
  }else{
    state.quests.push(quest);
  }
  save(); renderQuests(currentFilter()); show('quests'); $('#appbar-title').textContent='Quests';
});

// ----- init -----
function init(){
  // migrate player if older saves
  if(!state.player){ state.player={level:1,xp:0,xpNext:xpToNext(1)}; }
  state.player.xpNext = xpToNext(state.player.level);
  renderLevel(); renderRadar(); renderTiles(); renderQuests('all');
  // seed demo quests once
  if(!localStorage.getItem('shadowhud-full-seed')){
    state.quests.push(
      {id:++state.lastId, title:'Hydration', desc:'Drink 8 cups of water', type:'counter', target:8, count:0, repeat:'daily', xp:10, completed:false},
      {id:++state.lastId, title:'Daily Stretch', desc:'10 minute flexibility', type:'timer', startTs:Date.now(), durationMs:10*60000, endTs:Date.now()+10*60000, paused:false, repeat:'daily', xp:15, completed:false},
      {id:++state.lastId, title:'Project checklist', desc:'3 things today', type:'checklist', items:['Write outline','Send email','Tidy desk'], done:[false,false,false], repeat:'none', xp:25, completed:false}
    );
    save(); localStorage.setItem('shadowhud-full-seed','1'); renderQuests('all');
  }
}
window.addEventListener('DOMContentLoaded', init);
