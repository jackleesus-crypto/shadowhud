
// ---- Storage helpers -------------------------------------------------------
const LS_KEY = 'shadowhud.v12.1';
const state = loadState();

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch(e){}
  }
  // Fresh seed
  const now = Date.now();
  const today = dateKey(new Date());
  const s = {
    meta:{version:'12.1', created:now, lastOpen:now, lastDaily:today},
    gold:0,
    level:1, xp:0,
    attributes:{physical:0, psyche:0, intellect:0, social:0, spiritual:0, financial:0},
    quests:[],
    rewards:[],
    journey:{completed:0, streak:0, achievements:[]}
  };
  seedDaily(s);
  saveState(s);
  return s;
}
function saveState(s=state){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }

function dateKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function nextMidnight(){ const d=new Date(); d.setHours(24,0,0,0); return d; }

// ---- XP / Level / Rank -----------------------------------------------------
function xpForLevel(n){
  // progressive curve: 47 at L1 up to big at L100
  const base=50, growth=1.15;
  return Math.floor(base * Math.pow(growth, n-1));
}
function rankForLevel(l){
  if (l<=15) return 'E';
  if (l<=30) return 'D';
  if (l<=45) return 'C';
  if (l<=60) return 'B';
  if (l<=80) return 'A';
  return 'S';
}
function addXP(amount){
  state.xp += amount;
  // loop level ups
  while(true){
    const need = xpForLevel(state.level);
    if (state.xp >= need && state.level < 100){
      state.xp -= need;
      state.level += 1;
    } else break;
  }
  saveState();
  renderCharacter();
  renderJourney();
}

// ---- Seeding ----------------------------------------------------------------
function seedDaily(s){
  // Strength Training daily
  s.quests.push({
    id: uid(), title:"Strength Training", desc:"Daily routine",
    type:"multi", daily:true, penalty:false,
    diff:"Elite",
    attrs:["physical"],
    multi:[["Pushups",100],["Sit-ups",100],["Squats",100],["Run (miles)",1]],
    progress:{multi:[0,0,0,0], started:false, paused:false, timer:0},
    baseXP:120, gold:25, created:Date.now()
  });
  // Self-help dailies
  s.quests.push({
    id: uid(), title:"Meditate 10 min", type:"timer", daily:true, penalty:false, diff:"Normal",
    attrs:["spiritual","psyche"], duration:10, progress:{timer:0, started:false, paused:false},
    baseXP:25, gold:10, created:Date.now()
  });
  s.quests.push({
    id: uid(), title:"Call or text a loved one", type:"counter", daily:true, penalty:false, diff:"Easy",
    attrs:["social"], target:1, progress:{count:0}, baseXP:10, gold:10, created:Date.now()
  });
}
// ---- Utilities --------------------------------------------------------------
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36).slice(3); }
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

// ---- Tabs ------------------------------------------------------------------
$all('.tab').forEach(btn=>btn.addEventListener('click', ()=>{
  $all('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const to = btn.dataset.tab;
  $all('.screen').forEach(s=>s.classList.remove('active'));
  if (to==='character'){ $('#screen-character').classList.add('active'); renderCharacter(); }
  if (to==='quest'){ $('#screen-quests').classList.add('active'); renderQuests(); }
  if (to==='journey'){ $('#screen-journey').classList.add('active'); renderJourney(); }
  if (to==='store'){ $('#screen-store').classList.add('active'); renderStore(); }
  if (to==='focus'){ $('#screen-focus').classList.add('active'); }
}));

// ---- Character --------------------------------------------------------------
function renderCharacter(){
  const A = state.attributes;
  $('#attr-physical').textContent = A.physical;
  $('#attr-psyche').textContent = A.psyche;
  $('#attr-intellect').textContent = A.intellect;
  $('#attr-social').textContent = A.social;
  $('#attr-spiritual').textContent = A.spiritual;
  $('#attr-financial').textContent = A.financial;
  const need = xpForLevel(state.level);
  $('#xpNow').textContent = state.xp;
  $('#xpNext').textContent = need;
  $('#xpFill').style.width = Math.min(100, (state.xp/need)*100) + '%';
  $('#rankBadge').textContent = rankForLevel(state.level);
  $('#rankText').textContent = 'Rank ' + rankForLevel(state.level);
  $('#levelText').textContent = 'Level ' + state.level;
  drawRadar();
  $('#goldAmount').textContent = state.gold;
}
function drawRadar(){
  const cv = $('#radar'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H=cv.height, cx=W/2, cy=H/2+10, r=90;
  ctx.clearRect(0,0,W,H);
  const labels = ['Financial','Physical','Psyche','Intellect','Spiritual','Social'];
  const vals = [
    state.attributes.financial, state.attributes.physical, state.attributes.psyche,
    state.attributes.intellect, state.attributes.spiritual, state.attributes.social
  ];
  const max = Math.max(1, ...vals, 10);
  // web
  ctx.strokeStyle='#333'; ctx.lineWidth=1;
  for(let ring=1; ring<=5; ring++){
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a = (Math.PI*2/6)*i - Math.PI/2;
      const rr = r*ring/5;
      const x = cx + Math.cos(a)*rr;
      const y = cy + Math.sin(a)*rr;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  // polygon
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=(Math.PI*2/6)*i - Math.PI/2;
    const rr = r * (vals[i]/max);
    const x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.fillStyle='rgba(123, 150, 255, .25)'; ctx.fill();
  ctx.strokeStyle='rgba(123, 200, 255, .8)'; ctx.stroke();
}

// ---- Quests -----------------------------------------------------------------
let activeFilter = 'all';
$all('#questFilters .pill').forEach(p=>p.addEventListener('click',()=>{
  $all('#questFilters .pill').forEach(x=>x.classList.remove('active'));
  p.classList.add('active'); activeFilter=p.dataset.filter; renderQuests();
}));

$('#addQuest').addEventListener('click',()=>openQuestDialog());

function openQuestDialog(q=null){
  $('#qdTitle').textContent = q ? 'Edit Quest' : 'New Quest';
  $('#qTitle').value = q?.title || '';
  $('#qDesc').value = q?.desc || '';
  $('#qType').value = q?.type || 'timer';
  $('#qDuration').value = q?.duration ?? 25;
  $('#qTarget').value = q?.target ?? 10;
  $('#qChecklist').value = (q?.checklist||[]).join(', ');
  $('#qMulti').value = (q?.multi||[]).map(([n,t])=>`${n}:${t}`).join(', ');
  // multi-select
  $all('#qAttrs option').forEach(o=>o.selected = q?.attrs?.includes(o.value) || false);
  $('#qDiff').value = q?.diff || 'Normal';
  $('#qRepeat').value = q?.daily ? 'daily' : 'none';
  $('#qXP').value = q?.baseXP ?? 25;
  $('#qGold').value = q?.gold ?? 10;
  $('#questDialog').showModal();
  $('#saveQuest').onclick = (e)=>{
    e.preventDefault();
    const attrs = $all('#qAttrs option').filter(o=>o.selected).map(o=>o.value);
    const obj = {
      id: q?.id || uid(),
      title: $('#qTitle').value.trim(),
      desc: $('#qDesc').value.trim(),
      type: $('#qType').value,
      duration: Number($('#qDuration').value),
      target: Number($('#qTarget').value),
      checklist: $('#qChecklist').value.split(',').map(s=>s.trim()).filter(Boolean),
      multi: $('#qMulti').value.split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{
        const m = pair.split(':'); return [m[0], Number(m[1]||1)];
      }),
      attrs,
      diff: $('#qDiff').value,
      daily: $('#qRepeat').value==='daily',
      penalty: false,
      baseXP: Number($('#qXP').value),
      gold: Number($('#qGold').value),
      progress: {},
      created: Date.now()
    };
    if (obj.type==='timer') obj.progress={timer:0, started:false, paused:false};
    if (obj.type==='counter') obj.progress={count:0};
    if (obj.type==='checklist') obj.progress={checks:Array(obj.checklist.length).fill(false)};
    if (obj.type==='multi') obj.progress={multi:Array(obj.multi.length).fill(0)};
    if (q){ // update
      const i = state.quests.findIndex(x=>x.id===q.id); if(i>=0) state.quests[i]=obj;
    } else {
      state.quests.push(obj);
    }
    saveState(); $('#questDialog').close(); renderQuests();
  };
}

function renderQuests(){
  const list = $('#questList'); list.innerHTML='';
  let qs = state.quests.slice();
  const nowKey = dateKey(new Date());
  if (activeFilter==='daily') qs = qs.filter(q=>q.daily && !q.penalty);
  if (activeFilter==='penalty') qs = qs.filter(q=>q.penalty);
  if (activeFilter==='active') qs = qs.filter(q=>q.progress?.started);
  if (activeFilter==='done') qs = qs.filter(q=>isQuestDone(q));
  if (!qs.length){
    const empty = document.createElement('div');
    empty.className='small'; empty.style.padding='8px 6px';
    empty.textContent='No quests yet. Tap ＋ to add.';
    list.appendChild(empty);
  }
  for(const q of qs){
    const el = document.createElement('div'); el.className='quest';
    const tag = q.daily ? '<span class="pill small">Daily</span>' : (q.penalty?'<span class="pill small">Penalty</span>':'');
    let meta = `${q.diff}` + (q.attrs?.length?` • ${q.attrs.join(' + ')}`:'');
    el.innerHTML = `
      <div class="q-top">
        <div>
          <div class="q-title">${q.title}</div>
          <div class="q-meta">${meta}</div>
        </div>
        <div class="q-meta">+${q.baseXP} XP • 💰 ${q.gold}</div>
      </div>
      <div class="q-body">${questBodyHTML(q)}</div>
      <div class="q-actions">
        ${q.type==='timer'?'<button class="btn" data-act="start">Start</button><button class="btn secondary" data-act="pause">Pause</button><button class="btn" data-act="resume">Resume</button>':''}
        ${q.type!=='timer'?'<button class="btn" data-act="done">Done</button>':''}
        <button class="btn" data-act="reset">Reset</button>
        <button class="btn secondary" data-act="edit">Edit</button>
        <button class="btn danger" data-act="delete">Delete</button>
      </div>
      <div class="small">${tag} ${q.daily?` • resets in ${timeToMidnight()}`:''}</div>
    `;
    list.appendChild(el);
    el.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>questAction(q,b.dataset.act, el)));
    // special buttons inside body
    el.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>{ incrementQuest(q, Number(b.dataset.plus)); renderQuests(); }));
    el.querySelectorAll('[data-multi-finish]').forEach((b,i)=>b.addEventListener('click',()=>{ q.progress.multi[i] = q.multi[i][1]; saveState(); renderQuests(); }));
    el.querySelectorAll('[data-check]').forEach((b,i)=>b.addEventListener('click',()=>{ q.progress.checks[i]=!q.progress.checks[i]; saveState(); renderQuests(); }));
  }
}
function timeToMidnight(){
  const ms = nextMidnight()-Date.now();
  const h = Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000), s=Math.floor((ms%60000)/1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function questBodyHTML(q){
  if(q.type==='timer'){
    const mm = Math.floor((q.progress.timer||0)/60), ss = (q.progress.timer||0)%60;
    return `<div class="small">Paused — ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</div>
            <div class="xpbar"><div style="width:${Math.min(100, ((q.progress.timer||0)/(q.duration*60))*100)}%"></div></div>`;
  }
  if(q.type==='counter'){
    const c = q.progress.count||0; return `<div>${c} / ${q.target}</div>
        <div class="q-actions"><button class="btn" data-plus="1">+1</button><button class="btn" data-plus="-1">−1</button><button class="btn" data-plus="${q.target}">Finish</button></div>`;
  }
  if(q.type==='checklist'){
    const checks = q.progress.checks||[]; return q.checklist.map((txt,i)=>`
      <div class="row"><label class="small"><input type="checkbox" ${checks[i]?'checked':''} data-check="1"/> ${txt}</label></div>`).join('');
  }
  if(q.type==='multi'){
    const arr = q.multi||[]; const prog = q.progress.multi||[];
    return arr.map(([name,target],i)=>{
      const cur = prog[i]||0;
      return `<div style="margin:8px 0">
        <div class="row"><div>${name}</div><div>${cur} / ${target}</div></div>
        <div class="q-actions">
          <button class="btn" data-plus="1" data-i="${i}">+1</button>
          <button class="btn" data-plus="-1" data-i="${i}">−1</button>
          <button class="btn" data-multi-finish="${i}">Finish</button>
        </div>
      </div>`;
    }).join('');
  }
  return '';
}
function incrementQuest(q, delta){
  if(q.type==='counter'){
    q.progress.count = Math.max(0, Math.min(q.target, (q.progress.count||0)+delta));
  } else if(q.type==='multi'){
    // pick the first control in DOM? instead, apply to all items if data-i exists; handled by listeners created above
  }
  saveState();
}
function isQuestDone(q){
  if(q.type==='timer'){ return (q.progress.timer||0) >= (q.duration*60); }
  if(q.type==='counter'){ return (q.progress.count||0) >= q.target; }
  if(q.type==='checklist'){ return (q.progress.checks||[]).every(Boolean); }
  if(q.type==='multi'){ return (q.progress.multi||[]).every((v,i)=>v>=(q.multi[i][1])); }
  return false;
}
function questAction(q, act, el){
  if(act==='delete'){
    state.quests = state.quests.filter(x=>x.id!==q.id); saveState(); renderQuests(); return;
  }
  if(act==='edit'){ openQuestDialog(q); return; }
  if(act==='reset'){
    if(q.type==='timer') q.progress={timer:0, started:false, paused:false};
    if(q.type==='counter') q.progress={count:0};
    if(q.type==='checklist') q.progress={checks:Array(q.checklist.length).fill(false)};
    if(q.type==='multi') q.progress={multi:Array(q.multi.length).fill(0)};
    saveState(); renderQuests(); return;
  }
  if(act==='done'){
    if(!isQuestDone(q)){ // convenience: mark done instantly
      if(q.type==='counter') q.progress.count=q.target;
      if(q.type==='checklist') q.progress.checks = Array(q.checklist.length).fill(true);
      if(q.type==='multi') q.progress.multi = q.multi.map(x=>x[1]);
    }
    finishQuest(q); return;
  }
  if(act==='start' && q.type==='timer'){
    q.progress.started=true; q.progress.paused=false; saveState(); runQuestTimer(q); return;
  }
  if(act==='pause' && q.type==='timer'){
    q.progress.paused=true; saveState(); return;
  }
  if(act==='resume' && q.type==='timer'){
    q.progress.paused=false; saveState(); runQuestTimer(q); return;
  }
}
function runQuestTimer(q){
  function tick(){
    if(!q.progress.started || q.progress.paused) return;
    q.progress.timer = (q.progress.timer||0)+1;
    saveState();
    if(isQuestDone(q)){ finishQuest(q); return; }
    setTimeout(tick, 1000);
    renderQuests();
  }
  setTimeout(tick, 1000);
}
function rewardFromDifficulty(diff){
  // scale multipliers
  return {Easy:1, Normal:1.2, Hard:1.5, Elite:2.0}[diff]||1;
}
function finishQuest(q){
  if(isQuestDone(q)){
    const mult = rewardFromDifficulty(q.diff);
    const xp = Math.round(q.baseXP*mult);
    const gold = Math.round(q.gold*mult);
    addXP(xp);
    state.gold += gold;
    // attributes gain
    (q.attrs||[]).forEach(a=>{ state.attributes[a]=(state.attributes[a]||0)+1; });
    state.journey.completed += 1;
    // remove or reset
    if(q.daily || q.penalty){
      // leave it but reset progress for next cycle
      questAction(q,'reset');
    } else {
      state.quests = state.quests.filter(x=>x.id!==q.id);
    }
    saveState();
    renderCharacter(); renderJourney(); renderStore(); renderQuests();
  }
}

// ---- Daily reset / Penalty --------------------------------------------------
function midnightSweep(){
  const today = dateKey(new Date());
  if (state.meta.lastDaily !== today){
    // for each daily not done -> create penalty quest
    const dailies = state.quests.filter(q=>q.daily && !q.penalty);
    for(const q of dailies){
      if(!isQuestDone(q)){
        state.quests.push({
          id: uid(), title:`Penalty — Do 50 push-ups`, type:'counter', target:50,
          progress:{count:0}, attrs:['physical'], diff:'Hard', daily:false, penalty:true,
          baseXP:15, gold:5, created:Date.now()
        });
      }
      // reset daily progress
      questAction(q,'reset');
    }
    state.meta.lastDaily = today;
    saveState();
  }
}
setInterval(midnightSweep, 30*1000); // lightweight check

// ---- Journey ----------------------------------------------------------------
function renderJourney(){
  $('#journeyLevel').textContent = state.level;
  $('#journeyRank').textContent = rankForLevel(state.level);
  $('#journeyXP').textContent = `${state.xp}/${xpForLevel(state.level)}`;
  $('#journeyFill').style.width = Math.min(100,(state.xp/xpForLevel(state.level))*100)+'%';
  $('#journeyCompleted').textContent = state.journey.completed;
  $('#journeyGold').textContent = state.gold;
  const ach = $('#achList'); ach.innerHTML='';
  if(state.journey.completed>=1) ach.innerHTML += '<li>First Blood — complete 1 quest</li>';
  if(state.journey.completed>=10) ach.innerHTML += '<li>Rookie Grinder — complete 10 quests</li>';
}

// ---- Store ------------------------------------------------------------------
function renderStore(){
  $('#storeGold').textContent = state.gold;
  const wrap = $('#rewardList'); wrap.innerHTML='';
  if(!state.rewards.length){
    const hint=document.createElement('div'); hint.className='small'; hint.style.padding='6px'; hint.textContent='No rewards yet. Add your own!';
    wrap.appendChild(hint);
  } else {
    for(const r of state.rewards){
      const row=document.createElement('div'); row.className='row';
      row.innerHTML=`<div>${r.title}</div><div>💰 ${r.cost}</div>`;
      const buy=document.createElement('button'); buy.className='btn primary'; buy.textContent='Buy';
      buy.onclick=()=>{
        if(state.gold>=r.cost){ state.gold-=r.cost; saveState(); renderStore(); renderCharacter(); renderJourney(); }
        else alert('Not enough gold.');
      };
      row.appendChild(buy); wrap.appendChild(row);
    }
  }
}
$('#newReward').addEventListener('click',()=>$('#rewardEditor').classList.remove('hidden'));
$('#cancelReward').addEventListener('click',()=>$('#rewardEditor').classList.add('hidden'));
$('#saveReward').addEventListener('click',()=>{
  const t=$('#rTitle').value.trim(); const c=Number($('#rCost').value||0);
  if(!t||c<=0) return;
  state.rewards.push({id:uid(), title:t, cost:c}); saveState();
  $('#rewardEditor').classList.add('hidden'); $('#rTitle').value=''; renderStore();
});

// ---- Focus Timer ------------------------------------------------------------
let focusTimer=null, focusLeft=0;
function renderFocus(){
  const m = Math.floor(focusLeft/60), s=focusLeft%60;
  $('#focusTime').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
$('#focusStart').addEventListener('click',()=>{
  const mins = Number($('#focusMinutes').value||25);
  focusLeft = mins*60; if(focusTimer) clearInterval(focusTimer);
  renderFocus();
  focusTimer = setInterval(()=>{
    if(focusLeft>0){ focusLeft--; renderFocus(); }
    else { clearInterval(focusTimer); focusTimer=null; alert('Focus complete!'); }
  },1000);
});
$('#focusPause').addEventListener('click',()=>{ if(focusTimer){ clearInterval(focusTimer); focusTimer=null; } });
$('#focusResume').addEventListener('click',()=>{
  if(!focusTimer && focusLeft>0){
    focusTimer=setInterval(()=>{ if(focusLeft>0){ focusLeft--; renderFocus(); } else { clearInterval(focusTimer); focusTimer=null; alert('Focus complete!'); } },1000);
  }
});
$('#focusCancel').addEventListener('click',()=>{ if(focusTimer) clearInterval(focusTimer); focusTimer=null; focusLeft=0; renderFocus(); });

// ---- Notifications (scaffold) ----------------------------------------------
async function ensureNotificationPermission(){
  if(!('Notification' in window)) return false;
  if(Notification.permission==='granted') return true;
  try{
    const r = await Notification.requestPermission();
    return r==='granted';
  }catch(e){ return false; }
}

// ---- Boot -------------------------------------------------------------------
function boot(){
  midnightSweep();
  renderCharacter(); renderQuests(); renderJourney(); renderStore(); renderFocus();
}
document.addEventListener('DOMContentLoaded', boot);
