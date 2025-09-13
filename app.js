
// ShadowHUD v12.3 – core logic (localStorage-based)
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const screens = {
  character: $('#screen-character'),
  quest: $('#screen-quests'),
  journey: $('#screen-journey'),
  store: $('#screen-store'),
  focus: $('#screen-focus'),
};

// ---------- State ----------
const defaultState = () => ({
  version: '12.3',
  gold: 0,
  level: 1,
  xp: 0,
  xpToNext: 47,
  rank: 'E',
  attrs: { physical:0, psyche:0, intellect:0, social:0, spiritual:0, financial:0 },
  quests: [],
  rewards: [],
  journey: { completed:0, streak:0 },
  focus: { running:false, secs:0 },
  lastReset: null
});
let state = JSON.parse(localStorage.getItem('shadowhud_state')||'null') || defaultState();

// ---------- Helpers ----------
function save(){ localStorage.setItem('shadowhud_state', JSON.stringify(state)); }
function xpNeededForLevel(l){
  // smooth scaling
  return Math.round( 40 + Math.pow(l, 1.45) * 6 );
}
function rankForLevel(l){
  if (l<=15) return 'E';
  if (l<=30) return 'D';
  if (l<=45) return 'C';
  if (l<=60) return 'B';
  if (l<=80) return 'A';
  return 'S';
}
function midnightISO(d=new Date()){
  const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString();
}
function nowISO(){ return new Date().toISOString(); }
function fmtTime(secs){
  const m = Math.floor(secs/60).toString().padStart(2,'0');
  const s = Math.floor(secs%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

// ---------- Tabs ----------
$$('.tabs.bottom .tab').forEach(btn=>{
  btn.addEventListener('click', () => {
    $$('.tabs.bottom .tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    const key = btn.dataset.tab;
    screens[key].classList.add('active');
    if (key==='quest') renderQuests();
    if (key==='character') renderCharacter();
    if (key==='journey') renderJourney();
    if (key==='store') renderStore();
  });
});

// ---------- Render Character ----------
function renderCharacter(){
  $('#goldAmount').textContent = state.gold;
  $('#storeGold')?.textContent && ($('#storeGold').textContent = state.gold);
  $('#levelText').textContent = `Level ${state.level}`;
  $('#rankText').textContent = `Rank ${state.rank}`;
  $('#rankBadge').textContent = state.rank;
  $('#xpNow').textContent = state.xp;
  $('#xpNext').textContent = state.xpToNext;
  const fill = Math.max(0, Math.min(1, state.xp / state.xpToNext));
  $('#xpFill').style.width = `${fill*100}%`;

  for (const k of Object.keys(state.attrs)){
    $(`#attr-${k}`).textContent = state.attrs[k];
  }
  drawRadar();
}

// ---------- Radar ----------
function drawRadar(){
  const c = $('#radar'); if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  const labels = ['Financial','Physical','Psyche','Intellect','Social','Spiritual'];
  const vals = [state.attrs.financial, state.attrs.physical, state.attrs.psyche, state.attrs.intellect, state.attrs.social, state.attrs.spiritual];
  const max = Math.max(5, ...vals, 5);
  const cx = c.width/2, cy = c.height/2+10, r = Math.min(c.width, c.height)/2 - 25;
  ctx.strokeStyle = '#2a2a3d'; ctx.lineWidth = 1;

  // grid
  const rings = 5;
  for(let i=1;i<=rings;i++){
    ctx.beginPath();
    for(let j=0;j<6;j++){
      const ang = (Math.PI*2/6)*j - Math.PI/2;
      const rr = r*i/rings;
      const x = cx + rr*Math.cos(ang);
      const y = cy + rr*Math.sin(ang);
      j===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  // labels
  ctx.fillStyle = '#b6b7c2';
  ctx.font = '12px system-ui';
  labels.forEach((t,j)=>{
    const ang = (Math.PI*2/6)*j - Math.PI/2;
    const x = cx + (r+12)*Math.cos(ang);
    const y = cy + (r+12)*Math.sin(ang);
    ctx.fillText(t, x-ctx.measureText(t).width/2, y+4);
  });
  // polygon
  ctx.beginPath();
  vals.forEach((v,j)=>{
    const ang = (Math.PI*2/6)*j - Math.PI/2;
    const rr = r * (v/max);
    const x = cx + rr*Math.cos(ang);
    const y = cy + rr*Math.sin(ang);
    j===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(124,92,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = '#7c5cff'; ctx.stroke();
}

// ---------- Level / XP ----------
function addXP(xp){
  state.xp += xp;
  while(state.xp >= state.xpToNext && state.level < 100){
    state.xp -= state.xpToNext;
    state.level += 1;
    state.rank = rankForLevel(state.level);
    state.xpToNext = xpNeededForLevel(state.level);
  }
  save(); renderCharacter(); renderJourney();
}

// ---------- Quests ----------
function renderQuests(filter='all'){
  const list = $('#questList'); list.innerHTML='';
  const data = state.quests.filter(q => {
    if (filter==='daily') return q.repeat==='daily';
    if (filter==='penalty') return q.penalty===true;
    if (filter==='active') return q.status==='active';
    if (filter==='done') return q.status==='done';
    if (filter==='expired') return q.status==='expired';
    return true;
  });

  data.forEach(q => list.appendChild(questCard(q)) );
  // filter buttons
  $$('.filters .pill').forEach(b=>{
    b.onclick = () => {
      $$('.filters .pill').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      renderQuests(b.dataset.filter);
    };
  });
}
function questCard(q){
  const el = document.createElement('div');
  el.className = 'quest';
  const pillText = q.penalty?'Penalty': (q.repeat==='daily'?'Daily':'');
  const pill = pillText ? `<span class="pill small">${pillText}</span>` : '';
  const attrs = (q.attrs||[]).map(a=>a[0].toUpperCase()+a.slice(1)).join(' • ') || '—';
  const diff = q.difficulty || 'Normal';
  const rew = `+${q.xp||0} XP • 💰 ${q.gold||0}`;
  el.innerHTML = `
    ${pill}
    <div class="q-top">
      <div>
        <div class="q-title">${q.title}</div>
        <div class="q-meta">(${diff}${q.attrs?.length? ' • '+attrs:''})</div>
      </div>
      <div class="q-rewards">${rew}</div>
    </div>
    <div class="q-body">${questBodyHTML(q)}</div>
    <div class="q-actions">${questActionsHTML(q)}</div>
  `;
  wireQuestControls(el, q);
  return el;
}
function questBodyHTML(q){
  if (q.type==='timer') return `<div>Not started</div><div class="xpbar"><div style="width:${q.progress||0}%"></div></div>`;
  if (q.type==='counter') return `<div>Count ${q.count||0}/${q.target||10}</div>`;
  if (q.type==='checklist'){
    const items = (q.items||[]).map((it,i)=>`
      <label class="check-item">
        <input type="checkbox" data-q="${q.id}" data-idx="${i}" ${it.done?'checked':''}>
        <span>${it.label}</span>
      </label>`).join('');
    return `<div class="checklist">${items}</div>`;
  }
  if (q.type==='multi'){
    return (q.parts||[]).map((p,i)=>`
      <div class="multi-row">
        <div>${p.label}</div>
        <div>${p.value||0} / ${p.target}</div>
        <div class="multi-controls">
          <button data-action="dec" data-idx="${i}" data-q="${q.id}" class="btn">−1</button>
          <button data-action="inc" data-idx="${i}" data-q="${q.id}" class="btn">+1</button>
          <button data-action="fin" data-idx="${i}" data-q="${q.id}" class="btn">Finish</button>
        </div>
      </div>
    `).join('');
  }
  return '';
}
function questActionsHTML(q){
  const start = q.type==='timer' ? `<button class="btn" data-action="start" data-q="${q.id}">Start</button>` : '';
  const pause = q.type==='timer' ? `<button class="btn" data-action="pause" data-q="${q.id}">Pause</button>` : '';
  const resume= q.type==='timer' ? `<button class="btn" data-action="resume" data-q="${q.id}">Resume</button>` : '';
  const reset = `<button class="btn" data-action="reset" data-q="${q.id}">Reset</button>`;
  const done  = `<button class="btn primary" data-action="done" data-q="${q.id}">Done</button>`;
  const edit  = `<button class="btn" data-action="edit" data-q="${q.id}">Edit</button>`;
  const del   = `<button class="btn danger" data-action="delete" data-q="${q.id}">Delete</button>`;
  return [start,done,reset,pause,resume,edit,del].join(' ');
}
function wireQuestControls(el,q){
  // actions
  el.querySelectorAll('[data-action]').forEach(btn=>{
    btn.addEventListener('click', ev=>{
      const act=btn.dataset.action;
      if (act==='delete'){ state.quests = state.quests.filter(x=>x.id!==q.id); save(); renderQuests($('.filters .pill.active')?.dataset.filter||'all'); return; }
      if (act==='done'){ completeQuest(q); return; }
      if (act==='edit'){ openQuestDialog(q); return; }
      if (act==='reset'){ resetQuest(q); return; }
      if (q.type==='timer'){
        if (act==='start'){ q.status='active'; q._started=Date.now(); q._paused=0; }
        if (act==='pause'){ q._paused = Date.now(); }
        if (act==='resume'){ if(q._paused){ q._started += (Date.now()-q._paused); q._paused=0; } }
      }
      if (q.type==='checklist'){
        el.querySelectorAll('input[type="checkbox"]').forEach(chk=>{
          chk.onchange = () => { const idx=+chk.dataset.idx; q.items[idx].done = chk.checked; save(); };
        });
      }
      if (q.type==='multi'){
        el.querySelectorAll('.multi-controls button').forEach(b=>{
          b.onclick = () => {
            const i=+b.dataset.idx;
            if(b.dataset.action==='inc') q.parts[i].value = Math.min(q.parts[i].target,(q.parts[i].value||0)+1);
            if(b.dataset.action==='dec') q.parts[i].value = Math.max(0,(q.parts[i].value||0)-1);
            if(b.dataset.action==='fin') q.parts[i].value = q.parts[i].target;
            save(); renderQuests($('.filters .pill.active')?.dataset.filter||'all');
          };
        });
      }
      save(); renderQuests($('.filters .pill.active')?.dataset.filter||'all');
    });
  });
}
function resetQuest(q){
  if (q.type==='timer'){ q._started=0; q._paused=0; q.progress=0; q.status=''; }
  if (q.type==='counter'){ q.count=0; }
  if (q.type==='checklist'){ q.items.forEach(it=>it.done=false); }
  if (q.type==='multi'){ q.parts.forEach(p=>p.value=0); }
  save();
}
function completeQuest(q){
  // attribute gains
  if (q.attrAmts && q.attrs){
    const order = ['physical','psyche','intellect','social','spiritual','financial'];
    order.forEach((k,idx)=>{
      const amt = q.attrAmts[idx]||0;
      if (amt>0) state.attrs[k] += amt;
    });
  } else if (q.attrs){ // default +1 for each tagged attr
    q.attrs.forEach(a => state.attrs[a] = (state.attrs[a]||0) + 1);
  }
  // xp + gold
  addXP(q.xp||0);
  state.gold += (q.gold||0);
  state.journey.completed += 1;
  q.status = 'done';
  save();
  renderCharacter(); renderJourney(); renderStore(); renderQuests();
}

// ---------- Quest Dialog ----------
$('#addQuest').addEventListener('click', ()=>openQuestDialog());
function openQuestDialog(q=null){
  const dlg = $('#questDialog');
  $('#qdTitle').textContent = q? 'Edit Quest':'New Quest';
  $('#qTitle').value = q?.title || '';
  $('#qDesc').value = q?.desc || '';
  $('#qType').value = q?.type || 'timer';
  $('#qDuration').value = q?.duration || 25;
  $('#qTarget').value = q?.target || 10;
  $('#qChecklist').value = (q?.items||[]).map(i=>i.label).join(', ');
  $('#qMulti').value = (q?.parts||[]).map(p=>`${p.label}:${p.target}`).join(', ');
  // attributes
  const opts = $('#qAttrs').options; Array.from(opts).forEach(o=>o.selected=false);
  (q?.attrs||[]).forEach(a=>{ Array.from(opts).forEach(o=>{ if(o.value===a) o.selected=true; }) });
  $('#qAttrAmts').value = (q?.attrAmts||[0,0,0,0,0,0]).join(',');
  $('#qDiff').value = q?.difficulty || 'Normal';
  $('#qRepeat').value = q?.repeat || 'none';
  $('#qXP').value = q?.xp ?? 25;
  $('#qGold').value = q?.gold ?? 10;

  dlg.showModal();
  $('#saveQuest').onclick = (e)=>{
    e.preventDefault();
    const attrsSel = Array.from($('#qAttrs').selectedOptions).map(o=>o.value);
    const amts = ($('#qAttrAmts').value||'0,0,0,0,0,0').split(',').map(x=>parseInt(x.trim()||'0')).slice(0,6);
    const obj = {
      id: q?.id || Math.random().toString(36).slice(2),
      title: $('#qTitle').value.trim(),
      desc: $('#qDesc').value.trim(),
      type: $('#qType').value,
      duration: parseInt($('#qDuration').value||'25'),
      target: parseInt($('#qTarget').value||'10'),
      items: ($('#qChecklist').value||'').split(',').map(s=>s.trim()).filter(Boolean).map(t=>({label:t,done:false})),
      parts: ($('#qMulti').value||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>{ const [l,t]=s.split(':'); return {label:l.trim(), target:parseFloat(t||'1'), value:0}; }),
      attrs: attrsSel,
      attrAmts: amts,
      difficulty: $('#qDiff').value,
      repeat: $('#qRepeat').value,
      xp: parseInt($('#qXP').value||'0'),
      gold: parseInt($('#qGold').value||'0'),
      createdAt: nowISO(),
    };
    if (q){ // update
      const i = state.quests.findIndex(x=>x.id===q.id);
      state.quests[i] = {...state.quests[i], ...obj};
    } else {
      state.quests.push(obj);
    }
    save(); dlg.close(); renderQuests();
  };
}

$('#questDialog').addEventListener('close', ()=>{});

// ---------- Journey ----------
function renderJourney(){
  $('#journeyLevel').textContent = state.level;
  $('#journeyRank').textContent = state.rank;
  $('#journeyXP').textContent = `${state.xp}/${state.xpToNext}`;
  $('#journeyFill').style.width = `${Math.min(100, Math.floor(state.xp/state.xpToNext*100))}%`;
  $('#journeyCompleted').textContent = state.journey.completed;
  $('#journeyGold').textContent = state.gold;
}

// ---------- Store ----------
function renderStore(){
  $('#storeGold').textContent = state.gold;
  const list = $('#rewardList'); list.innerHTML='';
  state.rewards.forEach((r,idx)=>{
    const it = document.createElement('div');
    it.className='quest'; // reuse styling
    it.innerHTML = `<div class="q-top"><div class="q-title">${r.title}</div><div>💰 ${r.cost}</div></div>
      <div class="q-actions"><button class="btn primary">Buy</button><button class="btn danger">Delete</button></div>`;
    it.querySelector('.primary').onclick = () => {
      if (state.gold>=r.cost){ state.gold-=r.cost; save(); renderStore(); renderCharacter(); }
      else alert('Not enough gold');
    };
    it.querySelector('.danger').onclick = ()=>{ state.rewards.splice(idx,1); save(); renderStore(); };
    list.appendChild(it);
  });
}
$('#newReward').onclick = ()=>{
  $('#rewardEditor').classList.remove('hidden');
};
$('#saveReward').onclick = ()=>{
  const title = $('#rTitle').value.trim(); const cost=parseInt($('#rCost').value||'50');
  if(!title) return;
  state.rewards.push({title,cost});
  $('#rTitle').value=''; $('#rCost').value='50';
  $('#rewardEditor').classList.add('hidden');
  save(); renderStore();
};
$('#cancelReward').onclick = ()=>$('#rewardEditor').classList.add('hidden');

// ---------- Focus ----------
let focusTimer=null;
function renderFocus(){ $('#focusTime').textContent = fmtTime(state.focus.secs||($('#focusMinutes').value*60)); }
$('#focusStart').onclick = ()=>{
  const m = parseInt($('#focusMinutes').value||'25');
  state.focus.secs = m*60; save(); renderFocus();
  focusTimer && clearInterval(focusTimer);
  focusTimer = setInterval(()=>{
    state.focus.secs--; renderFocus();
    if (state.focus.secs<=0){ clearInterval(focusTimer); state.focus.secs=0; save(); renderFocus(); }
  },1000);
};
$('#focusPause').onclick = ()=>{ focusTimer && clearInterval(focusTimer); };
$('#focusResume').onclick = ()=>{
  focusTimer && clearInterval(focusTimer);
  focusTimer = setInterval(()=>{
    state.focus.secs--; renderFocus();
    if (state.focus.secs<=0){ clearInterval(focusTimer); state.focus.secs=0; save(); renderFocus(); }
  },1000);
};
$('#focusCancel').onclick = ()=>{ focusTimer && clearInterval(focusTimer); state.focus.secs=0; save(); renderFocus(); };

// ---------- Midnight Sweep (dailies) ----------
function midnightSweep(){
  const last = state.lastReset ? new Date(state.lastReset) : null;
  const todayMid = new Date(); todayMid.setHours(0,0,0,0);
  if (!last || last.getTime() < todayMid.getTime()){
    // for each daily: if not completed => create penalty; reset progress.
    state.quests.forEach(q=>{
      if (q.repeat==='daily'){
        const done = q.status==='done';
        if (!done){
          state.quests.push({
            id: Math.random().toString(36).slice(2),
            title: 'Penalty – 50 push-ups',
            type: 'counter', target: 50, count: 0,
            difficulty: 'Normal', xp: 10, gold: 0,
            penalty: true, createdAt: nowISO()
          });
        }
        // reset daily
        q.status=''; if(q.type==='counter') q.count=0;
        if(q.type==='checklist') q.items.forEach(i=>i.done=false);
        if(q.type==='multi') q.parts.forEach(p=>p.value=0);
      }
    });
    state.lastReset = midnightISO(new Date());
    save();
  }
}

// ---------- Seed daily quests (only first time) ----------
function seedIfEmpty(){
  if (state.quests.length>0) return;
  // Sample dailies
  state.quests.push(
    {id:cryptoRandom(), title:'Study/Skill practice 30 min', type:'timer', duration:30, difficulty:'Hard', xp:88, gold:22, repeat:'daily', attrs:['intellect','psyche']},
    {id:cryptoRandom(), title:'Deep clean a room', type:'checklist', items:[{label:'Dust'},{label:'Vacuum'},{label:'Organize'}], difficulty:'Hard', xp:77, gold:22, repeat:'daily', attrs:['social']},
    {id:cryptoRandom(), title:'Call or text a loved one', type:'counter', target:1, count:0, difficulty:'Easy', xp:10, gold:10, repeat:'daily', attrs:['social']},
    {id:cryptoRandom(), title:'Strength Training', type:'multi', parts:[{label:'Pushups',target:100,value:0},{label:'Sit-ups',target:100,value:0},{label:'Squats',target:100,value:0},{label:'Run (miles)',target:1,value:0}], difficulty:'Elite', xp:120, gold:35, repeat:'daily', attrs:['physical'], attrAmts:[1,0,0,0,0,0]}
  );
  save();
}
function cryptoRandom(){ return Math.random().toString(36).slice(2); }

// ---------- Init ----------
function init(){
  // upgrade + ensure xpToNext correct
  state.xpToNext = xpNeededForLevel(state.level);
  state.rank = rankForLevel(state.level);
  midnightSweep();
  seedIfEmpty();
  renderCharacter(); renderQuests(); renderJourney(); renderStore(); renderFocus();
}
init();
