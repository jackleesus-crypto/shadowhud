// ShadowHUD v13 - single file logic
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---------- State ----------
const DEFAULT_ATTRS = ["Physical","Psyche","Intellect","Social","Spiritual","Financial"];
const STATE_KEY = "shadowhud_state_v13";
let S = load();

function load(){
  const j = localStorage.getItem(STATE_KEY);
  if(j){ try { return JSON.parse(j);} catch(e){} }
  const now = new Date();
  return {
    version: "13",
    gold: 0,
    xp: 0,
    level: 1,
    completed: 0,
    streak: 0,
    lastReset: todayKey(),
    quests: [],
    rewards: [],
    attributes: Object.fromEntries(DEFAULT_ATTRS.map(a=>[a,0])),
    titles: [
      {id:"start", name:"The One Who Started", unlocked:false, req:"Complete 1 quest"},
      {id:"momentum", name:"Keeper of Momentum", unlocked:false, req:"3-day daily streak"},
      {id:"disciplined", name:"Disciplined", unlocked:false, req:"Finish 10 daily quests"}
    ],
    equippedTitle: null
  };
}
function save(){ localStorage.setItem(STATE_KEY, JSON.stringify(S)); }

function todayKey(d=new Date()){
  return d.toISOString().slice(0,10);
}

// ---------- Level/Rank/XP ----------
function rankFromLevel(lv){
  if(lv<=15) return "E";
  if(lv<=30) return "D";
  if(lv<=45) return "C";
  if(lv<=60) return "B";
  if(lv<=80) return "A";
  return "S";
}
function xpForLevel(lv){
  // Smoothly increasing requirement
  // base 40, curve up
  return Math.round(40 + (lv**1.35)*2);
}

// ---------- Midnight Reset ----------
function secondsToMidnight(){
  const now = new Date();
  const n = new Date(now);
  n.setHours(24,0,0,0);
  return Math.max(0, Math.floor((n-now)/1000));
}
function tickMidnight(){
  const s = secondsToMidnight();
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  $("#midnight").textContent = `resets in ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
setInterval(tickMidnight, 1000);

// Run daily reset once per day
function ensureDailyReset(){
  const tk = todayKey();
  if(S.lastReset !== tk){
    // Check dailies; spawn penalty if not complete
    let anyDone = false;
    for(const q of S.quests){
      if(q.daily){
        if(!q.done){
          // penalty
          S.quests.push(makePenaltyQuest(`Penalty — make up for "${q.title}"`));
        }else{
          anyDone = true;
        }
        // reset daily progress
        resetQuestProgress(q);
        q.done = false;
      }
    }
    // streak
    if(anyDone) S.streak = (S.streak||0) + 1;
    else S.streak = 0;
    S.lastReset = tk;
    save();
  }
}

// ---------- Quest Models ----------
function newId(){ return Math.random().toString(36).slice(2,9); }

function makePenaltyQuest(title="Penalty — Do 50 pushups"){
  return {
    id:newId(), title, type:"penalty", daily:false, xp:15, gold:5,
    done:false, created:Date.now(), attribs:["Physical"],
    internal:{}
  };
}
function defaultStrength(){
  return {
    id:newId(), title:"Strength Training", type:"multiCounter", daily:true,
    xp:60, gold:20, diff:"Elite", attribs:["Physical"],
    done:false, created:Date.now(),
    internal:{ items:[
      {label:"Pushups", target:100, count:0},
      {label:"Sit-ups", target:100, count:0},
      {label:"Squats", target:100, count:0},
      {label:"Run (miles)", target:1, count:0}
    ]}
  };
}
function resetQuestProgress(q){
  if(q.type==="counter"){ q.internal.count=0; }
  if(q.type==="checklist"){ q.internal.items.forEach(i=>i.done=false); }
  if(q.type==="multiCounter"){ q.internal.items.forEach(i=>i.count=0); }
  if(q.type==="timer"){ q.internal.elapsed=0; q.internal.running=false; }
}

function ensureSeedQuests(){
  if(!S.quests.some(q=>q.title==="Strength Training")){
    S.quests.unshift(defaultStrength());
  }
  // a couple of daily self-help
  if(!S.quests.some(q=>q.title==="Meditate 10 minutes")){
    S.quests.push({
      id:newId(), title:"Meditate 10 minutes", type:"timer", daily:true, xp:25, gold:8, diff:"Easy", attribs:["Spiritual","Psyche"],
      done:false, created:Date.now(), internal:{minutes:10, elapsed:0, running:false}
    });
  }
  if(!S.quests.some(q=>q.title==="Call a loved one")){
    S.quests.push({
      id:newId(), title:"Call a loved one", type:"checklist", daily:true, xp:10, gold:10, diff:"Easy", attribs:["Social"],
      done:false, created:Date.now(), internal:{items:[{text:"Call or text someone", done:false}]} 
    });
  }
}

// ---------- Rendering ----------
function renderAll(){
  // Top
  $("#gold").textContent = S.gold;
  // Tabs
  // Quest list
  renderQuestList();
  // Journey
  renderJourney();
  // Character
  renderCharacter();
  // Store
  renderStore();
  // Focus timer shown by controls
  drawRadar();
}

function renderQuestList(filter="all"){
  const wrap = $("#questList"); wrap.innerHTML = "";
  let qs = S.quests.slice().sort((a,b)=>a.done-b.done || b.created - a.created);
  if(filter==="daily") qs = qs.filter(q=>q.daily);
  if(filter==="penalty") qs = qs.filter(q=>q.type==="penalty");
  if(filter==="active") qs = qs.filter(q=>!q.done);
  if(filter==="done") qs = qs.filter(q=>q.done);
  if(qs.length===0){
    wrap.innerHTML = `<div class="sub">No quests yet. Tap ＋ to add.</div>`;
    return;
  }
  for(const q of qs){
    wrap.appendChild(renderQuestCard(q));
  }
}
function renderQuestCard(q){
  const card = document.createElement("div");
  card.className = "questCard";
  // progress
  const p = questProgress(q);
  card.innerHTML = `
    <div class="qHead">
      <div class="qTitle">${q.title} ${q.daily?'<span class="badge">Daily</span>':''}</div>
      <div class="qMeta">
        <span class="badge">+${q.xp} XP</span>
        <span class="badge">⭐ ${q.attribs?.length||0}</span>
        <span class="badge">💰 ${q.gold}</span>
      </div>
    </div>
    <div class="sub">${(q.diff||"").toString()} · ${q.attribs?.join(" • ")||""}</div>
    <div class="qBar"><div style="width:${p*100}%"></div></div>
    <div class="qBtns"></div>
    <div class="qBody"></div>
  `;
  const btns = card.querySelector(".qBtns");
  // Buttons depending on type
  if(q.type==="timer"){
    const running = q.internal.running;
    btns.append(btn("Start",()=>startTimer(q), running));
    btns.append(btn("Pause",()=>pauseTimer(q), !running));
    btns.append(btn("Resume",()=>resumeTimer(q), running || q.internal.elapsed<=0));
    btns.append(btn("Cancel",()=>cancelTimer(q), false));
  } else if(q.type==="counter"){
    btns.append(btn("+1",()=>{ q.internal.count++; saveDoneMaybe(q);}));
    btns.append(btn("−1",()=>{ q.internal.count=Math.max(0,q.internal.count-1); saveRender(); }));
    btns.append(btn("Finish",()=>{ q.internal.count=q.target; saveDoneMaybe(q);}));
  } else if(q.type==="checklist"){
    // rendered below
  } else if(q.type==="multiCounter"){
    // rendered below
  } else if(q.type==="penalty"){
    btns.append(btn("Done",()=>finishQuest(q)));
  }
  btns.append(btn("Reset",()=>{ resetQuestProgress(q); saveRender(); }));
  if(q.type!=="penalty"){
    btns.append(btn("Done",()=>finishQuest(q)));
    btns.append(btn("Edit",()=>openQuestDialog(q)));
    btns.append(btn("Delete",()=>{ S.quests=S.quests.filter(x=>x.id!==q.id); saveRender(); }));
  }

  const body = card.querySelector(".qBody");
  if(q.type==="checklist"){
    const list = document.createElement("div");
    list.className="checklist";
    q.internal.items.forEach((it,idx)=>{
      const row = document.createElement("div");
      row.className="checkItem";
      row.innerHTML = `<span class="circle ${it.done?'checked':''}"></span><span>${it.text}</span>`;
      row.onclick = ()=>{ it.done=!it.done; saveDoneMaybe(q); };
      list.append(row);
    });
    body.append(list);
  }
  if(q.type==="counter"){
    body.innerHTML = `<div class="sub">Count ${q.internal.count||0} / ${q.target}</div>`;
  }
  if(q.type==="timer"){
    const mins = q.internal.minutes || 25;
    const elapsed = q.internal.elapsed||0;
    const left = Math.max(0, mins*60 - elapsed);
    body.innerHTML = `<div class="sub">Timer ${fmt(left)}</div>`;
  }
  if(q.type==="multiCounter"){
    const list = document.createElement("div");
    list.className="checklist";
    q.internal.items.forEach((it,idx)=>{
      const row = document.createElement("div");
      row.className="checkItem";
      row.innerHTML = `<span class="badge">${it.label}</span>
        <span class="sub">${it.count} / ${it.target}</span>`;
      const controls = document.createElement("div");
      controls.className="qBtns";
      controls.append(btn("+1",()=>{it.count=Math.min(it.target,it.count+1); saveDoneMaybe(q);}));
      controls.append(btn("−1",()=>{it.count=Math.max(0,it.count-1); saveRender();}));
      controls.append(btn("Finish",()=>{it.count=it.target; saveDoneMaybe(q);}));
      row.append(controls);
      list.append(row);
    });
    body.append(list);
  }
  return card;
}
function btn(txt,fn,disabled=false){
  const b = document.createElement("button");
  b.className="btn" + (disabled?" ghost":"");
  b.textContent = txt;
  b.disabled = disabled===true;
  b.onclick = fn;
  return b;
}
function questProgress(q){
  if(q.type==="timer"){
    const mins = q.internal.minutes||25;
    const left = Math.max(0, mins*60 - (q.internal.elapsed||0));
    return 1 - left/(mins*60);
  }
  if(q.type==="counter"){
    return Math.min(1,(q.internal.count||0)/(q.target||1));
  }
  if(q.type==="checklist"){
    const items = q.internal.items||[];
    const n = items.length||1;
    const d = items.filter(i=>i.done).length;
    return d/n;
  }
  if(q.type==="multiCounter"){
    const items = q.internal.items||[];
    const n = items.length||1;
    const d = items.filter(i=> (i.count||0) >= i.target).length;
    return d/n;
  }
  if(q.type==="penalty"){ return 0; }
  return 0;
}
function saveDoneMaybe(q){
  if(questProgress(q)>=1 && !q.done){
    finishQuest(q);
  }else{
    saveRender();
  }
}
function finishQuest(q){
  if(q.done) return;
  q.done = true;
  // rewards
  S.xp += q.xp||0;
  S.gold += q.gold||0;
  // attributes
  (q.attribs||[]).forEach(a=>{
    if(!S.attributes[a]) S.attributes[a]=0;
    S.attributes[a]+=1;
  });
  S.completed = (S.completed||0)+1;
  // titles unlock
  tryUnlocks();
  // level up loop
  while(S.xp >= xpForLevel(S.level)){
    S.xp -= xpForLevel(S.level);
    S.level += 1;
  }
  saveRender();
}

// ---------- Titles & Achievements ----------
function tryUnlocks(){
  const t1 = S.titles.find(t=>t.id==="start");
  if(t1 && !t1.unlocked && (S.completed||0)>=1) t1.unlocked=true;
  const t2 = S.titles.find(t=>t.id==="momentum");
  if(t2 && !t2.unlocked && (S.streak||0)>=3) t2.unlocked=true;
  const t3 = S.titles.find(t=>t.id==="disciplined");
  if(t3 && !t3.unlocked){
    const dailiesDone = S.quests.filter(q=>q.daily && q.done).length;
    if(dailiesDone>=10) t3.unlocked=true;
  }
}

// ---------- Journey UI ----------
function renderJourney(){
  $("#jLevel").textContent = `Level ${S.level} · ${rankFromLevel(S.level)}`;
  $("#jXP").textContent = `${S.xp}/${xpForLevel(S.level)} XP`;
  $("#jBar").style.width = `${Math.min(100, (S.xp/xpForLevel(S.level))*100)}%`;
  $("#jCompleted").textContent = S.completed||0;
  $("#jStreak").textContent = S.streak||0;
  $("#jGold").textContent = S.gold||0;

  const tWrap = $("#titles"); tWrap.innerHTML="";
  S.titles.forEach(t=>{
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<div class="row space-between">
      <div><b>${t.name}</b><div class="sub">${t.req}</div></div>
      <div>${t.unlocked?'<span class="badge" style="color:var(--gold)">Unlocked</span>':'<span class="badge">Locked</span>'}</div>
    </div>
    <div class="row right">${t.unlocked?`<button class="btn" data-equip="${t.id}">Equip</button>`:''}</div>`;
    tWrap.append(el);
  });
  tWrap.querySelectorAll("[data-equip]").forEach(b=>{
    b.onclick = ()=>{ S.equippedTitle = b.dataset.equip; saveRender(); };
  });

  const aWrap = $("#achievements"); aWrap.innerHTML="";
  const ach = [];
  if(S.completed>=1) ach.push("First Steps — complete your first quest");
  if(S.streak>=3) ach.push("3 Day Streak — strong momentum");
  if(Object.values(S.attributes).some(v=>v>=10)) ach.push("Specialist — reach 10 in any attribute");
  if(ach.length===0) aWrap.innerHTML = `<li class="sub">No achievements yet.</li>`;
  else aWrap.innerHTML = ach.map(x=>`<li>${x}</li>`).join("");
}

// ---------- Character UI ----------
function renderCharacter(){
  $("#level").textContent = S.level;
  $("#rank").textContent = rankFromLevel(S.level);
  $("#rankBadge").textContent = rankFromLevel(S.level);
  $("#xpText").textContent = `${S.xp}/${xpForLevel(S.level)} XP`;
  $("#xpBar").style.width = `${Math.min(100,(S.xp/xpForLevel(S.level))*100)}%`;

  // equipped title
  const t = S.titles.find(x=>x.id===S.equippedTitle);
  $("#equippedTitle").textContent = `Title: ${t? t.name : 'None'}`;

  const grid = $("#attrs"); grid.innerHTML="";
  DEFAULT_ATTRS.forEach(a=>{
    const v = S.attributes[a]||0;
    const box = document.createElement("div");
    box.className = "box";
    box.innerHTML = `<div class="val">${v}</div><div class="sub">${a.toUpperCase()}</div>`;
    grid.append(box);
  });
}

// Radar
function drawRadar(){
  const ctx = $("#radar").getContext("2d");
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "#0f1219";
  ctx.fillRect(0,0,w,h);
  const cx = w/2, cy = h/2+10, r = Math.min(w,h)*0.36;
  const N = DEFAULT_ATTRS.length;
  // grid
  ctx.strokeStyle = "#2a2f3f";
  ctx.lineWidth = 1;
  for(let ring=1; ring<=5; ring++){
    const rad = r*ring/5;
    ctx.beginPath();
    for(let i=0;i<=N;i++){
      const t = (i%N)/N * Math.PI*2 - Math.PI/2;
      const x = cx + Math.cos(t)*rad;
      const y = cy + Math.sin(t)*rad;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  // axes + labels
  ctx.fillStyle = "#cbd1dc";
  ctx.font = "12px -apple-system, Inter, Segoe UI";
  for(let i=0;i<N;i++){
    const t = i/N * Math.PI*2 - Math.PI/2;
    const x = cx + Math.cos(t)*(r+16);
    const y = cy + Math.sin(t)*(r+16);
    ctx.textAlign = (Math.cos(t)>0.2) ? "left" : (Math.cos(t)<-0.2) ? "right":"center";
    ctx.fillText(DEFAULT_ATTRS[i], x, y);
  }
  // values
  const vals = DEFAULT_ATTRS.map(a=>S.attributes[a]||0);
  const maxV = Math.max(10, ...vals, 1);
  ctx.beginPath();
  for(let i=0;i<=N;i++){
    const val = vals[i%N]/maxV;
    const t = (i%N)/N * Math.PI*2 - Math.PI/2;
    const x = cx + Math.cos(t)*(r*val);
    const y = cy + Math.sin(t)*(r*val);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  const grad = ctx.createLinearGradient(0,0,w,0);
  grad.addColorStop(0,"#8b5cf6aa"); grad.addColorStop(1,"#60a5faaa");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "#8b5cf6";
  ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();
}

// ---------- Store ----------
function renderStore(){
  const wrap = $("#rewards"); wrap.innerHTML="";
  if(S.rewards.length===0) wrap.innerHTML = `<div class="sub">No rewards yet. Add your own!</div>`;
  for(const r of S.rewards){
    const card = document.createElement("div"); card.className="card";
    card.innerHTML = `<div class="row space-between">
      <div><b>${r.title}</b><div class="sub">${r.desc||""}</div></div>
      <div class="row"><span class="badge">💰 ${r.cost}</span>
        <button class="btn" data-buy="${r.id}">Buy</button></div>
    </div>`;
    wrap.append(card);
  }
  wrap.querySelectorAll("[data-buy]").forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.buy;
      const rw = S.rewards.find(x=>x.id===id);
      if(!rw) return;
      if(S.gold < rw.cost){ alert("Not enough gold."); return; }
      S.gold -= rw.cost;
      saveRender();
    };
  })
}

// ---------- Focus Timer ----------
let focusTimer=null, focusLeft=0;
function fmt(s){
  const m = Math.floor(s/60), r=s%60;
  return `${m}:${String(r).padStart(2,'0')}`;
}
function startFocus(){
  const mins = Math.max(1, parseInt($("#focusMin").value||"25"));
  focusLeft = mins*60;
  $("#focusTime").textContent = fmt(focusLeft);
  clearInterval(focusTimer);
  focusTimer = setInterval(()=>{
    focusLeft = Math.max(0, focusLeft-1);
    $("#focusTime").textContent = fmt(focusLeft);
    if(focusLeft<=0){ clearInterval(focusTimer); alert("Focus complete!"); }
  }, 1000);
}
function pauseFocus(){ clearInterval(focusTimer); }
function resumeFocus(){ clearInterval(focusTimer); focusTimer=setInterval(()=>{
  focusLeft = Math.max(0, focusLeft-1);
  $("#focusTime").textContent = fmt(focusLeft);
  if(focusLeft<=0){ clearInterval(focusTimer); alert("Focus complete!"); }
},1000); }
function cancelFocus(){ clearInterval(focusTimer); $("#focusTime").textContent="0:00"; }

// ---------- Timer quest controls ----------
let runningTimers = {};
function startTimer(q){
  q.internal.minutes = q.internal.minutes || 25;
  if(q.internal.running) return;
  q.internal.running=true;
  runningTimers[q.id] = setInterval(()=>{
    q.internal.elapsed = (q.internal.elapsed||0) + 1;
    if(q.internal.elapsed >= q.internal.minutes*60){
      clearInterval(runningTimers[q.id]);
      q.internal.running=false;
      finishQuest(q);
    }else{
      saveRender(false);
    }
  }, 1000);
  saveRender(false);
}
function pauseTimer(q){
  if(!q.internal.running) return;
  q.internal.running=false;
  clearInterval(runningTimers[q.id]);
  saveRender(false);
}
function resumeTimer(q){
  if(q.internal.running) return;
  q.internal.running=true;
  runningTimers[q.id] = setInterval(()=>{
    q.internal.elapsed = (q.internal.elapsed||0) + 1;
    if(q.internal.elapsed >= q.internal.minutes*60){
      clearInterval(runningTimers[q.id]);
      q.internal.running=false;
      finishQuest(q);
    }else saveRender(false);
  }, 1000);
  saveRender(false);
}
function cancelTimer(q){
  q.internal.elapsed = 0; q.internal.running=false;
  clearInterval(runningTimers[q.id]);
  saveRender(false);
}

// ---------- Events ----------
function wireTabs(){
  $$(".tabs button").forEach(b=>{
    b.onclick = ()=>{
      $$(".tabs button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      const id = b.dataset.tab;
      $$(".tab").forEach(s=>s.classList.remove("active"));
      $("#"+id).classList.add("active");
      if(id==="character") drawRadar();
    };
  });
}
function wireFilters(){
  $$(".filters .chip").forEach(c=>{
    c.onclick = ()=>{
      $$(".filters .chip").forEach(x=>x.classList.remove("active"));
      c.classList.add("active");
      renderQuestList(c.dataset.filter);
    };
  });
}
function openQuestDialog(q=null){
  const dlg = $("#questDialog"); const f = $("#questForm");
  $("#qdTitle").textContent = q? "Edit Quest" : "New Quest";
  f.reset();
  f.title.value = q?.title || "";
  f.desc.value = q?.desc || "";
  f.type.value = q?.type || "timer";
  f.minutes.value = q?.internal?.minutes || 25;
  f.target.value = q?.target || 10;
  f.checklist.value = (q?.internal?.items||[]).map(i=>i.text).join(", ");
  f.multi.value = (q?.internal?.items||[]).map(i=>`${i.label||i.text}:${i.target}`).join(", ");
  f.diff.value = q?.diff || "Normal";
  f.attribs.value = (q?.attribs||[]).join(", ");
  f.daily.checked = !!(q?.daily ?? true);
  f.xp.value = q?.xp ?? 25;
  f.gold.value = q?.gold ?? 10;

  // show/hide type-specific
  const refreshVis = ()=>{
    f.closest("form").querySelectorAll(".if").forEach(el=>el.style.display="none");
    f.closest("form").querySelectorAll(".if."+f.type.value).forEach(el=>el.style.display="block");
  };
  f.type.onchange = refreshVis; refreshVis();

  dlg.showModal();
  dlg.onclose = ()=>{
    if(dlg.returnValue!=="ok") return;
    const type = f.type.value;
    const attribs = f.attribs.value.split(",").map(s=>s.trim()).filter(Boolean);
    let nq = q || {id:newId(), created:Date.now(), internal:{}};
    nq.title = f.title.value.trim();
    nq.desc = f.desc.value.trim();
    nq.type = type;
    nq.diff = f.diff.value;
    nq.daily = f.daily.checked;
    nq.attribs = attribs;
    nq.xp = parseInt(f.xp.value)||0;
    nq.gold = parseInt(f.gold.value)||0;
    nq.done = false;
    if(type==="timer"){
      nq.internal.minutes = Math.max(1, parseInt(f.minutes.value||"25"));
      nq.internal.elapsed = 0; nq.internal.running=false;
    }
    if(type==="counter"){
      nq.target = Math.max(1, parseInt(f.target.value||"10"));
      nq.internal.count = 0;
    }
    if(type==="checklist"){
      nq.internal.items = f.checklist.value.split(",").map(s=>s.trim()).filter(Boolean).map(t=>({text:t, done:false}));
    }
    if(type==="multiCounter"){
      nq.internal.items = f.multi.value.split(",").map(s=>s.trim()).filter(Boolean).map(pair=>{
        const [label,tar] = pair.split(":");
        return {label:label||"Item", target:Math.max(1, parseInt(tar||"1")), count:0};
      });
    }
    if(!q) S.quests.unshift(nq);
    saveRender();
  };
}
function wireQuestUI(){
  $("#addQuest").onclick = ()=>openQuestDialog(null);
}

function wireStore(){
  $("#saveReward").onclick = ()=>{
    const title = $("#rwTitle").value.trim();
    if(!title) return;
    S.rewards.push({id:newId(), title, desc:$("#rwDesc").value.trim(), cost:Math.max(1,parseInt($("#rwCost").value||"1"))});
    $("#rwTitle").value=""; $("#rwDesc").value=""; $("#rwCost").value="50";
    saveRender();
  };
}

function saveRender(radar=true){
  save();
  renderAll();
  if(!radar) return;
  drawRadar();
}

// ---------- Init ----------
ensureDailyReset();
ensureSeedQuests();
wireTabs();
wireFilters();
wireQuestUI();
wireStore();
renderAll();

// Expose for console debugging
window.S = S;
