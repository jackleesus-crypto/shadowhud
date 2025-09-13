
// Core state & helpers
const LS_KEY = "shadowhud_state_v128";
const now = () => new Date();
const todayMidnight = () => { const d = new Date(); d.setHours(24,0,0,0); return d; }
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

const defaultState = {
  gold: 0,
  ap: 0,
  attributes: { Physical:0,Psyche:0,Intellect:0,Social:0,Spiritual:0,Financial:0 },
  level: 1, xp: 0,
  quests: [],
  rewards: [],
  titles: [
    { id:'start', name:'The One Who Started', req:'Complete 1 quest', unlocked:false },
    { id:'focus25', name:'Keeper of Focus', req:'Finish a 25 min focus', unlocked:false },
    { id:'sweat', name:'Steel Resolve', req:'Finish Strength Training', unlocked:false },
  ],
  equippedTitle: null,
  achievements: [],
  lastDailySeed: null
};

let S = load();
function load(){
  try{ const s = JSON.parse(localStorage.getItem(LS_KEY)); return s? s : structuredClone(defaultState);}catch{ return structuredClone(defaultState);}
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(S)); }
function addGold(n){ S.gold = Math.max(0, (S.gold||0) + n); }
function addAP(n){ S.ap = Math.max(0, (S.ap||0) + n); }
function addAttr(attr, n){ if(S.attributes[attr]!==undefined) S.attributes[attr]+=n; }
function xpRequired(lv){ // smooth curve: base 40, grows ~8% per level
  let req = Math.round(40 * Math.pow(1.08, lv-1));
  return clamp(req, 20, 5000);
}
function rankForLevel(lv){
  if(lv<=15) return 'E';
  if(lv<=30) return 'D';
  if(lv<=45) return 'C';
  if(lv<=60) return 'B';
  if(lv<=80) return 'A';
  return 'S';
}
function addXp(n){
  S.xp += n;
  while(S.xp >= xpRequired(S.level)){
    S.xp -= xpRequired(S.level);
    S.level++;
  }
}
function fmtTime(ms){
  const t = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
  if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(1,'0')}:${String(s).padStart(2,'0')}`;
}

function ensureDailySeeds(){
  const dayKey = new Date().toDateString();
  if(S.lastDailySeed !== dayKey){
    // generate default dailies including Strength Training
    S.lastDailySeed = dayKey;
    // Only add if not already present today
    const hasST = S.quests.some(q=> q.templateId==='strength-training' && q.daily==='yes' && q.seed===dayKey);
    if(!hasST){
      S.quests.push({
        id: crypto.randomUUID(), templateId:'strength-training', seed: dayKey,
        title:'Strength Training', desc:'Daily conditioning',
        type:'multi', attributes:['Physical'],
        difficulty:'Elite', daily:'yes', baseXp:160, gold:32,
        multi:[{label:'Pushups',target:100,progress:0},{label:'Sit-ups',target:100,progress:0},{label:'Squats',target:100,progress:0},{label:'Run (miles)',target:1,progress:0}],
        status:'new', created: Date.now()
      });
    }
    // sample gentle dailies
    const pool = [
      {title:'Meditate 10 min', type:'timer', minutes:10, attributes:['Spiritual'], difficulty:'Easy', xp:18, gold:8},
      {title:'Deep clean a room', type:'counter', target:3, attributes:['Social'], difficulty:'Hard', xp:70, gold:22},
      {title:'Call or text a loved one', type:'counter', target:1, attributes:['Social'], difficulty:'Easy', xp:10, gold:10}
    ];
    for(const d of pool){
      S.quests.push({
        id: crypto.randomUUID(), seed: dayKey, daily:'yes', templateId:'daily-'+d.title,
        title:d.title, type:d.type, attributes:d.attributes, difficulty:d.difficulty, baseXp:d.xp, gold:d.gold,
        minutes:d.minutes||25, target:d.target||1, progress:0, status:'new', created: Date.now()
      });
    }
  }
}

function midnightSweep(){
  const dayKey = new Date().toDateString();
  // delete expired dailies from yesterday and add penalties
  const keep = [];
  for(const q of S.quests){
    const isDaily = q.daily==='yes';
    const expired = isDaily && q.seed !== dayKey;
    if(expired){
      // if not completed -> penalty
      const done = isQuestDone(q);
      if(!done){
        S.quests.push({
          id: crypto.randomUUID(),
          title:`Penalty – 50 push-ups`, type:'counter', target:50, progress:0,
          attributes:['Physical'], difficulty:'Normal', daily:'no',
          baseXp:25, gold:5, status:'new', created: Date.now()
        });
      }
      // drop it
    } else {
      keep.push(q);
    }
  }
  S.quests = keep;
  ensureDailySeeds();
}

function isQuestDone(q){
  if(q.type==='timer') return q.elapsed && q.elapsed >= (q.minutes||25)*60*1000;
  if(q.type==='multi') return q.multi && q.multi.every(i=> (i.progress||0) >= (i.target||1));
  return (q.progress||0) >= (q.target||1);
}

// UI navigation
document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(el=>el.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    renderAll();
  });
});

// Common renderers
function renderHeader(){
  document.getElementById('goldAmount').textContent = S.gold||0;
  const g2 = document.getElementById('goldAmountStore'); if(g2) g2.textContent = S.gold||0;
}
function renderXP(){
  const lvl = S.level || 1;
  const need = xpRequired(lvl);
  const pct = Math.min(99, Math.round((S.xp/need)*100));
  const lvlText = `Level ${lvl} · ${rankForLevel(lvl)}`;
  const bar = document.getElementById('journeyXp'); if(bar){ bar.style.width = pct+'%'; }
  const jl = document.getElementById('journeyLevel'); if(jl){ jl.textContent = lvlText; }
}

function bootstrap(){
  midnightSweep();
  renderAll();
  // ticker for countdowns
  setInterval(()=>{
    renderQuests(true);
    renderFocusTick();
  }, 1000);
}
window.addEventListener('load', bootstrap);

function renderAll(){
  renderHeader();
  renderQuests();
  renderCharacter();
  renderJourney();
  renderStore();
}
