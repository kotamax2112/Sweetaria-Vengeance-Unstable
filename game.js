(() => {
  "use strict";

  const qs = (s) => document.querySelector(s);
  const qsa = (s) => [...document.querySelectorAll(s)];

  const SV = {
    running: false,
    paused: false,
    ctx: null,
    player: { x: 120, y: 296, w: 42, h: 64, vy: 0, jumps: 0 },
    hazards: [],
    score: 0,
    lastTs: 0,
    settings: { music: true, sfx: true, playerName: "Hero" }
  };

  /* -------------------------
        INIT
  -------------------------- */
  function init() {
    const canvas = qs("#game-canvas");
    SV.ctx = canvas.getContext("2d");

    qs("#title-screen").addEventListener("pointerdown", openHome);
    qs("#play-btn").addEventListener("click", () => startRun());
    qs("#jump-btn").addEventListener("pointerdown", jump);

    qs("#wardrobe-btn").addEventListener("click", () => openPopup("wardrobe-popup"));
    qs("#lore-btn").addEventListener("click", () => openPopup("lore-popup"));
    qs("#achievements-btn").addEventListener("click", () => openPopup("achievements-popup"));
    qs("#settings-btn").addEventListener("click", () => openPopup("settings-popup"));
    qs("#logout-btn").addEventListener("click", () => location.reload());

    qsa(".close-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.closest(".popup").classList.add("hidden");
      });
    });

    renderLore();
  }

  /* -------------------------
        POPUPS
  -------------------------- */
  function openHome() {
    qs("#title-screen").classList.add("hidden");
    qs("#home-screen").classList.remove("hidden");
  }

  function openPopup(id) {
    qs("#" + id).classList.remove("hidden");
  }

  /* -------------------------
        GAME LOOP
  -------------------------- */
  function startRun() {
    qs("#home-screen").classList.add("hidden");
    qs("#game-screen").classList.remove("hidden");

    SV.running = true;
    SV.paused = false;
    SV.score = 0;
    SV.lastTs = performance.now();

    loop();
  }

  function loop(ts) {
    if (!SV.running) return;

    const dt = (ts - SV.lastTs) || 16;
    SV.lastTs = ts;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  /* -------------------------
        UPDATE
  -------------------------- */
  function update(dt) {
    const p = SV.player;

    p.vy += 0.002 * dt;
    p.y += p.vy * dt;

    if (p.y >= 296) {
      p.y = 296;
      p.vy = 0;
      p.jumps = 0;
    }

    SV.score += dt * 0.01;
    qs("#score-display").textContent = Math.floor(SV.score);
    qs("#player-name-display").textContent = SV.settings.playerName;
  }

  /* -------------------------
        DRAW
  -------------------------- */
  function draw() {
    const ctx = SV.ctx;
    ctx.clearRect(0, 0, 800, 480);

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 800, 480);

    drawPlayer();
  }

  function drawPlayer() {
    const ctx = SV.ctx;
    const p = SV.player;

    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  /* -------------------------
        INPUT
  -------------------------- */
  function jump() {
    const p = SV.player;
    if (p.jumps < 2) {
      p.vy = -0.7;
      p.jumps++;
    }
  }

  /* -------------------------
        LORE
  -------------------------- */
  function renderLore() {
    const c1 = qs("#lore-canvas-1").getContext("2d");
    const c2 = qs("#lore-canvas-2").getContext("2d");

    c1.fillStyle = "#7af";
    c1.fillRect(0, 0, 128, 128);

    c2.fillStyle = "#f77";
    c2.fillRect(0, 0, 128, 128);
  }

  /* -------------------------
        START
  -------------------------- */
  document.addEventListener("DOMContentLoaded", init);
})();
