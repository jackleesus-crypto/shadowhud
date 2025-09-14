
/* ShadowHUD v13.3 — full single-file app logic */
const $ = (q, el=document)=>el.querySelector(q);
const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));
const LS = (k,v)=> v===undefined ? JSON.parse(localStorage.getItem(k)||"null") : localStorage.setItem(k, JSON.stringify(v));

// ---------- Data Model ----------
const defaultState = {
  version: "13.3",
  gold: 0,
  ap: 0,
  level: 1, xp: 0, xpMax: 47, rank: "E",
  attributes: {physical:0, psyche:0, intellect:0, social:0, spiritual:0, financial:0},
  titles: {owned:["The One Who Started"], equipped:"None"},
  journey: {completed:0, streak:0},
  rewards: [],
  quests: [],
  lastDailySeed: null
};

let S = LS("shadowhud") || structuredClone(defaultState);

// ---------- Utilities ----------
const now = ()=>new Date();
const midnightMs = ()=>{ const t=now(); t.setHours(24,0,0,0); return t - now(); }
const fmt = n => String(n).padStart(2,"0");
const hhmmss = s=>`${fmt(Math.floor(s/3600))}:${fmt(Math.floor(s%3600/60))}:${fmt(Math.floor(s%60))}`;

function save(){ LS("shadowhud", S); refreshHeader(); }

function refreshHeader(){ $("#goldAmount").textContent = S.gold; }

// ---------- Tabs ----------
function setupTabs(){
  $$("#tabs .tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$("#tabs .tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = "tab-"+btn.dataset.tab;
      $$(".tabpage").forEach(pg=>pg.classList.remove("active"));
      $("#"+id).classList.add("active");
      if(id==="tab-character"){ drawChart(); }
    });
  });
}

// ---------- Chart ----------
let radar;
function drawChart(){
  const ctx = $("#attrChart");
  const vals = S.attributes;
  const data = [vals.financial, vals.physical, vals.psyche, vals.social, vals.intellect, vals.spiritual];
  if(radar){ radar.destroy(); }
  radar = new Chart(ctx, {
    type:"radar",
    data:{
      labels:["Financial","Physical","Psyche","Social","Intellect","Spiritual"],
      datasets:[{ data, fill:true, borderColor:"#7b6cff", backgroundColor:"rgba(123,108,255,0.15)", pointBackgroundColor:"#cfd0ff"}]
    },
    options:{ scales:{ r:{ grid:{color:"#2a2a44"}, angleLines:{color:"#2a2a44"}, pointLabels:{color:"#c9c9dc"}, ticks:{display:false, stepSize:1, beginAtZero:true} } }, plugins:{legend:{display:false}} }
  });
}

function renderAttrTiles(){
  const grid = $("#attrGrid"); grid.innerHTML="";
  const map = [["physical","PHYSICAL"],["psyche","PSYCHE"],["intellect","INTELLECT"],["social","SOCIAL"],["spiritual","SPIRITUAL"],["financial","FINANCIAL"]];
  map.forEach(([k,label])=>{
    const div = document.createElement("div");
    div.className="attr-tile";
    div.innerHTML = `<b>${S.attributes[k]}</b><span>${label}</span>`;
    grid.appendChild(div);
  });
}

function updateCharacter(){
  $("#apCount").textContent = S.ap;
  $("#charLevel").textContent = S.level;
  $("#charXP").textContent = S.xp;
  $("#charXPMax").textContent = S.xpMax;
  $("#charXPBar").style.width = Math.min(100, Math.round((S.xp/S.xpMax)*100))+"%";
  renderAttrTiles();
}

// ---------- Journey ----------
function updateJourney(){
  $("#journeyLevel").textContent = S.level;
  $("#journeyRank").textContent = S.rank;
  $("#journeyXP").textContent = S.xp;
  $("#journeyXPMax").textContent = S.xpMax;
  $("#journeyXPBar").style.width = Math.min(100, Math.round((S.xp/S.xpMax)*100))+"%";
  $("#journeyCompleted").textContent = S.journey.completed;
  $("#journeyStreak").textContent = S.journey.streak;
  $("#journeyGold").textContent = S.gold;

  // titles UI
  const owned = $("#ownedTitles"); owned.innerHTML="";
  S.titles.owned.forEach(t=>{
    const chip = document.createElement("button");
    chip.className="chip"; chip.textContent=t;
    owned.appendChild(chip);
  });
  const sel = $("#equippedTitle"); sel.innerHTML="";
  ["None", ...S.titles.owned].forEach(t=>{
    const opt = document.createElement("option");
    opt.value=t; opt.textContent=t; if(S.titles.equipped===t) opt.selected=true;
    sel.appendChild(opt);
  });
}

// ---------- Rewards (Store) ----------
function renderRewards(){
  const list = $("#rewardList"); list.innerHTML="";
  if(S.rewards.length===0){ list.innerHTML = `<div class="muted">No rewards yet. Add your own!</div>`; return; }
  S.rewards.forEach((r,idx)=>{
    const card = document.createElement("div"); card.className="card";
    card.innerHTML = `<div class="row space"><div><b>${r.title}</b> <span class="muted">— ${r.cost} gold</span></div>
      <div class="btn-row"><button class="btn good">Buy</button><button class="btn danger">Delete</button></div></div>`;
    card.querySelector(".good").onclick=()=>{
      if(S.gold>=r.cost){ S.gold-=r.cost; save(); renderRewards(); updateJourney(); }
      else alert("Not enough gold");
    };
    card.querySelector(".danger").onclick=()=>{ S.rewards.splice(idx,1); save(); renderRewards(); };
    list.appendChild(card);
  });
}

$("#addRewardBtn")?.addEventListener("click", ()=>{
  const title = $("#rewardTitle").value.trim();
  const cost = Math.max(0, parseInt($("#rewardCost").value||"0",10));
  if(!title) return;
  S.rewards.push({title, cost}); save(); renderRewards();
  $("#rewardTitle").value=""; $("#rewardCost").value="50";
});

// ---------- Quests ----------
const QUEST_TYPES = { TIMER:"timer", COUNTER:"counter", MULTI:"multi" };

function seedDailiesIfNeeded(){
  const today = new Date(); const seedKey = today.toISOString().slice(0,10);
  if(S.lastDailySeed === seedKey) return;
  // keep Strength Training daily
  const strengthId = "strength-training";
  const exists = S.quests.some(q=>q.id===strengthId);
  if(!exists){
    S.quests.push(makeStrengthTraining());
  } else {
    // reset counters for new day
    const q = S.quests.find(q=>q.id===strengthId);
    q.parts.forEach(p=>p.value=0);
    q.done=false;
    q.deadline = endOfTodayIso();
  }
  // remove non-completed previous dailies and create 3 new
  S.quests = S.quests.filter(q=> q.id===strengthId || !q.daily || q.done);
  const pool = randomDailyPool();
  while(pool.length && S.quests.filter(q=>q.daily && q.id!=='strength-training').length<3){
    S.quests.push(pool.shift());
  }
  S.lastDailySeed = seedKey;
  save();
}

function endOfTodayIso(){ const t=new Date(); t.setHours(23,59,59,999); return t.toISOString(); }

function makeStrengthTraining(){
  return {
    id:"strength-training", title:"Strength Training", xp:120, gold:30, daily:true, difficulty:"Elite",
    type:QUEST_TYPES.MULTI, attributes:["physical"],
    parts:[
      {label:"Pushups", target:100, value:0},
      {label:"Sit-ups", target:100, value:0},
      {label:"Squats", target:100, value:0},
      {label:"Run (miles)", target:1, value:0}
    ],
    created: new Date().toISOString(),
    deadline: endOfTodayIso(),
    timer:0, active:false, done:false
  };
}

function randomDailyPool(){
  const L = [
    {title:"Meditate 10 minutes", xp:10, gold:10, type:QUEST_TYPES.TIMER, duration:600, attributes:["spiritual"], difficulty:"Normal"},
    {title:"Budget review", xp:20, gold:16, type:QUEST_TYPES.COUNTER, target:1, attributes:["financial"], difficulty:"Normal"},
    {title:"Deep clean a room", xp:77, gold:22, type:QUEST_TYPES.COUNTER, target:3, attributes:["social"], difficulty:"Hard"},
    {title:"Read 20 pages", xp:35, gold:14, type:QUEST_TYPES.COUNTER, target:20, attributes:["intellect"], difficulty:"Normal"},
    {title:"Call or text a loved one", xp:10, gold:10, type:QUEST_TYPES.COUNTER, target:1, attributes:["social"], difficulty:"Easy"},
  ];
  const shuffled = L.sort(()=>Math.random()-0.5);
  const out = shuffled.slice(0,3).map(x=>{
    const q = {
      id: `daily-${Math.random().toString(36).slice(2,8)}`,
      title:x.title,xp:x.xp,gold:x.gold,daily:true,difficulty:x.difficulty,attributes:x.attributes,
      type:x.type, created:new Date().toISOString(), deadline:endOfTodayIso(), done:false, active:false
    };
    if(x.type===QUEST_TYPES.TIMER){ q.duration=x.duration; q.remaining=x.duration; }
    if(x.type===QUEST_TYPES.COUNTER){ q.target=x.target; q.value=0; }
    return q;
  });
  return out;
}

function minutesCountdown(deadlineIso){
  const left = (new Date(deadlineIso) - now())/1000;
  return left<=0 ? "expired" : hhmmss(left);
}

function completeQuest(q){
  if(q.done) return;
  S.xp += q.xp;
  S.gold += q.gold;
  q.done = true;
  S.journey.completed += 1;
  // attribute increments (1 point per quest per listed attribute)
  (q.attributes||[]).forEach(a=>{ if(S.attributes[a]!=null) S.attributes[a] += 1; });
  // First title unlock
  if(!S.titles.owned.includes("The One Who Started") && S.journey.completed>=1){
    S.titles.owned.push("The One Who Started");
  }
  // level up logic
  while(S.xp >= S.xpMax){ S.xp -= S.xpMax; S.level += 1; S.xpMax = Math.round(S.xpMax*1.2 + 12); }
  save();
  renderAll();
}

function questBodyHtml(q){
  if(q.type===QUEST_TYPES.TIMER){
    return `<div class="muted">Not started</div>
            <div class="btn-row">
              <button class="btn primary act-start">Start</button>
              <button class="btn act-pause">Pause</button>
              <button class="btn act-resume">Resume</button>
            </div>`;
  }
  if(q.type===QUEST_TYPES.COUNTER){
    return `<div class="muted">Count ${q.value||0}/${q.target}</div>
            <div class="btn-row">
              <button class="btn act-dec">-1</button>
              <button class="btn act-inc">+1</button>
            </div>`;
  }
  if(q.type===QUEST_TYPES.MULTI){
    return q.parts.map((p,i)=>`
      <div class="row space">
        <div>${p.label}</div>
        <div class="muted">${p.value}/${p.target}</div>
      </div>
      <div class="btn-row">
        <button class="btn act-sub" data-i="${i}">-1</button>
        <button class="btn act-add" data-i="${i}">+1</button>
        <button class="btn primary act-fin" data-i="${i}">Finish</button>
      </div>
    `).join("");
  }
  return "";
}

function renderQuests(filter="all"){
  const host = $("#questList"); host.innerHTML="";
  const items = S.quests.filter(q=>{
    if(filter==="daily") return q.daily;
    if(filter==="penalty") return q.penalty;
    if(filter==="active") return q.active;
    if(filter==="done") return q.done;
    return true;
  });
  if(items.length===0){
    host.innerHTML = `<div class="muted">No quests yet. Tap ＋ to add.</div>`;
    return;
  }

  items.forEach(q=>{
    const tpl = $("#questTpl").content.cloneNode(true);
    const card = tpl.querySelector(".card");
    card.querySelector(".title").textContent = q.title;
    card.querySelector(".xp").textContent = `+${q.xp} XP`;
    card.querySelector(".gold").innerHTML = `🪙 ${q.gold}`;
    const meta = card.querySelector(".meta");
    if(q.daily) meta.append(tagChip("Daily"));
    if(q.difficulty) meta.append(tagChip(q.difficulty));
    (q.attributes||[]).forEach(a=> meta.append(tagChip(a)));
    const resetLine = card.querySelector(".resetLine");
    const updateReset = ()=> resetLine.textContent = `resets in ${minutesCountdown(q.deadline)}`;
    updateReset();
    q._resetTicker && clearInterval(q._resetTicker);
    q._resetTicker = setInterval(updateReset, 1000);

    const body = card.querySelector(".body"); body.innerHTML = questBodyHtml(q);

    const footer = card.querySelector(".footer");
    const btnDone = mkBtn("Done","good"); const btnReset = mkBtn("Reset","warn");
    const btnEdit = mkBtn("Edit",""); const btnDelete = mkBtn("Delete","danger");
    footer.append(btnDone, btnReset, btnEdit, btnDelete);

    btnDone.onclick = ()=>{ completeQuest(q); renderQuests(filter); };
    btnDelete.onclick = ()=>{ S.quests = S.quests.filter(x=>x!==q); save(); renderQuests(filter); };
    btnReset.onclick = ()=>{
      if(q.type===QUEST_TYPES.COUNTER){ q.value=0; }
      if(q.type===QUEST_TYPES.TIMER){ q.remaining=q.duration; q.active=false; }
      if(q.type===QUEST_TYPES.MULTI){ q.parts.forEach(p=>p.value=0); }
      q.done=false; save(); renderQuests(filter);
    };
    btnEdit.onclick = ()=> alert("Quick-edit coming later 😊");

    // handlers for body
    body.querySelectorAll(".act-start").forEach(b=>b.onclick=()=>{ q.active=true; tickTimer(q); save(); renderQuests(filter); });
    body.querySelectorAll(".act-pause").forEach(b=>b.onclick=()=>{ q.active=false; save(); });
    body.querySelectorAll(".act-resume").forEach(b=>b.onclick=()=>{ q.active=true; tickTimer(q); save(); });
    body.querySelectorAll(".act-inc").forEach(b=>b.onclick=()=>{ q.value=Math.min(q.target,(q.value||0)+1); save(); renderQuests(filter); });
    body.querySelectorAll(".act-dec").forEach(b=>b.onclick=()=>{ q.value=Math.max(0,(q.value||0)-1); save(); renderQuests(filter); });
    body.querySelectorAll(".act-add").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; q.parts[i].value=Math.min(q.parts[i].target, q.parts[i].value+1); save(); renderQuests(filter); });
    body.querySelectorAll(".act-sub").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; q.parts[i].value=Math.max(0, q.parts[i].value-1); save(); renderQuests(filter); });
    body.querySelectorAll(".act-fin").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; q.parts[i].value=q.parts[i].target; save(); renderQuests(filter); });

    host.appendChild(tpl);
  });
}

function tagChip(text){ const b=document.createElement("button"); b.className="chip"; b.textContent=text; return b; }
function mkBtn(text, cls){ const b=document.createElement("button"); b.className="btn "+cls; b.textContent=text; return b; }

function tickTimer(q){
  if(!q._timer){
    q._timer = setInterval(()=>{
      if(!q.active) return;
      q.remaining = Math.max(0, (q.remaining||q.duration) - 1);
      if(q.remaining===0){ q.active=false; completeQuest(q); }
      save();
    },1000);
  }
}

// filters
$$("#tab-quest .filter").forEach(f=>f.addEventListener("click",()=>{
  $$("#tab-quest .filter").forEach(x=>x.classList.remove("active"));
  f.classList.add("active");
  renderQuests(f.dataset.filter);
}));

// Add Quest (quick modal-less example: adds simple counter quest 10 reps, physical+psyche)
$("#addQuestBtn").addEventListener("click", ()=>{
  const id = "q-"+Math.random().toString(36).slice(2,8);
  S.quests.push({ id, title:"Custom Quest", xp:25, gold:10, daily:false, attributes:["physical","psyche"], type:QUEST_TYPES.COUNTER, target:10, value:0, created:new Date().toISOString(), deadline:endOfTodayIso(), done:false });
  save(); renderQuests();
});

// ---------- Focus timer ----------
let focusInt=null, focusRemain=0;
function refreshFocusTime(){ const m = Math.floor(focusRemain/60), s = focusRemain%60; $("#focusTime").textContent = `${fmt(m)}:${fmt(s)}`; }
function stopFocus(){ clearInterval(focusInt); focusInt=null; }
$("#focusStart").onclick=()=>{ focusRemain = parseInt($("#focusMinutes").value||"25",10)*60; refreshFocusTime(); stopFocus(); focusInt=setInterval(()=>{ if(focusRemain>0){ focusRemain--; refreshFocusTime(); } else stopFocus(); },1000); };
$("#focusPause").onclick=()=> stopFocus();
$("#focusResume").onclick=()=>{ if(!focusInt){ focusInt=setInterval(()=>{ if(focusRemain>0){ focusRemain--; refreshFocusTime(); } else stopFocus(); },1000);} };
$("#focusCancel").onclick=()=>{ focusRemain= parseInt($("#focusMinutes").value||"25",10)*60; refreshFocusTime(); stopFocus(); };

// ---------- Title equip ----------
$("#saveTitleBtn").onclick=()=>{ S.titles.equipped = $("#equippedTitle").value; save(); };

// ---------- Daily reset heartbeat ----------
setInterval(()=>{
  // deadline expiries -> convert to penalty if wanted (for now we just mark expired)
  const nowIso = new Date().toISOString();
  S.quests.forEach(q=>{
    if(!q.done && q.deadline && q.deadline < nowIso && q.daily){
      // auto expire: keep but mark done=false, and reset via seeding when date changes
    }
  });
}, 30000);

// ---------- Render ----------
function renderAll(){
  refreshHeader();
  updateCharacter();
  updateJourney();
  renderQuests();
  renderRewards();
  drawChart();
}

function boot(){
  setupTabs();
  seedDailiesIfNeeded();
  renderAll();
}
boot();
