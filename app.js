// ===== helpers =====
const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
function notify(title, body){ if(!('Notification' in window)) return; if(Notification.permission==='granted'){ (registration && registration.showNotification) ? registration.showNotification(title,{body}) : new Notification(title,{body}); } else if(Notification.permission!=='denied'){ Notification.requestPermission().then(p=>{ if(p==='granted') notify(title, body); }); } }
const todayKey=()=>{ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; };
const endOfToday=()=>{ const d=new Date(); d.setHours(23,59,59,999); return d.getTime(); };

// ===== state =====
const defaultState={ player:{level:1,xp:0,xpNext:50,gold:0,ap:0}, attrs:{Physical:0,Psyche:0,Intellect:0,Financial:0,Social:0,Spiritual:0}, quests:[], shop:[], lastId:0, lastDailyKey:null };
let state=load(); function load(){ try{ return JSON.parse(localStorage.getItem('shadowhud-daily'))||structuredClone(defaultState);}catch(e){ return structuredClone(defaultState);} } function save(){ localStorage.setItem('shadowhud-daily', JSON.stringify(state)); }

// ===== curves & rewards =====
const DIFF={easy:{label:'Easy',mult:1.0},normal:{label:'Normal',mult:1.5},hard:{label:'Hard',mult:2.2},elite:{label:'Elite',mult:3.2},boss:{label:'Boss',mult:5.0}};
function xpToNext(level){ return Math.round(40+6*level+0.6*level*level); }
function rankForLevel(l){ if(l<15)return'E'; if(l<30)return'D'; if(l<45)return'C'; if(l<60)return'B'; if(l<75)return'A'; return'S'; }
function grantXP(a){ const p=state.player; if(p.level>=100) return; p.xp+=Math.max(0,a|0); while(p.level<100&&p.xp>=p.xpNext){ p.xp-=p.xpNext; p.level++; p.xpNext=xpToNext(p.level);} if(p.level>=100){p.level=100;p.xp=p.xpNext;} save(); renderLevel(); }
function grantGold(a){ state.player.gold=Math.max(0,Math.round((state.player.gold||0)+a)); save(); renderWallet(); }
function grantAP(a){ state.player.ap=Math.max(0,Math.round((state.player.ap||0)+a)); save(); renderWallet(); }
function rewardXP(q){ const m=DIFF[q.diff||'normal'].mult; return Math.round((q.xp||0)*m); }
function rewardAP(q){ const m=DIFF[q.diff||'normal'].mult; return Math.max(1, Math.round(1*m)); }
function rewardGold(q){ const m=DIFF[q.diff||'normal'].mult; return Math.round(10*m); }

// ===== UI: Level/Wallet/Attrs =====
function renderWallet(){ $('#gold').textContent=state.player.gold||0; $('#gold2').textContent=state.player.gold||0; $('#ap').textContent=state.player.ap||0; }
function renderLevel(){ const p=state.player; $('#level-num').textContent=p.level; const rk=rankForLevel(p.level); $('#rank-text').textContent=rk; $('#rank-badge').textContent=rk; $('#xp-cur').textContent=p.xp; $('#xp-next').textContent=p.xpNext; $('#xp-fill').style.width=Math.max(0,Math.min(100,(p.xp/p.xpNext)*100))+'%'; }
const radarLabels=["Financial","Physical","Psyche","Intellect","Social","Spiritual"];
function renderRadar(){ const svg=$('#radar'); svg.innerHTML=''; const rings=5,R=48; for(let i=1;i<=rings;i++){ svg.appendChild(poly(R*i/rings,'#222')); } radarLabels.forEach((lab,i)=>{ const a=(Math.PI*2/radarLabels.length)*i-Math.PI/2; line(0,0,Math.cos(a)*R,Math.sin(a)*R,'#222'); const t=document.createElementNS('http://www.w3.org/2000/svg','text'); t.setAttribute('x',Math.cos(a)*(R+12)); t.setAttribute('y',Math.sin(a)*(R+12)); t.setAttribute('fill','#a0a0a0'); t.setAttribute('font-size','5'); t.setAttribute('text-anchor','middle'); t.textContent=lab; svg.appendChild(t); }); const pts=radarLabels.map((lab,i)=>{ const v=Math.max(0,Math.min(100,state.attrs[lab]||0)); const a=(Math.PI*2/radarLabels.length)*i-Math.PI/2; const r=(v/100)*R; return [Math.cos(a)*r,Math.sin(a)*r]; }); const p=document.createElementNS('http://www.w3.org/2000/svg','polygon'); p.setAttribute('points',pts.map(p=>p.join(',')).join(' ')); p.setAttribute('fill','#4da3ff22'); p.setAttribute('stroke','#4da3ff'); p.setAttribute('stroke-width','1.5'); svg.appendChild(p); function poly(r,stroke){ const pts=radarLabels.map((_,i)=>{ const a=(Math.PI*2/radarLabels.length)*i-Math.PI/2; return [Math.cos(a)*r,Math.sin(a)*r];}); const g=document.createElementNS('http://www.w3.org/2000/svg','polygon'); g.setAttribute('points',pts.map(p=>p.join(',')).join(' ')); g.setAttribute('fill','none'); g.setAttribute('stroke',stroke); g.setAttribute('stroke-width','0.6'); return g;} function line(x1,y1,x2,y2,stroke){ const l=document.createElementNS('http://www.w3.org/2000/svg','line'); l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2); l.setAttribute('stroke',stroke); l.setAttribute('stroke-width','0.6'); svg.appendChild(l);} }
function renderTiles(){ const grid=$('#attr-grid'); grid.innerHTML=''; const order=["Physical","Psyche","Intellect","Social","Spiritual","Financial"]; for(const lab of order){ const tile=document.createElement('div'); tile.className='tile'; tile.innerHTML=`<div class="n">${state.attrs[lab]||0}</div><div class="l">${lab.toUpperCase()}</div><button class="plus">＋</button>`; tile.querySelector('.plus').onclick=()=>{ if((state.player.ap||0)<=0) return alert('No attribute points to spend.'); state.attrs[lab]=Math.min(100,(state.attrs[lab]||0)+1); state.player.ap--; save(); renderTiles(); renderRadar(); renderWallet(); }; grid.appendChild(tile);} }

// ===== Navigation =====
function show(name){ $$('.screen').forEach(s=>s.classList.remove('visible')); $('#screen-'+name).classList.add('visible'); $$('.tab').forEach(t=>t.classList.remove('active')); if(name==='character') $('#tab-character').classList.add('active'); if(name==='quests') $('#tab-quests').classList.add('active'); if(name==='store') $('#tab-store').classList.add('active'); if(name==='focus') $('#tab-focus').classList.add('active'); }
$('#tab-character').onclick=()=>{ $('#appbar-title').textContent='Character'; show('character'); };
$('#tab-quests').onclick=()=>{ $('#appbar-title').textContent='Quests'; show('quests'); };
$('#tab-store').onclick=()=>{ $('#appbar-title').textContent='Store'; show('store'); renderShop(); };
$('#tab-focus').onclick=()=>{ $('#appbar-title').textContent='Focus'; show('focus'); };
$('#tab-journey').onclick=()=>alert('Journey coming soon');
$('#btn-plus').onclick=()=>{ resetForm(); show('create'); $('#appbar-title').textContent='New Quest'; };
$('#btn-cancel').onclick=()=>{ show('quests'); $('#appbar-title').textContent='Quests'; };

// ===== Quests render & logic =====
function currentFilter(){ return document.querySelector('.chip.active')?.dataset.filter || 'all'; }
$$('.chip').forEach(c=>c.onclick=()=>{ $$('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); renderQuests(c.dataset.filter); });

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
    const badges = (q.daily?'<span class="pill">Daily</span> ':'') + (q.penalty?'<span class="pill" style="border-color:#884;">Penalty</span> ':'');
    node.innerHTML = `
      <div class="q-top">
        <div class="q-title">${q.title} <span class="hint">(${diff.label})</span> ${badges}</div>
        <div class="q-xp">+${rewardXP(q)} XP · ⭐${rewardAP(q)} · 💰${rewardGold(q)}</div>
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
    const sub=node.querySelector('.q-sub'); const fill=node.querySelector('.q-fill');
    const btnC=node.querySelector('.complete'); const btnP=node.querySelector('.pause'); const btnR=node.querySelector('.resume'); const btnI=node.querySelector('.inc'); const btnD=node.querySelector('.dec'); const btnE=node.querySelector('.edit'); const btnDel=node.querySelector('.delete');

    if(q.type==='timer'){ const rem=timerRemaining(q); const pct=Math.max(0,Math.min(1,1-rem/q.durationMs)); fill.style.width=(pct*100)+'%'; sub.textContent=(q.paused?'Paused — ':'')+formatTime(rem); (q.paused?btnR:btnP).classList.remove('hidden'); }
    else if(q.type==='counter'){ const pct=Math.min(1,(q.count||0)/q.target); fill.style.width=(pct*100)+'%'; sub.textContent=`Count ${q.count||0}/${q.target}`; btnI.classList.remove('hidden'); btnD.classList.remove('hidden'); }
    else if(q.type==='checklist'){ const done=(q.done||[]).filter(Boolean).length; const total=(q.items||[]).length; const pct=total?done/total:0; fill.style.width=(pct*100)+'%'; sub.textContent=`${done}/${total} items`; }

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
function finishQuest(q, filter){ if(q.completed) return; q.completed=true; grantXP(rewardXP(q)); grantAP(rewardAP(q)); grantGold(rewardGold(q)); notify('Quest Complete', `${q.title} finished!`);
  if(q.repeat && q.repeat!=='none'){ const next=structuredClone(q); next.id=++state.lastId; next.completed=false; if(q.type==='timer'){ const now=Date.now(); next.startTs=now; next.endTs=now+(q.durationMs||0); next.paused=false; delete next.pauseTs; } if(q.type==='counter'){ next.count=0; } if(q.type==='checklist'){ next.done=(q.items||[]).map(()=>false); } if(q.deadline){ const d=new Date(q.deadline); if(q.repeat==='daily') d.setDate(d.getDate()+1); if(q.repeat==='weekly') d.setDate(d.getDate()+7); next.deadline=d.getTime(); } state.quests.push(next); }
  save(); renderQuests(filter);
}
setInterval(()=>{ let touched=false; for(const q of state.quests){ if(q.type==='timer'&&!q.completed&&!q.paused&&timerRemaining(q)<=0){ finishQuest(q, currentFilter()); touched=true; } } if(touched){ save(); renderQuests(currentFilter()); } },1000);
function timerRemaining(q){ if(q.paused) return Math.max(0,q.endTs-(q.pauseTs||Date.now())); return Math.max(0,q.endTs-Date.now()); }
function formatTime(ms){ const s=Math.ceil(ms/1000); const m=Math.floor(s/60); const ss=(''+(s%60)).padStart(2,'0'); const mm=(''+(m%60)).padStart(2,'0'); const hh=Math.floor(m/60); return hh>0?`${hh}:${mm}:${ss}`:`${m}:${ss}`; }

// ===== Quest form =====
function resetForm(){ const f=$('#quest-form'); f.dataset.editing=''; $('#q-title').value=''; $('#q-desc').value=''; $('#q-type').value='timer'; $('#q-duration').value=30; $('#q-target').value=10; $('#q-items').value=''; $('#q-diff').value='normal'; $('#q-deadline').value=''; $('#q-repeat').value='none'; $('#q-xp').value=25; $('#q-remind').value=10; updateTypeFields(); }
function populateForm(q){ const f=$('#quest-form'); f.dataset.editing=String(q.id); $('#q-title').value=q.title; $('#q-desc').value=q.desc||''; $('#q-type').value=q.type; $('#q-diff').value=q.diff||'normal'; $('#q-duration').value=Math.round((q.durationMs||0)/60000)||30; $('#q-target').value=q.target||10; $('#q-items').value=(q.items||[]).join(', '); $('#q-deadline').value=q.deadline? new Date(q.deadline).toISOString().slice(0,16):''; $('#q-repeat').value=q.repeat||'none'; $('#q-xp').value=q.xp||25; $('#q-remind').value=q.remindMin||10; updateTypeFields(); }
$('#q-type').onchange=updateTypeFields; function updateTypeFields(){ const t=$('#q-type').value; $$('.if').forEach(el=>el.classList.remove('show')); $$('.if.'+t).forEach(el=>el.classList.add('show')); }
document.querySelector('#quest-form').addEventListener('submit',(ev)=>{ ev.preventDefault(); const editingId=$('#quest-form').dataset.editing; const t=$('#q-type').value; const quest={ id:editingId?Number(editingId):++state.lastId, title:$('#q-title').value.trim(), desc:$('#q-desc').value.trim(), type:t, diff:$('#q-diff').value, repeat:$('#q-repeat').value, xp:Number($('#q-xp').value)||0, completed:false, remindMin:Number($('#q-remind').value)||0, daily:false, penalty:false, dayKey:null }; const deadlineStr=$('#q-deadline').value; quest.deadline=deadlineStr? new Date(deadlineStr).getTime():null; if(t==='timer'){ const mins=Math.max(1, Number($('#q-duration').value)||30); const now=Date.now(); quest.durationMs=mins*60000; if(editingId){ const ex=state.quests.find(x=>x.id===quest.id); const remaining=ex? timerRemaining(ex):quest.durationMs; quest.startTs=now; quest.endTs=now+remaining; quest.paused=ex?.paused||false; } else { quest.startTs=now; quest.endTs=now+quest.durationMs; } } if(t==='counter'){ quest.target=Math.max(1, Number($('#q-target').value)||10); quest.count=editingId?(state.quests.find(x=>x.id===quest.id)?.count||0):0; } if(t==='checklist'){ quest.items=$('#q-items').value.split(',').map(s=>s.trim()).filter(Boolean); quest.done=editingId?(state.quests.find(x=>x.id===quest.id)?.done||quest.items.map(()=>false)) : quest.items.map(()=>false); } if(editingId){ const idx=state.quests.findIndex(x=>x.id===quest.id); state.quests[idx]=quest; } else { state.quests.push(quest); } save(); renderQuests(currentFilter()); show('quests'); $('#appbar-title').textContent='Quests'; });

// ===== Daily generator & penalties =====
const DAILY_TEMPLATES = [
  {title:'Meditate for 10 minutes', type:'timer', mins:10, diff:'easy', xp:12},
  {title:'Read 15 pages of a book', type:'counter', target:15, diff:'normal', xp:20},
  {title:'Walk 5,000 steps', type:'counter', target:5000, diff:'normal', xp:22},
  {title:'Write in journal (3 prompts)', type:'checklist', items:['Gratitude x3','One win','One focus'], diff:'easy', xp:15},
  {title:'Stretch routine 15 min', type:'timer', mins:15, diff:'normal', xp:24},
  {title:'Deep clean a room', type:'checklist', items:['Declutter','Wipe surfaces','Vacuum'], diff:'hard', xp:35},
  {title:'Cold shower (3 minutes)', type:'timer', mins:3, diff:'hard', xp:28},
  {title:'Study/Skill practice 30 min', type:'timer', mins:30, diff:'hard', xp:40},
  {title:'Call or text a loved one', type:'counter', target:1, diff:'easy', xp:10},
  {title:'Cook a healthy meal', type:'checklist', items:['Prep','Cook','Clean'], diff:'normal', xp:25}
];
const PENALTY_TEMPLATES = [
  {title:'Penalty — Do 50 pushups', type:'counter', target:50, diff:'hard', xp:18},
  {title:'Penalty — 60-second cold shower', type:'timer', mins:1, diff:'hard', xp:16},
  {title:'Penalty — Clean your desk', type:'checklist', items:['Clear','Wipe','Organize'], diff:'normal', xp:14},
  {title:'Penalty — 100 squats', type:'counter', target:100, diff:'elite', xp:30},
  {title:'Penalty — 20 minute brisk walk', type:'timer', mins:20, diff:'normal', xp:18}
];
function pickRandom(arr,n){ const a=[...arr]; const out=[]; while(a.length && out.length<n){ out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); } return out; }
function generateDailySet(dayKey){
  const howMany = 3 + Math.floor(Math.random()*2); // 3–4
  const picks = pickRandom(DAILY_TEMPLATES, howMany);
  for(const t of picks){
    const q={ id: ++state.lastId, title:t.title, desc:'', type:t.type, diff:t.diff, repeat:'none', xp:t.xp, completed:false, remindMin:10, daily:true, penalty:false, dayKey };
    if(t.type==='timer'){ const now=Date.now(); q.durationMs=(t.mins||10)*60000; q.startTs=now; q.endTs=now+q.durationMs; }
    if(t.type==='counter'){ q.target=t.target||1; q.count=0; }
    if(t.type==='checklist'){ q.items=t.items||[]; q.done=(q.items||[]).map(()=>false); }
    q.deadline = endOfToday();
    state.quests.push(q);
  }
}
function generatePenaltiesFor(dayKeyMissed){
  const missed = state.quests.filter(q=>q.daily && q.dayKey===dayKeyMissed && !q.completed);
  if(!missed.length) return;
  const count = Math.min(3, missed.length); // up to 3 penalties
  const picks = pickRandom(PENALTY_TEMPLATES, count);
  for(const t of picks){
    const q={ id: ++state.lastId, title:t.title, desc:'', type:t.type, diff:t.diff, repeat:'none', xp:t.xp, completed:false, remindMin:0, daily:false, penalty:true, dayKey: todayKey() };
    if(t.type==='timer'){ const now=Date.now(); q.durationMs=(t.mins||1)*60000; q.startTs=now; q.endTs=now+q.durationMs; }
    if(t.type==='counter'){ q.target=t.target||1; q.count=0; }
    if(t.type==='checklist'){ q.items=t.items||[]; q.done=(q.items||[]).map(()=>false); }
    q.deadline = endOfToday(); state.quests.push(q);
  }
}

// ===== Shop =====
function renderShop(){ const list=$('#shop-list'); list.innerHTML=''; const items=state.shop||[]; $('#shop-empty').style.display = items.length?'none':'block'; for(const it of items){ const node=document.createElement('div'); node.className='card'; node.innerHTML=`<div class="q-top"><div class="q-title">${it.title}</div><div class="q-xp">💰 ${it.cost}</div></div><div class="q-sub">${it.desc||''}</div><div class="q-actions"><button class="btn small buy">Buy</button><div class="spacer"></div><button class="btn small ghost del">Delete</button></div>`; node.querySelector('.buy').onclick=()=>{ if((state.player.gold||0)<it.cost) return alert('Not enough gold.'); state.player.gold-=it.cost; save(); renderWallet(); notify('Purchased',`You bought: ${it.title}`); }; node.querySelector('.del').onclick=()=>{ state.shop=state.shop.filter(x=>x.id!==it.id); save(); renderShop(); }; list.appendChild(node);} }
$('#btn-add-reward').onclick=()=>{ $('#reward-form').classList.remove('hidden'); }; $('#r-cancel').onclick=()=>{ $('#reward-form').classList.add('hidden'); };
document.querySelector('#reward-form').addEventListener('submit',(ev)=>{ ev.preventDefault(); const item={ id:Date.now(), title:$('#r-title').value.trim(), desc:$('#r-desc').value.trim(), cost:Math.max(1,Number($('#r-cost').value)||1) }; state.shop.push(item); save(); $('#r-title').value=''; $('#r-desc').value=''; $('#r-cost').value=50; $('#reward-form').classList.add('hidden'); renderShop(); });

// ===== Focus lock =====
let focus={running:false,endTs:0,paused:false,pauseTs:0,timer:null};
function updateFocusUI(){ const remaining=Math.max(0, focus.paused ? focus.endTs-(focus.pauseTs||Date.now()) : focus.endTs-Date.now()); $('#focus-time').textContent=formatTime(remaining); $('#focus-start').classList.toggle('hidden',focus.running); $('#focus-pause').classList.toggle('hidden',!(focus.running&&!focus.paused)); $('#focus-resume').classList.toggle('hidden',!(focus.running&&focus.paused)); $('#lock-overlay').classList.toggle('hidden',!focus.running); }
$('#focus-start').onclick=()=>{ const mins=Math.max(1, Number($('#focus-mins').value)||25); focus.running=true; focus.paused=false; focus.endTs=Date.now()+mins*60000; if(focus.timer) clearInterval(focus.timer); focus.timer=setInterval(()=>{ const left=focus.endTs-Date.now(); updateFocusUI(); if(left<=0){ clearInterval(focus.timer); focus.running=false; notify('Focus complete','Great work!'); $('#lock-overlay').classList.add('hidden'); updateFocusUI(); } },500); updateFocusUI(); };
$('#focus-pause').onclick=()=>{ focus.paused=true; focus.pauseTs=Date.now(); updateFocusUI(); };
$('#focus-resume').onclick=()=>{ if(focus.paused){ const pausedFor=Date.now()-focus.pauseTs; focus.endTs+=pausedFor; focus.paused=false; updateFocusUI(); } };
$('#focus-cancel').onclick=()=>{ focus.running=false; if(focus.timer) clearInterval(focus.timer); $('#lock-overlay').classList.add('hidden'); updateFocusUI(); };

// ===== init =====
function init(){
  if(!state.player){ state.player={level:1,xp:0,xpNext:xpToNext(1),gold:0,ap:0}; }
  state.player.xpNext = xpToNext(state.player.level);
  // new day handling
  const today = todayKey();
  if(state.lastDailyKey !== today){
    if(state.lastDailyKey){ generatePenaltiesFor(state.lastDailyKey); }
    generateDailySet(today);
    state.lastDailyKey = today; save();
  }

  renderWallet(); renderLevel(); renderRadar(); renderTiles(); renderQuests('all'); renderShop();
  // Schedule reminders for today's dailies
  for(const q of state.quests){ if(q.daily && q.dayKey===today && q.remindMin>0){ const when=q.deadline - q.remindMin*60000 - Date.now(); if(when>0) setTimeout(()=>notify('Daily reminder', `${q.title} in ${q.remindMin} minutes`), Math.min(when, 2147483647)); } }
  if('Notification' in window && Notification.permission==='default'){ setTimeout(()=>Notification.requestPermission(), 1000); }
}
window.addEventListener('DOMContentLoaded', init);
