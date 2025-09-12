// ===== helpers =====
const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
function notify(title, body){ if(!('Notification' in window)) return; if(Notification.permission==='granted'){ try{ registration && registration.showNotification ? registration.showNotification(title,{body}) : new Notification(title,{body}); }catch(e){} } }
const todayKey=()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const endOfToday=()=>{ const d=new Date(); d.setHours(23,59,59,999); return d.getTime(); };

// ===== state =====
const defaultState={ 
  player:{level:1,xp:0,xpNext:50,gold:0},
  attrs:{Physical:0,Psyche:0,Intellect:0,Financial:0,Social:0,Spiritual:0},
  quests:[], shop:[], lastId:0, lastDailyKey:null,
  stats:{completed:0,goldEarned:0,xpEarned:0,penaltiesCleared:0,currentStreak:0,longestStreak:0,focusMinutes:0,lastCompletionDay:null}
};
let state=load(); function load(){ try{ return JSON.parse(localStorage.getItem('shadowhud-full-v7'))||structuredClone(defaultState);}catch(e){ return structuredClone(defaultState);} } function save(){ localStorage.setItem('shadowhud-full-v7', JSON.stringify(state)); }

// ===== curves & rewards =====
const DIFF={easy:{label:'Easy',mult:1.0},normal:{label:'Normal',mult:1.5},hard:{label:'Hard',mult:2.2},elite:{label:'Elite',mult:3.2},boss:{label:'Boss',mult:5.0}};
const ATTR_REWARD={easy:1, normal:1, hard:2, elite:3, boss:5};
function xpToNext(level){ return Math.round(40+6*level+0.6*level*level); }
function rankForLevel(l){ if(l<15)return'E'; if(l<30)return'D'; if(l<45)return'C'; if(l<60)return'B'; if(l<75)return'A'; return'S'; }
function grantXP(a){ const p=state.player; if(p.level>=100) return; const add=Math.max(0,a|0); p.xp+=add; state.stats.xpEarned+=add; while(p.level<100&&p.xp>=p.xpNext){ p.xp-=p.xpNext; p.level++; p.xpNext=xpToNext(p.level);} if(p.level>=100){p.level=100;p.xp=p.xpNext;} save(); renderLevel(); renderJourney(); }
function grantGold(a){ const g=Math.max(0,Math.round(a)); state.player.gold=(state.player.gold||0)+g; state.stats.goldEarned+=(g||0); save(); renderWallet(); renderJourney(); }

// ===== UI: Level/Wallet/Attrs =====
function renderWallet(){ $('#gold').textContent=state.player.gold||0; $('#gold2').textContent=state.player.gold||0; }
function renderLevel(){ const p=state.player; $('#level-num').textContent=p.level; const rk=rankForLevel(p.level); $('#rank-text').textContent=rk; $('#rank-badge').textContent=rk; $('#xp-cur').textContent=p.xp; $('#xp-next').textContent=p.xpNext; $('#xp-fill').style.width=Math.max(0,Math.min(100,(p.xp/p.xpNext)*100))+'%'; }

function drawRadar(){ const c=$('#radar'); const ctx=c.getContext('2d'); const W=c.width, H=c.height; ctx.clearRect(0,0,W,H); const centerX=W/2, centerY=H/2+10, R=80; const labs=["Financial","Physical","Psyche","Intellect","Social","Spiritual"]; 
  ctx.strokeStyle='#222'; for(let ring=1; ring<=5; ring++){ ctx.beginPath(); for(let i=0;i<labs.length;i++){ const a=(Math.PI*2/labs.length)*i - Math.PI/2; const r=R*ring/5; const x=centerX+Math.cos(a)*r; const y=centerY+Math.sin(a)*r; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.stroke(); }
  for(let i=0;i<labs.length;i++){ const a=(Math.PI*2/labs.length)*i - Math.PI/2; ctx.beginPath(); ctx.moveTo(centerX,centerY); ctx.lineTo(centerX+Math.cos(a)*R, centerY+Math.sin(a)*R); ctx.stroke(); ctx.fillStyle='#a0a0a0'; ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.fillText(labs[i], centerX+Math.cos(a)*(R+16), centerY+Math.sin(a)*(R+16)); }
  ctx.beginPath(); for(let i=0;i<labs.length;i++){ const val=Math.max(0,Math.min(100,(state.attrs[labs[i]]||0))); const a=(Math.PI*2/labs.length)*i - Math.PI/2; const x=centerX+Math.cos(a)*(R*val/100); const y=centerY+Math.sin(a)*(R*val/100); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); } ctx.closePath(); ctx.fillStyle='rgba(77,163,255,0.15)'; ctx.fill(); ctx.strokeStyle='#4da3ff'; ctx.lineWidth=2; ctx.stroke();
}

function renderTiles(){ const grid=$('#attr-grid'); grid.innerHTML=''; const order=["Physical","Psyche","Intellect","Social","Spiritual","Financial"]; for(const lab of order){ const tile=document.createElement('div'); tile.className='tile'; tile.innerHTML=`<div class="n">${state.attrs[lab]||0}</div><div class="l">${lab.toUpperCase()}</div>`; grid.appendChild(tile); } drawRadar(); }

// ===== Navigation =====
function show(name){ $$('.screen').forEach(s=>s.classList.remove('visible')); $('#screen-'+name).classList.add('visible'); $$('.tab').forEach(t=>t.classList.remove('active')); if(name==='character') $('#tab-character').classList.add('active'); if(name==='quests') $('#tab-quests').classList.add('active'); if(name==='store') $('#tab-store').classList.add('active'); if(name==='focus') $('#tab-focus').classList.add('active'); if(name==='journey') $('#tab-journey').classList.add('active'); }
$('#tab-character').onclick=()=>{ $('#appbar-title').textContent='Character'; show('character'); };
$('#tab-quests').onclick=()=>{ $('#appbar-title').textContent='Quests'; show('quests'); };
$('#tab-store').onclick=()=>{ $('#appbar-title').textContent='Store'; show('store'); renderShop(); };
$('#tab-focus').onclick=()=>{ $('#appbar-title').textContent='Focus'; show('focus'); updateFocusUI(); };
$('#tab-journey').onclick=()=>{ $('#appbar-title').textContent='Journey'; show('journey'); renderJourney(); };
$('#btn-plus').onclick=()=>{ resetForm(); show('create'); $('#appbar-title').textContent='New Quest'; };
$('#btn-cancel').onclick=()=>{ show('quests'); $('#appbar-title').textContent='Quests'; };

// ===== Quests render & logic =====
function currentFilter(){ return document.querySelector('.chip.active')?.dataset.filter || 'all'; }
$$('.chip').forEach(c=>c.onclick=()=>{ $$('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); renderQuests(c.dataset.filter); });
function badgeHTML(q){ const b=[]; if(q.daily) b.push('<span class="badge">Daily</span>'); if(q.penalty) b.push('<span class="badge pen">Penalty</span>'); return b.join(''); }

function renderQuests(filter='all'){
  const list=$('#quest-list'); list.innerHTML='';
  const now=Date.now();
  const filtered=state.quests.filter(q=>{
    if(filter==='all') return true;
    if(filter==='daily') return q.daily;
    if(filter==='penalty') return q.penalty;
    if(filter==='active') return !q.completed && !(q.deadline && now>q.deadline);
    if(filter==='completed') return q.completed;
    if(filter==='expired') return q.deadline && now>q.deadline && !q.completed;
  });
  $('#empty-note').style.display = filtered.length? 'none':'block';

  for(const q of filtered){
    const node=document.createElement('div'); node.className='card quest';
    const diff=DIFF[q.diff||'normal'];
    node.innerHTML = `
      <div class="badges">${badgeHTML(q)}</div>
      <div class="q-top">
        <div class="q-title">${q.title} <span class="hint">(${diff.label} • ${q.attr})</span></div>
        <div class="q-xp">+${rewardXP(q)} XP · 💰${rewardGold(q)} · ⬡ +${rewardAttr(q)} ${q.attr}</div>
      </div>
      <div class="q-sub"></div>
      <div class="q-progress"><div class="q-fill" style="width:0%"></div></div>
      <div class="q-actions">
        <button class="btn small start hidden">Start</button>
        <button class="btn small complete">Done</button>
        <button class="btn small ghost pause hidden">Pause</button>
        <button class="btn small ghost resume hidden">Resume</button>
        <button class="btn small ghost inc hidden">+1</button>
        <button class="btn small ghost dec hidden">−1</button>
        <div class="spacer"></div>
        <button class="btn small ghost edit">Edit</button>
        <button class="btn small ghost delete">Delete</button>
      </div>`;
    const sub=node.querySelector('.q-sub'); const fill=node.querySelector('.q-fill');
    const btnS=node.querySelector('.start'); const btnC=node.querySelector('.complete'); const btnP=node.querySelector('.pause'); const btnR=node.querySelector('.resume'); const btnI=node.querySelector('.inc'); const btnD=node.querySelector('.dec'); const btnE=node.querySelector('.edit'); const btnDel=node.querySelector('.delete');

    if(q.type==='timer'){
      if(!q.started){ sub.textContent='Not started'; btnS.classList.remove('hidden'); }
      else{
        const rem=timerRemaining(q); const pct=Math.max(0,Math.min(1,1-rem/q.durationMs));
        fill.style.width=(pct*100)+'%'; sub.textContent=(q.paused?'Paused — ':'')+formatTime(rem); (q.paused?btnR:btnP).classList.remove('hidden');
      }
    } else if(q.type==='counter'){
      const pct=Math.min(1,(q.count||0)/q.target); fill.style.width=(pct*100)+'%'; sub.textContent=`Count ${q.count||0}/${q.target}`; btnI.classList.remove('hidden'); btnD.classList.remove('hidden');
    } else if(q.type==='checklist'){
      const done=(q.done||[]).filter(Boolean).length, total=(q.items||[]).length; const pct=total?done/total:0; fill.style.width=(pct*100)+'%'; sub.textContent=`${done}/${total} items`;
    } else if(q.type==='multicounter'){
      const total = q.metrics.reduce((s,m)=>s+m.target,0);
      const have  = q.metrics.reduce((s,m)=>s+Math.min(m.count||0,m.target),0);
      const pct   = total? have/total : 0;
      fill.style.width=(pct*100)+'%';
      const rows = q.metrics.map((m,idx)=>`
        <div class="multi-row" data-idx="${idx}">
          <div class="lbl">${m.label}</div>
          <div class="val">${m.count||0} / ${m.target}</div>
          <button class="btn small ghost mdec">−1</button>
          <button class="btn small ghost minc">+1</button>
        </div>`).join('');
      sub.innerHTML = `<div class="multi">${rows}</div>`;
      sub.querySelectorAll('.multi-row').forEach(row=>{
        const i=Number(row.dataset.idx);
        row.querySelector('.minc').onclick=()=>{ q.metrics[i].count=Math.min(q.metrics[i].target,(q.metrics[i].count||0)+1); save(); renderQuests(filter); if(q.metrics.every(m=>(m.count||0)>=m.target)&&!q.completed){ finishQuest(q, filter);} };
        row.querySelector('.mdec').onclick=()=>{ q.metrics[i].count=Math.max(0,(q.metrics[i].count||0)-1); save(); renderQuests(filter); };
      });
    }

    btnS.onclick=()=>{ const now=Date.now(); q.startTs=now; q.endTs=now+(q.durationMs||0); q.started=true; q.paused=false; save(); renderQuests(filter); };
    btnC.onclick=()=>finishQuest(q, filter);
    if(btnP) btnP.onclick=()=>{ q.paused=true; q.pauseTs=Date.now(); save(); renderQuests(filter); };
    if(btnR) btnR.onclick=()=>{ if(q.paused){ const pausedFor=Date.now()-(q.pauseTs||Date.now()); q.endTs+=pausedFor; q.paused=false; save(); renderQuests(filter);} };
    if(btnI) btnI.onclick=()=>{ q.count=Math.min(q.target,(q.count||0)+1); if(q.count>=q.target && !q.completed){ finishQuest(q, filter); } else { save(); renderQuests(filter);} };
    if(btnD) btnD.onclick=()=>{ q.count=Math.max(0,(q.count||0)-1); save(); renderQuests(filter); };
    btnE.onclick=()=>{ populateForm(q); show('create'); $('#appbar-title').textContent='Edit Quest'; };
    btnDel.onclick=()=>{ state.quests=state.quests.filter(x=>x.id!==q.id); save(); renderQuests(filter); };

    list.appendChild(node);
  }
}
function rewardXP(q){ const m=DIFF[q.diff||'normal'].mult; return Math.round((q.xp||0)*m); }
function rewardGold(q){ const m=DIFF[q.diff||'normal'].mult; return Math.round(10*m); }
function rewardAttr(q){ return ATTR_REWARD[q.diff||'normal']||1; }
function applyAttributeReward(q){ const a=q.attr; if(!a) return; state.attrs[a]=(state.attrs[a]||0)+rewardAttr(q); }

function finishQuest(q, filter){
  if(q.completed) return;
  q.completed=true;
  state.stats.completed++;
  if(q.penalty) state.stats.penaltiesCleared++;
  state.stats.lastCompletionDay = todayKey();
  grantXP(rewardXP(q)); grantGold(rewardGold(q)); applyAttributeReward(q);
  notify('Quest Complete', `${q.title} finished!`);
  if(q.repeat && q.repeat!=='none'){
    const next=structuredClone(q); next.id=++state.lastId; next.completed=false;
    if(q.type==='timer'){ next.started=false; next.paused=false; delete next.startTs; delete next.endTs; delete next.pauseTs; }
    if(q.type==='counter'){ next.count=0; }
    if(q.type==='checklist'){ next.done=(q.items||[]).map(()=>false); }
    if(q.type==='multicounter'){ next.metrics=next.metrics.map(m=>({label:m.label,target:m.target,count:0})); }
    if(q.deadline){ const d=new Date(q.deadline); if(q.repeat==='daily') d.setDate(d.getDate()+1); if(q.repeat==='weekly') d.setDate(d.getDate()+7); next.deadline=d.getTime(); }
    state.quests.push(next);
  }
  save(); renderQuests(filter); renderTiles(); drawRadar(); renderJourney();
}
setInterval(()=>{ let touched=false; for(const q of state.quests){ if(q.type==='timer' && q.started && !q.completed && !q.paused && timerRemaining(q)<=0){ finishQuest(q, currentFilter()); touched=true; } } if(touched){ save(); renderQuests(currentFilter()); } },1000);
function timerRemaining(q){ if(q.paused) return Math.max(0,q.endTs-(q.pauseTs||Date.now())); return Math.max(0,(q.endTs||0)-Date.now()); }
function formatTime(ms){ const s=Math.max(0,Math.ceil(ms/1000)); const m=Math.floor(s/60); const ss=(''+(s%60)).padStart(2,'0'); const mm=(''+(m%60)).padStart(2,'0'); const hh=Math.floor(m/60); return hh>0?`${hh}:${mm}:${ss}`:`${m}:${ss}`; }

// ===== Quest form =====
function resetForm(){ const f=$('#quest-form'); f.dataset.editing=''; $('#q-title').value=''; $('#q-desc').value=''; $('#q-attr').value='Physical'; $('#q-type').value='timer'; $('#q-duration').value=30; $('#q-target').value=10; $('#q-items').value=''; $('#q-multi').value=''; $('#q-diff').value='normal'; $('#q-deadline').value=''; $('#q-repeat').value='none'; $('#q-xp').value=25; $('#q-remind').value=10; updateTypeFields(); }
function populateForm(q){ const f=$('#quest-form'); f.dataset.editing=String(q.id); $('#q-title').value=q.title; $('#q-desc').value=q.desc||''; $('#q-attr').value=q.attr||'Physical'; $('#q-type').value=q.type; $('#q-diff').value=q.diff||'normal'; $('#q-duration').value=Math.round((q.durationMs||0)/60000)||30; $('#q-target').value=q.target||10; $('#q-items').value=(q.items||[]).join(', '); $('#q-multi').value=(q.metrics||[]).map(m=>`${m.label}:${m.target}`).join(', '); $('#q-deadline').value=q.deadline? new Date(q.deadline).toISOString().slice(0,16):''; $('#q-repeat').value=q.repeat||'none'; $('#q-xp').value=q.xp||25; $('#q-remind').value=q.remindMin||10; updateTypeFields(); }
$('#q-type').onchange=updateTypeFields; function updateTypeFields(){ const t=$('#q-type').value; $$('.if').forEach(el=>el.classList.remove('show')); $$('.if.'+t).forEach(el=>el.classList.add('show')); }
document.querySelector('#quest-form').addEventListener('submit',(ev)=>{
  ev.preventDefault();
  const editingId=$('#quest-form').dataset.editing;
  const t=$('#q-type').value;
  const quest={ id:editingId?Number(editingId):++state.lastId, title:$('#q-title').value.trim(), desc:$('#q-desc').value.trim(), attr:$('#q-attr').value, type:t, diff:$('#q-diff').value, repeat:$('#q-repeat').value, xp:Number($('#q-xp').value)||0, completed:false, remindMin:Number($('#q-remind').value)||0, daily:false, penalty:false, dayKey:null };
  const deadlineStr=$('#q-deadline').value; quest.deadline = deadlineStr? new Date(deadlineStr).getTime(): null;
  if(t==='timer'){ const mins=Math.max(1, Number($('#q-duration').value)||30); quest.durationMs=mins*60000; quest.started=false; quest.paused=false; }
  if(t==='counter'){ quest.target=Math.max(1, Number($('#q-target').value)||10); quest.count = editingId ? (state.quests.find(x=>x.id===quest.id)?.count||0):0; }
  if(t==='checklist'){ quest.items=$('#q-items').value.split(',').map(s=>s.trim()).filter(Boolean); quest.done = editingId ? (state.quests.find(x=>x.id===quest.id)?.done||quest.items.map(()=>false)) : quest.items.map(()=>false); }
  if(t==='multicounter'){ quest.metrics = $('#q-multi').value.split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{ const p=pair.split(':'); const label=p[0].trim(); const target=Math.max(1, Number(p[1])||1); const existing=editingId? (state.quests.find(x=>x.id===quest.id)?.metrics||[]):[]; const found=existing.find(m=>m.label===label); return {label,target,count:found?found.count:0}; }); }
  if(editingId){ const idx=state.quests.findIndex(x=>x.id===quest.id); state.quests[idx]=quest; } else { state.quests.push(quest); }
  save(); renderQuests(currentFilter()); show('quests'); $('#appbar-title').textContent='Quests';
});

// ===== Daily generator & penalties + streak counting =====
const DAILY_TEMPLATES=[
  {title:'Meditate for 10 minutes', attr:'Spiritual', type:'timer', mins:10, diff:'easy', xp:12},
  {title:'Read 15 pages of a book', attr:'Intellect', type:'counter', target:15, diff:'normal', xp:20},
  {title:'Stretch routine 15 min', attr:'Physical', type:'timer', mins:15, diff:'normal', xp:24},
  {title:'Write in journal (3 prompts)', attr:'Psyche', type:'checklist', items:['Gratitude x3','One win','One focus'], diff:'easy', xp:15},
  {title:'Deep clean a room', attr:'Social', type:'checklist', items:['Declutter','Wipe surfaces','Vacuum'], diff:'hard', xp:35},
  {title:'Cold shower (3 minutes)', attr:'Psyche', type:'timer', mins:3, diff:'hard', xp:28},
  {title:'Study/Skill practice 30 min', attr:'Intellect', type:'timer', mins:30, diff:'hard', xp:40},
  {title:'Call or text a loved one', attr:'Social', type:'counter', target:1, diff:'easy', xp:10},
  {title:'Cook a healthy meal', attr:'Physical', type:'checklist', items:['Prep','Cook','Clean'], diff:'normal', xp:25}
];

// Strength Training as a SINGLE multicounter quest
const STRENGTH_MULTI={
  title:'Strength Training',
  attr:'Physical',
  type:'multicounter',
  diff:'elite',
  xp:120,
  metrics:[
    {label:'Pushups', target:100, count:0},
    {label:'Sit-ups', target:100, count:0},
    {label:'Squats',  target:100, count:0},
    {label:'Run (miles)', target:1, count:0}
  ]
};

const PENALTY_TEMPLATES=[
  {title:'Penalty — Do 50 pushups', attr:'Physical', type:'counter', target:50, diff:'hard', xp:18},
  {title:'Penalty — 60-second cold shower', attr:'Psyche', type:'timer', mins:1, diff:'hard', xp:16},
  {title:'Penalty — Clean your desk', attr:'Social', type:'checklist', items:['Clear','Wipe','Organize'], diff:'normal', xp:14},
  {title:'Penalty — 100 squats', attr:'Physical', type:'counter', target:100, diff:'elite', xp:30},
  {title:'Penalty — 20 minute brisk walk', attr:'Physical', type:'timer', mins:20, diff:'normal', xp:18}
];

function pickRandom(arr,n){ const a=[...arr]; const out=[]; while(a.length && out.length<n){ out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); } return out; }

function ensureStrengthTraining(dayKey){
  const exists = state.quests.some(q=>q.daily && q.dayKey===dayKey && q.title==='Strength Training');
  if(exists) return;
  const base = JSON.parse(JSON.stringify(STRENGTH_MULTI));
  base.id=++state.lastId; base.completed=false; base.remindMin=10; base.daily=true; base.penalty=false; base.dayKey=dayKey; base.deadline=endOfToday();
  state.quests.push(base);
}

function generateDailySet(dayKey){
  ensureStrengthTraining(dayKey);
  const already = new Set(state.quests.filter(q=>q.daily && q.dayKey===dayKey).map(q=>q.title));
  const pool = DAILY_TEMPLATES.filter(t=>!already.has(t.title));
  const picks = pickRandom(pool, Math.min(2, pool.length));
  for(const t of picks){
    const q={ id: ++state.lastId, title:t.title, desc:'', attr:t.attr, type:t.type, diff:t.diff, repeat:'none', xp:t.xp, completed:false, remindMin:10, daily:true, penalty:false, dayKey, deadline:endOfToday() };
    if(t.type==='timer'){ q.durationMs=(t.mins||10)*60000; q.started=false; }
    if(t.type==='counter'){ q.target=t.target||1; q.count=0; }
    if(t.type==='checklist'){ q.items=t.items||[]; q.done=(q.items||[]).map(()=>false); }
    state.quests.push(q);
  }
}

function generatePenaltiesFor(dayKeyMissed){
  const missed = state.quests.filter(q=>q.daily && q.dayKey===dayKeyMissed && !q.completed);
  if(!missed.length) return;
  const count = Math.min(3, missed.length);
  const picks = pickRandom(PENALTY_TEMPLATES, count);
  for(const t of picks){
    const q={ id: ++state.lastId, title:t.title, desc:'', attr:t.attr, type:t.type, diff:t.diff, repeat:'none', xp:t.xp, completed:false, remindMin:0, daily:false, penalty:true, dayKey: todayKey(), deadline:endOfToday() };
    if(t.type==='timer'){ q.durationMs=(t.mins||10)*60000; q.started=false; }
    if(t.type==='counter'){ q.target=t.target||1; q.count=0; }
    if(t.type==='checklist'){ q.items=t.items||[]; q.done=(q.items||[]).map(()=>false); }
    state.quests.push(q);
  }
}

function onNewDay(prevKey, currentKey){
  if(prevKey){
    const didCompleteYesterday = state.stats.lastCompletionDay === prevKey;
    state.stats.currentStreak = didCompleteYesterday ? (state.stats.currentStreak||0)+1 : 0;
    state.stats.longestStreak = Math.max(state.stats.longestStreak||0, state.stats.currentStreak);
    generatePenaltiesFor(prevKey);
  }
  generateDailySet(currentKey);
  state.lastDailyKey = currentKey;
  save();
}

// ===== Shop =====
function renderShop(){ const list=$('#shop-list'); list.innerHTML=''; const items=state.shop||[]; $('#shop-empty').style.display = items.length?'none':'block'; for(const it of items){ const node=document.createElement('div'); node.className='card'; node.innerHTML=`<div class="q-top"><div class="q-title">${it.title}</div><div class="q-xp">💰 ${it.cost}</div></div><div class="q-sub">${it.desc||''}</div><div class="q-actions"><button class="btn small buy">Buy</button><div class="spacer"></div><button class="btn small ghost del">Delete</button></div>`; node.querySelector('.buy').onclick=()=>{ if(state.player.gold<(it.cost||0)) return alert('Not enough gold'); state.player.gold-=it.cost||0; save(); renderWallet(); }; node.querySelector('.del').onclick=()=>{ state.shop=state.shop.filter(x=>x.id!==it.id); save(); renderShop(); }; list.appendChild(node); } }
$('#btn-add-reward').onclick=()=>{ $('#reward-form').classList.remove('hidden'); }; $('#r-cancel').onclick=()=>{ $('#reward-form').classList.add('hidden'); };
document.querySelector('#reward-form').addEventListener('submit',(ev)=>{ ev.preventDefault(); const item={ id:Date.now(), title:$('#r-title').value.trim(), desc:$('#r-desc').value.trim(), cost:Math.max(1,Number($('#r-cost').value)||1) }; state.shop.push(item); save(); $('#r-title').value=''; $('#r-desc').value=''; $('#r-cost').value=50; $('#reward-form').classList.add('hidden'); renderShop(); });

// ===== Focus (locks app) + stats minutes =====
let focus={running:false,endTs:0,paused:false,pauseTs:0,timer:null,startedAt:0};
function updateFocusUI(){ const runningNow = focus.running && (focus.endTs>Date.now()); const remaining=Math.max(0, focus.paused ? focus.endTs-(focus.pauseTs||Date.now()) : focus.endTs-Date.now()); $('#focus-time').textContent=formatTime(remaining); $('#focus-start').classList.toggle('hidden',runningNow); $('#focus-pause').classList.toggle('hidden',!(runningNow&&!focus.paused)); $('#focus-resume').classList.toggle('hidden',!(runningNow&&focus.paused)); $('#lock-overlay').classList.toggle('hidden',!runningNow); }
$('#focus-start').onclick=()=>{ const mins=Math.max(1, Number($('#focus-mins').value)||25); focus.running=true; focus.paused=false; focus.startedAt=Date.now(); focus.endTs=focus.startedAt+mins*60000; if(focus.timer) clearInterval(focus.timer); focus.timer=setInterval(()=>{ const left=focus.endTs-Date.now(); updateFocusUI(); if(left<=0){ clearInterval(focus.timer); focus.running=false; const minutes=Math.round((Date.now()-focus.startedAt)/60000); state.stats.focusMinutes += minutes; notify('Focus complete','Great work!'); save(); updateFocusUI(); } },500); updateFocusUI(); };
$('#focus-pause').onclick=()=>{ focus.paused=true; focus.pauseTs=Date.now(); updateFocusUI(); };
$('#focus-resume').onclick=()=>{ if(focus.paused){ const pausedFor=Date.now()-focus.pauseTs; focus.endTs+=pausedFor; focus.paused=false; updateFocusUI(); } };
$('#focus-cancel').onclick=()=>{ focus.running=false; if(focus.timer) clearInterval(focus.timer); $('#lock-overlay').classList.add('hidden'); updateFocusUI(); };

// ===== Journey (progress & achievements) =====
const ACH = [
  {id:'lv10',  name:'Apprentice', desc:'Reach Level 10',  check: s=>s.player.level>=10},
  {id:'lv50',  name:'Veteran',    desc:'Reach Level 50',  check: s=>s.player.level>=50},
  {id:'lv100', name:'Shadow Monarch', desc:'Reach Level 100', check: s=>s.player.level>=100},
  {id:'q10',   name:'Getting Things Done', desc:'Complete 10 quests', check: s=>s.stats.completed>=10},
  {id:'q50',   name:'Task Slayer', desc:'Complete 50 quests', check: s=>s.stats.completed>=50},
  {id:'gold1', name:'Shopper',     desc:'Earn 500 gold total', check: s=>s.stats.goldEarned>=500},
  {id:'streak3', name:'Consistency', desc:'3-day streak', check: s=>s.stats.longestStreak>=3},
  {id:'streak7', name:'Iron Will', desc:'7-day streak', check: s=>s.stats.longestStreak>=7},
  {id:'pen5',  name:'Redeemer',    desc:'Clear 5 penalty quests', check: s=>s.stats.penaltiesCleared>=5},
  {id:'focus5',name:'Deep Worker', desc:'Accumulate 300 focus minutes', check: s=>s.stats.focusMinutes>=300}
];
function renderJourney(){
  $('#j-level').textContent = `Lv ${state.player.level} (${rankForLevel(state.player.level)})`;
  $('#j-xp').style.width = Math.max(0,Math.min(100,(state.player.xp/state.player.xpNext)*100))+'%';
  $('#j-completed').textContent = `${state.stats.completed} total`;
  const completePct = Math.min(1, state.stats.completed/50);
  $('#j-complete-bar').style.width = (completePct*100)+'%';
  $('#j-streak').textContent = `${state.stats.currentStreak} (best ${state.stats.longestStreak})`;
  $('#j-streak-bar').style.width = Math.min(100, state.stats.currentStreak*10)+'%';
  $('#j-gold').textContent = `${state.stats.goldEarned} earned`;
  const list = $('#achievements'); list.innerHTML='';
  for(const a of ACH){
    const done = a.check(state);
    const row = document.createElement('div'); row.className='ach'+(done?' done':'');
    row.innerHTML = `<div><div style="font-weight:700">${a.name}</div><div class="hint">${a.desc}</div></div><div>${done?'✅':'⬜️'}</div>`;
    list.appendChild(row);
  }
}

// ===== init & daily handling =====
function init(){
  if(!state.player){ state.player={level:1,xp:0,xpNext:xpToNext(1),gold:0}; }
  state.player.xpNext = xpToNext(state.player.level);
  const today = todayKey();
  if(state.lastDailyKey !== today){ onNewDay(state.lastDailyKey, today); }
  renderWallet(); renderLevel(); renderTiles(); drawRadar(); renderQuests('all'); renderShop(); renderJourney();
  if('Notification' in window && Notification.permission==='default'){ setTimeout(()=>Notification.requestPermission(), 600); }
  updateFocusUI();
}
window.addEventListener('DOMContentLoaded', init);
