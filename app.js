
// ShadowHUD v11.4 — custom attribute amounts + iOS-style checklist
const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
function notify(title, body){ if(!('Notification' in window)) return; if(Notification.permission==='granted'){ try{ registration && registration.showNotification ? registration.showNotification(title,{body}) : new Notification(title,{body}); }catch(e){} } }
const todayKey=()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const endOfToday=()=>{ const d=new Date(); d.setHours(23,59,59,999); return d.getTime(); };
function pad(n){return String(n).padStart(2,'0');}
function nowHHMM(){ const d=new Date(); return pad(d.getHours())+':'+pad(d.getMinutes()); }

const defaultState={ 
  player:{level:1,xp:0,xpNext:50,gold:0},
  attrs:{Physical:0,Psyche:0,Intellect:0,Financial:0,Social:0,Spiritual:0},
  quests:[], shop:[], lastId:0, lastDailyKey:null,
  notifSent:{},
  stats:{completed:0,goldEarned:0,xpEarned:0,penaltiesCleared:0,currentStreak:0,longestStreak:0,focusMinutes:0,lastCompletionDay:null}
};
let state=load(); function load(){ try{ return JSON.parse(localStorage.getItem('shadowhud-full-v11'))||structuredClone(defaultState);}catch(e){ return structuredClone(defaultState);} } function save(){ localStorage.setItem('shadowhud-full-v11', JSON.stringify(state)); }

const DIFF={easy:{label:'Easy',mult:1.0},normal:{label:'Normal',mult:1.5},hard:{label:'Hard',mult:2.2},elite:{label:'Elite',mult:3.2},boss:{label:'Boss',mult:5.0}};
function xpToNext(level){ return Math.round(40+6*level+0.6*level*level); }
function rankForLevel(l){ if(l<15)return'E'; if(l<30)return'D'; if(l<45)return'C'; if(l<60)return'B'; if(l<75)return'A'; return'S'; }
function grantXP(a){ const p=state.player; if(p.level>=100) return; const add=Math.max(0,a|0); p.xp+=add; state.stats.xpEarned+=add; while(p.level<100&&p.xp>=p.xpNext){ p.xp-=p.xpNext; p.level++; p.xpNext=xpToNext(p.level);} if(p.level>=100){p.level=100;p.xp=p.xpNext;} save(); renderLevel(); renderJourney(); }
function grantGold(a){ const g=Math.max(0,Math.round(a)); state.player.gold=(state.player.gold||0)+g; state.stats.goldEarned+=(g||0); save(); renderWallet(); renderJourney(); }

function renderWallet(){ $('#gold').textContent=state.player.gold||0; $('#gold2').textContent=state.player.gold||0; }
function renderLevel(){ const p=state.player; $('#level-num').textContent=p.level; const rk=rankForLevel(p.level); $('#rank-text').textContent=rk; $('#rank-badge').textContent=rk; $('#xp-cur').textContent=p.xp; $('#xp-next').textContent=p.xpNext; $('#xp-fill').style.width=Math.max(0,Math.min(100,(p.xp/p.xpNext)*100))+'%'; }

function drawRadar(){ const c=$('#radar'); const ctx=c.getContext('2d'); const W=c.width, H=c.height; ctx.clearRect(0,0,W,H); const centerX=W/2, centerY=H/2+10, R=80; const labs=["Financial","Physical","Psyche","Intellect","Social","Spiritual"]; 
  ctx.strokeStyle='#222'; for(let ring=1; ring<=5; ring++){ ctx.beginPath(); for(let i=0;i<labs.length;i++){ const a=(Math.PI*2/labs.length)*i - Math.PI/2; const r=R*ring/5; const x=centerX+Math.cos(a)*r; const y=centerY+Math.sin(a)*r; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.stroke(); }
  for(let i=0;i<labs.length;i++){ const a=(Math.PI*2/labs.length)*i - Math.PI/2; ctx.beginPath(); ctx.moveTo(centerX,centerY); ctx.lineTo(centerX+Math.cos(a)*R, centerY+Math.sin(a)*R); ctx.stroke(); ctx.fillStyle='#a0a0a0'; ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.fillText(labs[i], centerX+Math.cos(a)*(R+16), centerY+Math.sin(a)*(R+16)); }
  ctx.beginPath(); for(let i=0;i<labs.length;i++){ const val=Math.max(0,Math.min(100,(state.attrs[labs[i]]||0))); const a=(Math.PI*2/labs.length)*i - Math.PI/2; const x=centerX+Math.cos(a)*(R*val/100); const y=centerY+Math.sin(a)*(R*val/100); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); } ctx.closePath(); ctx.fillStyle='rgba(77,163,255,0.15)'; ctx.fill(); ctx.strokeStyle='#4da3ff'; ctx.lineWidth=2; ctx.stroke();
}
function renderTiles(){ const grid=$('#attr-grid'); grid.innerHTML=''; const order=["Physical","Psyche","Intellect","Social","Spiritual","Financial"]; for(const lab of order){ const tile=document.createElement('div'); tile.className='tile'; tile.innerHTML=`<div class="n">${state.attrs[lab]||0}</div><div class="l">${lab.toUpperCase()}</div>`; grid.appendChild(tile); } drawRadar(); }

function show(name){ $$('.screen').forEach(s=>s.classList.remove('visible')); $('#screen-'+name).classList.add('visible'); $$('.tab').forEach(t=>t.classList.remove('active')); if(name==='character') $('#tab-character').classList.add('active'); if(name==='quests') $('#tab-quests').classList.add('active'); if(name==='store') $('#tab-store').classList.add('active'); if(name==='focus') $('#tab-focus').classList.add('active'); if(name==='journey') $('#tab-journey').classList.add('active'); }
$('#tab-character').onclick=()=>{ $('#appbar-title').textContent='ShadowHUD v11.4 — Character'; show('character'); };
$('#tab-quests').onclick=()=>{ $('#appbar-title').textContent='ShadowHUD v11.4 — Quests'; show('quests'); };
$('#tab-store').onclick=()=>{ $('#appbar-title').textContent='ShadowHUD v11.4 — Store'; show('store'); renderShop(); };
$('#tab-focus').onclick=()=>{ $('#appbar-title').textContent='ShadowHUD v11.4 — Focus'; show('focus'); updateFocusUI(); };
$('#tab-journey').onclick=()=>{ $('#appbar-title').textContent='ShadowHUD v11.4 — Journey'; show('journey'); renderJourney(); };
$('#btn-plus').onclick=()=>{ resetForm(); show('create'); $('#appbar-title').textContent='New/Edit Quest'; };
$('#btn-cancel').onclick=()=>{ show('quests'); $('#appbar-title').textContent='ShadowHUD v11.4 — Quests'; };

function currentFilter(){ return document.querySelector('.chip.active')?.dataset.filter || 'all'; }
$$('.chip').forEach(c=>c.onclick=()=>{ $$('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); renderQuests(c.dataset.filter); });

function tagRowHTML(q){ const chips=[]; if(q.daily) chips.push('<span class="badge">Daily</span>'); if(q.penalty) chips.push('<span class="badge pen">Penalty</span>'); return chips.length? `<div class="tag-row">${chips.join(' ')}</div>` : ''; }
function countdownText(ts){ if(!ts) return ''; const ms=Math.max(0, ts-Date.now()); const s=Math.floor(ms/1000); const hh=String(Math.floor(s/3600)).padStart(2,'0'); const mm=String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${hh}:${mm}:${ss}`; }
function normalizeAttrs(arr){ if(!arr) return []; return arr.map(x=> typeof x==='string' ? {name:x, amt:1} : {name:x.name, amt:Math.max(1,Number(x.amt)||1)} ); }
function attrLabel(q){ const a = normalizeAttrs(q.attrs); if(!a.length) return 'Attribute'; return a.map(x=>`${x.name} +${x.amt}`).join(', '); }

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
    const countdown = q.daily && q.deadline ? ` • resets in ${countdownText(q.deadline)}` : '';
    node.innerHTML = `
      ${tagRowHTML(q)}
      <div class="q-top">
        <div class="q-title">${q.title} <span class="hint">(${diff.label} • ${attrLabel(q)}${countdown})</span></div>
        <div class="q-xp">+${rewardXP(q)} XP · 💰${rewardGold(q)}</div>
      </div>
      <div class="q-sub"></div>
      <div class="q-progress"><div class="q-fill" style="width:0%"></div></div>
      <div class="q-actions">
        <button class="btn small start hidden">Start</button>
        <button class="btn small complete">Done</button>
        <button class="btn small ghost reset">Reset</button>
        <button class="btn small ghost pause hidden">Pause</button>
        <button class="btn small ghost resume hidden">Resume</button>
        <button class="btn small ghost inc hidden">+1</button>
        <button class="btn small ghost dec hidden">−1</button>
        <div class="spacer"></div>
        <button class="btn small ghost edit">Edit</button>
        <button class="btn small ghost delete">Delete</button>
      </div>`;
    const sub=node.querySelector('.q-sub'); const fill=node.querySelector('.q-fill');
    const btnS=node.querySelector('.start'); const btnC=node.querySelector('.complete'); const btnP=node.querySelector('.pause'); const btnR=node.querySelector('.resume'); const btnI=node.querySelector('.inc'); const btnD=node.querySelector('.dec'); const btnE=node.querySelector('.edit'); const btnDel=node.querySelector('.delete'); const btnReset=node.querySelector('.reset');

    if(q.type==='timer'){
      if(!q.started){ sub.textContent='Not started'; btnS.classList.remove('hidden'); }
      else{
        const rem=timerRemaining(q); const pct=Math.max(0,Math.min(1,1-rem/q.durationMs));
        fill.style.width=(pct*100)+'%'; sub.textContent=(q.paused?'Paused — ':'')+formatTime(rem); (q.paused?btnR:btnP).classList.remove('hidden');
      }
    } else if(q.type==='counter'){
      const pct=Math.min(1,(q.count||0)/q.target); fill.style.width=(pct*100)+'%'; sub.textContent=`Count ${q.count||0}/${q.target}`; btnI.classList.remove('hidden'); btnD.classList.remove('hidden');
    } else if(q.type==='checklist'){
      const listEl = document.createElement('div');
      (q.items||[]).forEach((label,idx)=>{
        const row=document.createElement('div'); row.className='ck-row'+((q.done&&q.done[idx])?' done':''); 
        row.innerHTML=`<div class="ck-dot">${(q.done&&q.done[idx])?'✓':''}</div><div class="ck-label">${label}</div>`;
        row.onclick=()=>{ q.done= q.done||((q.items||[]).map(()=>false)); q.done[idx]=!q.done[idx]; save(); renderQuests(filter); if(q.done.every(Boolean)&&!q.completed){ finishQuest(q, filter);} };
        listEl.appendChild(row);
      });
      sub.innerHTML=''; sub.appendChild(listEl);
      const done=(q.done||[]).filter(Boolean).length, total=(q.items||[]).length; const pct=total?done/total:0; fill.style.width=(pct*100)+'%';
    } else if(q.type==='multicounter'){
      const total = q.metrics.reduce((s,m)=>s+m.target,0);
      const have  = q.metrics.reduce((s,m)=>s+Math.min(m.count||0,m.target),0);
      const pct   = total? have/total : 0;
      fill.style.width=(pct*100)+'%';
      const rows = q.metrics.map((m,idx)=>`
        <div class="multi-row" data-idx="${idx}">
          <div class="lbl">${m.label}</div>
          <div class="val">${m.count||0} / ${m.target}</div>
          <button class="btn small ghost mfinish">Finish</button>
          <button class="btn small ghost mdec">−1</button>
          <button class="btn small ghost minc">+1</button>
        </div>`).join('');
      sub.innerHTML = `<div class="multi">${rows}</div>`;
      sub.querySelectorAll('.multi-row').forEach(row=>{
        const i=Number(row.dataset.idx);
        row.querySelector('.minc').onclick=()=>{ q.metrics[i].count=Math.min(q.metrics[i].target,(q.metrics[i].count||0)+1); save(); renderQuests(filter); if(q.metrics.every(m=>(m.count||0)>=m.target)&&!q.completed){ finishQuest(q, filter);} };
        row.querySelector('.mdec').onclick=()=>{ q.metrics[i].count=Math.max(0,(q.metrics[i].count||0)-1); save(); renderQuests(filter); };
        row.querySelector('.mfinish').onclick=()=>{ q.metrics[i].count=q.metrics[i].target; save(); renderQuests(filter); if(q.metrics.every(m=>(m.count||0)>=m.target)&&!q.completed){ finishQuest(q, filter);} };
      });
    }

    btnS.onclick=()=>{ const now=Date.now(); q.startTs=now; q.endTs=now+(q.durationMs||0); q.started=true; q.paused=false; save(); renderQuests(filter); };
    btnC.onclick=()=>finishQuest(q, filter);
    btnReset.onclick=()=>{ resetQuestProgress(q); save(); renderQuests(filter); };
    if(btnP) btnP.onclick=()=>{ q.paused=true; q.pauseTs=Date.now(); save(); renderQuests(filter); };
    if(btnR) btnR.onclick=()=>{ if(q.paused){ const pausedFor=Date.now()- (q.pauseTs||Date.now()); q.endTs+=pausedFor; q.paused=false; save(); renderQuests(filter);} };
    if(btnI) btnI.onclick=()=>{ q.count=Math.min(q.target,(q.count||0)+1); if(q.count>=q.target && !q.completed){ finishQuest(q, filter); } else { save(); renderQuests(filter);} };
    if(btnD) btnD.onclick=()=>{ q.count=Math.max(0,(q.count||0)-1); save(); renderQuests(filter); };
    btnE.onclick=()=>{ populateForm(q); show('create'); $('#appbar-title').textContent='New/Edit Quest'; };
    btnDel.onclick=()=>{ state.quests=state.quests.filter(x=>x.id!==q.id); save(); renderQuests(filter); };

    list.appendChild(node);
  }
}

function rewardXP(q){ const m=DIFF[q.diff||'normal'].mult; return Math.round((q.xp||0)*m); }
function rewardGold(q){ const m=DIFF[q.diff||'normal'].mult; return Math.round(10*m); }

function applyAttributeReward(q){
  const attrs = normalizeAttrs(q.attrs);
  for(const {name,amt} of attrs){ state.attrs[name]=(state.attrs[name]||0)+amt; }
}

function resetQuestProgress(q){
  q.completed=false;
  if(q.type==='timer'){ q.started=false; q.paused=false; delete q.startTs; delete q.endTs; delete q.pauseTs; }
  if(q.type==='counter'){ q.count=0; }
  if(q.type==='checklist'){ q.done=(q.items||[]).map(()=>false); }
  if(q.type==='multicounter'){ q.metrics=(q.metrics||[]).map(m=>({label:m.label,target:m.target,count:0})); }
}

function finishQuest(q, filter){
  if(q.completed) return;
  q.completed=true;
  state.stats.completed++;
  if(q.penalty) state.stats.penaltiesCleared++;
  state.stats.lastCompletionDay = todayKey();
  grantXP(rewardXP(q)); grantGold(rewardGold(q)); applyAttributeReward(q);
  notify('Quest Complete', `${q.title} finished!`);
  if(q.repeat && q.repeat!=='none'){
    const next=structuredClone(q); next.id=++state.lastId; resetQuestProgress(next);
    if(q.deadline){ const d=new Date(q.deadline); if(q.repeat==='daily') d.setDate(d.getDate()+1); if(q.repeat==='weekly') d.setDate(d.getDate()+7); next.deadline=d.getTime(); next.dayKey = q.daily ? todayKey() : null; }
    state.quests.push(next);
  }
  save(); renderQuests(filter); renderTiles(); drawRadar(); renderJourney();
}

setInterval(()=>{ let touched=false; for(const q of state.quests){ if(q.type==='timer' && q.started && !q.completed && !q.paused && timerRemaining(q)<=0){ finishQuest(q, currentFilter()); touched=true; } } if(touched){ save(); renderQuests(currentFilter()); } },1000);
setInterval(()=>{ renderQuests(currentFilter()); },1000);
function timerRemaining(q){ if(q.paused) return Math.max(0,q.endTs-(q.pauseTs||Date.now())); return Math.max(0,(q.endTs||0)-Date.now()); }
function formatTime(ms){ const s=Math.max(0,Math.ceil(ms/1000)); const m=Math.floor(s/60); const ss=(''+(s%60)).padStart(2,'0'); const mm=(''+(m%60)).padStart(2,'0'); const hh=Math.floor(m/60); return hh>0?`${hh}:${mm}:${ss}`:`${m}:${ss}`; }

function getSelectedAttrs(){
  const rows=$$('.attr'); const amts=$$('.attr-amt'); const out=[];
  rows.forEach(chk=>{
    const name=chk.getAttribute('data-for');
    const amtInput=amts.find(i=>i.getAttribute('data-name')===name);
    const amt=Math.max(1, Number(amtInput?.value)||1);
    if(chk.checked){ out.push({name, amt}); }
  });
  return out;
}

function resetForm(){
  const f=$('#quest-form'); f.dataset.editing='';
  $('#q-title').value=''; $('#q-desc').value='';
  $$('.attr').forEach(x=>{ x.checked=false; });
  $$('.attr-amt').forEach(i=>{ i.value=1; });
  $('#q-type').value='timer'; $('#q-duration').value=30; $('#q-target').value=10; $('#q-items').value=''; $('#q-multi').value='';
  $('#q-diff').value='normal'; $('#q-deadline').value=''; $('#q-repeat').value='none'; $('#q-xp').value=25; $('#q-remind').value=10; $('#q-is-daily').checked=false; $('#q-remindtimes').value='';
  updateTypeUI();
}

function populateForm(q){
  const f=$('#quest-form'); f.dataset.editing=q.id;
  $('#q-title').value=q.title; $('#q-desc').value=q.desc||'';
  const attrs = normalizeAttrs(q.attrs);
  $$('.attr').forEach(x=>{ const name=x.getAttribute('data-for'); x.checked=attrs.some(a=>a.name===name); });
  $$('.attr-amt').forEach(i=>{ const a=attrs.find(a=>a.name===i.getAttribute('data-name')); i.value=a?a.amt:1; });
  $('#q-type').value=q.type; $('#q-duration').value=(q.durationMin||30); $('#q-target').value=q.target||10; $('#q-items').value=(q.items||[]).join(', ');
  $('#q-multi').value = (q.metrics||[]).map(m=>`${m.label}:${m.target}`).join(', ');
  $('#q-diff').value=q.diff||'normal'; $('#q-repeat').value=q.repeat||'none'; $('#q-xp').value=q.xp||25; $('#q-is-daily').checked=!!q.daily;
  if(q.deadline){ const d=new Date(q.deadline); const s=d.toISOString().slice(0,16); $('#q-deadline').value=s; } else { $('#q-deadline').value=''; }
  $('#q-remind').value=q.remind||10; $('#q-remindtimes').value=(q.remindTimes||[]).join(', ');
  updateTypeUI();
}

function updateTypeUI(){
  const t=$('#q-type').value;
  $$('.if').forEach(x=>x.classList.remove('show'));
  $$('.if.'+t).forEach(x=>x.classList.add('show'));
}
$('#q-type').onchange=updateTypeUI;

$('#quest-form').onsubmit=(e)=>{
  e.preventDefault();
  const id = $('#quest-form').dataset.editing? Number($('#quest-form').dataset.editing): ++state.lastId;
  const t = $('#q-type').value;
  const q = {
    id, title:$('#q-title').value.trim(), desc:$('#q-desc').value.trim(),
    attrs:getSelectedAttrs(),
    type:t, diff:$('#q-diff').value, repeat:$('#q-repeat').value, xp:Number($('#q-xp').value||0),
    daily:$('#q-is-daily').checked,
    remind:Number($('#q-remind').value||0), remindTimes:($('#q-remindtimes').value||'').split(',').map(s=>s.trim()).filter(Boolean)
  };
  if(t==='timer'){ q.durationMin=Number($('#q-duration').value||30); q.durationMs=q.durationMin*60*1000; }
  if(t==='counter'){ q.target=Number($('#q-target').value||10); q.count=0; }
  if(t==='checklist'){ q.items=($('#q-items').value||'').split(',').map(s=>s.trim()).filter(Boolean); q.done=q.items.map(()=>false); }
  if(t==='multicounter'){ q.metrics=($('#q-multi').value||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>{ const [label,tar]=s.split(':'); return {label:label.trim(), target:Number(tar||1), count:0}; }); }
  const dl=$('#q-deadline').value; q.deadline= dl? new Date(dl).getTime(): null;
  if(q.daily){ q.deadline=endOfToday(); q.dayKey=todayKey(); }

  const idx = state.quests.findIndex(x=>x.id===id);
  if(idx>=0) state.quests[idx]=q; else state.quests.unshift(q);
  save(); renderQuests(currentFilter()); show('quests'); $('#appbar-title').textContent='ShadowHUD v11.4 — Quests';
};

// Store
function renderShop(){
  $('#gold2').textContent=state.player.gold||0;
  const list=$('#shop-list'); list.innerHTML='';
  if(!state.shop.length) $('#shop-empty').style.display='block'; else $('#shop-empty').style.display='none';
  state.shop.forEach((r,i)=>{
    const card=document.createElement('div'); card.className='card ach';
    card.innerHTML=`<div><div style="font-weight:700">${r.title}</div><div class="hint">${r.desc||''}</div></div><div>💰 ${r.cost} <button class="btn small primary buy">Buy</button></div>`;
    card.querySelector('.buy').onclick=()=>{ if((state.player.gold||0)>=r.cost){ state.player.gold-=r.cost; save(); renderShop(); renderWallet(); } };
    list.appendChild(card);
  });
}
$('#btn-add-reward').onclick=()=>{ $('#reward-form').classList.remove('hidden'); };
$('#r-cancel').onclick=()=>{ $('#reward-form').classList.add('hidden'); };
$('#reward-form').onsubmit=(e)=>{ e.preventDefault(); state.shop.push({title:$('#r-title').value.trim(),desc:$('#r-desc').value.trim(),cost:Number($('#r-cost').value||1)}); save(); $('#reward-form').classList.add('hidden'); renderShop(); };

// Focus simple timer (no app lock)
let focusInterval=null, focusEnd=0, focusPaused=false, pauseTs=0;
function updateFocusUI(){
  const left=Math.max(0, Math.ceil((focusEnd-(focusPaused?pauseTs:Date.now()))/1000));
  const mm=String(Math.floor(left/60)).padStart(2,'0'); const ss=String(left%60).padStart(2,'0');
  $('#focus-time').textContent = `${mm}:${ss}`;
  $('#focus-pause').classList.toggle('hidden', !(focusEnd && !focusPaused));
  $('#focus-resume').classList.toggle('hidden', !(focusEnd && focusPaused));
}
$('#focus-start').onclick=()=>{ const mins=Math.max(1, Number($('#focus-mins').value||25)); focusEnd=Date.now()+mins*60*1000; focusPaused=false; clearInterval(focusInterval); focusInterval=setInterval(()=>{ updateFocusUI(); if(Date.now()>=focusEnd && !focusPaused){ clearInterval(focusInterval); notify('Focus complete','Nice work!'); }}, 200); updateFocusUI(); };
$('#focus-pause').onclick=()=>{ focusPaused=true; pauseTs=Date.now(); updateFocusUI(); };
$('#focus-resume').onclick=()=>{ if(focusPaused){ const paused=Date.now()-pauseTs; focusEnd+=paused; focusPaused=false; updateFocusUI(); } };
$('#focus-cancel').onclick=()=>{ focusEnd=0; clearInterval(focusInterval); updateFocusUI(); };

// Daily/penalty midnight rollover
function midnightSweep(){
  const key=todayKey();
  if(state.lastDailyKey===key) return;
  // streak handling
  if(state.stats.lastCompletionDay){
    const prev=new Date(state.stats.lastCompletionDay);
    const today=new Date(key);
    const diff=(today - new Date(prev.getFullYear(),prev.getMonth(),prev.getDate()))/86400000;
    if(diff===1) state.stats.currentStreak++; else state.stats.currentStreak=0;
  } else {
    state.stats.currentStreak=0;
  }
  state.stats.longestStreak=Math.max(state.stats.longestStreak,state.stats.currentStreak);

  const keep=[], penalties=[];
  for(const q of state.quests){
    if(q.daily){
      if(!q.completed){ penalties.push(makePenalty()); }
      // drop yesterday's daily
    }else{
      keep.push(q);
    }
  }
  state.quests = keep.concat(penalties);
  // add today's default dailies
  addDefaultDailiesForToday();
  state.lastDailyKey = key;
  save();
  renderQuests(currentFilter());
}
  const key=todayKey(); if(state.lastDailyKey===key) return;
  // handle streaks
  if(state.stats.lastCompletionDay){ const prev=new Date(state.stats.lastCompletionDay); const today=new Date(key); const diff=(today - new Date(prev.getFullYear(),prev.getMonth(),prev.getDate()))/86400000; if(diff===1) state.stats.currentStreak++; else state.stats.currentStreak=0; } else { state.stats.currentStreak=0; }
  state.stats.longestStreak=Math.max(state.stats.longestStreak,state.stats.currentStreak);

  const newList=[]; const penalties=[];
  for(const q of state.quests){
    if(q.daily){
      if(!q.completed){ penalties.push(makePenalty()); }
      // drop old daily
    }else{
      newList.push(q);
    }
  }
  state.quests=newList.concat(penalties);
  state.lastDailyKey=key;
  save();
  renderQuests(currentFilter());
}
function makePenalty(){
  const samples=[
    {title:'Penalty — 50 push-ups', type:'counter', target:50},
    {title:'Penalty — Cold shower', type:'timer', durationMin:5, durationMs:5*60*1000},
    {title:'Penalty — 15min study', type:'timer', durationMin:15, durationMs:15*60*1000}
  ];
  const pick=samples[Math.floor(Math.random()*samples.length)];
  const q={ id:++state.lastId, title:pick.title, attrs:[{name:'Physical',amt:1}], type:pick.type, diff:'normal', repeat:'none', xp:20, penalty:true, daily:false };
  if(q.type==='counter'){ q.target=pick.target; q.count=0; }
  if(q.type==='timer'){ q.durationMin=pick.durationMin; q.durationMs=pick.durationMs; }
  return q;
}
setInterval(midnightSweep, 10_000);


function addDefaultDailiesForToday(){
  const key=todayKey();
  // Don't duplicate if there are already dailies for today
  const hasTodayDaily = state.quests.some(q=>q.daily && q.dayKey===key);
  if(hasTodayDaily) return;

  const defaults = [];

  // Strength Training multi-counter
  defaults.push({
    id: ++state.lastId,
    title:'Strength Training',
    type:'multicounter',
    diff:'elite',
    repeat:'none',
    xp:60,
    daily:true,
    dayKey:key,
    deadline:endOfToday(),
    attrs:[{name:'Physical',amt:2}],
    metrics:[
      {label:'Pushups',target:100,count:0},
      {label:'Sit-ups',target:100,count:0},
      {label:'Squats',target:100,count:0},
      {label:'Run (miles)',target:1,count:0}
    ]
  });

  // A couple helpful self-care dailies
  defaults.push({
    id: ++state.lastId,
    title:'Meditate 10 min',
    type:'timer', durationMin:10, durationMs:10*60*1000,
    diff:'normal', xp:20, daily:true, dayKey:key, deadline:endOfToday(),
    attrs:[{name:'Spiritual',amt:1},{name:'Psyche',amt:1}]
  });
  defaults.push({
    id: ++state.lastId,
    title:'Journal 1 page',
    type:'checklist', items:['What went well?','What to improve?','One intention for tomorrow'], done:[false,false,false],
    diff:'easy', xp:12, daily:true, dayKey:key, deadline:endOfToday(),
    attrs:[{name:'Intellect',amt:1},{name:'Psyche',amt:1}]
  });

  // Insert at top
  state.quests = defaults.concat(state.quests);
}

// Daily defaults seeding function injected above

/*seed removed*/ if(false){ 
  const q={ id:++state.lastId, title:'Strength Training', type:'multicounter', diff:'elite', repeat:'none', xp:60, daily:true, deadline:endOfToday(), attrs:[{name:'Physical',amt:2}], 
    metrics:[{label:'Pushups',target:100,count:0},{label:'Sit-ups',target:100,count:0},{label:'Squats',target:100,count:0},{label:'Run (miles)',target:1,count:0}] };
  state.quests.unshift(q); state._seeded=true; save();
}

function renderJourney(){
  $('#j-level').textContent=`Lv ${state.player.level} (${rankForLevel(state.player.level)})`;
  $('#j-xp').style.width=Math.min(100,(state.player.xp/state.player.xpNext*100))+'%';
  $('#j-completed').textContent=String(state.stats.completed||0)+' total';
  const c=Math.min(100,(state.stats.completed||0)%20*5); $('#j-complete-bar').style.width=c+'%';
  $('#j-gold').textContent=state.stats.goldEarned||0;
  $('#j-streak').textContent=state.stats.currentStreak||0; $('#j-streak-bar').style.width=Math.min(100,(state.stats.currentStreak||0)/30*100)+'%';
  const ach=$('#achievements'); ach.innerHTML='';
  const list=[
    {id:'first',name:'First Steps',desc:'Complete 1 quest',ok:(state.stats.completed||0)>=1},
    {id:'sprout',name:'Growing',desc:'Complete 10 quests',ok:(state.stats.completed||0)>=10},
    {id:'grit',name:'Streak x3',desc:'3-day streak',ok:(state.stats.currentStreak||0)>=3}
  ];
  list.forEach(a=>{ const el=document.createElement('div'); el.className='ach'+(a.ok?' done':''); el.innerHTML=`<div>${a.name}<div class="hint">${a.desc}</div></div><div>${a.ok?'✓':''}</div>`; ach.appendChild(el); });
}

// Initial render
addDefaultDailiesForToday(); renderWallet(); renderLevel(); renderTiles(); renderQuests('all'); renderJourney();
