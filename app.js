function showTab(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('visible'));
  document.getElementById(id).classList.add('visible');
}