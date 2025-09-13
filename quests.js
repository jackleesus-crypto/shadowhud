
// QUESTS
const questListEl = ()=> document.getElementById('questList');
const questDialog = document.getElementById('questDialog');
const questForm = document.getElementById('questForm');

document.getElementById('addQuestFab').addEventListener('click', ()=>{
  questForm.reset();
  questDialog.showModal();
});

questForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(questForm);
  const Q = {
    id: crypto.randomUUID(),
    title: fd.get('title'),
    desc: fd.get('desc')||'',
    type: fd.get('type'),
    attributes: (fd.get('attributes')||'').split(',').map(s=>s.trim()).filter(Boolean),
    difficulty: fd.get('difficulty')||'Normal',
    daily: fd.get('daily')==='yes' ? 'yes':'no',
    baseXp: Number(fd.get('baseXp')||25),
    gold: Number(fd.get('gold')||10),
    target: Number(fd.get('target')||1),
    minutes: Number(fd.get('minutes')||25),
    checklist: (fd.get('checklist')||'').split(',').map(s=>s.trim()).filter(Boolean).map(t=>({text:t,done:false})),
    multi: (fd.get('multi')||'').split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{
      const [label, num] = pair.split(':').map(x=>x.trim()); return {label, target:Number(num||1), progress:0};
    }),
    status:'new', progress:0, created: Date.now(),
    seed: (fd.get('daily')==='yes')? new Date().toDateString() : undefined,
    deadline: fd.get('deadline')? (new Date(fd.get('deadline')).getTime()) : null
  };
  S.quests.push(Q); save(); renderQuests(); questDialog.close();
});

document.querySelectorAll('.filters .chip').forEach(ch=>{
  ch.addEventListener('click', ()=>{
    document.querySelectorAll('.filters .chip').forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    renderQuests();
  });
});

function questFilter(){
  const active = document.querySelector('.filters .chip.active');
  return active? active.dataset.filter : 'all';
}

function xpWithDifficulty(base, diff){
  const mult = diff==='Easy'?0.8 : diff==='Hard'?1.3 : diff==='Elite'?1.6 : 1.0;
  return Math.max(1, Math.round(base*mult));
}
function apFromDifficulty(diff){
  return diff==='Easy'?1 : diff==='Hard'?2 : diff==='Elite'?3 : 1;
}
function goldFromDifficulty(base, diff){
  const mult = diff==='Easy'?0.8 : diff==='Hard'?1.3 : diff==='Elite'?1.6 : 1.0;
  return Math.max(0, Math.round(base*mult));
}

function renderQuests(ticking=false){
  const list = questListEl();
  if(!list) return;
  const f = questFilter();
  const items = S.quests.filter(q=>{
    if(f==='daily') return q.daily==='yes';
    if(f==='penalty') return (q.title||'').toLowerCase().includes('penalty');
    if(f==='active') return q.status==='active';
    if(f==='done') return q.status==='done';
    return true;
  }).sort((a,b)=> (b.created||0)-(a.created||0));

  if(!ticking) list.innerHTML='';
  items.forEach(q=>{
    let el = document.getElementById('q_'+q.id);
    if(!el){
      el = document.createElement('div');
      el.className='card quest-card'; el.id = 'q_'+q.id;
      el.innerHTML = `
        <div class="tag">${q.daily==='yes'?'Daily':''}</div>
        <div class="quest-top">
          <div>
            <div class="quest-title">${q.title}</div>
            <div class="quest-meta"><span>${q.difficulty}</span> · <span>${(q.attributes||[]).join(' • ')||'Neutral'}</span></div>
            <div class="countdown"></div>
          </div>
          <div class="rewardline">+<b class="xp"></b> XP · ⭐ <span class="ap"></span> · 🪙 <span class="gold"></span></div>
        </div>
        <div class="body"></div>
        <div class="actions">
          <button class="btn small" data-act="start">Start</button>
          <button class="btn small ghost" data-act="done">Done</button>
          <button class="btn small ghost" data-act="reset">Reset</button>
          <button class="btn small ghost" data-act="edit">Edit</button>
          <button class="btn small ghost" data-act="delete">Delete</button>
        </div>`;
      list.appendChild(el);
      // actions
      el.querySelectorAll('[data-act]').forEach(btn=>{
        btn.addEventListener('click', ()=> handleQuestAction(q.id, btn.dataset.act));
      });
    }
    // update reward line
    el.querySelector('.xp').textContent = xpWithDifficulty(q.baseXp||10, q.difficulty||'Normal');
    el.querySelector('.ap').textContent = apFromDifficulty(q.difficulty||'Normal');
    el.querySelector('.gold').textContent = goldFromDifficulty(q.gold||5, q.difficulty||'Normal');

    // body
    const body = el.querySelector('.body');
    body.innerHTML='';
    if(q.type==='timer'){
      const need = (q.minutes||25)*60*1000;
      const elapsed = q.elapsed||0;
      const bar = `<div class="xpbar"><div class="fill" style="width:${Math.min(99,Math.round(elapsed/need*100))}%"></div></div>`;
      body.innerHTML = `<div>${bar}</div>`;
    } else if(q.type==='multi'){
      q.multi = q.multi||[];
      q.multi.forEach((row, idx)=>{
        const r = document.createElement('div'); r.className='counter-row';
        r.innerHTML = `<div class="label">${row.label}</div>
          <div>${row.progress||0} / ${row.target}</div>
          <button class="btn small" data-idx="${idx}" data-do="finish">Finish</button>
          <button class="btn small ghost" data-idx="${idx}" data-do="-1">−1</button>
          <button class="btn small ghost" data-idx="${idx}" data-do="+1">+1</button>`;
        r.querySelectorAll('[data-do]').forEach(b=>{
          b.addEventListener('click', ()=>{
            const id = q.id; const i = Number(b.dataset.idx);
            const act = b.dataset.do;
            const QQ = S.quests.find(x=>x.id===id); if(!QQ) return;
            if(act==='+1') QQ.multi[i].progress = Math.min(QQ.multi[i].target, (QQ.multi[i].progress||0)+1);
            if(act==='-1') QQ.multi[i].progress = Math.max(0, (QQ.multi[i].progress||0)-1);
            if(act==='finish') QQ.multi[i].progress = QQ.multi[i].target;
            save(); renderQuests();
          });
        });
        body.appendChild(r);
      });
    } else {
      body.innerHTML = `<div>${q.progress||0} / ${q.target||1}</div>
        <div class="actions">
          <button class="btn small ghost" data-act="minus1">−1</button>
          <button class="btn small ghost" data-act="plus1">+1</button>
        </div>`;
      // attach inline handlers
      body.querySelector('[data-act="minus1"]').onclick = ()=>{ q.progress=Math.max(0,(q.progress||0)-1); save(); renderQuests();};
      body.querySelector('[data-act="plus1"]').onclick = ()=>{ q.progress=Math.min(q.target||1,(q.progress||0)+1); save(); renderQuests();};
    }

    // countdown to midnight
    const left = todayMidnight().getTime() - Date.now();
    const cd = el.querySelector('.countdown');
    if(cd) cd.textContent = q.daily==='yes'? `resets in ${fmtTime(left)}` : (q.deadline? ('deadline '+ new Date(q.deadline).toLocaleString()) : '');
  });

  // empty state
  if(items.length===0 && !ticking){
    list.innerHTML = `<div class="card">No quests yet. Tap + to add.</div>`;
  }
}

function completeQuest(q){
  const xp = xpWithDifficulty(q.baseXp||10, q.difficulty||'Normal');
  addXp(xp);
  const ap = apFromDifficulty(q.difficulty||'Normal'); addAP(ap);
  const gold = goldFromDifficulty(q.gold||5, q.difficulty||'Normal'); addGold(gold);

  // attributes
  (q.attributes||[]).forEach(a=> addAttr(a, 1));

  // titles/achievements
  if(!S.titles.find(t=>t.id==='start').unlocked){
    S.titles.find(t=>t.id==='start').unlocked = true;
  }
  if(q.templateId==='strength-training'){
    const T = S.titles.find(t=>t.id==='sweat'); if(T) T.unlocked = true;
  }

  q.status='done'; q.completedAt = Date.now();
  save(); renderAll();
}

function handleQuestAction(id, act){
  const q = S.quests.find(x=>x.id===id); if(!q) return;
  if(act==='start'){ q.status='active'; q.startedAt = Date.now(); }
  else if(act==='reset'){ 
    q.progress=0; q.elapsed=0; if(q.multi){ q.multi.forEach(i=> i.progress=0); }
    q.status='new';
  }
  else if(act==='done'){ completeQuest(q); }
  else if(act==='delete'){ S.quests = S.quests.filter(x=>x.id!==id); }
  else if(act==='edit'){ // simple: reopen dialog prefilled
    questForm.reset();
    questDialog.showModal();
    questForm.querySelector('[name=title]').value = q.title;
    questForm.querySelector('[name=desc]').value = q.desc||'';
    questForm.querySelector('[name=type]').value = q.type;
    questForm.querySelector('[name=attributes]').value = (q.attributes||[]).join(',');
    questForm.querySelector('[name=difficulty]').value = q.difficulty||'Normal';
    questForm.querySelector('[name=daily]').value = (q.daily==='yes'?'yes':'no');
    questForm.querySelector('[name=baseXp]').value = q.baseXp||25;
    questForm.querySelector('[name=gold]').value = q.gold||10;
    questForm.querySelector('[name=target]').value = q.target||10;
    questForm.querySelector('[name=minutes]').value = q.minutes||25;
    questForm.querySelector('[name=checklist]').value = (q.checklist||[]).map(i=>i.text).join(', ');
    questForm.querySelector('[name=multi]').value = (q.multi||[]).map(i=>`${i.label}:${i.target}`).join(', ');
    questForm.querySelector('[name=deadline]').value = q.deadline? new Date(q.deadline).toISOString().slice(0,16) : '';
    // intercept save to update
    const onSubmit = (e)=>{
      e.preventDefault();
      const fd = new FormData(questForm);
      q.title = fd.get('title'); q.desc = fd.get('desc')||'';
      q.type = fd.get('type'); q.attributes = (fd.get('attributes')||'').split(',').map(s=>s.trim()).filter(Boolean);
      q.difficulty = fd.get('difficulty')||'Normal'; q.daily = (fd.get('daily')==='yes')?'yes':'no';
      q.baseXp = Number(fd.get('baseXp')||25); q.gold = Number(fd.get('gold')||10);
      q.target = Number(fd.get('target')||1); q.minutes = Number(fd.get('minutes')||25);
      q.checklist = (fd.get('checklist')||'').split(',').map(s=>s.trim()).filter(Boolean).map(t=>({text:t,done:false}));
      q.multi = (fd.get('multi')||'').split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{const [label,num]=pair.split(':').map(x=>x.trim()); return {label, target:Number(num||1), progress:0};});
      q.deadline = fd.get('deadline')? (new Date(fd.get('deadline')).getTime()) : null;
      save(); renderQuests(); questDialog.close();
      questForm.removeEventListener('submit', onSubmit);
    };
    questForm.addEventListener('submit', onSubmit);
    return;
  }
  save(); renderQuests();
}

// Timer ticking
function renderFocusTick(){ // from focus.js actually; keep minimal call here
  // no-op placeholder
}

