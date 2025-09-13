
// ShadowHUD v12.6 — Equip titles directly on Character tab
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const store={k:'shadowhud.v126',load(){try{return JSON.parse(localStorage.getItem(this.k))||null}catch(e){return null}},save(d){localStorage.setItem(this.k,JSON.stringify(d))}};
const ATTRS=["Physical","Psyche","Intellect","Social","Spiritual","Financial"];
const RANKS=["E","D","C","B","A","S"];
const xpForLevel=lv=>Math.round(45+(lv-1)*(10+Math.pow(lv,1.35))/2);
const rankForLevel=lv=>RANKS[Math.min(5,Math.floor((lv-1)/15))];
const now=()=>new Date();
const nextMidnight=()=>{const d=new Date();d.setHours(24,0,0,0);return d};
const secondsToHMS=s=>{s=Math.max(0,s|0);const h=(s/3600)|0,m=((s%3600)/60)|0,x=s%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`};

// Titles & Achievements
const Titles=[
 {id:'start',name:'The One Who Started',desc:'Complete 1 quest.',unlock:s=>countCompleted(s)>=1},
 {id:'momentum',name:'Momentum Builder',desc:'Complete 3 quests in a day.',unlock:s=>completedToday(s)>=3},
 {id:'learner',name:'Learner',desc:'Finish 5 study/practice sessions.',unlock:s=>(s._stats?.study||0)>=5},
 {id:'focus',name:'Focused Mind',desc:'Finish a 25+ minute Focus session.',unlock:s=>s._flags?.didFocus25},
 {id:'clean',name:'Clean Slate',desc:'Deep clean a room.',unlock:s=>s._flags?.didClean},
 {id:'strength',name:'Strength Seeker',desc:'Complete Strength Training once.',unlock:s=>s._flags?.didStrength},
 {id:'rankD',name:'Rank D Adventurer',desc:'Reach level 16.',unlock:s=>s.level>=16}
];
const Achievements=[
 {id:'first',name:'First Steps',desc:'Complete your first quest.',unlock:s=>countCompleted(s)>=1,badge:'🥇'},
 {id:'five',name:'Quest Novice',desc:'Complete 5 quests.',unlock:s=>countCompleted(s)>=5,badge:'🥈'},
 {id:'ten',name:'Quest Adept',desc:'Complete 10 quests.',unlock:s=>countCompleted(s)>=10,badge:'🏅'},
 {id:'gold100',name:'Gold Stacker',desc:'Earn 100 gold.',unlock:s=>(s.gold||0)>=100,badge:'💰'},
 {id:'learner',name:'Learner',desc:'Finish 5 study/practice sessions.',unlock:s=>(s._stats?.study||0)>=5,badge:'📚'}
];

function seedDailyQuests(){const arr=[];const add=q=>arr.push({...q,id:crypto.randomUUID(),created:Date.now(),daily:q.daily??true});add({title:'Study/Skill practice 30 min',type:'timer',duration:30,difficulty:'Hard',xp:88,gold:22,ap:{Intellect:2},daily:true,tag:'study'});add({title:'Deep clean a room',type:'checklist',checklist:['Pick area','Sort','Put away'],difficulty:'Hard',xp:77,gold:22,ap:{Social:2},daily:true,tag:'clean'});add({title:'Call or text a loved one',type:'counter',target:1,difficulty:'Easy',xp:10,gold:10,ap:{Social:1},daily:true,tag:'social'});add({title:'Strength Training',type:'multi',items:[['Pushups',100],['Sit-ups',100],['Squats',100],['Run (miles)',1]],difficulty:'Elite',xp:150,gold:35,ap:{Physical:3},daily:true,tag:'strength'});return arr}
const defaultState=()=>({gold:0,level:1,xp:0,attributes:Object.fromEntries(ATTRS.map(a=>[a,0])),titles:{owned:[],active:null},achievements:[],rewards:[],quests:seedDailyQuests(),_stats:{study:0},_flags:{},focus:{active:false,remaining:0}});

const screen=$("#screen"); const tabs=$$(".tabs button");
let state=store.load()||defaultState(); store.save(state);
updateGold(); setTab('quests'); tabs.forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));

function updateGold(){ $("#goldDisplay").textContent=`💰 ${state.gold}` }
function setTab(name){ tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===name)); $("#fab").style.display=(name==='quests')?'block':'none'; if(name==='quests') renderQuests(); if(name==='journey') renderJourney(); if(name==='character') renderCharacter(); if(name==='store') renderStore(); if(name==='focus') renderFocus(); }
let countdownTimer=null;
function renderQuests(){ clearInterval(countdownTimer); screen.innerHTML='<h2>Quests</h2>'; const wrap=document.createElement('div'); state.quests.forEach(q=>wrap.appendChild(renderQuestCard(q))); screen.appendChild(wrap); const spans=$$('.quest .togo',wrap); const tick=()=>{const secs=((nextMidnight()-now())/1000)|0; spans.forEach(s=>s.textContent=secondsToHMS(secs))}; tick(); countdownTimer=setInterval(tick,1000); }
function renderQuestCard(q){ const tpl=$("#quest-card").content.cloneNode(true); const badge=tpl.querySelector('[data-badge]'); badge.style.display=q.daily?'inline-block':'none'; tpl.querySelector('.title').textContent=q.title; tpl.querySelector('.meta').textContent=`${q.difficulty??'Normal'} • ${q.type}`; tpl.querySelector('.rewards .xp').textContent=`+${q.xp||0} XP`; const apSum=q.ap?Object.values(q.ap).reduce((a,b)=>a+b,0):0; tpl.querySelector('.rewards .ap').textContent=`⭐ ${apSum}`; tpl.querySelector('.rewards .gold').textContent=`💰 ${q.gold||0}`; const bar=tpl.querySelector('.bar'); bar.style.width=`${progressPercent(q)}%`; const actions=tpl.querySelector('.actions'); if(q.type==='timer'){ const start=mkBtn('Start',()=>{q._end=Date.now()+q.duration*60*1000; tick(); saveRerender();}); const done=mkBtn('Done',()=>completeQuest(q)); actions.append(start,done); function tick(){ if(!q._end) return; const left=q._end-Date.now(); bar.style.width=`${100-(left/(q.duration*60*1000))*100}%`; if(left<=0) completeQuest(q); else setTimeout(tick,200) } if(q._end) tick(); } else if(q.type==='counter'){ q.count??=0; actions.append(badgeSpan(`${q.count}/${q.target}`),mkBtn('−1',()=>{q.count=Math.max(0,q.count-1); saveRerender()}),mkBtn('+1',()=>{q.count=Math.min(q.target,q.count+1); if(q.count>=q.target) completeQuest(q); else saveRerender()}),mkBtn('Finish',()=>{q.count=q.target; completeQuest(q)})); } else if(q.type==='checklist'){ q.items??=(q.checklist||[]).map(t=>({t,d:false})); const ul=el('ul'); ul.className='clean'; q.items.forEach(it=>{ const li=el('li'); li.append(mkBtn(it.d?'☑︎':'○',()=>{ it.d=!it.d; if(q.items.every(x=>x.d)) completeQuest(q); else saveRerender(); }), el('span',' '+it.t)); ul.appendChild(li); }); actions.append(ul); } else if(q.type==='multi'){ q.items??=(q.items||[]).map(([label,target])=>({label,target,count:0})); q.items.forEach(it=>{ const row=el('div'); row.className='row between'; row.style.margin='4px 0'; row.append(el('div',it.label), el('div',`${it.count} / ${it.target}`)); const btns=el('div'); btns.className='row'; btns.style.gap='8px'; btns.append(mkBtn('Finish',()=>{it.count=it.target; checkMultiComplete(q); saveRerender()})); btns.append(mkBtn('−1',()=>{it.count=Math.max(0,it.count-1); saveRerender()})); btns.append(mkBtn('+1',()=>{it.count=Math.min(it.target,it.count+1); checkMultiComplete(q); saveRerender()})); actions.append(row,btns); }); } function saveRerender(){ store.save(state); setTab('quests'); updateGold(); } return tpl; }
function progressPercent(q){ if(q.type==='timer'){ if(!q._end) return 0; const spent=(q.duration*60*1000)-Math.max(0,q._end-Date.now()); return spent/(q.duration*60*1000)*100 } if(q.type==='counter') return (q.count||0)/(q.target||1)*100; if(q.type==='checklist'){ const t=(q.items||[]).length||1; const d=(q.items||[]).filter(i=>i.d).length; return d/t*100 } if(q.type==='multi'){ let T=0,D=0; (q.items||[]).forEach(it=>{T+=it.target; D+=it.count||0}); return D/Math.max(1,T)*100 } return 0 }
function checkMultiComplete(q){ if((q.items||[]).every(it=>it.count>=it.target)) completeQuest(q) }
function completeQuest(q){ if(q._completed) return; q._completed=Date.now(); state.gold+=(q.gold||0); if(q.ap) Object.entries(q.ap).forEach(([k,v])=> state.attributes[k]=(state.attributes[k]||0)+v); if(q.tag==='study') state._stats.study=(state._stats.study||0)+1; if(q.tag==='clean') state._flags.didClean=true; if(q.tag==='strength') state._flags.didStrength=true; addXP(q.xp||0); toast(`+${q.xp||0} XP • ⭐ ${q.ap?Object.values(q.ap).reduce((a,b)=>a+b,0):0} • 💰 ${q.gold||0}`); checkUnlocks(); store.save(state); setTab('quests'); updateGold(); }
function addXP(xp){ state.xp+=xp; while(state.xp>=xpForLevel(state.level)&&state.level<100){ state.xp-=xpForLevel(state.level); state.level++ } }
function countCompleted(s){ return s.quests.filter(q=>q._completed).length }
function completedToday(s){ const today=new Date().toDateString(); return s.quests.filter(q=>q._completed && new Date(q._completed).toDateString()===today).length }
function sweepAtMidnight(){ const key=new Date().toDateString(); if(state._lastMidnightKey===key) return; const kept=[]; let missed=0; for(const q of state.quests){ if(q.daily){ if(!q._completed){ missed++ } } else kept.push(q) } state.quests=kept.concat(seedDailyQuests()); if(missed>0){ state.quests.unshift({id:crypto.randomUUID(),title:`Penalty — Do ${missed*25} pushups`,type:'counter',target:missed*25,difficulty:'Penalty',xp:Math.round(5*missed),gold:0,ap:{Physical:1},daily:false,created:Date.now()}) } state._lastMidnightKey=key; store.save(state); setTab('quests') }
setInterval(sweepAtMidnight,5000); sweepAtMidnight();

// Character — now includes EQUIP selector right on the page
function renderCharacter(){
  screen.innerHTML='<h2>Character</h2>';
  const tbar=document.createElement('section'); tbar.className='titlebar';
  const active=state.titles.active || 'No Title';
  const current=document.createElement('div'); current.className='current'; current.innerHTML=`<span class="badge gold">🏷️ Title</span> ${active}`;
  const actions=document.createElement('div'); actions.className='actions';
  const equipBtn=mkBtn('Change Title',()=>openTitlePicker()); actions.append(equipBtn);
  tbar.append(current,actions);
  // earned titles quick equip row
  const row=document.createElement('div'); row.className='badgerow';
  (state.titles.owned||[]).forEach(n=>{ const b=document.createElement('button'); b.className='badge gold'; b.textContent=n; b.onclick=()=>{ state.titles.active=n; store.save(state); renderCharacter(); }; row.appendChild(b); });
  if(!row.childNodes.length) row.appendChild(el('div','Unlock titles by completing quests.'));
  tbar.appendChild(row);
  screen.appendChild(tbar);

  const rank=rankForLevel(state.level), need=xpForLevel(state.level);
  const lv=document.createElement('section'); lv.className='card'; lv.innerHTML=`<div class="row between"><div class="badge">Rank ${rank}</div><div>${state.xp}/${need} XP</div></div><div class="progress"><div class="bar" style="width:${Math.min(100,state.xp/need*100)}%"></div></div>`; screen.appendChild(lv);

  // attributes grid
  const grid=document.createElement('div'); grid.className='row'; grid.style.flexWrap='wrap'; grid.style.gap='8px';
  ATTRS.forEach(a=>{ const box=document.createElement('div'); box.className='badge'; box.textContent=`${a.toUpperCase()}: ${state.attributes[a]||0}`; grid.appendChild(box) });
  const card=document.createElement('section'); card.className='card'; card.appendChild(grid); screen.appendChild(card);
}

// Title picker dialog (simple)
function openTitlePicker(){
  const dlg=document.createElement('div'); dlg.style.position='fixed'; dlg.style.inset='0'; dlg.style.background='rgba(0,0,0,.6)'; dlg.style.display='flex'; dlg.style.alignItems='center'; dlg.style.justifyContent='center'; dlg.style.zIndex=99;
  const panel=document.createElement('div'); panel.className='card'; panel.style.maxWidth='520px'; panel.style.width='92%'; panel.innerHTML='<h3>Select a Title</h3>';
  const list=document.createElement('ul'); list.className='clean';
  Titles.forEach(t=>{
    const unlocked=isTitleUnlocked(t);
    const li=document.createElement('li');
    li.append(el('div', t.name+' — '+t.desc));
    const btn=mkBtn(unlocked?(state.titles.active===t.name?'Equipped':'Equip'):'Locked', ()=>{ if(unlocked){ state.titles.active=t.name; addOwnedTitle(t.name); store.save(state); document.body.removeChild(dlg); renderCharacter(); } });
    if(!unlocked){ btn.className='badge lock' } else { btn.className='badge gold' }
    li.append(btn); list.appendChild(li);
  });
  panel.appendChild(list);
  const close=mkBtn('Close',()=>document.body.removeChild(dlg)); panel.appendChild(close);
  dlg.appendChild(panel);
  document.body.appendChild(dlg);
}

function renderJourney(){
  screen.innerHTML='<h2>Journey</h2>';
  const titles=document.createElement('section'); titles.className='card'; titles.innerHTML='<h3>Titles</h3><div class="subtitle">Tap to equip. Locked items show requirements.</div>';
  const list=document.createElement('ul'); list.className='clean';
  Titles.forEach(t=>{
    const unlocked=isTitleUnlocked(t);
    const li=document.createElement('li');
    li.append(el('div', t.name+' — '+t.desc));
    const btn=mkBtn(unlocked?(state.titles.active===t.name?'Equipped':'Equip'):'Locked', ()=>{ if(unlocked){ state.titles.active=t.name; addOwnedTitle(t.name); store.save(state); renderJourney(); } });
    if(!unlocked){ btn.className='badge lock' } else { btn.className='badge gold' }
    li.append(btn); list.appendChild(li);
  });
  titles.appendChild(list); screen.appendChild(titles);

  const ach=document.createElement('section'); ach.className='card'; ach.innerHTML='<h3>Achievements</h3><div class="subtitle">Earn badges as you improve.</div>';
  const aul=document.createElement('ul'); aul.className='clean';
  Achievements.forEach(a=>{ const ok=a.unlock(state); const li=document.createElement('li'); li.append(el('div', `${a.badge||'🏅'} ${a.name}`), el('div', ok?'✅':'⌛')); aul.appendChild(li); if(ok) addAchievement(a.id); });
  ach.appendChild(aul); screen.appendChild(ach);
}

function renderStore(){
  screen.innerHTML='<h2>Store</h2>'; const wrap=document.createElement('section'); wrap.className='card'; wrap.innerHTML='<div class="subtitle">Add your own rewards, priced in gold.</div><div class="row" style="gap:8px;flex-wrap:wrap"><input id="rwTitle" placeholder="Title"><input id="rwCost" type="number" value="50" min="1" style="width:120px"><button id="rwAdd">Save</button></div><ul id="rwList" class="clean"></ul>'; screen.appendChild(wrap); const list=$("#rwList"); state.rewards||=[]; (state.rewards||[]).forEach((r,i)=> list.appendChild(rwRow(r,i))); $("#rwAdd").onclick=()=>{ const t=$("#rwTitle").value.trim(); const c=Math.max(1,Number($("#rwCost").value||0)); if(!t) return; (state.rewards||(state.rewards=[])).push({t,c}); store.save(state); renderStore(); }; function rwRow(r,i){ const li=document.createElement('li'); const buy=mkBtn(`Buy (${r.c}💰)`,()=>{ if(state.gold<r.c){ toast('Not enough gold.'); return } state.gold-=r.c; updateGold(); store.save(state); renderStore(); }); li.append(el('span',r.t), buy, mkBtn('Delete',()=>{ state.rewards.splice(i,1); store.save(state); renderStore(); })); return li; }}

let focusInterval=null;
function renderFocus(){ screen.innerHTML='<h2>Focus</h2>'; const card=document.createElement('section'); card.className='card'; card.innerHTML='<div class="row" style="gap:10px;flex-wrap:wrap"><label style="color:#a3a3ad">Minutes</label><input id="fmins" type="number" min="1" value="25" style="width:100px"></div><div style="font-size:42px;font-weight:800;margin:6px 0" id="ftimer">25:00</div><div class="row" style="gap:8px;flex-wrap:wrap"><button id="fstart">Start</button><button id="fpause">Pause</button><button id="fresume">Resume</button><button id="fcancel">Cancel</button></div>'; screen.appendChild(card); const out=$("#ftimer"); const upd=()=>{ const s=Math.max(0,(state.focus.remaining||0)|0); out.textContent=secondsToHMS(s).slice(3); if(s<=0){ clearInterval(focusInterval); if(state.focus._justEnded){ state._flags.didFocus25=(state.focus._lastLen||0)>=25; delete state.focus._justEnded; checkUnlocks(); store.save(state); } } }; $("#fstart").onclick=()=>{ const m=Math.max(1,Number($("#fmins").value||25)); state.focus.remaining=m*60; state.focus._lastLen=m; clearInterval(focusInterval); focusInterval=setInterval(()=>{ state.focus.remaining--; if(state.focus.remaining<=0){ state.focus._justEnded=true; clearInterval(focusInterval) } upd() },1000); upd(); store.save(state) }; $("#fpause").onclick=()=>{ clearInterval(focusInterval); store.save(state) }; $("#fresume").onclick=()=>{ if(state.focus.remaining>0){ clearInterval(focusInterval); focusInterval=setInterval(()=>{ state.focus.remaining--; if(state.focus.remaining<=0){ state.focus._justEnded=true; clearInterval(focusInterval) } upd() },1000) } }; $("#fcancel").onclick=()=>{ clearInterval(focusInterval); state.focus.remaining=0; upd(); store.save(state) }; upd() }

function openTitlePicker(){} // defined in renderCharacter dynamically

function addOwnedTitle(name){ state.titles.owned||(state.titles.owned=[]); if(!state.titles.owned.includes(name)) state.titles.owned.push(name) }
function isTitleUnlocked(t){ try{return !!t.unlock(state)}catch(e){return false} }
function addAchievement(id){ state.achievements||(state.achievements=[]); if(!state.achievements.includes(id)) state.achievements.push(id) }
function checkUnlocks(){ Titles.forEach(t=>{ if(t.unlock(state)) addOwnedTitle(t.name) }); Achievements.forEach(a=>{ if(a.unlock(state)) addAchievement(a.id) }) }

function mkBtn(label,fn){ const b=document.createElement('button'); b.className='badge'; b.textContent=label; b.onclick=fn; return b }
function badgeSpan(txt){ const b=document.createElement('span'); b.className='badge'; b.textContent=txt; return b }
function el(tag,txt){ const n=document.createElement(tag); if(txt!=null) n.textContent=txt; return n }
function toast(msg){ const t=document.createElement('div'); t.textContent=msg; t.style.position='fixed'; t.style.bottom='64px'; t.style.left='50%'; t.style.transform='translateX(-50%)'; t.style.padding='10px 14px'; t.style.borderRadius='12px'; t.style.background='rgba(0,0,0,.75)'; t.style.border='1px solid #2a3242'; t.style.color='white'; t.style.zIndex=50; document.body.appendChild(t); setTimeout(()=>t.remove(),1500) }

// FAB add quick quest
$("#fab").onclick=()=>{ const n=prompt('New quest title? (counter 1/1)'); if(!n) return; state.quests.unshift({id:crypto.randomUUID(),title:n,type:'counter',target:1,count:0,daily:false,xp:10,gold:5,ap:{Psyche:1},difficulty:'Normal'}); store.save(state); setTab('quests') };
