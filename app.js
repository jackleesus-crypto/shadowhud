const $=s=>document.querySelector(s);
const defaultState={player:{level:1,xp:0,xpNext:50}};
let state=JSON.parse(localStorage.getItem('shadowhud-rank')||JSON.stringify(defaultState));
function save(){localStorage.setItem('shadowhud-rank',JSON.stringify(state));}
function xpToNext(level){return Math.round(40+6*level+0.6*level*level);}
function rankForLevel(l){if(l<15)return'E';if(l<30)return'D';if(l<45)return'C';if(l<60)return'B';if(l<75)return'A';return'S';}
function grantXP(amount){const p=state.player;if(p.level>=100)return;p.xp+=amount;while(p.level<100&&p.xp>=p.xpNext){p.xp-=p.xpNext;p.level++;p.xpNext=xpToNext(p.level);}if(p.level>=100){p.level=100;p.xp=p.xpNext;}save();renderLevel();}
function renderLevel(){const p=state.player;$('#level-num').textContent=p.level;$('#rank-text').textContent=rankForLevel(p.level);$('#rank-badge').textContent=rankForLevel(p.level);$('#xp-cur').textContent=p.xp;$('#xp-next').textContent=p.xpNext;$('#xp-fill').style.width=(100*p.xp/p.xpNext)+'%';}
window.addEventListener('DOMContentLoaded',()=>{state.player.xpNext=xpToNext(state.player.level);renderLevel();setInterval(()=>grantXP(5),3000);});