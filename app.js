
/* ShadowHUD v13 - single bundle */
const VERSION = 'v13.0';
const state = {
  gold: 0,
  xp: 0,
  level: 1,
  titles: {
    owned: [],
    equipped: null
  },
  attrs: {physical:0, psyche:0, intellect:0, social:0, spiritual:0, financial:0},
  quests: [],
  rewards: [],
  stats: {completed:0, streak:0, lastCompleteDate:null},
};

const KEY='shadowhud.state.v13';
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function load(){
  const s = localStorage.getItem(KEY);
  if(s){ try{ const o = JSON.parse(s); Object.assign(state,o); }catch(e){} }
}
load();

// ---------- XP / Level / Rank ----------
function xpForLevel(lv){
  // gentle curve up to 100: f(lv)=ceil( (lv^2 + 9*lv)/2 )
  return Math.ceil((lv*lv + 9*lv)/2);
}
function currentRank(lv){
  if (lv<=15) return 'E';
  if (lv<=30) return 'D';
  if (lv<=45) return 'C';
  if (lv<=60) return 'B';
  if (lv<=80) return 'A';
  return 'S';
}
function addXP(amount){
  state.xp += Math.max(0,amount|0);
  let need = xpForLevel(state.level);
  while (state.xp >= need && state.level < 100){
    state.xp -= need;
    state.level += 1;
    need = xpForLevel(state.level);
  }
  save(); renderCharacter(); renderJourney();
}

// ---------- Utilities ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function fmt(n){ return new Intl.NumberFormat().format(n); }
function now(){ return Date.now(); }
function midnightTs(){
  const d = new Date();
  d.setHours(24,0,0,0);
  return +d;
}
function ensureNotificationPermission(){
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission();
}
function notify(title, body){
  if (!("Notification" in window)) { alert(title+"\n"+body); return; }
  if (Notification.permission === "granted"){
    new Notification(title,{ body });
  }
}

// ---------- Tabs ----------
const TABS=['quest','journey','character','store','focus'];
function show(tab){
  TABS.forEach(t=>{
    const s = document.getElementById(t);
    s.classList.toggle('hidden', t!==tab);
  });
  $$('.tabs a').forEach(a=>a.classList.toggle('active', (a.dataset.tab===tab)));
  localStorage.setItem('shadowhud.tab',tab);
  if (location.hash !== '#'+tab) history.replaceState(null,'','#'+tab);
}
function initTabs(){
  $$('.tabs a').forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault(); show(a.dataset.tab);
  }));
  const h = (location.hash||'').replace('#','');
  const saved = localStorage.getItem('shadowhud.tab') || 'quest';
  const initial = TABS.includes(h) ? h : saved;
  show(initial);
}

// ---------- Quests ----------
function diffMultiplier(d){
  return {easy:0.8, normal:1, hard:1.4, elite:2}[d||'normal'] || 1;
}
function baseXPFor(q){
  const base = (q.baseXP ?? 25);
  return Math.max(0, Math.round(base * diffMultiplier(q.difficulty)));
}
function goldFor(q){
  const base = (q.gold ?? 10);
  return Math.max(0, Math.round(base * diffMultiplier(q.difficulty)));
}
function attrsAwardFor(q){
  // q.attrAwards is array of {name, amount}
  return (q.attrAwards||[]);
}
function newStrengthTraining(){
  return {
    id: crypto.randomUUID(),
    title: "Strength Training",
    desc: "100 pushups, 100 sit-ups, 100 squats, run 1 mile",
    type: "multi",
    multi: [
      {label:"Pushups", target:100, value:0},
      {label:"Sit-ups", target:100, value:0},
      {label:"Squats", target:100, value:0},
      {label:"Run (miles)", target:1, value:0}
    ],
    difficulty:"elite",
    daily:true,
    deadline: new Date().setHours(23,59,59,999),
    repeat:"daily",
    baseXP: 90,
    gold: 40,
    attrAwards: [{name:'physical', amount:2}],
    created: now(), status: "active"
  };
}
function ensureDailyQuests(){
  // Only add Strength Training if not present today
  const todayKey = new Date().toDateString();
  if (!state._dailyKeyAdded || state._dailyKeyAdded !== todayKey){
    // Remove previous daily copies
    state.quests = state.quests.filter(q=>!(q.title==="Strength Training" && q.daily));
    state.quests.push(newStrengthTraining());
    state._dailyKeyAdded = todayKey;
    save();
  }
}
function penaltyFor(q){
  return {
    id: crypto.randomUUID(),
    title: `Penalty — 50 pushups`,
    type:'counter', target:50, value:0,
    difficulty:'hard',
    daily:false,
    deadline:null, repeat:'none',
    baseXP: 20, gold: 0,
    attrAwards:[{name:'physical',amount:1}],
    created: now(), status:'active', penalty:true
  };
}
function midnightSweep(){
  const today = new Date().toDateString();
  if (state._sweptKey === today) return;
  // For any daily quest from yesterday that is not done, add penalty
  const ms24 = 24*3600*1000;
  const yesterdayStart = +new Date(+new Date().setHours(0,0,0,0) - ms24);
  const yesterdayEnd = +new Date(+new Date().setHours(0,0,0,0)-1);
  state.quests.forEach(q=>{
    if (q.daily && q.created < yesterdayEnd && q.status!=='done' && !q.penalty){
      state.quests.push(penaltyFor(q));
    }
  });
  // Remove expired dailies older than 2 days
  state.quests = state.quests.filter(q=>!(q.daily && q.created < yesterdayStart));
  state._sweptKey = today;
  save();
  ensureDailyQuests();
}
setInterval(()=>{
  const msLeft = midnightTs()-now();
  if (msLeft < 1000) midnightSweep();
}, 5000);

// Quest CRUD + rendering
function openQuestForm(edit=null){
  const dlg = $('#questDialog');
  $('#qFormTitle').textContent = edit ? 'Edit Quest' : 'New Quest';
  const fields = {
    title: $('#qTitle'), desc: $('#qDesc'), type: $('#qType'), diff: $('#qDiff'),
    target: $('#qTarget'), minutes: $('#qMinutes'), checklist: $('#qChecklist'),
    multi: $('#qMulti'), deadline: $('#qDeadline'), repeat: $('#qRepeat'),
    baseXP: $('#qBaseXP'), gold: $('#qGold'), attrs: $('#qAttrs'),
    reminders: $('#qReminders'), notifyBefore: $('#qNotifyBefore'),
  };
  // reset
  Object.values(fields).forEach(el=>{ if(el.tagName==='SELECT') el.selectedIndex=0; else el.value='';});
  fields.target.value=1; fields.minutes.value=25; fields.baseXP.value=25; fields.gold.value=10; fields.notifyBefore.value=10;
  if (edit){
    fields.title.value = edit.title || '';
    fields.desc.value = edit.desc || '';
    fields.type.value = edit.type || 'counter';
    fields.diff.value = edit.difficulty || 'normal';
    if (edit.type==='counter'){ fields.target.value = edit.target||1; }
    if (edit.type==='timer'){ fields.minutes.value = edit.minutes||25; }
    if (edit.type==='checklist'){ fields.checklist.value = (edit.items||[]).join("\\n"); }
    if (edit.type==='multi'){ fields.multi.value=(edit.multi||[]).map(x=>`${x.label}:${x.target}`).join("\\n"); }
    if (edit.deadline) fields.deadline.value = new Date(edit.deadline).toISOString().slice(0,16);
    fields.repeat.value = edit.repeat || 'none';
    fields.baseXP.value = edit.baseXP ?? 25;
    fields.gold.value = edit.gold ?? 10;
    fields.attrs.value = (edit.attrAwards||[]).map(a=>`${a.name}:${a.amount}`).join(', ');
  }
  updateTypeFields(fields.type.value);
  fields.type.addEventListener('change', e=>updateTypeFields(e.target.value));
  function updateTypeFields(t){
    $$('#typeFields .typeWrap').forEach(w=>w.classList.add('hidden'));
    const el = $(`#typeFields .typeWrap[data-for="${t}"]`); if(el) el.classList.remove('hidden');
  }
  dlg.showModal();

  $('#qSaveBtn').onclick = (e)=>{
    e.preventDefault();
    const q = edit ? edit : { id: crypto.randomUUID(), created: now(), status: 'active' };
    q.title = fields.title.value.trim();
    q.desc = fields.desc.value.trim();
    q.type = fields.type.value;
    q.difficulty = fields.diff.value;
    q.repeat = fields.repeat.value;
    q.baseXP = Number(fields.baseXP.value||0);
    q.gold = Number(fields.gold.value||0);
    q.attrAwards = (fields.attrs.value||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>{
      const [n,v] = s.split(':').map(x=>x.trim().toLowerCase());
      return {name:n, amount:Number(v||1)};
    });
    if (fields.deadline.value) q.deadline = +new Date(fields.deadline.value);
    else q.deadline = null;
    if (q.type==='counter'){ q.target=Number(fields.target.value||1); q.value = q.value||0; }
    if (q.type==='timer'){ q.minutes=Number(fields.minutes.value||25); q.timerLeft = q.timerLeft || q.minutes*60; q.running=false; }
    if (q.type==='checklist'){ q.items=(fields.checklist.value||'').split('\\n').map(s=>s.trim()).filter(Boolean); q.doneItems = q.doneItems||[]; }
    if (q.type==='multi'){
      q.multi=(fields.multi.value||'').split('\\n').map(s=>s.trim()).filter(Boolean).map(row=>{
        const idx = row.lastIndexOf(':');
        const label = idx>-1 ? row.slice(0,idx).trim() : row;
        const target = idx>-1 ? Number(row.slice(idx+1).trim()||1) : 1;
        const existing=(edit?.multi||[]).find(m=>m.label===label);
        return {label,target,value:existing?existing.value:0};
      });
    }
    if (!edit) state.quests.push(q);
    save(); dlg.close(); renderQuests();
  }
}

function questCard(q){
  const wrap = document.createElement('div'); wrap.className='quest-card';
  const head = document.createElement('div'); head.className='row between';
  const title = document.createElement('div'); title.className='qtitle'; title.textContent = q.title;
  const rewards = document.createElement('div'); rewards.innerHTML = `+<b>${baseXPFor(q)}</b> XP · <span class="kpi">💰 ${goldFor(q)}</span>`;
  head.append(title, rewards);
  wrap.append(head);

  const meta = document.createElement('div'); meta.className='qmeta row';
  const diff = q.difficulty ? ` (${q.difficulty[0].toUpperCase()+q.difficulty.slice(1)})` : '';
  const attrs = (q.attrAwards||[]).map(a=>a.name[0].toUpperCase()+a.name.slice(1)).join(', ');
  meta.innerHTML = `${q.type}${diff}${attrs?` · ${attrs}`:''}`;
  if (q.daily) {
    const badge = document.createElement('span'); badge.className='badgeDaily'; badge.textContent='Daily';
    meta.prepend(badge);
  }
  const cdown = document.createElement('span'); cdown.className='countdown';
  if (q.repeat==='daily' || q.daily) cdown.textContent = countdownToMidnight();
  meta.append(cdown);
  wrap.append(meta);

  // Body controls
  const body = document.createElement('div'); body.className='qrow';

  if (q.type==='counter'){
    const c = document.createElement('div'); c.className='counter';
    const disp = document.createElement('span'); disp.textContent = `${q.value||0} / ${q.target}`;
    const minus = btn('−1',()=>{q.value=Math.max(0,(q.value||0)-1); save(); renderQuests();});
    const plus = btn('+1',()=>{q.value=Math.min(q.target,(q.value||0)+1); save(); renderQuests();});
    const finish = btn('Finish',()=>{q.value=q.target; save(); renderQuests();});
    c.append(disp, minus, plus, finish); body.append(c);
  }
  if (q.type==='timer'){
    const time = document.createElement('span'); time.textContent = secToMMSS(q.timerLeft ?? (q.minutes*60));
    const start = btn('Start',()=>{ q.running=true; if(q.timerLeft==null) q.timerLeft=q.minutes*60; tickTimer(q); save(); renderQuests(); });
    const pause = btn('Pause',()=>{ q.running=false; save(); renderQuests(); });
    const resume = btn('Resume',()=>{ q.running=true; tickTimer(q); save(); renderQuests(); });
    const cancel = btn('Reset',()=>{ q.running=false; q.timerLeft=q.minutes*60; save(); renderQuests();});
    body.append(time,start,pause,resume,cancel);
  }
  if (q.type==='checklist'){
    const ul = document.createElement('div'); ul.style.display='flex'; ul.style.flexDirection='column'; ul.style.gap='6px';
    (q.items||[]).forEach(item=>{
      const id = `${q.id}-${item}`;
      const row = document.createElement('label'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = (q.doneItems||[]).includes(item);
      cb.addEventListener('change',()=>{
        q.doneItems = q.doneItems || [];
        const idx = q.doneItems.indexOf(item);
        if (cb.checked && idx<0) q.doneItems.push(item);
        if (!cb.checked && idx>-1) q.doneItems.splice(idx,1);
        save();
      });
      const span = document.createElement('span'); span.textContent=item;
      row.append(cb, span); ul.append(row);
    });
    body.append(ul);
  }
  if (q.type==='multi'){
    const col = document.createElement('div'); col.style.display='flex'; col.style.flexDirection='column'; col.style.gap='8px';
    (q.multi||[]).forEach(mi=>{
      const line = document.createElement('div'); line.className='row';
      const label = document.createElement('div'); label.textContent = `${mi.label}`;
      const disp = document.createElement('div'); disp.textContent = `${mi.value||0} / ${mi.target}`; disp.style.marginLeft='auto';
      const minus = btn('−1',()=>{ mi.value=Math.max(0,(mi.value||0)-1); save(); renderQuests(); });
      const plus = btn('+1',()=>{ mi.value=Math.min(mi.target,(mi.value||0)+1); save(); renderQuests(); });
      const finish = btn('Finish',()=>{ mi.value=mi.target; save(); renderQuests(); });
      line.append(label, disp, minus, plus, finish);
      col.append(line);
    });
    body.append(col);
  }
  wrap.append(body);

  const footer = document.createElement('div'); footer.className='qrow';
  const start = (q.type!=='timer')? null : btn('Start',()=>{ q.running=true; tickTimer(q); save(); renderQuests(); });
  const done = btn('Done',()=>completeQuest(q));
  const reset = btn('Reset',()=>resetQuest(q));
  const edit = btn('Edit',()=>openQuestForm(q));
  const del = btn('Delete',()=>{ if(confirm('Delete quest?')){ state.quests = state.quests.filter(x=>x.id!==q.id); save(); renderQuests(); }});
  if (start) footer.append(start);
  footer.append(done, reset, edit, del);
  wrap.append(footer);
  return wrap;
}
function btn(text,fn){ const b=document.createElement('button'); b.className='btn small ghost'; b.textContent=text; b.onclick=fn; return b; }
function secToMMSS(s){ s=Math.max(0,Math.floor(s||0)); const m = Math.floor(s/60), r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;}
function tickTimer(q){
  if (!q._timer && q.running){
    q._timer = setInterval(()=>{
      if (!q.running){ clearInterval(q._timer); q._timer=null; return; }
      q.timerLeft = (q.timerLeft??q.minutes*60)-1;
      if (q.timerLeft<=0){ q.timerLeft=0; q.running=false; completeQuest(q); clearInterval(q._timer); q._timer=null; }
      save(); renderQuests();
    },1000);
  }
}

function resetQuest(q){
  if (q.type==='counter'){ q.value=0; }
  if (q.type==='timer'){ q.timerLeft=q.minutes*60; q.running=false; }
  if (q.type==='checklist'){ q.doneItems=[]; }
  if (q.type==='multi'){ (q.multi||[]).forEach(m=>m.value=0); }
  q.status='active'; save(); renderQuests();
}

function isQuestComplete(q){
  if (q.type==='counter') return (q.value||0)>=q.target;
  if (q.type==='timer') return (q.timerLeft||0)<=0;
  if (q.type==='checklist') return (q.doneItems||[]).length === (q.items||[]).length && (q.items||[]).length>0;
  if (q.type==='multi') return (q.multi||[]).every(m=>(m.value||0)>=m.target) && (q.multi||[]).length>0;
  return false;
}
function completeQuest(q){
  if (!isQuestComplete(q)) { alert('Not complete yet!'); return; }
  q.status='done'; // rewards
  const xp = baseXPFor(q);
  const gold = goldFor(q);
  state.gold += gold;
  addXP(xp);
  attrsAwardFor(q).forEach(a=>{ if(state.attrs[a.name]!=null) state.attrs[a.name]+=Number(a.amount||1) });
  // titles/achievements
  if (!state.titles.owned.includes('The One Who Started')){
    state.titles.owned.push('The One Who Started');
  }
  state.stats.completed += 1;
  // streak calc
  const today = new Date().toDateString();
  if (state.stats.lastCompleteDate === today) { /* same day */ }
  else if (!state.stats.lastCompleteDate) state.stats.streak = 1;
  else {
    const prev = new Date(state.stats.lastCompleteDate);
    const diffDays = Math.round((+new Date(today) - +prev)/86400000);
    state.stats.streak = (diffDays===1) ? (state.stats.streak+1) : 1;
  }
  state.stats.lastCompleteDate = today;
  notify('Quest Complete', `${q.title}: +${xp} XP, +${gold} gold`);
  save(); renderAll();
}

function filterQuests(list, mode){
  const nowts = now();
  return list.filter(q=>{
    if (mode==='daily') return !!q.daily;
    if (mode==='penalty') return !!q.penalty;
    if (mode==='active') return q.status!=='done';
    if (mode==='done') return q.status==='done';
    if (mode==='expired') return q.deadline && nowts>q.deadline && q.status!=='done';
    return true;
  });
}
function countdownToMidnight(){
  const ms = midnightTs()-now();
  const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), r=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}
setInterval(()=>{
  // update countdown text nodes
  $$('.countdown').forEach(el=>el.textContent=countdownToMidnight());
}, 1000);

function renderQuests(){
  ensureDailyQuests();
  const list = $('#questList'); list.innerHTML='';
  const mode = $('.chip.filter.active')?.dataset.filter || 'all';
  const qs = filterQuests(state.quests, mode);
  if (!qs.length){ const empty=document.createElement('div'); empty.className='muted'; empty.style.margin='10px'; empty.textContent='No quests yet. Tap ＋ to add.'; list.append(empty); }
  qs.forEach(q=>list.append(questCard(q)));
}

function initQuestUI(){
  // filters
  $$('.chip.filter').forEach(ch=>ch.addEventListener('click',()=>{
    $$('.chip.filter').forEach(x=>x.classList.remove('active')); ch.classList.add('active'); renderQuests();
  }));
  $('#addQuestBtn').addEventListener('click',()=>openQuestForm(null));
}

// ---------- Journey / Titles / Achievements ----------
const DEFAULT_TITLES = [
  { name:'The One Who Started', req:'Complete 1 quest', test: s=>s.stats.completed>=1 },
  { name:'Consistency Apprentice', req:'3-day streak', test: s=>s.stats.streak>=3 },
  { name:'Daily Grinder', req:'Complete 10 daily quests', test: s=> (s.quests.filter(q=>q.daily && q.status==='done').length>=10) },
  { name:'Mind & Body', req:'Gain points in both Physical and Intellect', test: s=> s.attrs.physical>0 && s.attrs.intellect>0 },
];
function allTitles(){
  const owned = new Set(state.titles.owned||[]);
  DEFAULT_TITLES.forEach(t=>{ if (t.test(state)) owned.add(t.name); });
  state.titles.owned = Array.from(owned);
  save();
  return DEFAULT_TITLES.map(t=>({ ...t, owned: owned.has(t.name)}));
}
function renderJourney(){
  $('#levelText').textContent = `Level ${state.level} · ${currentRank(state.level)}`;
  $('#xpText').textContent = `${fmt(state.xp)}/${fmt(xpForLevel(state.level))} XP`;
  $('#xpBar').style.width = `${Math.min(100, Math.round(state.xp*100/Math.max(1,xpForLevel(state.level))))}%`;
  $('#statCompleted').textContent = fmt(state.stats.completed||0);
  $('#statStreak').textContent = fmt(state.stats.streak||0);
  $('#statGold').textContent = fmt(state.gold||0);

  const titlesWrap = $('#titlesWrap'); titlesWrap.innerHTML='';
  allTitles().forEach(t=>{
    const row = document.createElement('div'); row.className='card row between';
    const left = document.createElement('div'); left.innerHTML = `<b>${t.name}</b><div class="muted small">${t.req}</div>`;
    const right = document.createElement('div');
    const b = document.createElement('button'); b.className='btn small'; b.textContent = (t.name===state.titles.equipped)?'Equipped':'Equip';
    b.disabled = !t.owned;
    b.addEventListener('click',()=>{ state.titles.equipped = t.name; save(); renderCharacter(); renderJourney(); notify('Title equipped', t.name); });
    if (!t.owned){ const m=document.createElement('span'); m.className='muted small'; m.textContent=' (locked)'; left.append(m); }
    right.append(b);
    row.append(left, right);
    titlesWrap.append(row);
  });

  const achieve = $('#achievementsWrap'); achieve.innerHTML='';
  const badges = [
    {name:'Early Bird', cond: s=> (new Date().getHours()<8) && s.stats.completed>0},
    {name:'Night Owl', cond: s=> (new Date().getHours()>=22) && s.stats.completed>0},
  ];
  badges.forEach(b=>{
    const own = b.cond(state);
    const row = document.createElement('div'); row.className='card row between';
    row.innerHTML = `<div><b>${b.name}</b></div><div>${own? '🏅' : '<span class="muted small">—</span>'}</div>`;
    achieve.append(row);
  });
}

// ---------- Character ----------
function renderCharacter(){
  $('#goldDisplay').textContent = fmt(state.gold||0);
  $('#charLevel').textContent = state.level;
  $('#charRank').textContent = currentRank(state.level);
  $('#charXPText').textContent = `${fmt(state.xp)}/${fmt(xpForLevel(state.level))} XP`;
  $('#charXPBar').style.width = `${Math.min(100, Math.round(state.xp*100/Math.max(1,xpForLevel(state.level))))}%`;
  for (const k in state.attrs){ $('#attr-'+k).textContent = fmt(state.attrs[k]||0); }
  $('#equippedTitle').textContent = state.titles.equipped || 'None';
}

// ---------- Store ----------
function renderStore(){
  const list = $('#rewardsList'); list.innerHTML='';
  if (!state.rewards.length){ const e=document.createElement('div'); e.className='muted'; e.style.margin='10px'; e.textContent='No rewards yet. Add your own!'; list.append(e); }
  state.rewards.forEach(r=>{
    const row = document.createElement('div'); row.className='card row between';
    row.innerHTML = `<div><b>${r.title}</b><div class="muted small">${r.desc||''}</div></div><div>💰 ${fmt(r.cost)}</div>`;
    const buy = document.createElement('button'); buy.className='btn small'; buy.textContent='Buy';
    buy.disabled = (state.gold<r.cost);
    buy.onclick = ()=>{ if (state.gold>=r.cost){ state.gold-=r.cost; notify('Purchased', r.title); save(); renderAll(); } };
    row.append(buy);
    list.append(row);
  });
}

// Add reward dialog
function initStore(){
  $('#addRewardBtn').addEventListener('click',()=>{
    const dlg = $('#rewardDialog'); dlg.showModal();
    $('#rewardForm').onsubmit=(e)=>{
      e.preventDefault();
      const r={ id:crypto.randomUUID(), title:$('#rTitle').value.trim(), desc:$('#rDesc').value.trim(), cost:Number($('#rCost').value||0) };
      state.rewards.push(r); save(); dlg.close(); renderStore();
    };
  });
}

// ---------- Focus timer ----------
let focusInt=null, focusLeft=0;
function renderFocus(){ $('#focusTime').textContent = secToMMSS(focusLeft); }
function initFocus(){
  $('#focusStart').onclick=()=>{ focusLeft = Number($('#focusMinutes').value||25)*60; renderFocus(); if(focusInt) clearInterval(focusInt); focusInt=setInterval(()=>{ focusLeft--; renderFocus(); if(focusLeft<=0){ clearInterval(focusInt); focusInt=null; notify('Focus done','Nice work!'); } },1000); };
  $('#focusPause').onclick=()=>{ if(focusInt){ clearInterval(focusInt); focusInt=null; } };
  $('#focusResume').onclick=()=>{ if(!focusInt && focusLeft>0){ focusInt=setInterval(()=>{ focusLeft--; renderFocus(); if(focusLeft<=0){ clearInterval(focusInt); focusInt=null; notify('Focus done','Nice work!'); } },1000);} };
  $('#focusCancel').onclick=()=>{ if(focusInt){ clearInterval(focusInt); focusInt=null;} focusLeft=0; renderFocus(); };
}

// ---------- Init ----------
function renderAll(){ renderCharacter(); renderJourney(); renderStore(); renderQuests(); }
function init(){
  document.getElementById('appVersion').textContent = VERSION;
  ensureDailyQuests(); midnightSweep(); ensureNotificationPermission();
  initTabs(); initQuestUI(); initStore(); initFocus();
  renderAll();
}
document.addEventListener('DOMContentLoaded', init);
