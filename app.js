
// --- Diagnostic overlay ---
(function(){
  function set(t){ try{document.getElementById('diag').textContent=t;}catch(e){} }
  set('JS loaded…');
  window.addEventListener('error',e=>set('Error: '+(e.message||e.error)), true);
  window.addEventListener('unhandledrejection',e=>set('Promise: '+e.reason));
  document.addEventListener('DOMContentLoaded',()=>{
    set('JS OK @ '+new Date().toLocaleTimeString());
    const testBtn=document.createElement('button');
    testBtn.textContent='Tap test'; testBtn.style.marginLeft='8px';
    testBtn.onclick=()=>set('Tap received @ '+new Date().toLocaleTimeString());
    document.getElementById('diag').appendChild(testBtn);
  });
})();


// Polyfills & guards
(function(){
  if(typeof window.structuredClone!=='function'){
    window.structuredClone=(o)=>{ try{return JSON.parse(JSON.stringify(o));}catch(e){return o;} };
  }
  window.safeNotify=(t,b)=>{ try{ if('Notification'in window && Notification.permission==='granted'){ new Notification(t,{body:b}); } }catch(e){ console.log('[notify]',t,b||''); } };
})();

// --- State ---
const LS='shadowhud.v11.7';
const state = load() || {
  wallet:{gold:0},
  level:{xp:0, lvl:1},
  attrs:{Physical:0,Psyche:0,Intellect:0,Social:0,Spiritual:0,Financial:0},
  stats:{completed:0,currentStreak:0,longestStreak:0,lastCompletionDay:null},
  quests:[],
  rewards:[],
  lastDailyKey:null
};

function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
function load(){ try{ return JSON.parse(localStorage.getItem(LS)); }catch(e){ return null; } }
function todayKey(){ const d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function endOfToday(){ const d=new Date(); d.setHours(23,59,59,999); return d.toISOString(); }

// XP curve
function xpForLevel(l){ return Math.round( 40 + (l-1)* (l<30?7: (l<60?12:20)) ); }
function rankForLevel(l){
  if(l<=15) return 'E';
  if(l<=30) return 'D';
  if(l<=45) return 'C';
  if(l<=60) return 'B';
  if(l<=80) return 'A';
  return 'S';
}
function addXP(n){
  state.level.xp += n;
  while(true){
    const need = xpForLevel(state.level.lvl);
    if(state.level.xp >= need){
      state.level.xp -= need;
      state.level.lvl++;
    }else break;
  }
  save(); renderJourney(); renderCharacter();
}
function addGold(n){ state.wallet.gold+=n; save(); document.getElementById('gold').textContent=state.wallet.gold; }

// Difficulty scaling
const diffScale = {easy:1, normal:1.2, hard:1.6, elite:2.2, boss:3.0};
function rewardFromBase(base, diff){ return Math.round(base * (diffScale[diff]||1)); }
function goldFromBase(base, diff){ return Math.max(5, Math.round(base * (diffScale[diff]||1) * 0.4)); }

// Seeding: default dailies
function seedTodayDailiesIfMissing(){
  const key = todayKey();
  const hasToday = state.quests.some(q=>q.daily && q.dayKey===key);
  if(hasToday) return;
  const defaults = [];
  // Strength Training
  defaults.push({
    id: uid(), title:'Strength Training', desc:'100/100/100 + Run 1 mile',
    type:'multicounter', diff:'elite', baseXP:60, daily:true, dayKey:key, deadline:endOfToday(),
    attrs:[{name:'Physical',amt:2}],
    metrics:[
      {label:'Pushups',target:100,count:0},
      {label:'Sit-ups',target:100,count:0},
      {label:'Squats',target:100,count:0},
      {label:'Run (miles)',target:1,count:0}
    ],
    completed:false, started:false
  });
  defaults.push({
    id: uid(), title:'Meditate 10 min',
    type:'timer', durationMin:10, durationMs:10*60*1000, diff:'normal', baseXP:20,
    attrs:[{name:'Spiritual',amt:1},{name:'Psyche',amt:1}], daily:true, dayKey:key, deadline:endOfToday(),
    completed:false, started:false
  });
  defaults.push({
    id: uid(), title:'Journal 1 page',
    type:'checklist', items:['What went well?','What to improve?','One intention for tomorrow'], done:[false,false,false],
    diff:'easy', baseXP:12, attrs:[{name:'Intellect',amt:1},{name:'Psyche',amt:1}], daily:true, dayKey:key, deadline:endOfToday(),
    completed:false, started:false
  });
  state.quests = defaults.concat(state.quests);
  save();
}

// Midnight sweep: penalties + reseed
function midnightSweepIfNeeded(){
  const key=todayKey();
  if(state.lastDailyKey===key) return;
  // penalties for unfinished daily
  const keep=[], penalties=[];
  for(const q of state.quests){
    if(q.daily){
      if(!q.completed){
        penalties.push(makePenalty());
      }
    }else keep.push(q);
  }
  state.quests = keep.concat(penalties);
  seedTodayDailiesIfMissing();
  state.lastDailyKey = key;
  save();
}

// Penalty generator
function makePenalty(){
  const items = ['Penalty — 50 pushups','Penalty — 25 burpees','Penalty — clean & organize desk','Penalty — walk 15 minutes'];
  const pick = items[Math.floor(Math.random()*items.length)];
  return { id:uid(), title:pick, type:'counter', target:1, count:0, diff:'normal', baseXP:8, daily:false, penalty:true };
}

function uid(){ return Math.floor(Math.random()*1e9)+Date.now(); }

// Render Quests
let currentFilter='all';
function renderQuests(){
  const list=document.getElementById('quest-list');
  list.innerHTML='';
  let qs = state.quests.slice();
  if(currentFilter==='daily') qs=qs.filter(q=>q.daily);
  if(currentFilter==='penalty') qs=qs.filter(q=>q.penalty);
  if(currentFilter==='active') qs=qs.filter(q=>q.started && !q.completed);
  if(currentFilter==='completed') qs=qs.filter(q=>q.completed);
  document.getElementById('empty-quests').style.display = qs.length? 'none':'block';
  for(const q of qs){
    const card=document.createElement('div'); card.className='q';
    const tag = q.penalty?'<span class="badge">Penalty</span>': (q.daily?'<span class="badge">Daily</span>':'');
    const diff = q.diff?`<span class="badge">${q.diff}</span>`:'';
    const reward = `+${rewardFromBase(q.baseXP||25,q.diff)} XP · 💰 ${goldFromBase(q.baseXP||25,q.diff)}`;
    card.innerHTML = `<div class="title">${tag}${diff}${q.title}</div><div class="sub">${q.desc||''}</div><div class="sub">${reward}</div>`;

    // body per type
    if(q.type==='counter'){
      const row=document.createElement('div'); row.className='row';
      const span=document.createElement('span'); span.textContent=`${q.count||0} / ${q.target||1}`; row.appendChild(span);
      const b1=btn('+1',()=>{ q.count=(q.count||0)+1; if(q.count>=q.target) complete(q); save(); renderQuests(); });
      const bDec=btn('−1',()=>{ q.count=Math.max(0,(q.count||0)-1); save(); renderQuests(); });
      const bDone=btn('Finish',()=>{ q.count=q.target||1; complete(q); save(); renderQuests(); });
      row.append(bDone,bDec,b1); card.appendChild(row);
    }
    if(q.type==='checklist'){
      q.done=q.done||q.items.map(()=>false);
      q.items.forEach((it,i)=>{
        const row=document.createElement('div'); row.className='counter';
        const dot=document.createElement('div'); dot.className='circle'+(q.done[i]?' done':'');
        dot.textContent = q.done[i]?'✓':''; dot.addEventListener('click',()=>{ q.done[i]=!q.done[i]; if(q.done.every(Boolean)) complete(q); save(); renderQuests(); });
        const label=document.createElement('span'); label.textContent=it;
        row.append(dot,label); card.appendChild(row);
      });
    }
    if(q.type==='multicounter'){
      q.metrics=q.metrics||[];
      for(const m of q.metrics){
        const row=document.createElement('div'); row.className='row';
        row.innerHTML=`<div>${m.label}</div><div>${m.count||0} / ${m.target}</div>`;
        row.append(btn('Finish',()=>{ m.count=m.target; checkMulti(q); save(); renderQuests(); }),
                   btn('−1',()=>{ m.count=Math.max(0,(m.count||0)-1); save(); renderQuests(); }),
                   btn('+1',()=>{ m.count=Math.min(m.target,(m.count||0)+1); checkMulti(q); save(); renderQuests(); }));
        card.appendChild(row);
      }
    }
    if(q.type==='timer'){
      const t=document.createElement('div'); t.id='t-'+q.id; t.textContent=timeLeftText(q);
      const row=document.createElement('div'); row.className='row';
      const start=btn('Start',()=>{ if(!q.started){ q.started=true; q.tStart=Date.now(); q.tLeft=(q.durationMs||(q.durationMin||10)*60000); } tickTimers(); save(); renderQuests(); });
      const pause=btn('Pause',()=>{ if(q.started){ q.tLeft=Math.max(0,(q.tLeft||0)-(Date.now()-q.tStart)); q.started=false; } save(); renderQuests(); });
      const resume=btn('Resume',()=>{ if(!q.started&& q.tLeft>0){ q.started=true; q.tStart=Date.now(); } save(); renderQuests(); });
      const done=btn('Done',()=>{ complete(q); save(); renderQuests(); });
      row.append(start,pause,resume,done); card.append(t,row);
    }

    // common buttons
    const rowb=document.createElement('div'); rowb.className='rowbtns';
    rowb.append(
      btn('Reset',()=>{ resetQuest(q); save(); renderQuests(); }),
      btn('Delete',()=>{ state.quests=state.quests.filter(x=>x.id!==q.id); save(); renderQuests(); })
    );
    card.appendChild(rowb);
    list.appendChild(card);
  }
}

function btn(text, on){ const b=document.createElement('button'); b.className='btn'; b.textContent=text; b.onclick=on; return b; }

function timeLeftText(q){
  if(!q.started){ return (q.durationMin||Math.round((q.durationMs||0)/60000)) + ':00'; }
  const elapsed = Date.now()-q.tStart;
  const left = Math.max(0, (q.tLeft || (q.durationMs||(q.durationMin||10)*60000)) - elapsed);
  const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000).toString().padStart(2,'0');
  if(left===0){ complete(q); }
  return `${m}:${s}`;
}
function tickTimers(){ clearInterval(window.__tick); window.__tick=setInterval(()=>{ document.querySelectorAll('[id^=t-]').forEach(el=>{ const id=Number(el.id.slice(2)); const q=state.quests.find(x=>x.id===id); if(q) el.textContent=timeLeftText(q); }); }, 500); }

function resetQuest(q){
  if(q.type==='counter'){ q.count=0; }
  if(q.type==='checklist'){ q.done=q.items.map(()=>false); }
  if(q.type==='multicounter'){ for(const m of q.metrics){ m.count=0; } }
  if(q.type==='timer'){ q.started=false; q.tLeft=(q.durationMs||(q.durationMin||10)*60000); }
  q.completed=false; q.started=false;
}

function checkMulti(q){ if(q.metrics.every(m=>m.count>=m.target)) complete(q); }

function complete(q){
  if(q.completed) return;
  q.completed=true;
  const xp = rewardFromBase(q.baseXP||25,q.diff||'normal');
  const gold = goldFromBase(q.baseXP||25,q.diff||'normal');
  addXP(xp); addGold(gold);
  // attribute rewards
  if(q.attrs){ for(const a of q.attrs){ state.attrs[a.name]=(state.attrs[a.name]||0)+(a.amt||1); } }
  state.stats.completed+=1; state.stats.lastCompletionDay = todayKey();
  save(); renderCharacter(); renderJourney();
}

// Render Character / Journey
function renderCharacter(){
  document.getElementById('gold').textContent = state.wallet.gold;
  document.getElementById('lvl').textContent = state.level.lvl;
  document.getElementById('rank').textContent = rankForLevel(state.level.lvl);
  document.getElementById('xp').textContent = state.level.xp;
  document.getElementById('xpreq').textContent = xpForLevel(state.level.lvl);
  document.getElementById('xpbar').style.width = Math.min(100, Math.round((state.level.xp / xpForLevel(state.level.lvl))*100))+'%';
  for(const k of Object.keys(state.attrs)){
    const el=document.getElementById('attr-'+k); if(el) el.textContent = state.attrs[k];
  }
}

function renderJourney(){
  document.getElementById('lvl').textContent = state.level.lvl;
  document.getElementById('rank').textContent = rankForLevel(state.level.lvl);
  document.getElementById('xp').textContent = state.level.xp;
  document.getElementById('xpreq').textContent = xpForLevel(state.level.lvl);
  document.getElementById('xpbar').style.width = Math.min(100, Math.round((state.level.xp / xpForLevel(state.level.lvl))*100))+'%';
  document.getElementById('done').textContent = state.stats.completed;
  document.getElementById('streak').textContent = state.stats.currentStreak||0;
}

// Store
function renderStore(){
  const list=document.getElementById('rewards'); list.innerHTML='';
  if(!state.rewards.length){ const empt=document.createElement('div'); empt.className='empty'; empt.textContent='No rewards yet.'; list.appendChild(empt); }
  state.rewards.forEach((r,i)=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<div class="title">${r.title}</div><div>Cost: 💰 ${r.cost}</div>`;
    card.appendChild(btn('Buy',()=>{ if(state.wallet.gold>=r.cost){ state.wallet.gold-=r.cost; save(); renderCharacter(); renderStore(); } }));
    list.appendChild(card);
  });
}

// UI bindings
document.querySelectorAll('.tabs .tab').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const to=b.dataset.to;
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('visible'));
    document.getElementById('screen-'+to).classList.add('visible');
    if(to==='quests') renderQuests();
    if(to==='store') renderStore();
    if(to==='journey') renderJourney();
    if(to==='character') renderCharacter();
  });
});

document.querySelectorAll('[data-filter]').forEach(c=>{
  c.addEventListener('click',()=>{
    document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));
    c.classList.add('active'); currentFilter=c.dataset.filter; renderQuests();
  });
});

document.getElementById('fab-add').addEventListener('click',()=>openModal());

function openModal(q){
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('m-title').textContent = q?'Edit Quest':'New Quest';
  const form=document.getElementById('qform'); form.reset();
  if(q){
    document.getElementById('q-title').value=q.title;
    document.getElementById('q-desc').value=q.desc||'';
    document.getElementById('q-type').value=q.type;
    document.getElementById('q-min').value=q.durationMin||30;
    document.getElementById('q-target').value=q.target||10;
    document.getElementById('q-items').value=(q.items||[]).join(', ');
    document.getElementById('q-multi').value=(q.metrics||[]).map(m=>`${m.label}:${m.target}`).join(', ');
    document.getElementById('q-diff').value=q.diff||'normal';
    document.getElementById('q-daily').checked=!!q.daily;
    document.getElementById('q-xp').value=q.baseXP||25;
  }
}

document.getElementById('q-cancel').addEventListener('click',()=>document.getElementById('modal').classList.add('hidden'));
document.getElementById('q-type').addEventListener('change',updateTypeFields);
function updateTypeFields(){
  const t=document.getElementById('q-type').value;
  document.querySelectorAll('[data-if]').forEach(el=>el.style.display = el.getAttribute('data-if')===t ? 'block':'none');
}
updateTypeFields();

document.getElementById('qform').addEventListener('submit', e=>{
  e.preventDefault();
  const q={ id:uid(),
    title:val('q-title'), desc:val('q-desc'),
    type:val('q-type'), diff:val('q-diff'), baseXP:num('q-xp'),
    daily: byId('q-daily').checked, dayKey: byId('q-daily').checked ? todayKey(): null,
    deadline: byId('q-daily').checked ? endOfToday(): byId('q-deadline').value || null,
    completed:false, started:false
  };
  if(q.type==='timer'){ q.durationMin = num('q-min'); q.durationMs=q.durationMin*60000; }
  if(q.type==='counter'){ q.target=num('q-target'); q.count=0; }
  if(q.type==='checklist'){ q.items=val('q-items').split(',').map(s=>s.trim()).filter(Boolean); q.done=q.items.map(()=>false); }
  if(q.type==='multicounter'){ q.metrics=val('q-multi').split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{ const [label,target]=pair.split(':'); return {label:(label||'Item').trim(), target:Number(target||1), count:0}; }); }
  // attributes
  const attrs=[]; document.querySelectorAll('#qform .attr').forEach(chk=>{ const name=chk.dataset.name; const on=chk.checked; const amtEl=document.querySelector(`#qform .amt[data-name="${name}"]`); if(on){ attrs.push({name, amt:Number(amtEl.value||1)}); } });
  q.attrs=attrs;

  state.quests.unshift(q); save(); document.getElementById('modal').classList.add('hidden'); renderQuests();
});

function val(id){ return document.getElementById(id).value; }
function num(id){ return Number(document.getElementById(id).value||0); }
function byId(id){ return document.getElementById(id); }

// Store form
byId('btn-new-reward').addEventListener('click',()=>byId('reward-form').classList.remove('hidden'));
byId('r-cancel').addEventListener('click',()=>byId('reward-form').classList.add('hidden'));
byId('reward-form').addEventListener('submit', e=>{
  e.preventDefault();
  state.rewards.push({title:byId('r-title').value, cost:Number(byId('r-cost').value||50)});
  save(); byId('reward-form').classList.add('hidden'); renderStore();
});

// Focus timer
let fTimer=null, fEnd=0, fPauseLeft=0;
function fmt(ms){ const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000).toString().padStart(2,'0'); return `${m}:${s}`; }
function updateFocus(){
  const out=byId('focus-time');
  if(!fTimer){ out.textContent = fmt((byId('focus-min').value||25)*60000); return; }
  const left=Math.max(0, fEnd-Date.now());
  out.textContent=fmt(left);
  if(left<=0){ clearInterval(fTimer); fTimer=null; }
}
byId('f-start').onclick=()=>{ const ms=Number(byId('focus-min').value||25)*60000; fEnd=Date.now()+ms; clearInterval(fTimer); fTimer=setInterval(updateFocus,500); byId('f-pause').classList.remove('hidden'); byId('f-start').classList.add('hidden'); };
byId('f-pause').onclick=()=>{ fPauseLeft=Math.max(0,fEnd-Date.now()); clearInterval(fTimer); fTimer=null; byId('f-pause').classList.add('hidden'); byId('f-resume').classList.remove('hidden'); };
byId('f-resume').onclick=()=>{ fEnd=Date.now()+fPauseLeft; fTimer=setInterval(updateFocus,500); byId('f-resume').classList.add('hidden'); byId('f-pause').classList.remove('hidden'); };
byId('f-cancel').onclick=()=>{ clearInterval(fTimer); fTimer=null; byId('f-start').classList.remove('hidden'); byId('f-pause').classList.add('hidden'); byId('f-resume').classList.add('hidden'); updateFocus(); };

// Init
function init(){
  midnightSweepIfNeeded();
  seedTodayDailiesIfMissing();
  renderQuests(); renderCharacter(); renderStore(); renderJourney(); tickTimers();
}
document.addEventListener('DOMContentLoaded', init);
