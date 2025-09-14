document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");

  app.innerHTML = `
    <header>
      <h1>ShadowHUD v13.2</h1>
      <div>💰 <span id="gold">0</span></div>
    </header>
    <nav>
      <button id="tab-quest" class="active">Quest</button>
      <button id="tab-journey">Journey</button>
      <button id="tab-character">Character</button>
      <button id="tab-store">Store</button>
      <button id="tab-focus">Focus</button>
    </nav>
    <div class="container" id="content"></div>
  `;

  const tabs = {
    quest: `
      <h2>Quests</h2>
      <div class="quest-card">
        <h3>Strength Training</h3>
        <p>resets in <span id="timer">--:--:--</span></p>
        <div>
          Pushups 0/100
          <button class="small finish">Finish</button>
        </div>
        <button class="small done">Done</button>
        <button class="small reset">Reset</button>
        <button class="small edit">Edit</button>
        <button class="small delete">Delete</button>
      </div>
    `,
    journey: `<h2>Journey</h2><p>Track your progress here.</p>`,
    character: `
      <h2>Character</h2>
      <p>⭐ Unspent AP: 0</p>
      <canvas id="attrChart" class="chart"></canvas>
      <div class="attribute-grid">
        <div class="attribute"><h3>0</h3><p>PHYSICAL</p></div>
        <div class="attribute"><h3>0</h3><p>PSYCHE</p></div>
        <div class="attribute"><h3>0</h3><p>INTELLECT</p></div>
        <div class="attribute"><h3>0</h3><p>SOCIAL</p></div>
        <div class="attribute"><h3>0</h3><p>SPIRITUAL</p></div>
        <div class="attribute"><h3>0</h3><p>FINANCIAL</p></div>
      </div>
    `,
    store: `<h2>Store</h2><p>Buy and manage items here.</p>`,
    focus: `<h2>Focus</h2><p>Stay on task with timers.</p>`
  };

  const content = document.getElementById("content");
  content.innerHTML = tabs.quest;

  function switchTab(tab) {
    document.querySelectorAll("nav button").forEach(btn => btn.classList.remove("active"));
    document.getElementById("tab-" + tab).classList.add("active");
    content.innerHTML = tabs[tab];
    if(tab === "character") renderChart();
  }

  document.getElementById("tab-quest").addEventListener("click", () => switchTab("quest"));
  document.getElementById("tab-journey").addEventListener("click", () => switchTab("journey"));
  document.getElementById("tab-character").addEventListener("click", () => switchTab("character"));
  document.getElementById("tab-store").addEventListener("click", () => switchTab("store"));
  document.getElementById("tab-focus").addEventListener("click", () => switchTab("focus"));

  function renderChart() {
    const ctx = document.getElementById("attrChart").getContext("2d");
    new Chart(ctx, {
      type: "radar",
      data: {
        labels: ["Physical","Psyche","Intellect","Social","Spiritual","Financial"],
        datasets: [{
          label: "Attributes",
          data: [0,0,0,0,0,0],
          backgroundColor: "rgba(106,90,205,0.2)",
          borderColor: "#6a5acd",
          pointBackgroundColor: "#6a5acd"
        }]
      },
      options: {
        scales: { r: { angleLines: { color: "#333" }, grid: { color: "#333" }, pointLabels: { color: "#fff" }, ticks: { color: "#fff" } } }
      }
    });
  }

  // Countdown timer to midnight
  function updateTimer() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24,0,0,0);
    const diff = midnight - now;
    const hours = String(Math.floor(diff / 1000 / 60 / 60)).padStart(2, '0');
    const mins = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0');
    const secs = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
    const timerEl = document.getElementById("timer");
    if(timerEl) timerEl.textContent = `${hours}:${mins}:${secs}`;
  }
  setInterval(updateTimer, 1000);
});
