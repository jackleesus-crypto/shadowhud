
// ====== Simple State ======
const state = {
  version: '13.4',
  gold: 0,
  xp: 0,
  nextLevelXP: 47,
  level: 1,
  rank: 'E',
  unspentAP: 0,
  attributes: { physical: 0, psyche: 0, intellect: 0, social: 0, spiritual: 0, financial: 0 },
  titles: [
    { id:'starter', name:'The One Who Started', requirement:'Complete 1 quest', owned:false },
    { id:'dawn', name:'Dawn Chaser', requirement:'Complete 5 daily quests', owned:false },
    { id:'iron', name:'Iron Will', requirement:'Complete Strength Training once', owned:false }
  ],
  equippedTitle: null,
  achievements: [],
  store: [],
  quests: [],
  lastDailySeed: null, // YYYY-MM-DD
};

// ====== Utils ======
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function save(){
  localStorage.setItem('shadowhud_v13_4', JSON.stringify(state));
}

function load(){
  const raw = localStorage.getItem('shadowhud_v13_4');
  if(!raw) return;
  try{
    const data = JSON.parse(raw);
    Object.assign(state, data);
  }catch(e){ console.error('load err', e); }
}

function todayKey(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function timeToMidnight(){
  const now = new Date();
  const end = new Date(now);
  end.setHours(24,0,0,0);
  return Math.max(0, end - now);
}

function formatCountdown(ms){
  const s = Math.floor(ms/1000);
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}

function xpFor(diff) {
  const base = {Normal:10, Hard:20, Elite:30}[diff] || 10;
  return base;
}

// ====== Radar (canvas) ======
function drawRadar(){
  const canvas = $('#radar');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const cx = W/2, cy = H/2 + 10;
  const labels = ['Financial','Physical','Spiritual','Social','Intellect','Psyche'];
  const keys   = ['financial','physical','spiritual','social','intellect','psyche'];
  const radius = Math.min(W,H)/2 - 60;
  const levels = 5;

  ctx.strokeStyle = '#3a3a55'; ctx.lineWidth=1;
  for(let l=1;l<=levels;l++){
    const r = radius * (l/levels);
    ctx.beginPath();
    for(let i=0;i<labels.length;i++){
      const a = (Math.PI*2*i/labels.length) - Math.PI/2;
      const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  // axes + labels
  ctx.fillStyle = '#b8bade'; ctx.font='16px system-ui';
  for(let i=0;i<labels.length;i++){
    const a = (Math.PI*2*i/labels.length) - Math.PI/2;
    const x = cx + (radius+20)*Math.cos(a), y = cy + (radius+20)*Math.sin(a);
    ctx.textAlign = x>cx? 'left' : (x<cx? 'right' : 'center');
    ctx.fillText(labels[i], x, y);
  }
  // data
  const maxVal = Math.max(1, ...Object.values(state.attributes), 10);
  ctx.fillStyle = 'rgba(141,139,255,0.25)';
  ctx.strokeStyle = '#8f8dff'; ctx.lineWidth=2;
  ctx.beginPath();
  for(let i=0;i<labels.length;i++){
    const key = keys[i];
    const val = state.attributes[key];
    const ratio = Math.min(1, val / maxVal);
    const a = (Math.PI*2*i/labels.length) - Math.PI/2;
    const x = cx + radius*ratio*Math.cos(a), y = cy + radius*ratio*Math.sin(a);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

// ====== Tabs ======
function setupTabs(){
  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.dataset.tab;
      $$('.tabpanel').forEach(s=>s.classList.remove('active'));
      $('#tab-'+id).classList.add('active');
    });
  });
}

// ====== Quests ======
function randomDailyPool(){
  return [
    { title:'Meditate 10 minutes', type:'timer', minutes:10, repeat:'Daily', difficulty:'Normal', attributes:['spiritual'] },
    { title:'Deep clean a room', type:'checklist', checklist:['Pick up','Vacuum','Mop'], repeat:'Daily', difficulty:'Hard', attributes:['social'] },
    { title:'Budget review', type:'count', target:1, repeat:'Daily', difficulty:'Normal', attributes:['financial'] },
    { title:'Read 20 pages', type:'count', target:20, repeat:'Daily', difficulty:'Normal', attributes:['intellect'] },
    { title:'Walk 3,000 steps', type:'count', target:3000, repeat:'Daily', difficulty:'Normal', attributes:['physical'] },
  ];
}

function ensureDailyQuests(){
  const seed = todayKey();
  if(state.lastDailySeed === seed && state.quests.some(q=>q.fixedDaily)) return;
  // Clear non-fixed daily quests (that were generated)
  state.quests = state.quests.filter(q=>q.fixedDaily || !q.generatedDaily);
  // Strength Training (fixed)
  if(!state.quests.some(q=>q.id==='strength_training')){
    state.quests.unshift({
      id:'strength_training',
      title:'Strength Training',
      type:'multi',
      multi:[
        { label:'Pushups', target:100, value:0 },
        { label:'Sit-ups', target:100, value:0 },
        { label:'Squats', target:100, value:0 },
        { label:'Run (miles)', target:1, value:0 }
      ],
      repeat:'Daily', difficulty:'Elite', xp:120, gold:30, attributes:['physical'],
      createdAt: Date.now(),
      countdown: timeToMidnight(),
      status:'not_started',
      fixedDaily:true
    });
  }
  // pick 2 others
  const pool = randomDailyPool();
  // Random deterministic choice by day
  const rand = (n) => {
    const t = new Date().getDate() + new Date().getMonth()*31;
    return (t*9301 + 49297) % 233280 % n;
  };
  const picks = new Set();
  while(picks.size<2) picks.add(rand(pool.length));
  for(const idx of picks){
    const p = pool[idx];
    const q = {
      id: 'daily_'+seed+'_'+idx,
      title: p.title,
      type: p.type,
      minutes: p.minutes||0,
      target: p.target||1,
      checklist: p.checklist||[],
      multi: p.multi||[],
      repeat:'Daily',
      difficulty: p.difficulty||'Normal',
      xp: xpFor(p.difficulty||'Normal'),
      gold: Math.round(xpFor(p.difficulty||'Normal')*0.8),
      attributes: p.attributes||[],
      createdAt: Date.now(),
      countdown: timeToMidnight(),
      status:'not_started',
      generatedDaily:true
    };
    state.quests.push(q);
  }
  state.lastDailySeed = seed;
  save();
}

function renderQuests(){
  ensureDailyQuests();
  const list = $('#questsList');
  list.innerHTML='';
  const filter = $('.chip-row .chip.active')?.dataset.filter || 'all';

  const qs = state.quests.filter(q=>{
    if(filter==='all') return true;
    if(filter==='daily') return q.repeat==='Daily';
    if(filter==='penalty') return q.penalty;
    if(filter==='active') return q.status==='active';
    if(filter==='done') return q.status==='done';
    return true;
  });
  qs.forEach(q=> list.appendChild(renderQuestCard(q)) );
}

function renderQuestCard(q){
  const card = document.createElement('div');
  card.className = 'card quest-card';

  // header
  const head = document.createElement('div');
  head.className='quest-head';
  const title = document.createElement('div');
  title.innerHTML = `<div class="quest-title">${q.title}</div>`;
  const right = document.createElement('div');
  right.innerHTML = `<div style="text-align:right;font-weight:800">+${q.xp||xpFor(q.difficulty||'Normal')} XP • <span class="coin">🪙</span> ${q.gold||Math.round((q.xp||10)*0.8)}</div>`;
  head.append(title, right);

  // tags
  const tags = document.createElement('div');
  tags.className='quest-tags';
  if(q.repeat==='Daily'){ const c = btnChip('Daily'); c.classList.add('active'); tags.append(c); }
  const diff = btnChip(q.difficulty||'Normal'); tags.append(diff);
  if(q.attributes?.length){
    const c = btnChip(q.attributes[0]); tags.append(c);
  }

  // countdown
  const cd = document.createElement('div');
  cd.className='countdown';
  cd.textContent = 'resets in ' + formatCountdown(q.countdown||timeToMidnight());

  // body per type
  const body = document.createElement('div');
  if(q.type==='multi'){
    q.multi = q.multi || [];
    q.multi.forEach((it, idx)=>{
      const row = document.createElement('div');
      row.className='row';
      const progress = `${it.value||0} / ${it.target}`;
      row.innerHTML = `<div style="min-width:120px">${it.label}</div>
        <div class="chip-row">
          ${btn('-1','sm ghost').outerHTML}
          ${btn('+1','sm ghost').outerHTML}
          ${btn('Finish','sm primary').outerHTML}
        </div>
        <div style="margin-left:auto;opacity:.8">${progress}</div>`;
      // wire buttons
      const [minus, plus, finish] = row.querySelectorAll('button');
      minus.addEventListener('click', ()=>{ it.value=Math.max(0,(it.value||0)-1); update(); });
      plus.addEventListener('click', ()=>{ it.value=Math.min(it.target,(it.value||0)+1); update(); });
      finish.addEventListener('click', ()=>{ it.value=it.target; update(); });
      body.append(row);
    });
  } else if(q.type==='count'){
    q.value = q.value||0;
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `<div>${q.title.includes('Count')?'Count':''}</div>
      <div class="chip-row">
        ${btn('-1','sm ghost').outerHTML}
        ${btn('+1','sm ghost').outerHTML}
        ${btn('Finish','sm primary').outerHTML}
      </div>
      <div style="margin-left:auto;opacity:.8">${q.value} / ${q.target||1}</div>`;
    const [minus, plus, finish] = row.querySelectorAll('button');
    minus.addEventListener('click', ()=>{ q.value=Math.max(0,q.value-1); update(); });
    plus.addEventListener('click', ()=>{ q.value=Math.min(q.target||1,q.value+1); update(); });
    finish.addEventListener('click', ()=>{ q.value=q.target||1; update(); });
    body.append(row);
  } else if(q.type==='timer'){
    q.elapsed = q.elapsed||0; q.minutes=q.minutes||25;
    const row = document.createElement('div');
    row.className='row';
    const time = document.createElement('div');
    time.style.minWidth='100px';
    function fmt(ms){ const s=Math.floor(ms/1000); const mm=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${mm}:${ss}`;}
    time.textContent = fmt(q.elapsed*1000);
    const start = btn('Start','sm primary'), pause=btn('Pause','sm'), resume=btn('Resume','sm'), done=btn('Done','sm good');
    let timer=null;
    start.addEventListener('click', ()=>{ if(timer) return; q.status='active'; timer=setInterval(()=>{ q.elapsed++; time.textContent=fmt(q.elapsed*1000)},1000); update(); });
    pause.addEventListener('click', ()=>{ clearInterval(timer); timer=null; update(); });
    resume.addEventListener('click', ()=>{ if(!timer){ timer=setInterval(()=>{ q.elapsed++; time.textContent=fmt(q.elapsed*1000)},1000);} });
    done.addEventListener('click', ()=>{ clearInterval(timer); timer=null; completeQuest(q); });
    row.append(time,start,pause,resume,done);
    body.append(row);
  } else if(q.type==='checklist'){
    q.items = q.items || (q.checklist||[]).map(text=>({text,done:false}));
    const ul = document.createElement('ul');
    q.items.forEach((it,i)=>{
      const li = document.createElement('li'); li.style.listStyle='none';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=!!it.done;
      cb.addEventListener('change',()=>{ it.done=cb.checked; update(); });
      li.append(cb, document.createTextNode(' '+it.text));
      ul.append(li);
    });
    body.append(ul);
  }

  // actions
  const actions = document.createElement('div');
  actions.className='row';
  const done = btn('Done','good'), resetB = btn('Reset','warn'), edit = btn('Edit','ghost'), del = btn('Delete','danger');
  done.addEventListener('click', ()=> completeQuest(q));
  resetB.addEventListener('click', ()=>{ resetQuest(q); });
  edit.addEventListener('click', ()=> editQuest(q));
  del.addEventListener('click', ()=> deleteQuest(q));
  actions.append(done, resetB, edit, del);

  card.append(head, tags, cd, body, actions);

  // live countdown
  const int = setInterval(()=>{
    const remain = timeToMidnight();
    cd.textContent='resets in '+formatCountdown(remain);
    if(remain<=0){ clearInterval(int); dailyReset(); }
  },1000);
  return card;
}

function btn(label, classes=''){
  const b=document.createElement('button');
  b.className='btn '+classes;
  b.textContent=label;
  return b;
}
function btnChip(label){
  const b=document.createElement('button');
  b.className='chip'; b.textContent=label;
  return b;
}

function completeQuest(q){
  q.status='done';
  // reward
  const xp = q.xp || xpFor(q.difficulty||'Normal');
  state.xp += xp;
  const gold = q.gold ?? Math.round(xp*0.8);
  state.gold += gold;
  // attribute points automatically from quest attributes
  (q.attributes||[]).forEach(k => state.attributes[k]=(state.attributes[k]||0)+1);
  // titles
  if(q.id==='strength_training'){ grantTitle('iron'); }
  if(totalCompleted()>=1){ grantTitle('starter'); }
  // remove from list on complete
  state.quests = state.quests.filter(x=>x!==q);
  update();
}

function resetQuest(q){
  if(q.type==='multi'){ q.multi.forEach(i=>i.value=0); }
  if(q.type==='count'){ q.value=0; }
  if(q.type==='timer'){ q.elapsed=0; }
  if(q.type==='checklist'){ q.items?.forEach(i=>i.done=false); }
  q.status='not_started';
  update();
}

function deleteQuest(q){
  state.quests = state.quests.filter(x=>x!==q);
  update();
}

function totalCompleted(){
  // we'll infer from achievements length + not precise; store count
  state._completed = (state._completed||0)+1;
  return state._completed;
}

function dailyReset(){
  // clear generated dailies and recreate
  state.lastDailySeed = null;
  state.quests = state.quests.filter(q=>q.fixedDaily); // keep strength training
  ensureDailyQuests();
  update();
}

function editQuest(q){
  const dlg = $('#questEditor');
  $('#qeTitle').textContent = q ? 'Edit Quest':'New Quest';
  $('#qTitle').value = q?.title || '';
  $('#qDesc').value = q?.desc || '';
  $('#qType').value = q?.type || 'timer';
  $('#qMinutes').value = q?.minutes || 25;
  $('#qTarget').value = q?.target || 1;
  $('#qChecklist').value = (q?.items||q?.checklist||[]).map(i=> typeof i==='string'?i: i.text).join(', ');
  $('#qMulti').value = (q?.multi||[]).map(i=>`${i.label}:${i.target}`).join(', ');
  // attributes
  $$('#questEditor .attrs input').forEach(cb=> cb.checked = q?.attributes?.includes(cb.value) || false );
  $('#qDifficulty').value = q?.difficulty || 'Normal';
  $('#qRepeat').value = q?.repeat || 'None';
  $('#qXP').value = q?.xp ?? xpFor(q?.difficulty || 'Normal');
  $('#qGold').value = q?.gold ?? Math.round(($('#qXP').value)*0.8);
  dlg.showModal();
  $('#saveQuestBtn').onclick = (ev)=>{
    ev.preventDefault();
    const attrs = $$('#questEditor .attrs input').filter(cb=>cb.checked).map(cb=>cb.value);
    const newQ = q || { id:'q_'+Math.random().toString(36).slice(2), createdAt: Date.now() };
    Object.assign(newQ, {
      title: $('#qTitle').value.trim()||'Untitled',
      desc: $('#qDesc').value.trim(),
      type: $('#qType').value,
      minutes: +$('#qMinutes').value || 25,
      target: +$('#qTarget').value || 1,
      items: ($('#qChecklist').value||'').split(',').map(s=>s.trim()).filter(Boolean).map(t=>({text:t,done:false})),
      checklist: ($('#qChecklist').value||'').split(',').map(s=>s.trim()).filter(Boolean),
      multi: ($('#qMulti').value||'').split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{
        const [label,target] = pair.split(':'); return {label:label.trim(), target: +target||1, value:0};
      }),
      repeat: $('#qRepeat').value,
      difficulty: $('#qDifficulty').value,
      xp: +$('#qXP').value,
      gold: +$('#qGold').value,
      attributes: attrs,
      countdown: timeToMidnight(),
      status: 'not_started'
    });
    if(!q){ state.quests.push(newQ); }
    $('#questEditor').close();
    update();
  };
}

function setupQuestUI(){
  $('#newQuestBtn').addEventListener('click', ()=> editQuest(null));
  $$('#questFilters .chip').forEach(ch=>{
    ch.addEventListener('click', ()=>{
      $$('#questFilters .chip').forEach(x=>x.classList.remove('active'));
      ch.classList.add('active');
      renderQuests();
    });
  });
}

// ====== Journey & Titles ======
function grantTitle(id){
  const t = state.titles.find(t=>t.id===id);
  if(t && !t.owned){ t.owned = true; addAchievement(`Unlocked title: ${t.name}`); }
}
function addAchievement(text){
  state.achievements.unshift({text, ts: Date.now()});
}

function renderJourney(){
  $('#journeyGold').textContent = state.gold;
  $('#xpBar').max = state.nextLevelXP;
  $('#xpBar').value = state.xp;
  $('#xpBarLabel').textContent = `${state.xp}/${state.nextLevelXP} XP`;
  $('#completedTotal').textContent = state._completed || 0;
  // titles
  const earned = $('#earnedTitles'); earned.innerHTML='';
  state.titles.filter(t=>t.owned).forEach(t=>{
    const c = document.createElement('button'); c.className='chip'; c.textContent=t.name; earned.appendChild(c);
  });
  $('#equippedTitle').textContent = 'Equipped title: ' + (state.equippedTitle ? state.titles.find(t=>t.id===state.equippedTitle)?.name : 'None');
  const list = $('#titleOptions'); list.innerHTML='';
  state.titles.forEach(t=>{
    const row = document.createElement('label'); row.className='row';
    row.innerHTML = `<input type="radio" name="t" value="${t.id}" ${state.equippedTitle===t.id?'checked':''} ${!t.owned?'disabled':''}/> <div>${t.name}</div> <div class="subtle" style="margin-left:auto">${t.requirement}${t.owned?' — owned':''}</div>`;
    list.append(row);
  });
}

function setupTitles(){
  $('#chooseTitleBtn').addEventListener('click', ()=> $('#titlePicker').showModal());
  $('#equipTitle').addEventListener('click', (e)=>{
    e.preventDefault();
    const val = $('#titleOptions input[name="t"]:checked')?.value;
    if(val){ state.equippedTitle=val; }
    $('#titlePicker').close();
    update();
  });
}

// ====== Character ======
function renderCharacter(){
  $('#goldAmount').textContent = state.gold;
  $('#unspentAP').textContent = state.unspentAP;
  for(const k of Object.keys(state.attributes)){
    $('#attr-'+k).textContent = state.attributes[k];
  }
  drawRadar();
}

// ====== Store ======
function renderStore(){
  const list = $('#storeList'); list.innerHTML='';
  state.store.forEach(item=>{
    const c = document.createElement('div'); c.className='card row';
    c.innerHTML = `<div><strong>${item.title}</strong> — <span class="coin">🪙</span> ${item.cost}</div>`;
    const buy = btn('Buy','good sm'), del = btn('Delete','danger sm');
    buy.addEventListener('click', ()=>{
      if(state.gold>=item.cost){ state.gold-=item.cost; addAchievement(`Bought ${item.title}`); update(); }
      else alert('Not enough gold!');
    });
    del.addEventListener('click', ()=>{
      state.store = state.store.filter(x=>x!==item); update();
    });
    c.append(buy, del);
    list.append(c);
  });
}

function setupStore(){
  $('#saveReward').addEventListener('click', ()=>{
    const title = $('#rTitle').value.trim(); const cost = +$('#rCost').value||0;
    if(!title) return;
    state.store.push({id:'r_'+Math.random().toString(36).slice(2), title, cost});
    $('#rTitle').value=''; $('#rCost').value=50;
    update();
  });
  $('#cancelReward').addEventListener('click', ()=>{ $('#rTitle').value=''; });
}

// ====== Focus Timer ======
let focusTimer=null, focusRemain=0;
function setupFocus(){
  const minutesInput = $('#focusMinutes');
  const view = $('#focusTime');
  const fmt = (s)=>{const m=String(Math.floor(s/60)).padStart(2,'0');const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`;}
  function draw(){ view.textContent = fmt(focusRemain); }
  function stop(){ if(focusTimer){ clearInterval(focusTimer); focusTimer=null; } }
  $('#focusStart').addEventListener('click', ()=>{
    stop(); focusRemain = Math.max(1, +minutesInput.value||25)*60; draw();
    focusTimer = setInterval(()=>{ focusRemain--; draw(); if(focusRemain<=0){ stop(); } }, 1000);
  });
  $('#focusPause').addEventListener('click', stop);
  $('#focusResume').addEventListener('click', ()=>{ if(!focusTimer && focusRemain>0){ focusTimer=setInterval(()=>{focusRemain--; draw(); if(focusRemain<=0) clearInterval(focusTimer);},1000);} });
  $('#focusCancel').addEventListener('click', ()=>{ stop(); focusRemain=0; draw(); });
  focusRemain = Math.max(1, +minutesInput.value||25)*60; draw();
}

// ====== App Init ======
function update(){
  save();
  renderQuests();
  renderJourney();
  renderCharacter();
  renderStore();
}
function init(){
  load();
  setupTabs();
  setupQuestUI();
  setupTitles();
  setupStore();
  setupFocus();
  ensureDailyQuests();
  update();

  // global countdown tick (keeps labels fresh)
  setInterval(()=>{
    $$('.countdown').forEach(el=> el.textContent='resets in '+formatCountdown(timeToMidnight()) );
  }, 1000);
}
document.addEventListener('DOMContentLoaded', init);

// ====== PWA SW ======
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js');
}
