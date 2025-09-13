
function renderJourney(){
  renderXP();
  document.getElementById('journeyCompleted').textContent = S.quests.filter(q=>q.status==='done').length;
  document.getElementById('journeyGold').textContent = S.gold||0;
  // simple streak: consecutive days with at least 1 completed
  const days = new Set(S.quests.filter(q=>q.status==='done').map(q=> new Date(q.completedAt).toDateString()));
  let streak = 0; let d=new Date();
  while(days.has(d.toDateString())){ streak++; d.setDate(d.getDate()-1); }
  document.getElementById('journeyStreak').textContent = streak;

  // titles
  const list = document.getElementById('titleList'); list.innerHTML='';
  S.titles.forEach(t=>{
    const card = document.createElement('div'); card.className='title-card card'+(t.unlocked?'':' locked');
    card.innerHTML = `<div class="title-name">${t.name}</div><div class="title-req">${t.req}</div>
      <div style="margin-top:8px">
        <button class="btn small" ${t.unlocked?'':'disabled'}>${S.equippedTitle===t.id?'Equipped':'Equip'}</button>
      </div>`;
    card.querySelector('button').onclick = ()=>{ if(t.unlocked){ S.equippedTitle=t.id; save(); renderJourney(); } };
    list.appendChild(card);
  });
  document.getElementById('equippedTitle').textContent = (S.titles.find(t=>t.id===S.equippedTitle)||{name:'None'}).name;
}
