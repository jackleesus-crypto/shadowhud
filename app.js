/* ShadowHUD v13 - compact single-file logic split from HTML */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---------------------- Persistence ----------------------
const store = {
  load() {
    const raw = localStorage.getItem('shud_v13');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  save(data) {
    localStorage.setItem('shud_v13', JSON.stringify(data));
  }
};

// Default state
const defaultState = () => ({
  version: 13,
  gold: 0,
  level: 1,
  xp: 0,
  attributes: { Physical:0, Psyche:0, Intellect:0, Social:0, Spiritual:0, Financial:0 },
  titles: {
    unlocked: [],
    equipped: null
  },
  rewards: [],
  quests: [],
  lastDailyDate: null,
  stats: { completed:0, streak:0, lastCompletionDate:null }
});

let state = store.load() || defaultState();

// ---------------------- Helpers ----------------------
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const fmt = n => new Intl.NumberFormat().format(n);
const rankForLevel = lvl => (lvl<16?'E':lvl<31?'D':lvl<46?'C':lvl<61?'B':lvl<76?'A':'S');
const xpToNext = lvl => Math.floor( 40 + Math.pow(lvl-1, 1.35) * 14 ); // ramping

function midnightCountdownText() {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate()+1);
  next.setHours(0,0,0,0);
  let s = Math.max(0, Math.floor((next - now)/1000));
  const h = Math.floor(s/3600); s-=h*3600;
  const m = Math.floor(s/60); s-=m*60;
  const p = t => String(t).padStart(2,'0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

function upsertTitle(id, name, desc, unlocked=false){
  const idx = state.titles?.list?.findIndex(t=>t.id===id) ?? -1;
  if(!state.titles.list) state.titles.list = [];
  if(idx===-1) state.titles.list.push({id, name, desc, unlocked});
  else Object.assign(state.titles.list[idx], {name,desc,unlocked: state.titles.list[idx].unlocked || unlocked});
}

function ensureBaseTitles(){
  upsertTitle('starter','The One Who Started','Complete 1 quest.', false);
  upsertTitle('streak3','The Consistent','3-day completion streak.', false);
  upsertTitle('lvl10','The Rising','Reach level 10.', false);
}

// ---------------------- Daily quest generation ----------------------
const DAILY_POOL = [
  {title:'Meditate 10 min', type:'timer', duration:10, diff:'Easy', attrs:['Spiritual'], xp:14, gold:8},
  {title:'Read 20 pages', type:'counter', target:20, diff:'Normal', attrs:['Intellect'], xp:22, gold:12},
  {title:'Walk 5,000 steps', type:'counter', target:5000, diff:'Normal', attrs:['Physical'], xp:24, gold:12},
  {title:'Call or text a loved one', type:'counter', target:1, diff:'Easy', attrs:['Social'], xp:10, gold:10},
  {title:'Deep clean a room', type:'checklist', checklist:['Declutter','Dust','Vacuum'], diff:'Hard', attrs:['Social'], xp:60, gold:20},
  {title:'Budget review', type:'checklist', checklist:['Track expenses','Categorize','Adjust'], diff:'Normal', attrs:['Financial'], xp:28, gold:14},
  {title:'Journal (3 prompts)', type:'checklist', checklist:['Gratitude','What went well?','One improvement'], diff:'Easy', attrs:['Psyche'], xp:16, gold:8},
  {title:'Stretch 15 min', type:'timer', duration:15, diff:'Easy', attrs:['Physical'], xp:16, gold:8}
];

function newId(){ return Math.random().toString(36).slice(2,10); }

function createQuestFromTemplate(t){
  const q = {
    id: newId(),
    title: t.title,
    desc: t.desc||'',
    type: t.type||'counter',
    difficulty: t.diff||'Normal',
    attributes: t.attrs||[],
    xp: t.xp||20,
    gold: t.gold||10,
    repeat: 'daily',
    daily: true,
    createdAt: Date.now(),
    status: 'new',
    progress: 0,
    target: t.target||1,
    checklist: t.checklist||[],
    checklistDone: (t.checklist||[]).map(_=>false),
    duration: (t.duration||25)*60, // seconds
    elapsed: 0,
    multi: t.multi||null,
    deadline: null
  };
  if (t.type==='multi' && t.multi){
    q.multiProgress = t.multi.map(it=>0);
  }
  return q;
}

function generateDailies(){
  // fixed Strength Training every day
  const strength = {
    title:'Strength Training',
    type:'multi',
    diff:'Elite',
    attrs:['Physical'],
    xp:120,
    gold:40,
    multi:[
      {label:'Pushups', target:100},
      {label:'Sit-ups', target:100},
      {label:'Squats', target:100},
      {label:'Run (miles)', target:1}
    ]
  };
  const today = new Date(); today.setHours(0,0,0,0);
  const last = state.lastDailyDate? new Date(state.lastDailyDate): null;
  const changedDay = !last || last.getTime() !== today.getTime();

  if(!changedDay) return; // already generated

  // penalties for unfinished previous daily
  const unfinished = (state.quests||[]).filter(q=>q.daily && q.status!=='done');
  unfinished.forEach(q=>{
    state.quests.push({
      id:newId(),
      title:`Penalty — 50 pushups`,
      type:'counter',
      target:50, progress:0,
      daily:false, repeat:'none',
      difficulty:'Hard',
      attributes:['Physical'],
      xp:30, gold:12,
      status:'new',
      createdAt: Date.now()
    });
  });

  // wipe old dailies
  state.quests = state.quests.filter(q=>!q.daily);

  // add strength
  const sq = createQuestFromTemplate(strength);
  sq.countdown = true;
  state.quests.push(sq);

  // pick 3 random distinct from pool
  const picks = [];
  const poolIdx = [...DAILY_POOL.keys()];
  while(picks.length<3 && poolIdx.length){
    const i = poolIdx.splice(Math.floor(Math.random()*poolIdx.length),1)[0];
    picks.push(DAILY_POOL[i]);
  }
  picks.forEach(t=>{
    const q = createQuestFromTemplate(t);
    q.countdown = true;
    state.quests.push(q);
  });

  state.lastDailyDate = today.getTime();
}

// ---------------------- Rendering ----------------------
let currentTab = 'quests';

function setTab(tab){
  currentTab = tab;
  $$('.tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  render();
}

function renderTop(){
  $('#goldDisplay').textContent = `💰 ${fmt(state.gold)}`;
}

function makeQuestCard(q){
  const card = document.createElement('div');
  card.className = 'card qcard';
  const dailyBadge = q.daily? `<span class="badge">Daily</span>`:'';
  const attrs = (q.attributes||[]).map(a=>`<span class="badge">${a}</span>`).join(' ');
  const diff = `<span class="badge">${q.difficulty}</span>`;
  const rewards = `<span class="badge gold">+${q.xp} XP</span> <span class="badge gold">💰 ${q.gold}</span>`;
  const countdown = q.countdown? `<span class="badge timer" data-countdown="${q.id}"></span>`:'';

  card.innerHTML = `
    <div class="row between">
      <div><strong>${q.title}</strong></div>
      <div class="qmeta">${rewards}</div>
    </div>
    <div class="qmeta">${dailyBadge} ${diff} ${attrs} ${countdown}</div>
    <div class="qrow" id="qr_${q.id}"></div>
    <div class="qrow">
      ${q.type!=='timer'?'<button class="ghost" data-act="done">Done</button>':''}
      <button class="ghost" data-act="reset">Reset</button>
      ${q.type==='timer'
        ? '<button class="primary" data-act="start">Start</button><button class="ghost" data-act="pause">Pause</button><button class="ghost" data-act="resume">Resume</button><button class="ghost" data-act="done">Done</button>'
        : ''
      }
      ${q.type==='counter'
        ? '<div class="counter"><button class="ghost" data-act="dec">−1</button><div>'+q.progress+'/'+q.target+'</div><button class="ghost" data-act="inc">+1</button></div>'
        : ''
      }
    </div>
  `;

  // Per-type controls
  const row = card.querySelector('#qr_'+q.id);
  if(q.type==='checklist'){
    const list = document.createElement('div'); list.className='itemlist';
    q.checklist.forEach((t,i)=>{
      const it = document.createElement('label'); it.className='item';
      it.innerHTML = `<input type="checkbox" ${q.checklistDone[i]?'checked':''} data-idx="${i}"> <span>${t}</span>`;
      list.appendChild(it);
    });
    row.appendChild(list);
  }
  if(q.type==='multi'){
    const list = document.createElement('div'); list.className='itemlist';
    q.multi.forEach((m,i)=>{
      const prog = q.multiProgress? q.multiProgress[i]:0;
      const el = document.createElement('div'); el.className='counter';
      el.innerHTML = `
        <div style="width:90px">${m.label}</div>
        <button class="ghost" data-multi-dec="${i}">−1</button>
        <div>${prog} / ${m.target}</div>
        <button class="ghost" data-multi-inc="${i}">+1</button>
        <button class="ghost" data-multi-fin="${i}">Finish</button>
      `;
      list.appendChild(el);
    });
    row.appendChild(list);
  }
  if(q.type==='timer'){
    const t = document.createElement('div'); t.className='big timer';
    const left = Math.max(0, q.duration - (q.elapsed||0));
    t.id = 't_'+q.id;
    t.textContent = fmtTime(left);
    row.appendChild(t);
  }

  card.addEventListener('click', (e)=>{
    const a = e.target.dataset.act;
    if(a) handleQuestAction(q, a);
    if(e.target.dataset.idx!=null){
      const i = Number(e.target.dataset.idx);
      q.checklistDone[i] = !q.checklistDone[i];
      store.save(state); render();
    }
    if(e.target.dataset.multiInc!=null || e.target.dataset.multiDec!=null || e.target.dataset.multiFin!=null){
      const i = Number(e.target.dataset.multiInc ?? e.target.dataset.multiDec ?? e.target.dataset.multiFin);
      if(!q.multiProgress) q.multiProgress = q.multi.map(_=>0);
      if(e.target.dataset.multiInc!=null) q.multiProgress[i] = clamp(q.multiProgress[i]+1,0,q.multi[i].target);
      if(e.target.dataset.multiDec!=null) q.multiProgress[i] = clamp(q.multiProgress[i]-1,0,q.multi[i].target);
      if(e.target.dataset.multiFin!=null) q.multiProgress[i] = q.multi[i].target;
      store.save(state); render();
    }
  });
  return card;
}

function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec/60); const s = sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

let tickTimer=null;
function ensureTicker(){
  if(tickTimer) return;
  tickTimer = setInterval(()=>{
    // update countdown badges and running timers
    $$('.timer[data-countdown]').forEach(el=>{
      el.textContent = midnightCountdownText();
    });
    state.quests.forEach(q=>{
      if(q.type==='timer' && q.status==='running'){
        q.elapsed = (q.elapsed||0) + 1;
        if(q.elapsed >= q.duration){
          completeQuest(q);
        }
      }
    });
    if(currentTab==='focus' && focusState.running){
      focusState.elapsed += 1;
      updateFocusDisplay();
    }
    store.save(state);
    if(currentTab==='quests') renderQuests(); // cheap partial update
  },1000);
}

function renderQuests(){
  const list = $('#questList'); if(!list) return;
  const filter = $('.chip.active')?.dataset.filter || 'all';

  list.innerHTML = '';
  const arr = state.quests.filter(q=>{
    if(filter==='all') return true;
    if(filter==='daily') return q.daily;
    if(filter==='penalty') return q.title?.toLowerCase().startsWith('penalty');
    if(filter==='active') return q.status==='running' || q.type!=='timer' && q.progress>0;
    if(filter==='done') return q.status==='done';
    if(filter==='expired') return q.deadline && Date.now()>q.deadline && q.status!=='done';
    return true;
  });

  if(arr.length===0){
    list.innerHTML = '<div class="muted pad">No quests yet. Tap ＋ to add.</div>';
  } else {
    arr.forEach(q=>list.appendChild(makeQuestCard(q)));
  }
}

function renderJourney(){
  $('#jrLevel').textContent = `Level ${state.level} · ${rankForLevel(state.level)}`;
  const need = xpToNext(state.level);
  $('#jrXP').textContent = `${state.xp}/${need} XP`;
  $('#jrBar').style.width = `${Math.min(100, state.xp/need*100)}%`;
  $('#jrCompleted').textContent = state.stats.completed;
  $('#jrStreak').textContent = state.stats.streak;
  $('#jrGold').textContent = state.gold;

  // titles
  ensureBaseTitles();
  const holder = $('#titleList'); holder.innerHTML='';
  (state.titles.list||[]).forEach(t=>{
    const div = document.createElement('div');
    div.className='row between';
    div.style.margin='6px 0';
    div.innerHTML = `<div>${t.name} <span class="small muted">— ${t.desc}</span></div>
      <div>${t.unlocked?'<span class="badge gold">Unlocked</span>':'<span class="badge">Locked</span>'}
      <button class="ghost" data-equip="${t.id}" ${t.unlocked?'':'disabled'}>${state.titles.equipped===t.id?'Equipped':'Equip'}</button></div>`;
    div.addEventListener('click', (e)=>{
      if(e.target.dataset.equip){
        state.titles.equipped = e.target.dataset.equip;
        store.save(state); render();
      }
    });
    holder.appendChild(div);
  });

  // achievements placeholder
  $('#achievements').innerHTML = '<li class="muted">More achievements coming soon.</li>';
}

function renderCharacter(){
  $('#chLevel').textContent = `Level ${state.level}`;
  $('#chRank').textContent = `Rank ${rankForLevel(state.level)}`;
  $('.hero .rank').textContent = rankForLevel(state.level)[0];
  const need = xpToNext(state.level);
  $('#chXP').textContent = `${state.xp}/${need} XP`;
  $('#chBar').style.width = `${Math.min(100, state.xp/need*100)}%`;

  // attributes numbers
  const A = state.attributes;
  $('#aPhysical').textContent = A.Physical|0;
  $('#aPsyche').textContent = A.Psyche|0;
  $('#aIntellect').textContent = A.Intellect|0;
  $('#aSocial').textContent = A.Social|0;
  $('#aSpiritual').textContent = A.Spiritual|0;
  $('#aFinancial').textContent = A.Financial|0;

  drawRadar([A.Financial,A.Physical,A.Psyche,A.Intellect,A.Social,A.Spiritual]);
}

function renderStore(){
  $('#storeGold').textContent = fmt(state.gold);
  const wrap = $('#rewards'); wrap.innerHTML='';
  state.rewards.forEach((r,idx)=>{
    const card = document.createElement('div');
    card.className='card pad';
    card.innerHTML = `<div class="row between"><strong>${r.title}</strong><strong class="gold">💰 ${r.cost}</strong></div>
      <div class="small muted">${r.desc||''}</div>
      <div class="row end"><button class="primary" data-buy="${idx}">Buy</button> <button class="ghost" data-del="${idx}">Delete</button></div>`;
    card.addEventListener('click',(e)=>{
      if(e.target.dataset.buy!=null){
        const i = Number(e.target.dataset.buy);
        if(state.gold >= state.rewards[i].cost){
          state.gold -= state.rewards[i].cost;
          store.save(state); render();
          alert('Enjoy your reward!');
        }else alert('Not enough gold.');
      }
      if(e.target.dataset.del!=null){
        state.rewards.splice(Number(e.target.dataset.del),1);
        store.save(state); render();
      }
    });
    wrap.appendChild(card);
  });
}

function render(){
  renderTop();
  const view = $('#view');
  const tpl = $('#'+currentTab+'_tpl').content.cloneNode(true);
  view.innerHTML='';
  view.appendChild(tpl);
  if(currentTab==='quests'){
    // filter chips
    $$('.chip').forEach(c=>c.addEventListener('click',()=>{
      $$('.chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active'); renderQuests();
    }));
    renderQuests();
  }
  if(currentTab==='journey') renderJourney();
  if(currentTab==='character') renderCharacter();
  if(currentTab==='store'){
    renderStore();
    $('#rSave').onclick = ()=>{
      const t = $('#rTitle').value.trim(); if(!t) return;
      state.rewards.push({title:t, desc:$('#rDesc').value.trim(), cost:Number($('#rCost').value)||0});
      store.save(state); render();
    };
  }
  if(currentTab==='focus'){
    wireFocus();
  }
}

function addXP(amount){
  state.xp += amount;
  while(state.xp >= xpToNext(state.level) && state.level<100){
    state.xp -= xpToNext(state.level);
    state.level++;
  }
}

function completeQuest(q){
  if(q.status==='done') return;
  q.status='done';
  // attributes (multi attribute supported via attributes[])
  (q.attributes||[]).forEach(a=>{
    if(!state.attributes[a]) state.attributes[a]=0;
    state.attributes[a] += 1;
  });
  addXP(q.xp||0);
  state.gold += q.gold||0;

  // stats/streak
  const todayKey = new Date().toDateString();
  const lastKey = state.stats.lastCompletionDate;
  state.stats.completed += 1;
  if(lastKey && (new Date(lastKey)).toDateString() === (new Date(Date.now()-86400000)).toDateString()) {
    state.stats.streak += 1;
  } else if(!lastKey) {
    state.stats.streak = 1;
  } else if((new Date(lastKey)).toDateString() === todayKey){
    // same day, keep streak as-is
  } else {
    state.stats.streak = 1;
  }
  state.stats.lastCompletionDate = Date.now();

  // unlock titles
  ensureBaseTitles();
  if(!state.titles.list.find(t=>t.id==='starter')?.unlocked){
    const t = state.titles.list.find(t=>t.id==='starter'); if(t) t.unlocked = true;
  }
  if(state.stats.streak>=3){
    const t = state.titles.list.find(t=>t.id==='streak3'); if(t) t.unlocked = true;
  }
  if(state.level>=10){
    const t = state.titles.list.find(t=>t.id==='lvl10'); if(t) t.unlocked = true;
  }

  store.save(state); render();
}

function handleQuestAction(q, act){
  if(act==='done'){ completeQuest(q); }
  if(act==='reset'){
    if(q.type==='counter'){ q.progress=0; }
    if(q.type==='timer'){ q.elapsed=0; q.status='new'; }
    if(q.type==='checklist'){ q.checklistDone = q.checklist.map(_=>false); }
    if(q.type==='multi'){ q.multiProgress = q.multi.map(_=>0); }
    store.save(state); render();
  }
  if(q.type==='timer'){
    if(act==='start'){ q.status='running'; }
    if(act==='pause'){ q.status='paused'; }
    if(act==='resume'){ q.status='running'; }
    store.save(state); render();
  }
  if(q.type==='counter'){
    if(act==='inc'){ q.progress = clamp((q.progress||0)+1, 0, q.target||1); if(q.progress>=q.target) completeQuest(q); }
    if(act==='dec'){ q.progress = clamp((q.progress||0)-1, 0, q.target||1); }
    store.save(state); render();
  }
}

// ---------------------- Radar Chart ----------------------
function drawRadar(values){
  const labels = ['Financial','Physical','Psyche','Intellect','Social','Spiritual'];
  const maxVal = Math.max(5, ...values, 10);
  const canvas = $('#radar'); if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const cx=w/2, cy=h/2+10, R=Math.min(w,h)*0.33;

  // grid
  ctx.strokeStyle='#2a2a33';
  ctx.lineWidth=1;
  const levels=5;
  for(let l=1;l<=levels;l++){
    const r = R*l/levels;
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a = -Math.PI/2 + i*(Math.PI*2/6);
      const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  // axes + labels
  ctx.fillStyle='#aeb4bb';
  ctx.font='16px system-ui';
  for(let i=0;i<6;i++){
    const a = -Math.PI/2 + i*(Math.PI*2/6);
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+R*Math.cos(a), cy+R*Math.sin(a)); ctx.stroke();
    const lx = cx + (R+28)*Math.cos(a), ly = cy + (R+28)*Math.sin(a);
    const text = labels[i];
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, lx - tw/2, ly+6);
  }
  // polygon
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const v = clamp(values[i]/maxVal,0,1);
    const a = -Math.PI/2 + i*(Math.PI*2/6);
    const x = cx + (R*v)*Math.cos(a), y = cy + (R*v)*Math.sin(a);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle='rgba(99,102,241,0.25)';
  ctx.strokeStyle='rgba(99,102,241,0.9)';
  ctx.lineWidth=2;
  ctx.fill(); ctx.stroke();
}

// ---------------------- Focus Timer ----------------------
const focusState = { running:false, minutes:25, elapsed:0 };
function updateFocusDisplay(){
  const total = (focusState.minutes||25)*60;
  $('#fTime').textContent = fmtTime(total - focusState.elapsed);
}
function wireFocus(){
  $('#fMinutes').value = focusState.minutes;
  updateFocusDisplay();
  $('#fStart').onclick = ()=>{ focusState.minutes = Number($('#fMinutes').value)||25; focusState.elapsed=0; focusState.running=true; };
  $('#fPause').onclick = ()=>{ focusState.running=false; };
  $('#fResume').onclick = ()=>{ focusState.running=true; };
  $('#fCancel').onclick = ()=>{ focusState.running=false; focusState.elapsed=0; updateFocusDisplay(); };
}

// ---------------------- New/Edit Quest modal (basic) ----------------------
$('#fab').addEventListener('click', ()=>{
  if(currentTab!=='quests'){ setTab('quests'); return; }
  const dlg = $('#questEdit'); $('#qeTitle').textContent = 'New Quest';
  $('#qTitle').value=''; $('#qDesc').value=''; $('#qAttrs').value='';
  $('#qType').value='counter'; $('#qDuration').value=25; $('#qTarget').value=10;
  $('#qChecklist').value=''; $('#qMulti').value=''; $('#qDiff').value='Normal';
  $('#qDeadline').value=''; $('#qRepeat').value='none'; $('#qXP').value=25;
  $('#qReminders').value=''; $('#qBefore').value=10;
  dlg.showModal();
  $('#qeSave').onclick = ()=>{
    const t = {
      id: newId(),
      title: $('#qTitle').value || 'Untitled',
      desc: $('#qDesc').value||'',
      type: $('#qType').value,
      difficulty: $('#qDiff').value,
      attributes: ($('#qAttrs').value||'').split(',').map(s=>s.trim()).filter(Boolean),
      xp: Number($('#qXP').value)||0,
      gold: Math.max(0, Math.round((Number($('#qXP').value)||0) * 0.4)),
      repeat: $('#qRepeat').value,
      daily: $('#qRepeat').value==='daily',
      createdAt: Date.now(),
      status: 'new'
    };
    if(t.type==='counter'){ t.target = Number($('#qTarget').value)||1; t.progress=0; }
    if(t.type==='timer'){ t.duration=(Number($('#qDuration').value)||25)*60; t.elapsed=0; }
    if(t.type==='checklist'){ t.checklist=($('#qChecklist').value||'').split(',').map(s=>s.trim()).filter(Boolean); t.checklistDone=t.checklist.map(_=>false); }
    if(t.type==='multi'){
      const items = ($('#qMulti').value||'').split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{
        const [label,tar] = pair.split(':').map(x=>x.trim());
        return {label, target:Number(tar)||1};
      });
      t.multi = items; t.multiProgress = items.map(_=>0);
    }
    const dl = $('#qDeadline').value; if(dl) t.deadline = new Date(dl).getTime();
    state.quests.push(t); store.save(state); dlg.close(); render();
  };
});

// ---------------------- Init ----------------------
function init(){
  ensureBaseTitles();
  generateDailies();
  setTab('quests');
  renderTop();
  ensureTicker();
  $('.tabbar').addEventListener('click', (e)=>{
    if(e.target.dataset.tab){ setTab(e.target.dataset.tab); }
  });
}
init();
