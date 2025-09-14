
/* ShadowHUD v13.1 — tabs, quests w/ midnight countdown, titles on Character, store delete, hide done */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const store = { load(k,f){ try{ return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(f)); }catch(e){ return f; } }, save(k,v){ localStorage.setItem(k, JSON.stringify(v)); } };

const state = store.load('sh_state', {
  gold: 0, xp: 0, level: 1, ap: 0,
  attributes: {physical:0, psyche:0, intellect:0, social:0, spiritual:0, financial:0},
  titles: [{id:'starter', name:'The One Who Started', req:'Complete 1 quest', unlocked:false, equipped:false}],
  achievements: [], quests: [], rewards: [], lastDailyDate: null, completedCount: 0,
});
function saveState(){ store.save('sh_state', state); syncUIHeader(); }

function activateTab(name){
  $$('#tabs button').forEach(b=> b.classList.toggle('active', b.dataset.tab===name));
  $$('.tab').forEach(t=> t.classList.toggle('active', t.id === `tab-${name}`));
  if(name==='quest') renderQuests();
  if(name==='journey') renderJourney();
  if(name==='character') renderCharacter();
  if(name==='store') renderStore();
  if(name==='focus') syncFocus();
}
$('#tabs').addEventListener('click', (e)=>{ const b=e.target.closest('button[data-tab]'); if(!b) return; activateTab(b.dataset.tab); });

function syncUIHeader(){ $('#goldDisplay').textContent=state.gold; $('#storeGold').textContent=state.gold; $('#charGold').textContent=state.gold; }
syncUIHeader();

function xpForLevel(level){ return Math.floor(35 + Math.pow(level,1.35)*12); }
function totalXpForLevel(level){ let t=0; for(let i=1;i<=level;i++) t+=xpForLevel(i); return t; }
function rankForLevel(level){ if(level<=15) return 'E'; if(level<=30) return 'D'; if(level<=45) return 'C'; if(level<=60) return 'B'; if(level<=80) return 'A'; return 'S'; }
function addXp(n){ state.xp+=n; let lvl=1, need=xpForLevel(1), total=0; while(state.xp>=total+need){ total+=need; lvl++; need=xpForLevel(lvl); if(lvl>100){ lvl=100; break; } } state.level=Math.min(lvl,100); saveState(); }
function addGold(n){ state.gold+=n; saveState(); }

function tryUnlockTitles(){ const first=state.titles.find(t=>t.id==='starter'); if(state.completedCount>=1) first.unlocked=true; if(!state.titles.some(t=>t.equipped)&&first.unlocked) first.equipped=true; }
function equippedTitle(){ return state.titles.find(t=>t.equipped)||{name:'None'}; }

const DAILY_POOL = [
  {title:'Meditate 10 minutes', attrs:['spiritual'], baseXP:10, gold:10, type:'timer', minutes:10},
  {title:'Call or text a loved one', attrs:['social'], baseXP:10, gold:10, type:'counter', target:1},
  {title:'Read 10 pages', attrs:['intellect'], baseXP:14, gold:12, type:'counter', target:10},
  {title:'Walk 6k steps', attrs:['physical'], baseXP:20, gold:14, type:'counter', target:6000},
  {title:'Tidy up for 15 min', attrs:['psyche','social'], baseXP:16, gold:12, type:'timer', minutes:15},
  {title:'Budget review', attrs:['financial'], baseXP:20, gold:16, type:'check', checklist:['Review expenses','Log income','Set saving %']},
];
function strengthTrainingQuest(){ return { id:uid(), created:Date.now(), kind:'daily', title:'Strength Training', qtype:'multi', multi:[{label:'Pushups',target:100,value:0},{label:'Sit-ups',target:100,value:0},{label:'Squats',target:100,value:0},{label:'Run (miles)',target:1,value:0}], difficulty:'Elite', attrs:['physical'], baseXP:120, gold:30, status:'active' }; }
function createDailyFromPool(item){ const q={ id:uid(), created:Date.now(), kind:'daily', title:item.title, difficulty:item.difficulty||'Normal', attrs:item.attrs||[], baseXP:item.baseXP||15, gold:item.gold||10, status:'active' }; if(item.type==='timer'){ q.qtype='timer'; q.minutes=item.minutes||15; q.remainingSec=q.minutes*60; } else if(item.type==='counter'){ q.qtype='counter'; q.target=item.target||1; q.count=0; } else if(item.type==='check'){ q.qtype='check'; q.checklist=(item.checklist||[]).map(t=>({text:t,done:false})); } else { q.qtype='counter'; q.target=1; q.count=0; } return q; }
function rotateDailiesIfNeeded(){ const today=new Date().toDateString(); if(state.lastDailyDate===today) return;
  const remaining=state.quests.filter(q=>q.kind==='daily' && q.status!=='done'); if(remaining.length){ state.quests=state.quests.filter(q=>q.kind!=='penalty'); state.quests.push({ id:uid(), created:Date.now(), kind:'penalty', title:'Penalty — 50 pushups', qtype:'counter', target:50, count:0, difficulty:'Hard', attrs:['physical'], baseXP:20, gold:5, status:'active' }); }
  state.quests = state.quests.filter(q=>q.kind!=='daily');
  state.quests.push(strengthTrainingQuest());
  const pool=[...DAILY_POOL]; for(let i=0;i<3 && pool.length;i++){ const idx=Math.floor(Math.random()*pool.length); state.quests.push(createDailyFromPool(pool.splice(idx,1)[0])); }
  state.lastDailyDate=today; saveState();
}
rotateDailiesIfNeeded();

let currentFilter='all';
$('#questFilters').addEventListener('click',e=>{ const chip=e.target.closest('.chip'); if(!chip) return; $$('#questFilters .chip').forEach(c=>c.classList.remove('active')); chip.classList.add('active'); currentFilter=chip.dataset.filter; renderQuests(); });

function questCountdownHTML(){ const ms=nextMidnightMs()-Date.now(); return `<span class="qcountdown">resets in ${formatHMS(ms)}</span>`; }

function questCard(q){
  const daily=(q.kind==='daily'); const badges = `${daily?'<span class="badge">Daily</span>':''} <span class="badge">${q.difficulty||'Normal'}</span> ${q.attrs&&q.attrs.length?`<span class="badge">${q.attrs.join(' • ')}</span>`:''}`;
  const right = `<div class="meta">+${q.baseXP} XP • 💰 ${q.gold}</div>`;
  let body='';
  if(q.qtype==='timer'){ if(typeof q.remainingSec!=='number') q.remainingSec=(q.minutes||25)*60;
    body+=`<div class="meta">Not started</div><div class="progress"><div style="width:0%" id="p_${q.id}"></div></div>
      <div class="qcontrols">
        <button data-act="start" data-id="${q.id}">Start</button>
        <button data-act="pause" data-id="${q.id}">Pause</button>
        <button data-act="resume" data-id="${q.id}">Resume</button>
        <button data-act="done" data-id="${q.id}" class="primary">Done</button>
        <button data-act="reset" data-id="${q.id}">Reset</button>
        <button data-act="edit" data-id="${q.id}">Edit</button>
        <button data-act="delete" data-id="${q.id}">Delete</button>
      </div>`;
  } else if(q.qtype==='counter'){ if(typeof q.count!=='number') q.count=0;
    body+=`<div class="meta">Count ${q.count||0}/${q.target||1}</div>
      <div class="qcontrols">
        <button data-act="inc" data-id="${q.id}">+1</button>
        <button data-act="dec" data-id="${q.id}">−1</button>
        <button data-act="finishCounter" data-id="${q.id}">Finish</button>
        <button data-act="done" data-id="${q.id}" class="primary">Done</button>
        <button data-act="reset" data-id="${q.id}">Reset</button>
        <button data-act="edit" data-id="${q.id}">Edit</button>
        <button data-act="delete" data-id="${q.id}">Delete</button>
      </div>`;
  } else if(q.qtype==='multi'){
    body += q.multi.map((m,i)=>`
      <div class="row between"><div>${m.label}</div><div class="meta">${m.value||0} / ${m.target}</div></div>
      <div class="row qcontrols">
        <button data-act="mdec" data-id="${q.id}" data-idx="${i}">−1</button>
        <button data-act="minc" data-id="${q.id}" data-idx="${i}">+1</button>
        <button data-act="mfinish" data-id="${q.id}" data-idx="${i}">Finish</button>
      </div>
    `).join('');
    body += `<div class="qcontrols">
      <button data-act="done" data-id="${q.id}" class="primary">Done</button>
      <button data-act="reset" data-id="${q.id}">Reset</button>
      <button data-act="edit" data-id="${q.id}">Edit</button>
      <button data-act="delete" data-id="${q.id}">Delete</button>
    </div>`;
  } else if(q.qtype==='check'){
    body += `<ul>${(q.checklist||[]).map((c,i)=>`
      <li><label class="row"><input type="checkbox" data-act="check" data-id="${q.id}" data-idx="${i}" ${c.done?'checked':''}/> <span>${c.text}</span></label></li>
    `).join('')}</ul>
    <div class="qcontrols">
      <button data-act="done" data-id="${q.id}" class="primary">Done</button>
      <button data-act="reset" data-id="${q.id}">Reset</button>
      <button data-act="edit" data-id="${q.id}">Edit</button>
      <button data-act="delete" data-id="${q.id}">Delete</button>
    </div>`;
  }
  const countdown = daily ? `<div>${questCountdownHTML()}</div>` : '';
  return `<div class="questCard" data-qid="${q.id}">
    <div class="questTop">
      <div><div><strong>${q.title}</strong> ${badges}</div>${countdown}</div>
      ${right}
    </div>
    ${body}
  </div>`;
}

function renderQuests(){
  rotateDailiesIfNeeded();
  let list = state.quests.slice().sort((a,b)=> (b.kind==='daily') - (a.kind==='daily'));
  if(currentFilter==='daily') list = list.filter(q=>q.kind==='daily');
  else if(currentFilter==='penalty') list = list.filter(q=>q.kind==='penalty');
  else if(currentFilter==='active') list = list.filter(q=>q.status!=='done');
  else if(currentFilter==='done') list = list.filter(q=>q.status==='done');
  const html = list.length? list.map(questCard).join('') : `<div class="empty">No quests yet. Tap ＋ to add.</div>`;
  $('#questList').innerHTML = html;
}
renderQuests();

setInterval(()=>{ if($('.tab.active')?.id!=='tab-quest') return; $$('#questList .qcountdown').forEach(el=> el.textContent = `resets in ${formatHMS(nextMidnightMs()-Date.now())}`); }, 1000);

$('#questList').addEventListener('click', (e)=>{
  const actBtn = e.target.closest('button[data-act]'); if(!actBtn) return;
  const id = actBtn.dataset.id, q = state.quests.find(x=>x.id===id); if(!q) return;
  const act = actBtn.dataset.act;
  if(act==='start'){ if(!q._timerStart){ q._timerStart=Date.now(); }}
  if(act==='pause'){ if(q._timerStart){ q.remainingSec = Math.max(0, (q.remainingSec??(q.minutes*60)) - Math.round((Date.now()-q._timerStart)/1000)); q._timerStart=null; }}
  if(act==='resume'){ if(!q._timerStart){ q._timerStart=Date.now(); }}
  if(act==='inc'){ q.count=Math.min((q.count||0)+1, q.target||1); }
  if(act==='dec'){ q.count=Math.max((q.count||0)-1, 0); }
  if(act==='finishCounter'){ q.count=q.target||q.count; }
  if(act==='minc'){ const i=+actBtn.dataset.idx; q.multi[i].value=Math.min((q.multi[i].value||0)+1, q.multi[i].target); }
  if(act==='mdec'){ const i=+actBtn.dataset.idx; q.multi[i].value=Math.max((q.multi[i].value||0)-1, 0); }
  if(act==='mfinish'){ const i=+actBtn.dataset.idx; q.multi[i].value = q.multi[i].target; }
  if(act==='check'){ const i=+actBtn.dataset.idx; q.checklist[i].done = e.target.checked; }
  if(act==='reset'){ if(q.qtype==='counter'){ q.count=0; } if(q.qtype==='timer'){ q.remainingSec=(q.minutes||25)*60; q._timerStart=null; } if(q.qtype==='multi'){ q.multi.forEach(m=>m.value=0); } if(q.qtype==='check'){ q.checklist.forEach(c=>c.done=false); } }
  if(act==='delete'){ state.quests = state.quests.filter(x=>x.id!==id); }
  if(act==='done'){ q.status='done'; completeQuestRewards(q); document.querySelector(`[data-qid="${q.id}"]`)?.remove(); }
  saveState(); if(act!=='done') renderQuests();
});

function completeQuestRewards(q){
  const mult = diffMultiplier(q.difficulty||'Normal');
  const xp = Math.round((q.baseXP||20) * mult);
  const gold = Math.round((q.gold||10) * (0.8 + Math.random()*0.4));
  addXp(xp); addGold(gold);
  (q.attrs||[]).forEach(a=>{ if(state.attributes[a]!=null) state.attributes[a]+=1; });
  state.completedCount += 1; tryUnlockTitles();
}

function openQuestForm(){ $('details[open]')?.removeAttribute('open'); $('#tab-quest details').setAttribute('open',''); }
$('#fab').addEventListener('click',()=>{ activateTab('quest'); openQuestForm(); });

$('#questForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const q = { id: uid(), created: Date.now(), kind: fd.get('repeat')==='daily'?'daily':'normal', title: fd.get('title'), desc: fd.get('desc')||'', difficulty: fd.get('difficulty'), attrs: parseAttrs(fd.get('attrs')), baseXP: Number(fd.get('basexp')||25), gold: Math.round((Number(fd.get('basexp')||25))*0.4), status:'active' };
  const qtype = fd.get('qtype');
  if(qtype==='timer'){ q.qtype='timer'; q.minutes=Number(fd.get('minutes')||25); q.remainingSec=q.minutes*60; }
  if(qtype==='counter'){ q.qtype='counter'; q.target=Number(fd.get('target')||1); q.count=0; }
  if(qtype==='multi'){ q.qtype='multi'; q.multi=parseMulti(fd.get('multi')); }
  if(qtype==='check'){ q.qtype='check'; q.checklist=parseChecklist(fd.get('multi')); }
  state.quests.unshift(q); saveState(); renderQuests(); e.target.reset(); $('#questCancel').click();
});
$('#questCancel').addEventListener('click',()=>{ $('#tab-quest details').removeAttribute('open'); });

function parseAttrs(s){ return (s||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean); }
function parseMulti(s){ return (s||'').split(',').map(x=>x.trim()).filter(Boolean).map(k=>{ let [label,target]=k.split(':'); target=Number(target||1); return {label,target,value:0}; }); }
function parseChecklist(s){ return (s||'').split(',').map(x=>x.trim()).filter(Boolean).map(t=>({text:t,done:false})); }

function renderJourney(){
  $('#levelLabel').textContent = `Level ${state.level} · ${rankForLevel(state.level)}`;
  const currentLevelXp = totalXpForLevel(state.level-1);
  const nextLevelXp = totalXpForLevel(state.level);
  const within = Math.max(0, state.xp - currentLevelXp);
  const need = Math.max(1, nextLevelXp - currentLevelXp);
  $('#xpLabel').textContent = `${within}/${need} XP`;
  $('#xpBar').style.width = `${Math.min(100, within/need*100)}%`;
  $('#statCompleted').textContent = state.completedCount;
  $('#statStreak').textContent = 0;
  $('#statGold').textContent = state.gold;
  tryUnlockTitles();
  $('#equippedTitle').textContent = equippedTitle().name;
  $('#titleList').innerHTML = state.titles.map(t=>`<span class="titleBadge ${t.unlocked?'':'locked'}">${t.name}${t.unlocked?` <button class="equip" data-id="${t.id}">Equip</button>`:''}</span>`).join('');
}
$('#titleList').addEventListener('click', e=>{ const b=e.target.closest('.equip'); if(!b) return; state.titles.forEach(t=> t.equipped = (t.id===b.dataset.id)); saveState(); renderJourney(); renderCharacter(); });

function radarDraw(){
  const canvas = $('#radar'); if(!canvas) return;
  const ctx = canvas.getContext('2d'); const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H); ctx.strokeStyle='#2e2e3d'; ctx.lineWidth=1;
  const cx=W/2, cy=H/2+10, r=Math.min(W,H)/2-30;
  const labels=['Financial','Physical','Psyche','Intellect','Social','Spiritual'];
  const keys=['financial','physical','psyche','intellect','social','spiritual'];
  for(let ring=1; ring<=5; ring++){ const rr=r*ring/5; ctx.beginPath(); for(let i=0;i<6;i++){ const a=Math.PI/2+i*2*Math.PI/6; const x=cx+rr*Math.cos(a), y=cy-rr*Math.sin(a); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.stroke(); }
  ctx.fillStyle='#b7bbd9'; ctx.font='14px system-ui';
  labels.forEach((lab,i)=>{ const a=Math.PI/2+i*2*Math.PI/6, x=cx+(r+10)*Math.cos(a), y=cy-(r+10)*Math.sin(a); ctx.textAlign=(i===1||i===2)?'left':(i===4||i===5)?'right':'center'; ctx.fillText(lab,x,y); });
  const vals=keys.map(k=> Math.min(1,(state.attributes[k]||0)/10)); ctx.beginPath();
  for(let i=0;i<6;i++){ const a=Math.PI/2+i*2*Math.PI/6; const rr=r*vals[i]; const x=cx+rr*Math.cos(a), y=cy-rr*Math.sin(a); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.closePath(); ctx.fillStyle='rgba(107,91,255,0.25)'; ctx.fill(); ctx.strokeStyle='#6b5bff'; ctx.stroke();
}
function renderCharacter(){
  $('#apDisplay').textContent = state.ap; $('#charTitle').textContent = equippedTitle().name; $('#changeTitleBtn').onclick=()=> activateTab('journey');
  $('#levelNum').textContent=state.level; $('#rankIcon').textContent=rankForLevel(state.level); $('#rankText').textContent=`Rank ${rankForLevel(state.level)}`;
  const currentLevelXp = totalXpForLevel(state.level-1); const nextLevelXp = totalXpForLevel(state.level);
  const within=Math.max(0,state.xp-currentLevelXp); const need=Math.max(1,nextLevelXp-currentLevelXp);
  $('#xpRight').textContent=`${within}/${need} XP`; $('#xpBarTop').style.width=`${Math.min(100,within/need*100)}%`;
  const entries = Object.entries(state.attributes);
  $('#attrGrid').innerHTML = entries.map(([k,v])=>`<div class="attrTile"><div class="num">${v}</div><div class="label">${k.toUpperCase()}</div></div>`).join('');
  radarDraw();
}

function renderStore(){
  $('#storeGold').textContent = state.gold;
  if(!state.rewards.length){ $('#rewardList').innerHTML = `<div class="empty">No rewards yet. Add your own!</div>`; }
  else{ $('#rewardList').innerHTML = state.rewards.map((r,i)=>`<div class="rewardRow"><div><strong>${r.title}</strong> — <span class="meta">${r.cost} gold</span></div><div class="actions"><button data-ract="buy" data-idx="${i}" class="primary">Buy</button><button data-ract="del" data-idx="${i}">Delete</button></div></div>`).join(''); }
}
$('#rewardList').addEventListener('click', e=>{ const b=e.target.closest('button[data-ract]'); if(!b) return; const i=+b.dataset.idx, r=state.rewards[i]; if(!r) return; if(b.dataset.ract==='buy'){ if(state.gold>=r.cost){ state.gold-=r.cost; saveState(); alert(`Enjoy: ${r.title}`); renderStore(); } else alert('Not enough gold'); } if(b.dataset.ract==='del'){ state.rewards.splice(i,1); saveState(); renderStore(); } });
$('#rewardForm').addEventListener('submit', e=>{ e.preventDefault(); const fd=new FormData(e.target); state.rewards.push({title:fd.get('rtitle'), cost:Number(fd.get('rcost')||50)}); saveState(); renderStore(); e.target.reset(); $('#rewardCancel').click(); });
$('#rewardCancel').addEventListener('click',()=>{ $('#tab-store details').removeAttribute('open'); });

let focusTimer=null, focusLeft=0; function syncFocus(){ $('#focusDisplay').textContent = formatMMSS(focusLeft||($('#focusMinutes').value*60)); }
$('#focusStart').onclick=()=>{ focusLeft = Math.max(5, $('#focusMinutes').value*60); tickFocus(); };
$('#focusPause').onclick=()=>{ if(focusTimer){ clearInterval(focusTimer); focusTimer=null; } };
$('#focusResume').onclick=()=>{ if(!focusTimer){ tickFocus(); } };
$('#focusCancel').onclick=()=>{ if(focusTimer){ clearInterval(focusTimer); } focusTimer=null; focusLeft=0; syncFocus(); };
function tickFocus(){ if(focusTimer) clearInterval(focusTimer); focusTimer=setInterval(()=>{ focusLeft--; if(focusLeft<=0){ clearInterval(focusTimer); focusTimer=null; focusLeft=0; alert('Focus complete!'); } syncFocus(); },1000); syncFocus(); }

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function diffMultiplier(d){ return d==='Easy'?0.8 : d==='Normal'?1 : d==='Hard'?1.3 : 1.6; }
function nextMidnightMs(){ const n=new Date(); const m=new Date(n); m.setHours(24,0,0,0); return +m; }
function formatHMS(ms){ const s=Math.max(0,Math.floor(ms/1000)); const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function formatMMSS(s){ s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), ss=s%60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }

function renderAll(){ renderCharacter(); renderJourney(); activateTab('quest'); }
renderAll();
