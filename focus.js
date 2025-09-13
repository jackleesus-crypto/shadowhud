
let focusTimer=null, focusEnd=null, pausedLeft=0;
function renderFocus(){
  const min = Number(document.getElementById('focusMinutes').value||25);
  document.getElementById('focusDisplay').textContent = `${String(min).padStart(2,'0')}:00`;
}
function renderFocusTick(){
  if(!focusEnd) return;
  const left = focusEnd - Date.now();
  if(left<=0){ clearInterval(focusTimer); focusTimer=null; focusEnd=null; pausedLeft=0;
    document.getElementById('focusDisplay').textContent = '00:00';
    // unlock title
    const t = S.titles.find(t=>t.id==='focus25'); if(t) t.unlocked = true; save(); renderJourney();
    return;
  }
  const m = Math.floor(left/1000/60), s = Math.floor((left/1000)%60);
  document.getElementById('focusDisplay').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
document.getElementById('focusMinutes').addEventListener('input', renderFocus);
document.getElementById('focusStart').addEventListener('click', ()=>{
  const min = Number(document.getElementById('focusMinutes').value||25);
  focusEnd = Date.now() + min*60*1000; if(focusTimer) clearInterval(focusTimer);
  focusTimer = setInterval(renderFocusTick, 1000);
  renderFocusTick();
});
document.getElementById('focusPause').addEventListener('click', ()=>{
  if(focusEnd){ pausedLeft = focusEnd - Date.now(); clearInterval(focusTimer); focusTimer=null; focusEnd=null; }
});
document.getElementById('focusResume').addEventListener('click', ()=>{
  if(pausedLeft>0){ focusEnd = Date.now()+pausedLeft; pausedLeft=0; if(focusTimer) clearInterval(focusTimer); focusTimer=setInterval(renderFocusTick,1000); }
});
document.getElementById('focusCancel').addEventListener('click', ()=>{
  if(focusTimer) clearInterval(focusTimer); focusTimer=null; focusEnd=null; pausedLeft=0; renderFocus();
});
renderFocus();
