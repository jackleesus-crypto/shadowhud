
// v12.7 — rolled back look, kept all v12 features; multi-file modules friendly
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

// --- State ---
const ATTRS=["Physical","Psyche","Intellect","Social","Spiritual","Financial"];
const RANKS=["E","D","C","B","A","S"];
const xpForLevel=lv=>Math.round(45+(lv-1)*(10+Math.pow(lv,1.35))/2);
const rankForLevel=lv=>RANKS[Math.min(5,Math.floor((lv-1)/15))];
const store={k:'shadowhud.v127',load(){try{return JSON.parse(localStorage.getItem(this.k))||null}catch{return null}},save(s){localStorage.setItem(this.k,JSON.stringify(s))}};
const now=()=>new Date();
const nextMidnight=()=>{const d=new Date(); d.setHours(24,0,0,0); return d};
const secondsToHMS=s=>{s=Math.max(0,s|0); const h=(s/3600)|0, m=((s%3600)/60)|0, x=s%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`};

// Titles & Achievements
const Titles=[
 {id:'start',name:'The One Who Started',desc:'Complete 1 quest.',unlock:s=>countCompleted(s)>=1},
 {id:'momentum',name:'Momentum Builder',desc:'Complete 3 quests in a day.',unlock:s=>completedToday(s)>=3},
 {id:'learner',name:'Learner',desc:'Finish 5 study/practice sessions.',unlock:s=>(s._stats?.study||0)>=5},
 {id:'focus',name:'Focused Mind',desc:'Finish a 25+ min Focus.',unlock:s=>s._flags?.didFocus25},
 {id:'clean',name:'Clean Slate',desc:'Deep clean a room.',unlock:s=>s._flags?.didClean},
 {id:'strength',name:'Strength Seeker',desc:'Complete Strength Training.',unlock:s=>s._flags?.didStrength},
 {id:'rankD',name:'Rank D Adventurer',desc:'Reach level 16.',unlock:s=>s.level>=16}
];
const Achievements=[
 {id:'first',name:'First Steps',desc:'Complete your first quest.',unlock:s=>countCompleted(s)>=1,badge:'🥇'},
 {id:'five',name:'Quest Novice',desc:'Complete 5 quests.',unlock:s=>countCompleted(s)>=5,badge:'🥈'},
 {id:'ten',name:'Quest Adept',desc:'Complete 10 quests.',unlock:s=>countCompleted(s)>=10,badge:'🏅'},
 {id:'gold100',name:'Gold Stacker',desc:'Earn 100 gold.',unlock:s=>(s.gold||0)>=100,badge:'💰'},
 {id:'learner',name:'Learner',desc:'5 study/practice sessions.',unlock:s=>(s._stats?.study||0)>=5,badge:'📚'}
];

function seedDailyQuests(){
  const add=(a,arr)=>arr.push({...a,id:crypto.randomUUID(),created:Date.now(),daily:a.daily??true});
  const qs=[];
  add({title:'Study/Skill practice 30 min',type:'timer',duration:30,difficulty:'Hard',xp:88,gold:22,ap:{Intellect:2},daily:true,tag:'study'},qs);
  add({title:'Deep clean a room',type:'checklist',checklist:['Pick area','Sort','Put away'],difficulty:'Hard',xp:77,gold:22,ap:{Social:2},daily:true,tag:'clean'},qs);
  add({title:'Call or text a loved one',type:'counter',target:1,difficulty:'Easy',xp:10,gold:10,ap:{Social:1},daily:true,tag:'social'},qs);
  add({title:'Strength Training',type:'multi',items:[['Pushups',100],['Sit-ups',100],['Squats',100],['Run (miles)',1]],difficulty:'Elite',xp:150,gold:35,ap:{Physical:3},daily:true,tag:'strength'},qs);
  return qs;
}
const defaultState=()=>({gold:0,level:1,xp:0,attributes:Object.fromEntries(ATTRS.map(a=>[a,0])),titles:{owned:[],active:null},achievements:[],rewards:[],quests:seedDailyQuests(),_stats:{study:0},_flags:{},focus:{remaining:0}});
let S=store.load()||defaultState(); store.save(S);

// --- Router (tabs) ---
const content=$("#content");
const tabs=$$(".tabbar button");
tabs.forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$("#fab").addEventListener('click',onFab);
function setTab(name){ tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===name)); if(name==='quests') renderQuests(); if(name==='journey') renderJourney(); if(name==='character') renderCharacter(); if(name==='store') renderStore(); if(name==='focus') renderFocus(); }
updateGold(); setTab('quests');

function updateGold(){ $("#gold").textContent=`💰 ${S.gold}` }

// --- Quests ---
let midTimer=null;
function renderQuests(){
  clearInterval(midTimer);
  content.innerHTML=`
    <section class="card"><div class="row between"><div class="badge">Level ${S.level} · ${rankForLevel(S.level)}</div><div>${S.xp}/${xpForLevel(S.level)} XP</div></div><div class="progress"><div class="bar" style="width:${Math.min(100,S.xp/xpForLevel(S.level)*100)}%"></div></div></section>
    <section class="card"><div class="row between"><h2>Quests</h2><div class="subtitle">Daily quests reset at midnight.</div></div></section>
  `;
  const wrap=document.createElement('div');
  S.quests.forEach(q=>wrap.appendChild(renderQuestCard(q)));
  content.appendChild(wrap);

  // live countdown
  const spans=$$('.quest .countdown .left', wrap);
  const tick=()=>{ const secs=((nextMidnight()-now())/1000)|0; spans.forEach(s=>s.textContent=secondsToHMS(secs)); };
  tick(); midTimer=setInterval(tick,1000);
}

function renderQuestCard(q){
  const tpl=$("#quest-card-tpl").content.cloneNode(true);
  const card=tpl.querySelector('.quest');
  const badge=tpl.querySelector('.chip'); badge.style.display=q.daily?'inline-flex':'none';
  tpl.querySelector('.qtitle').textContent=q.title;
  tpl.querySelector('.meta').textContent=`${q.difficulty??'Normal'} • ${q.type}`;
  tpl.querySelector('.rewards .xp').textContent=`+${q.xp||0} XP`;
  const apSum=q.ap?Object.values(q.ap).reduce((a,b)=>a+b,0):0;
  tpl.querySelector('.rewards .ap').textContent=`⭐ ${apSum}`;
  tpl.querySelector('.rewards .gold').textContent=`💰 ${q.gold||0}`;
  const bar=tpl.querySelector('.bar'); bar.style.width=`${progressPercent(q)}%`;
  const actions=tpl.querySelector('.actions');

  if(q.type==='timer'){
    const start=btn('Start',()=>{ q._end=Date.now()+q.duration*60*1000; tick(); saveRerender(); });
    const done=btn('Done',()=>completeQuest(q));
    actions.append(start,done);
    function tick(){ if(!q._end) return; const left=q._end-Date.now(); bar.style.width=`${100-(left/(q.duration*60*1000))*100}%`; if(left<=0){ completeQuest(q) } else setTimeout(tick,200) }
    if(q._end) tick();
  } else if(q.type==='counter'){
    q.count??=0;
    actions.append(badge(`${q.count}/${q.target}`), btn('−1',()=>{q.count=Math.max(0,q.count-1); saveRerender()}), btn('+1',()=>{q.count=Math.min(q.target,q.count+1); if(q.count>=q.target) completeQuest(q); else saveRerender()}), btn('Finish',()=>{q.count=q.target; completeQuest(q)}));
  } else if(q.type==='checklist'){
    q.items??=(q.checklist||[]).map(t=>({t,d:false}));
    const ul=el('ul'); ul.className='clean';
    q.items.forEach(it=>{ const li=el('li'); const mark=btn(it.d?'☑︎':'○',()=>{ it.d=!it.d; if(q.items.every(x=>x.d)) completeQuest(q); else saveRerender() }); li.append(mark, el('span',' '+it.t)); ul.appendChild(li); });
    actions.append(ul);
  } else if(q.type==='multi'){
    q.items??=(q.items||[]).map(([label,target])=>({label,target,count:0}));
    q.items.forEach(it=>{
      const row=el('div'); row.className='row between'; row.style.margin='4px 0';
      row.append(el('div',it.label), el('div',`${it.count} / ${it.target}`));
      const btns=el('div'); btns.className='row'; btns.style.gap='8px';
      btns.append(btn('Finish',()=>{it.count=it.target; checkMultiComplete(q); saveRerender()}));
      btns.append(btn('−1',()=>{it.count=Math.max(0,it.count-1); saveRerender()}));
      btns.append(btn('+1',()=>{it.count=Math.min(it.target,it.count+1); checkMultiComplete(q); saveRerender()}));
      actions.append(row,btns);
    });
  }

  // Reset button (for any quest)
  actions.append(btn('Reset',()=>{ delete q._completed; delete q._end; q.count=0; (q.items||[]).forEach(it=>{it.count=0; it.d=false}); saveRerender() }));

  function saveRerender(){ store.save(S); renderQuests(); updateGold() }
  return tpl;
}

function progressPercent(q){
  if(q.type==='timer'){ if(!q._end) return 0; const spent=(q.duration*60*1000)-Math.max(0,q._end-Date.now()); return spent/(q.duration*60*1000)*100 }
  if(q.type==='counter') return (q.count||0)/(q.target||1)*100;
  if(q.type==='checklist'){ const t=(q.items||[]).length||1; const d=(q.items||[]).filter(i=>i.d).length; return d/t*100 }
  if(q.type==='multi'){ let T=0,D=0; (q.items||[]).forEach(it=>{T+=it.target; D+=it.count||0}); return D/Math.max(1,T)*100 }
  return 0;
}
function checkMultiComplete(q){ if((q.items||[]).every(it=>it.count>=it.target)) completeQuest(q) }

function completeQuest(q){
  if(q._completed) return;
  q._completed=Date.now();
  S.gold+=(q.gold||0);
  if(q.ap) Object.entries(q.ap).forEach(([k,v])=>S.attributes[k]=(S.attributes[k]||0)+v);
  if(q.tag==='study') S._stats.study=(S._stats.study||0)+1;
  if(q.tag==='clean') S._flags.didClean=true;
  if(q.tag==='strength') S._flags.didStrength=true;
  addXP(q.xp||0);
  toast(`+${q.xp||0} XP • ⭐ ${q.ap?Object.values(q.ap).reduce((a,b)=>a+b,0):0} • 💰 ${q.gold||0}`);
  checkUnlocks();
  store.save(S); renderQuests(); updateGold();
}

function addXP(xp){ S.xp+=xp; while(S.xp>=xpForLevel(S.level)&&S.level<100){ S.xp-=xpForLevel(S.level); S.level++ } }

function countCompleted(s){ return s.quests.filter(q=>q._completed).length }
function completedToday(s){ const d=new Date().toDateString(); return s.quests.filter(q=>q._completed && new Date(q._completed).toDateString()===d).length }

// Midnight sweep: replace missed dailies with penalty, respawn default dailies
function sweepAtMidnight(){
  const key=new Date().toDateString();
  if(S._lastMidnightKey===key) return;
  let missed=0; const kept=[];
  for(const q of S.quests){ if(q.daily){ if(!q._completed) missed++; } else kept.push(q) }
  S.quests = kept.concat(seedDailyQuests());
  if(missed>0){
    S.quests.unshift({id:crypto.randomUUID(),title:`Penalty — Do ${missed*25} pushups`,type:'counter',target:missed*25,difficulty:'Penalty',xp:Math.round(5*missed),gold:0,ap:{Physical:1},daily:false,created:Date.now()});
  }
  S._lastMidnightKey=key; store.save(S); renderQuests();
}
setInterval(sweepAtMidnight, 5000); sweepAtMidnight();

// --- Character (with EQUIP title) ---
function renderCharacter(){
  content.innerHTML='';
  const titleBar=document.createElement('section'); titleBar.className='card';
  const active=S.titles.active || 'No Title';
  titleBar.innerHTML=`<div class="row between"><div class="badge badge--gold">🏷️ ${active}</div><button id="equipBtn" class="badge">Change Title</button></div>`;
  content.appendChild(titleBar);
  $("#equipBtn").onclick=openTitlePicker;

  const lv=document.createElement('section'); lv.className='card';
  lv.innerHTML=`<div class="row between"><div class="badge">Rank ${rankForLevel(S.level)}</div><div>${S.xp}/${xpForLevel(S.level)} XP</div></div><div class="progress"><div class="bar" style="width:${Math.min(100,S.xp/xpForLevel(S.level)*100)}%"></div></div>`;
  content.appendChild(lv);

  const grid=el('div'); grid.className='grid';
  ATTRS.forEach(a=>{ const s=el('div'); s.className='stat'; s.innerHTML=`<div style="color:var(--muted);font-size:12px">${a.toUpperCase()}</div><div style="font-size:28px;font-weight:800">${S.attributes[a]||0}</div>`; grid.appendChild(s) });
  const card=document.createElement('section'); card.className='card'; card.appendChild(grid);
  content.appendChild(card);
}

function openTitlePicker(){
  const dlg=document.createElement('div'); dlg.style.position='fixed'; dlg.style.inset='0'; dlg.style.display='flex'; dlg.style.alignItems='center'; dlg.style.justifyContent='center'; dlg.style.background='rgba(0,0,0,.6)'; dlg.style.zIndex=50;
  const panel=document.createElement('section'); panel.className='card'; panel.style.width='92%'; panel.style.maxWidth='520px'; panel.innerHTML='<h3>Choose a Title</h3>';
  const list=document.createElement('ul'); list.className='clean';
  Titles.forEach(t=>{
    const unlocked=!!t.unlock(S);
    const li=document.createElement('li');
    li.append(el('div', `${t.name} — ${t.desc}`));
    const b=document.createElement('button'); b.className=unlocked?'badge badge--gold':'badge'; b.textContent=unlocked?(S.titles.active===t.name?'Equipped':'Equip'):'Locked';
    b.onclick=()=>{ if(unlocked){ S.titles.active=t.name; addOwnedTitle(t.name); store.save(S); document.body.removeChild(dlg); renderCharacter(); } };
    li.append(b); list.appendChild(li);
  });
  panel.appendChild(list);
  const close=document.createElement('button'); close.className='badge'; close.textContent='Close'; close.onclick=()=>document.body.removeChild(dlg);
  panel.appendChild(close);
  dlg.appendChild(panel); document.body.appendChild(dlg);
}

// --- Journey (titles + achievements) ---
function renderJourney(){
  content.innerHTML='';
  const tsec=document.createElement('section'); tsec.className='card';
  tsec.innerHTML='<h3>Titles</h3><div class="subtitle">Tap Equip to set your displayed title.</div>';
  const list=document.createElement('ul'); list.className='clean';
  Titles.forEach(t=>{
    const unlocked=!!t.unlock(S);
    const li=document.createElement('li');
    li.append(el('div', `${t.name} — ${t.desc}`));
    const b=document.createElement('button'); b.className=unlocked?'badge badge--gold':'badge'; b.textContent=unlocked?(S.titles.active===t.name?'Equipped':'Equip'):'Locked';
    b.onclick=()=>{ if(unlocked){ S.titles.active=t.name; addOwnedTitle(t.name); store.save(S); renderJourney(); } };
    list.appendChild(li); li.appendChild(b);
  });
  tsec.appendChild(list); content.appendChild(tsec);

  const asec=document.createElement('section'); asec.className='card';
  asec.innerHTML='<h3>Achievements</h3><div class="subtitle">Badges for progress.</div>';
  const al=document.createElement('ul'); al.className='clean';
  Achievements.forEach(a=>{
    const ok=a.unlock(S); if(ok) addAchievement(a.id);
    const li=document.createElement('li'); li.append(el('div', `${a.badge||'🏅'} ${a.name}`), el('div', ok?'✅':'⌛')); al.appendChild(li);
  });
  asec.appendChild(al); content.appendChild(asec);
}

// --- Store ---
function renderStore(){
  content.innerHTML='';
  const sec=document.createElement('section'); sec.className='card';
  sec.innerHTML='<h3>Store</h3><div class="subtitle">Add your own rewards to buy with gold.</div>';
  const row=el('div'); row.className='row'; row.style.flexWrap='wrap'; row.style.gap='8px';
  row.innerHTML='<input id="rwTitle" placeholder="Title"><input id="rwCost" type="number" min="1" value="50" style="width:120px"><button id="rwAdd" class="badge">Save</button>';
  sec.appendChild(row);
  const list=document.createElement('ul'); list.id='rwList'; list.className='clean'; sec.appendChild(list);
  content.appendChild(sec);
  S.rewards ||= [];
  S.rewards.forEach((r,i)=> list.appendChild(rwRow(r,i)));
  $("#rwAdd").onclick=()=>{
    const t=$("#rwTitle").value.trim(); const c=Math.max(1,Number($("#rwCost").value||0));
    if(!t) return; S.rewards.push({t,c}); store.save(S); renderStore();
  };
  function rwRow(r,i){
    const li=document.createElement('li');
    const buy=btn(`Buy (${r.c}💰)`,()=>{ if(S.gold<r.c){ toast('Not enough gold.'); return } S.gold-=r.c; updateGold(); store.save(S); renderStore(); });
    const del=btn('Delete',()=>{ S.rewards.splice(i,1); store.save(S); renderStore(); });
    li.append(el('span', r.t), buy, del); return li;
  }
}

// --- Focus (simple timer) ---
let focusTimer=null;
function renderFocus(){
  content.innerHTML='';
  const sec=document.createElement('section'); sec.className='card';
  sec.innerHTML='<h3>Focus</h3><div class="subtitle">Simple timer.</div>';
  const input=el('input'); input.type='number'; input.min=1; input.value=25; input.style.width='100px';
  const big=el('div'); big.style.cssText='font-size:44px;font-weight:800;margin:6px 0'; big.id='ftimer'; big.textContent='25:00';
  const btns=el('div'); btns.className='row'; btns.style.gap='8px';
  const start=btn('Start',()=>{ const m=Math.max(1,Number(input.value||25)); S.focus.remaining=m*60; clearInterval(focusTimer); focusTimer=setInterval(()=>{ S.focus.remaining--; if(S.focus.remaining<=0){ clearInterval(focusTimer); S._flags.didFocus25=(m>=25); store.save(S); checkUnlocks(); } update() },1000); update(); store.save(S) });
  const pause=btn('Pause',()=>{ clearInterval(focusTimer) });
  const resume=btn('Resume',()=>{ clearInterval(focusTimer); focusTimer=setInterval(()=>{ S.focus.remaining--; if(S.focus.remaining<=0){ clearInterval(focusTimer); S._flags.didFocus25=(S.focus._lastLen||0)>=25; } update() },1000) });
  const cancel=btn('Cancel',()=>{ clearInterval(focusTimer); S.focus.remaining=0; update() });
  btns.append(start,pause,resume,cancel);
  sec.appendChild(el('div','Minutes')); sec.appendChild(input); sec.appendChild(big); sec.appendChild(btns);
  content.appendChild(sec);
  function update(){ const s=Math.max(0,S.focus.remaining|0); big.textContent=secondsToHMS(s).slice(3) }
}

// --- Helpers ---
function btn(label,fn){ const b=document.createElement('button'); b.className='badge'; b.textContent=label; b.onclick=fn; return b }
function badge(text){ const s=document.createElement('span'); s.className='badge'; s.textContent=text; return s }
function el(tag,txt){ const n=document.createElement(tag); if(txt!=null) n.textContent=txt; return n }
function toast(msg){ const t=document.createElement('div'); t.textContent=msg; t.style.position='fixed'; t.style.bottom='70px'; t.style.left='50%'; t.style.transform='translateX(-50%)'; t.style.padding='10px 14px'; t.style.borderRadius='12px'; t.style.background='rgba(0,0,0,.75)'; t.style.border='1px solid #2a3242'; t.style.color='white'; t.style.zIndex=50; document.body.appendChild(t); setTimeout(()=>t.remove(),1500) }
function addOwnedTitle(n){ S.titles.owned||(S.titles.owned=[]); if(!S.titles.owned.includes(n)) S.titles.owned.push(n) }
function addAchievement(id){ S.achievements||(S.achievements=[]); if(!S.achievements.includes(id)) S.achievements.push(id) }
function checkUnlocks(){ Titles.forEach(t=>{ if(t.unlock(S)) addOwnedTitle(t.name) }); Achievements.forEach(a=>{ if(a.unlock(S)) addAchievement(a.id) }) }

function onFab(){
  const title=prompt('New quest title? (counter 1/1)');
  if(!title) return;
  S.quests.unshift({id:crypto.randomUUID(),title,type:'counter',target:1,count:0,daily:false,xp:10,gold:5,ap:{Psyche:1},difficulty:'Normal'});
  store.save(S); renderQuests();
}
