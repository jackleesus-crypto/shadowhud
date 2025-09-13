
// Polyfills
(function(){
  if(typeof window.structuredClone!=='function'){ window.structuredClone=(o)=>{try{return JSON.parse(JSON.stringify(o));}catch(e){return o;}}; }
})();

const LS='shadowhud.v11.8';
const state = load() || {
  wallet:{gold:0}, level:{xp:0,lvl:1},
  attrs:{Physical:0,Psyche:0,Intellect:0,Social:0,Spiritual:0,Financial:0},
  stats:{completed:0,currentStreak:0,longestStreak:0,lastCompletionDay:null},
  quests:[], rewards:[], lastDailyKey:null
};

function save(){ localStorage.setItem(LS,JSON.stringify(state)); }
function load(){ try{ return JSON.parse(localStorage.getItem(LS)); }catch(e){ return null; } }
function uid(){ return Math.floor(Math.random()*1e9)+Date.now(); }
function todayKey(){ const d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function endOfToday(){ const d=new Date(); d.setHours(23,59,59,999); return d.toISOString(); }

// Leveling
function xpForLevel(l){ return Math.round(40 + (l-1)*(l<30?7:(l<60?12:20))); }
function rankForLevel(l){ if(l<=15)return'E'; if(l<=30)return'D'; if(l<=45)return'C'; if(l<=60)return'B'; if(l<=80)return'A'; return 'S'; }
function addXP(n){ state.level.xp+=n; while(state.level.xp>=xpForLevel(state.level.lvl)){ state.level.xp-=xpForLevel(state.level.lvl); state.level.lvl++; } save(); renderJourney(); renderCharacter(); }
function addGold(n){ state.wallet.gold+=n; save(); renderCharacter(); }

// Rewards
const diffScale={easy:1,normal:1.2,hard:1.6,elite:2.2,boss:3};
function rewardFromBase(base,diff){ return Math.round(base*(diffScale[diff]||1)); }
function goldFromBase(base,diff){ return Math.max(5,Math.round(base*(diffScale[diff]||1)*0.4)); }

// Dailies
function seedTodayDailiesIfMissing(){
  const key=todayKey();
  if(state.quests.some(q=>q.daily&&q.dayKey===key)) return;
  const d=[];
  d.push({id:uid(),title:'Strength Training',type:'multicounter',diff:'elite',baseXP:60,daily:true,dayKey:key,deadline:endOfToday(),
    attrs:[{name:'Physical',amt:2}],
    metrics:[{label:'Pushups',target:100,count:0},{label:'Sit-ups',target:100,count:0},{label:'Squats',target:100,count:0},{label:'Run (miles)',target:1,count:0}],
    completed:false,started:false
  });
  d.push({id:uid(),title:'Meditate 10 min',type:'timer',durationMin:10,durationMs:600000,diff:'normal',baseXP:20,daily:true,dayKey:key,deadline:endOfToday(),
    attrs:[{name:'Spiritual',amt:1},{name:'Psyche',amt:1}],completed:false,started:false});
  d.push({id:uid(),title:'Journal 1 page',type:'checklist',items:['What went well?','What to improve?','One intention for tomorrow'],done:[false,false,false],diff:'easy',baseXP:12,
    daily:true,dayKey:key,deadline:endOfToday(),attrs:[{name:'Intellect',amt:1},{name:'Psyche',amt:1}],completed:false,started:false});
  state.quests=d.concat(state.quests); save();
}
function makePenalty(){
  const choices=['Penalty — 50 pushups','Penalty — 25 burpees','Penalty — tidy desk','Penalty — 15 min walk'];
  const t=choices[Math.floor(Math.random()*choices.length)];
  return {id:uid(),title:t,type:'counter',target:1,count:0,diff:'normal',baseXP:8,penalty:true};
}
function midnightSweepIfNeeded(){
  const key=todayKey(); if(state.lastDailyKey===key) return;
  const keep=[],pen=[];
  for(const q of state.quests){ if(q.daily){ if(!q.completed) pen.push(makePenalty()); } else keep.push(q); }
  state.quests=keep.concat(pen); seedTodayDailiesIfMissing(); state.lastDailyKey=key; save();
}

// Render
let currentFilter='all';
function renderCharacter(){
  document.getElementById('gold').textContent=state.wallet.gold;
  document.getElementById('gold2')?.textContent = state.wallet.gold;
  // attrs
  for(const k in state.attrs){ const el=document.getElementById('attr-'+k); if(el) el.textContent=state.attrs[k]; }
  // radar
  drawRadar();
}
function renderJourney(){
  document.getElementById('lvl').textContent=state.level.lvl;
  document.getElementById('rank').textContent=rankForLevel(state.level.lvl);
  document.getElementById('xp').textContent=state.level.xp;
  document.getElementById('xpreq').textContent=xpForLevel(state.level.lvl);
  document.getElementById('xpbar').style.width = Math.min(100,Math.round(state.level.xp/xpForLevel(state.level.lvl)*100))+'%';
  document.getElementById('done').textContent=state.stats.completed;
  document.getElementById('streak').textContent=state.stats.currentStreak||0;
  document.getElementById('jg').textContent=state.wallet.gold;
}
function btn(text,fn){ const b=document.createElement('button'); b.className='btn'; b.textContent=text; b.onclick=fn; return b; }

function renderQuests(){
  const list=document.getElementById('quest-list'); list.innerHTML='';
  let qs=state.quests.slice();
  if(currentFilter==='daily') qs=qs.filter(q=>q.daily);
  if(currentFilter==='penalty') qs=qs.filter(q=>q.penalty);
  if(currentFilter==='active') qs=qs.filter(q=>q.started && !q.completed);
  if(currentFilter==='completed') qs=qs.filter(q=>q.completed);
  document.getElementById('empty-quests').style.display = qs.length? 'none':'block';
  qs.forEach(q=>{
    const c=document.createElement('div'); c.className='q';
    const head=document.createElement('div'); head.className='head';
    const tag = q.penalty?'<span class="badge">Penalty</span>':(q.daily?'<span class="badge">Daily</span>':'');
    head.innerHTML = `${tag}<span class="badge">${q.diff||'normal'}</span><div class="title">${q.title}</div>`;
    c.appendChild(head);
    const sub=document.createElement('div'); sub.className='sub';
    const xp=`+${rewardFromBase(q.baseXP||25,q.diff)} XP · 💰 ${goldFromBase(q.baseXP||25,q.diff)}`;
    sub.textContent = xp; c.appendChild(sub);

    if(q.type==='counter'){
      const row=document.createElement('div'); row.className='row gap';
      const span=document.createElement('div'); span.textContent=`${q.count||0} / ${q.target||1}`;
      row.append(span, btn('Finish',()=>{q.count=q.target||1; complete(q); renderQuests(); save();}), btn('−1',()=>{q.count=Math.max(0,(q.count||0)-1); save(); renderQuests();}), btn('+1',()=>{q.count=(q.count||0)+1; if(q.count>=q.target) complete(q); save(); renderQuests();}));
      c.appendChild(row);
    }
    if(q.type==='checklist'){
      q.done=q.done||q.items.map(()=>false);
      q.items.forEach((it,i)=>{
        const row=document.createElement('div'); row.className='counter';
        const dot=document.createElement('div'); dot.className='circle'+(q.done[i]?' done':''); dot.textContent=q.done[i]?'✓':'';
        dot.onclick=()=>{ q.done[i]=!q.done[i]; if(q.done.every(Boolean)) complete(q); save(); renderQuests(); };
        row.append(dot, document.createTextNode(it)); c.appendChild(row);
      });
    }
    if(q.type==='multicounter'){
      (q.metrics||[]).forEach(m=>{
        const row=document.createElement('div'); row.className='row gap';
        row.append(document.createTextNode(`${m.label}`), document.createTextNode(` ${m.count||0} / ${m.target}`),
          btn('Finish',()=>{ m.count=m.target; checkMulti(q); save(); renderQuests(); }),
          btn('−1',()=>{ m.count=Math.max(0,(m.count||0)-1); save(); renderQuests(); }),
          btn('+1',()=>{ m.count=Math.min(m.target,(m.count||0)+1); checkMulti(q); save(); renderQuests(); }));
        c.appendChild(row);
      });
    }
    if(q.type==='timer'){
      const disp=document.createElement('div'); disp.id='t-'+q.id; disp.textContent=timeLeftText(q); c.appendChild(disp);
      const row=document.createElement('div'); row.className='row gap';
      row.append(btn('Start',()=>{ if(!q.started){ q.started=true; q.tStart=Date.now(); q.tLeft=(q.durationMs||(q.durationMin||10)*60000); } tickTimers(); save(); renderQuests(); }),
                 btn('Pause',()=>{ if(q.started){ q.tLeft=Math.max(0,(q.tLeft||0)-(Date.now()-q.tStart)); q.started=false; } save(); renderQuests(); }),
                 btn('Resume',()=>{ if(!q.started&&q.tLeft>0){ q.started=true; q.tStart=Date.now(); } save(); renderQuests(); }),
                 btn('Done',()=>{ complete(q); save(); renderQuests(); }));
      c.appendChild(row);
    }

    const tail=document.createElement('div'); tail.className='rowbtns';
    tail.append(btn('Reset',()=>{ resetQuest(q); save(); renderQuests(); }),
                btn('Delete',()=>{ state.quests=state.quests.filter(x=>x.id!==q.id); save(); renderQuests(); }));
    c.appendChild(tail);

    list.appendChild(c);
  });
}

function resetQuest(q){
  if(q.type==='counter'){ q.count=0; }
  if(q.type==='checklist'){ q.done=q.items.map(()=>false); }
  if(q.type==='multicounter'){ q.metrics.forEach(m=>m.count=0); }
  if(q.type==='timer'){ q.started=false; q.tLeft=(q.durationMs||(q.durationMin||10)*60000); }
  q.completed=false;
}
function checkMulti(q){ if(q.metrics.every(m=>m.count>=m.target)) complete(q); }
function timeLeftText(q){ if(!q.started){ return (q.durationMin||Math.round((q.durationMs||0)/60000))+':00'; } const el=Date.now()-q.tStart; const left=Math.max(0,(q.tLeft||q.durationMs)-el); const m=Math.floor(left/60000), s=String(Math.floor((left%60000)/1000)).padStart(2,'0'); if(left===0){ complete(q);} return m+':'+s; }

function complete(q){
  if(q.completed) return; q.completed=true;
  const xp=rewardFromBase(q.baseXP||25,q.diff||'normal'); const gold=goldFromBase(q.baseXP||25,q.diff||'normal');
  addXP(xp); addGold(gold);
  if(q.attrs){ q.attrs.forEach(a=>{ state.attrs[a.name]=(state.attrs[a.name]||0)+(a.amt||1); }); }
  state.stats.completed+=1; state.stats.lastCompletionDay=todayKey();
  save(); renderCharacter(); renderJourney();
}

function drawRadar(){
  const cv=document.getElementById('radar'); if(!cv) return; const ctx=cv.getContext('2d');
  const w=cv.width, h=cv.height; ctx.clearRect(0,0,w,h);
  const labels=['Physical','Psyche','Intellect','Social','Spiritual','Financial'];
  const vals=labels.map(k=>state.attrs[k]);
  const max=Math.max(5, ...vals, 10);
  const cx=w/2, cy=h/2+20, r=Math.min(w,h)/2 - 50;
  // grid
  ctx.strokeStyle='#222'; ctx.lineWidth=1;
  for(let ring=1; ring<=5; ring++){ ctx.beginPath(); for(let i=0;i<labels.length;i++){ const ang=(Math.PI*2/labels.length)*i - Math.PI/2; const rr=r*ring/5; const x=cx+Math.cos(ang)*rr; const y=cy+Math.sin(ang)*rr; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.stroke(); }
  // axes + labels
  ctx.fillStyle='#aaa'; ctx.font='16px -apple-system,system-ui'; ctx.textAlign='center';
  for(let i=0;i<labels.length;i++){ const ang=(Math.PI*2/labels.length)*i - Math.PI/2; const x=cx+Math.cos(ang)*(r+16); const y=cy+Math.sin(ang)*(r+16); ctx.fillText(labels[i],x,y); }
  // value shape
  ctx.beginPath(); for(let i=0;i<labels.length;i++){ const ang=(Math.PI*2/labels.length)*i - Math.PI/2; const p=vals[i]/max; const x=cx+Math.cos(ang)*(r*p); const y=cy+Math.sin(ang)*(r*p); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.closePath(); ctx.fillStyle='rgba(141,162,255,0.25)'; ctx.fill(); ctx.strokeStyle='#8da2ff'; ctx.lineWidth=2; ctx.stroke();
}

// Store
function renderStore(){
  const list=document.getElementById('rewards'); list.innerHTML='';
  if(!state.rewards.length){ const e=document.createElement('div'); e.className='empty'; e.textContent='No rewards yet.'; list.appendChild(e); }
  state.rewards.forEach((r,i)=>{
    const c=document.createElement('div'); c.className='card';
    c.innerHTML=`<div class="title">${r.title}</div><div>Cost: 💰 ${r.cost}</div>`;
    c.appendChild(btn('Buy',()=>{ if(state.wallet.gold>=r.cost){ state.wallet.gold-=r.cost; save(); renderCharacter(); renderStore(); } }));
    list.appendChild(c);
  });
}

// Modal/new quest
document.getElementById('fab-add').addEventListener('click',()=>openModal());
document.getElementById('q-cancel').addEventListener('click',()=>document.getElementById('modal').classList.add('hidden'));
document.getElementById('q-type').addEventListener('change',updateTypeFields);
function updateTypeFields(){ const t=document.getElementById('q-type').value; document.querySelectorAll('[data-if]').forEach(el=>el.style.display = el.getAttribute('data-if')===t ? 'block' : 'none'); }
updateTypeFields();
document.getElementById('qform').addEventListener('submit', e=>{
  e.preventDefault();
  const q={ id:uid(), title:val('q-title'), desc:val('q-desc'), type:val('q-type'), diff:val('q-diff'), baseXP:Number(val('q-xp')||25),
    daily: byId('q-daily').checked, dayKey: byId('q-daily').checked? todayKey(): null, deadline: byId('q-daily').checked? endOfToday(): null,
    completed:false, started:false };
  if(q.type==='timer'){ q.durationMin=Number(val('q-min')||30); q.durationMs=q.durationMin*60000; }
  if(q.type==='counter'){ q.target=Number(val('q-target')||10); q.count=0; }
  if(q.type==='checklist'){ q.items=val('q-items').split(',').map(s=>s.trim()).filter(Boolean); q.done=q.items.map(()=>false); }
  if(q.type==='multicounter'){ q.metrics=val('q-multi').split(',').map(s=>s.trim()).filter(Boolean).map(p=>{ const [l,t]=p.split(':'); return {label:(l||'Item'),target:Number(t||1),count:0}; }); }
  const attrs=[]; document.querySelectorAll('#qform .attr').forEach(chk=>{ const name=chk.dataset.name; const on=chk.checked; const amtEl=document.querySelector(`#qform .amt[data-name="${name}"]`); if(on){ attrs.push({name,amt:Number(amtEl.value||1)}); }});
  q.attrs=attrs;
  state.quests.unshift(q); save(); document.getElementById('modal').classList.add('hidden'); renderQuests();
});
function val(id){ return document.getElementById(id).value; } function byId(id){ return document.getElementById(id); }

// Tabs
document.querySelectorAll('.tabs .tab').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const to=b.dataset.to; document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    if(to==='quest'){ byId('screen-quests').classList.remove('hidden'); renderQuests(); }
    if(to==='journey'){ byId('screen-journey').classList.remove('hidden'); renderJourney(); }
    if(to==='character'){ byId('screen-character').classList.remove('hidden'); renderCharacter(); }
    if(to==='store'){ byId('screen-store').classList.remove('hidden'); renderStore(); }
    if(to==='focus'){ byId('screen-focus').classList.remove('hidden'); }
  });
});

// Filters
document.querySelectorAll('[data-filter]').forEach(c=>c.addEventListener('click',()=>{
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));
  c.classList.add('active'); currentFilter=c.dataset.filter; renderQuests();
}));

// Focus
let fTimer=null,fEnd=0,fPauseLeft=0;
function fmt(ms){ const m=Math.floor(ms/60000), s=String(Math.floor((ms%60000)/1000)).padStart(2,'0'); return `${m}:${s}`; }
function updateFocus(){ const out=byId('focus-time'); if(!fTimer){ out.textContent = fmt((byId('focus-min').value||25)*60000); return; } const left=Math.max(0,fEnd-Date.now()); out.textContent=fmt(left); if(left<=0){ clearInterval(fTimer); fTimer=null; } }
byId('f-start').onclick=()=>{ const ms=Number(byId('focus-min').value||25)*60000; fEnd=Date.now()+ms; clearInterval(fTimer); fTimer=setInterval(updateFocus,500); byId('f-pause').classList.remove('hidden'); byId('f-start').classList.add('hidden'); };
byId('f-pause').onclick=()=>{ fPauseLeft=Math.max(0,fEnd-Date.now()); clearInterval(fTimer); fTimer=null; byId('f-pause').classList.add('hidden'); byId('f-resume').classList.remove('hidden'); };
byId('f-resume').onclick=()=>{ fEnd=Date.now()+fPauseLeft; fTimer=setInterval(updateFocus,500); byId('f-resume').classList.add('hidden'); byId('f-pause').classList.remove('hidden'); };
byId('f-cancel').onclick=()=>{ clearInterval(fTimer); fTimer=null; byId('f-start').classList.remove('hidden'); byId('f-pause').classList.add('hidden'); byId('f-resume').classList.add('hidden'); updateFocus(); };

// Timers in quests
function tickTimers(){ clearInterval(window.__tick); window.__tick=setInterval(()=>{ document.querySelectorAll('[id^=t-]').forEach(el=>{ const id=Number(el.id.slice(2)); const q=state.quests.find(x=>x.id===id); if(q) el.textContent=timeLeftText(q); }); }, 500); }

// Startup
function init(){ midnightSweepIfNeeded(); seedTodayDailiesIfMissing(); renderCharacter(); renderJourney(); renderQuests(); tickTimers(); }
document.addEventListener('DOMContentLoaded', init);
