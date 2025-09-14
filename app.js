// ShadowHUD minimal single-file app
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const VERSION = '13.3-rebuild';
const LS_KEY = 'shadowhud_v13_state';

const ATTRS = ['physical','psyche','intellect','social','spiritual','financial'];

const defaultState = () => ({
  version: VERSION,
  gold: 0,
  ap: 0,
  equippedTitle: null,
  titles: [
    {id:'start', name:'The One Who Started', req:'Complete 1 quest', owned:false},
    {id:'streak3', name:'Routine Rookie', req:'3 dailies in a row', owned:false},
    {id:'strength5', name:'Iron Initiate', req:'Finish Strength Training 5x', owned:false}
  ],
  achievements:[],
  attributes: {physical:0, psyche:0, intellect:0, social:0, spiritual:0, financial:0},
  quests: [],
  done: [],
  penalty: [],
  store: [],
  lastDaily: null
});

let S = null;
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw){ S = defaultState(); seed(); save(); return; }
    S = JSON.parse(raw);
    if(!S.version) S.version = VERSION;
  }catch(e){ S = defaultState(); }
  rotateDailiesIfNeeded();
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(S)); }

// Midnight calculations
function nextMidnight(){
  const n = new Date();
  n.setSeconds(0,0);
  const d = new Date(n);
  d.setDate(d.getDate()+1); d.setHours(0,0,0,0);
  return d;
}
function countdownStr(){
  const ms = nextMidnight()-Date.now();
  const t = Math.max(0, Math.floor(ms/1000));
  const h = String(Math.floor(t/3600)).padStart(2,'0');
  const m = String(Math.floor((t%3600)/60)).padStart(2,'0');
  const s = String(t%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

// Seed default quests
function seed(){
  // Strength Training daily
  if(!S.quests.some(q=>q.id==='strength')){
    S.quests.push({
      id:'strength', title:'Strength Training', tags:['Daily','Elite','physical'],
      xp:120, gold:30, type:'daily',
      counters:[
        {label:'Pushups', count:0, target:100},
        {label:'Sit-ups', count:0, target:100},
        {label:'Squats', count:0, target:100},
        {label:'Run (miles)', count:0, target:1}
      ],
      started:false, done:false, created: Date.now()
    });
  }
  // plus 3 rotating examples
  const pool = [
    {title:'Meditate 10 minutes', tags:['Daily','Normal','spiritual'], xp:10, gold:10, counters:[{label:'Count',count:0,target:1}]},
    {title:'Budget review', tags:['Daily','Normal','financial'], xp:20, gold:16, counters:[{label:'Count',count:0,target:1}]},
    {title:'Read 20 pages', tags:['Daily','Normal','intellect'], xp:15, gold:12, counters:[{label:'Count',count:0,target:1}]},
    {title:'Check in with a friend', tags:['Daily','Easy','social'], xp:10, gold:10, counters:[{label:'Count',count:0,target:1}]},
  ];
  const picks = pool.slice(0,3);
  picks.forEach((p,i)=>{
    S.quests.push({id:'seed'+i, ...p, type:'daily', started:false, done:false, created:Date.now()});
  });
  S.lastDaily = (new Date()).toDateString();
}

function rotateDailiesIfNeeded(){
  const today = (new Date()).toDateString();
  if(S.lastDaily === today) return;
  // remove all non-strength daily quests & move incomplete to penalty
  const keep = [];
  S.quests.forEach(q=>{
    if(q.id==='strength'){ // reset counters
      q.counters.forEach(c=>c.count=0);
      q.done=false; q.started=false;
      keep.push(q);
    }else if(q.type==='daily'){
      // missed — move to penalty list
      S.penalty.push({...q, type:'penalty', missedOn: Date.now()});
    }else{
      keep.push(q);
    }
  });
  S.quests = keep;
  // add 3 fresh random dailies
  const pool = [
    {title:'Meditate 10 minutes', tags:['Daily','Normal','spiritual'], xp:10, gold:10, counters:[{label:'Count',count:0,target:1}]},
    {title:'Budget review', tags:['Daily','Normal','financial'], xp:20, gold:16, counters:[{label:'Count',count:0,target:1}]},
    {title:'Read 20 pages', tags:['Daily','Normal','intellect'], xp:15, gold:12, counters:[{label:'Count',count:0,target:1}]},
    {title:'Check in with a friend', tags:['Daily','Easy','social'], xp:10, gold:10, counters:[{label:'Count',count:0,target:1}]},
    {title:'Deep clean a room', tags:['Daily','Hard','physical'], xp:77, gold:22, counters:[{label:'Items',count:0,target:3}]},
  ];
  // choose 3
  while(S.quests.filter(q=>q.type==='daily').length<4){
    const p = pool.splice(Math.floor(Math.random()*pool.length),1)[0];
    S.quests.push({id:'d'+Math.random().toString(36).slice(2,7), ...p, type:'daily', started:false, done:false, created:Date.now()});
  }
  S.lastDaily = today;
  save();
}

// Rendering
function setGold(){ $('#goldAmount').textContent = S.gold; }

function renderTabs(){
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{
    $$('.tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const tab = b.dataset.tab;
    $$('.screen').forEach(s=>s.classList.remove('visible'));
    $('#screen-'+tab).classList.add('visible');
    if(tab==='character') drawRadar();
  }));
}

function renderFilters(){
  $$('.filter').forEach(b=>b.addEventListener('click', ()=>{
    $$('.filter').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    renderQuests();
  }));
}

function renderQuests(){
  const list = $('#questList'); list.innerHTML = '';
  const fbtn = $('.filter.active');
  const mode = fbtn ? fbtn.dataset.filter : 'all';
  const items = S.quests.filter(q=>{
    if(mode==='all') return true;
    if(mode==='daily') return q.type==='daily';
    if(mode==='penalty') return q.type==='penalty';
    if(mode==='active') return !q.done;
    if(mode==='done') return q.done;
    return true;
  });

  items.forEach(q=> list.appendChild(renderQuestCard(q)));
}

function renderQuestCard(q){
  const t = $('#questCardTmpl').content.cloneNode(true);
  const card = t.querySelector('.card.quest');
  t.querySelector('.qtitle').textContent = q.title;
  t.querySelector('.xp').textContent = q.xp;
  t.querySelector('.gold').textContent = q.gold;
  const tags = t.querySelector('.tags');
  (q.tags||[]).forEach(tag=>{
    const c=document.createElement('span'); c.className='chip'; c.textContent=tag; tags.appendChild(c);
  });
  // countdown
  const cdown = t.querySelector('.countdown'); cdown.textContent = countdownStr();
  // counters
  const qc = t.querySelector('.qcontent');
  (q.counters||[]).forEach((c,i)=>{
    const row = document.createElement('div'); row.className='rowy wrap';
    const label = document.createElement('div'); label.textContent = `${c.label} ${c.count}/${c.target}`;
    label.style.minWidth='120px'; label.style.fontWeight='600';
    const minus = btn('−1',()=>{ c.count = Math.max(0,c.count-1); save(); render(); }, 'btn');
    const plus = btn('+1',()=>{ c.count = Math.min(c.target, c.count+1); save(); render(); }, 'btn');
    const fin = btn('Finish',()=>{ c.count=c.target; save(); render(); }, 'btn primary');
    row.append(label, minus, plus, fin);
    qc.appendChild(row);
  });
  // actions
  const actions = t.querySelector('.actions');
  actions.appendChild(btn('Done', ()=>completeQuest(q), 'btn success'));
  actions.appendChild(btn('Reset', ()=>{ (q.counters||[]).forEach(c=>c.count=0); q.done=false; save(); render(); }, 'btn warn'));
  actions.appendChild(btn('Edit', ()=>alert('Edit UI omitted in rebuild'), 'btn'));
  actions.appendChild(btn('Delete', ()=>{ S.quests = S.quests.filter(x=>x!==q); save(); render(); }, 'btn danger'));

  return card;
}

function btn(txt, fn, cls='btn'){
  const b = document.createElement('button'); b.className=cls; b.textContent=txt; b.addEventListener('click', fn); return b;
}

function completeQuest(q){
  q.done = true;
  // grant rewards
  S.gold += q.gold;
  // basic attribute credit from tags if matches attr name
  ATTRS.forEach(a=>{ if(q.tags && q.tags.includes(a)) S.attributes[a] += 1; });
  // titles unlocks
  if(!S.titles.find(t=>t.id==='start').owned){
    S.titles.find(t=>t.id==='start').owned = true;
  }
  // remove from active screen immediately
  S.done.push({...q, finished: Date.now()});
  S.quests = S.quests.filter(x=>x!==q);
  save(); setGold(); render();
}

// Titles / Journey
function renderJourney(){
  $('#equippedTitle').textContent = S.equippedTitle || 'None';
  const tl = $('#titleList'); tl.innerHTML='';
  S.titles.forEach(ti=>{
    const chip = document.createElement('button');
    chip.className = 'pill';
    chip.textContent = ti.owned ? ti.name : `🔒 ${ti.name}`;
    chip.disabled = !ti.owned;
    chip.addEventListener('click', ()=>{ S.equippedTitle = ti.name; save(); renderJourney(); });
    tl.appendChild(chip);
  });
  $('#progressSummary').textContent = `Level E • Completed ${S.done.length} • Gold ${S.gold}`;
  const ach = $('#achievements'); ach.innerHTML='';
  S.achievements.forEach(a=>{ const li=document.createElement('li'); li.textContent=a; ach.appendChild(li); });
}

// Character
function renderAttributes(){
  $('#apCount').textContent = S.ap;
  const grid = $('#attributes'); grid.innerHTML='';
  ATTRS.forEach(a=>{
    const card = document.createElement('div');
    card.className='attr';
    card.innerHTML = `<div class="num">${S.attributes[a]||0}</div><div class="name">${a.toUpperCase()}</div>`;
    grid.appendChild(card);
  });
}
function polarToXY(cx, cy, r, angle){
  return [cx + r*Math.cos(angle), cy + r*Math.sin(angle)];
}
function drawRadar(){
  const wrap = $('#radar'); wrap.innerHTML='';
  const w = wrap.clientWidth || 320, h=240, cx=w/2, cy=h/2+10, levels=5, max=10;
  const svgNS='http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.classList.add('radar');
  // grid
  for(let l=1;l<=levels;l++){
    const r = (Math.min(w,h)/2 - 30) * (l/levels);
    const poly = document.createElementNS(svgNS,'polygon');
    const pts = ATTRS.map((_,i)=>{
      const angle = (-Math.PI/2) + (i*(2*Math.PI/ATTRS.length));
      const [x,y] = polarToXY(cx, cy, r, angle);
      return `${x},${y}`;
    }).join(' ');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill','none');
    poly.setAttribute('stroke','#33354f');
    svg.appendChild(poly);
  }
  // labels
  ATTRS.forEach((name,i)=>{
    const angle = (-Math.PI/2) + (i*(2*Math.PI/ATTRS.length));
    const [x,y] = polarToXY(cx, cy, Math.min(w,h)/2 - 10, angle);
    const t = document.createElementNS(svgNS,'text');
    t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('fill', '#bfc1e6');
    t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','12'); t.textContent = name[0].toUpperCase()+name.slice(1);
    svg.appendChild(t);
  });
  // values polygon
  const pts = ATTRS.map((name,i)=>{
    const val = Math.min(10, S.attributes[name]||0);
    const r = (Math.min(w,h)/2 - 30) * (val/max);
    const angle = (-Math.PI/2) + (i*(2*Math.PI/ATTRS.length));
    const [x,y] = polarToXY(cx, cy, r, angle);
    return `${x},${y}`;
  }).join(' ');
  const poly = document.createElementNS(svgNS,'polygon');
  poly.setAttribute('points', pts);
  poly.setAttribute('fill','rgba(124,108,255,.35)');
  poly.setAttribute('stroke','rgba(124,108,255,.8)');
  svg.appendChild(poly);
  wrap.appendChild(svg);
}

// Store
function renderStore(){
  const list = $('#storeList'); list.innerHTML='';
  if(S.store.length===0){
    const empty = document.createElement('div'); empty.className='card compact'; empty.textContent='No rewards yet.'; list.appendChild(empty);
  }
  S.store.forEach((it, idx)=>{
    const c = document.createElement('div'); c.className='card rowy bar';
    const left = document.createElement('div'); left.textContent = `${it.title} — ${it.cost} gold`;
    const buy = btn('Buy', ()=>{
      if(S.gold>=it.cost){ S.gold-=it.cost; setGold(); save(); alert('Purchased!'); }
      else alert('Not enough gold.');
    }, 'btn primary');
    const del = btn('Delete', ()=>{ S.store.splice(idx,1); save(); renderStore(); }, 'btn danger');
    c.append(left, buy, del); list.appendChild(c);
  });
}

function wireStoreForm(){
  $('#saveReward').addEventListener('click', ()=>{
    const title = $('#rewardTitle').value.trim();
    const cost = parseInt($('#rewardCost').value||'0',10);
    if(!title) return;
    S.store.push({title, cost}); save(); renderStore();
    $('#rewardTitle').value=''; $('#rewardCost').value='50';
  });
}

// Focus
let focusTimer=null, focusUntil=0;
function wireFocus(){
  const disp = $('#focusTime');
  function tick(){
    const left = Math.max(0, focusUntil - Date.now());
    const t = Math.floor(left/1000);
    const m = String(Math.floor(t/60)).padStart(2,'0');
    const s = String(t%60).padStart(2,'0');
    disp.textContent = `${m}:${s}`;
    if(left<=0){ clearInterval(focusTimer); focusTimer=null; }
  }
  $('#focusStart').addEventListener('click', ()=>{
    const mins = parseInt($('#focusMinutes').value||'25',10);
    focusUntil = Date.now()+mins*60*1000;
    if(focusTimer) clearInterval(focusTimer);
    focusTimer = setInterval(tick, 250);
    tick();
  });
  $('#focusPause').addEventListener('click', ()=>{ if(focusTimer){ clearInterval(focusTimer); focusTimer=null; }});
  $('#focusResume').addEventListener('click', ()=>{ if(!focusTimer){ focusTimer=setInterval(tick,250);} });
  $('#focusCancel').addEventListener('click', ()=>{ if(focusTimer){ clearInterval(focusTimer); focusTimer=null;} disp.textContent='25:00'; });
}

// Countdown updater
function startCountdowns(){
  function upd(){
    $$('.countdown').forEach(el=> el.textContent = countdownStr());
  }
  setInterval(upd, 1000);
}

function render(){
  setGold();
  renderQuests();
  renderJourney();
  renderAttributes();
  renderStore();
  // ensure radar refresh on character tab
  if($('#screen-character').classList.contains('visible')) drawRadar();
}

function main(){
  load();
  renderTabs();
  renderFilters();
  render();
  $('#addQuestBtn').addEventListener('click', ()=> alert('Quest creator omitted in rebuild'));
  wireStoreForm();
  wireFocus();
  startCountdowns();
}

document.addEventListener('DOMContentLoaded', main);
