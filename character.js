
// CHARACTER
function renderCharacter(){
  // attributes
  for(const k of Object.keys(S.attributes)){
    const el = document.getElementById('attr-'+k);
    if(el) el.textContent = S.attributes[k]||0;
  }
  // AP
  const ap = document.getElementById('apCount'); if(ap) ap.textContent = S.ap||0;
  // radar
  drawRadar();
}
function drawRadar(){
  const c = document.getElementById('radar'); if(!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  const labels = ['Financial','Physical','Psyche','Intellect','Social','Spiritual'];
  const vals = [S.attributes.Financial, S.attributes.Physical, S.attributes.Psyche, S.attributes.Intellect, S.attributes.Social, S.attributes.Spiritual];
  const max = Math.max(1, ...vals, 10);
  const cx=c.width/2, cy=c.height/2+10, r=Math.min(c.width,c.height)/2-20;
  const N=labels.length;
  // grid
  ctx.strokeStyle='#2a2f41'; ctx.lineWidth=1;
  for(let ring=1; ring<=5; ring++){
    ctx.beginPath();
    for(let i=0;i<N;i++){
      const a = (Math.PI*2*i/N) - Math.PI/2;
      const rr = r*ring/5;
      const x = cx + rr*Math.cos(a), y = cy + rr*Math.sin(a);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  // polygon
  ctx.beginPath();
  for(let i=0;i<N;i++){
    const a = (Math.PI*2*i/N) - Math.PI/2;
    const rr = r*(vals[i]/max);
    const x = cx + rr*Math.cos(a), y = cy + rr*Math.sin(a);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.fillStyle='rgba(139,92,246,0.35)'; ctx.fill();
  // labels
  ctx.fillStyle='#aeb6cc'; ctx.font='12px -apple-system,system-ui,Inter';
  for(let i=0;i<N;i++){
    const a = (Math.PI*2*i/N) - Math.PI/2;
    const x = cx + (r+10)*Math.cos(a), y = cy + (r+10)*Math.sin(a);
    ctx.textAlign = (Math.cos(a)>0.2)?'left':(Math.cos(a)<-0.2?'right':'center');
    ctx.fillText(labels[i], x, y);
  }
}
