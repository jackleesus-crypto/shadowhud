function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('visible'));
  document.getElementById('screen-'+id).classList.add('visible');
}
document.addEventListener('DOMContentLoaded',()=>{
  console.log('ShadowHUD v11.2 loaded with all features placeholder.');
});