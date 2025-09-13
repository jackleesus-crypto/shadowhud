
const rewardListEl = ()=> document.getElementById('rewardList');
const rewardDialog = document.getElementById('rewardDialog');
const rewardForm = document.getElementById('rewardForm');
document.getElementById('addRewardFab').addEventListener('click', ()=>{ rewardForm.reset(); rewardDialog.showModal(); });
rewardForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(rewardForm);
  const R = { id: crypto.randomUUID(), title: fd.get('title'), desc: fd.get('desc')||'', cost: Number(fd.get('cost')||50)};
  S.rewards.push(R); save(); renderStore(); rewardDialog.close();
});

function renderStore(){
  const list = rewardListEl(); if(!list) return;
  document.getElementById('goldAmountStore').textContent = S.gold||0;
  list.innerHTML = '';
  if((S.rewards||[]).length===0){
    list.innerHTML = `<div class="card">No rewards yet. Add your own!</div>`;
  } else {
    S.rewards.forEach(r=>{
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `<div class="row space">
        <div><b>${r.title}</b><div class="muted">${r.desc||''}</div></div>
        <div>🪙 ${r.cost}</div>
      </div>
      <div class="actions">
        <button class="btn small" data-act="buy">Buy</button>
        <button class="btn small ghost" data-act="del">Delete</button>
      </div>`;
      el.querySelector('[data-act=buy]').onclick = ()=>{
        if((S.gold||0) >= r.cost){ S.gold -= r.cost; save(); renderHeader(); renderStore(); alert('Enjoy your reward!'); }
        else alert('Not enough gold yet!');
      };
      el.querySelector('[data-act=del]').onclick = ()=>{ S.rewards = S.rewards.filter(x=>x.id!==r.id); save(); renderStore(); };
      list.appendChild(el);
    });
  }
}
