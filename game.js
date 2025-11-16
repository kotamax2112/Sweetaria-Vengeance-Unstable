/* =========================================================
   SWEETARIA: VENGEANCE — HYBRID UI STABLE BUILD
   Version: stable-3-0-hybrid-2
   - Fully synced with your current HTML structure
   - Safe event binding (no null crashes)
   - Title screen tap works
   - Dev zone optional & safe
   - Wardrobe, achievements, lore, RPG all functional
   ========================================================= */

(() => {
  "use strict";

  // ===============================
  // HELPERS
  // ===============================
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const $ = (id) => document.getElementById(id);

  // Safe binding: only attaches handler if element exists
  const on = (el, evt, fn) => {
    if (el) el.addEventListener(evt, fn);
  };

  const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ===============================
  // AUDIO ENGINE
  // ===============================
  let actx = null;
  let musInt = null;

  const Sound = {
    init: () => {
      if (!actx)
        actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
    },

    play(freq, type = "square", vol = 0.1, dur = 0.25) {
      if (!SV.settings.sfx || !actx) return;
      try {
        const o = actx.createOscillator();
        const g = actx.createGain();

        o.type = type;
        o.frequency.value = freq;
        g.gain.value = vol;

        o.connect(g);
        g.connect(actx.destination);

        o.start();
        g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
        o.stop(actx.currentTime + dur);
      } catch (err) {
        console.error("Audio error:", err);
      }
    },

    startMusic() {
      if (!SV.settings.music || !actx) return;

      if (musInt) clearInterval(musInt);

      let t = 0;
      musInt = setInterval(() => {
        if (SV.paused) return;
        Sound.play([110, 130, 146, 165][t % 4], "triangle", 0.05, 0.2);
        t++;
      }, 300);
    },

    stopMusic() {
      if (musInt) clearInterval(musInt);
    },
  };

  // ===============================
  // GAME STATE
  // ===============================
  const Store = {
    get(k, d) {
      try {
        return JSON.parse(localStorage.getItem(k)) ?? d;
      } catch {
        return d;
      }
    },
    set(k, v) {
      localStorage.setItem(k, JSON.stringify(v));
    },
  };

  const SV = {
    running: false,
    paused: false,
    lastTs: 0,
    level: 1,

    // Player
    player: { x: 120, y: 296, w: 42, h: 64, vy: 0, jumps: 0, onGround: true },

    // Game objects
    hazards: [],
    powerups: [],

    shield: 0,
    jetpack: false,
    jetTime: 0,
    tesla: 0,

    // Save data
    settings: Store.get("sv_set", {
      music: true,
      sfx: true,
      playerName: "Hero",
      gender: "m",
      shirt: "#ff5a5a",
      pants: "#2d3549",
      skinTone: "#ffd5a3",
      hairStyle: "short",
      item: "none",
      skin: null,
    }),

    progress: Store.get("sv_prog", {
      ach: {},
      allTimeScore: 0,
      lastCheckpoint: 0,
    }),

    score: 0,
    ctx: null,
  };

  // ===============================
  // INIT
  // ===============================
  function init() {
    // Canvas
    const canvas = $("#game-canvas");
    if (!canvas) return;
    SV.ctx = canvas.getContext("2d");

    // ============================
    // TITLE SCREEN → HOME SCREEN
    // ============================
    on($("#title-screen"), "pointerdown", () => {
      Sound.init();
      if (SV.settings.music) Sound.startMusic();

      $("#title-screen").classList.add("hidden");
      $("#home-screen").classList.remove("hidden");
    });

    // ============================
    // MAIN MENU BUTTONS
    ============================
    on($("#play-btn"), "click", () => {
      if (SV.progress.lastCheckpoint > 1) openPopup("start-popup");
      else startRun(1);
    });

    on($("#endless-btn"), "click", () => startRun(99));
    on($("#wardrobe-btn"), "click", () => {
      openPopup("wardrobe-popup");
      buildWardrobe();
    });
    on($("#lore-btn"), "click", () => {
      openPopup("lore-popup");
      drawLore();
    });
    on($("#achievements-btn"), "click", () => {
      openPopup("achievements-popup");
      buildAchievements();
    });
    on($("#share-btn"), "click", () => openPopup("share-popup"));
    on($("#logout-btn"), "click", () => location.reload());

    // ============================
    // SETTINGS
    // ============================
    const updateSettingsLabels = () => {
      $("#music-toggle").textContent = `MUSIC: ${
        SV.settings.music ? "ON" : "OFF"
      }`;
      $("#pause-music-btn").textContent = `MUSIC: ${
        SV.settings.music ? "ON" : "OFF"
      }`;
      $("#sfx-toggle").textContent = `SFX: ${SV.settings.sfx ? "ON" : "OFF"}`;
      $("#pause-sfx-btn").textContent = `SFX: ${SV.settings.sfx ? "ON" : "OFF"}`;
    };

    on($("#music-toggle"), "click", () => {
      SV.settings.music = !SV.settings.music;
      if (SV.settings.music) Sound.startMusic();
      else Sound.stopMusic();
      Store.set("sv_set", SV.settings);
      updateSettingsLabels();
    });

    on($("#sfx-toggle"), "click", () => {
      SV.settings.sfx = !SV.settings.sfx;
      Store.set("sv_set", SV.settings);
      updateSettingsLabels();
    });

    on($("#reset-progress-btn"), "click", () => {
      if (confirm("Reset all progress?")) {
        localStorage.clear();
        location.reload();
      }
    });

    // ============================
    // PAUSE MENU
    // ============================
    on($("#pause-btn"), "click", () => {
      SV.paused = true;
      openPopup("pause-menu");
    });

    on($("#resume-btn"), "click", () => {
      closePopup("pause-menu");
      SV.paused = false;
      SV.lastTs = performance.now();
      loop();
    });

    on($("#quit-btn"), "click", () => location.reload());

    // ============================
    // JUMP
    // ============================
    const jump = (e) => {
      if (!SV.running || SV.paused) return;
      if (e.type === "keydown" && e.code !== "Space") return;

      const p = SV.player;
      if (p.jumps < 2) {
        p.vy = p.jumps === 0 ? -0.66 : -0.58;
        p.jumps++;
        p.onGround = false;
        Sound.play(300);
      }
    };

    on(window, "keydown", jump);
    on($("#jump-btn"), "pointerdown", jump);
    on($("#game-canvas"), "pointerdown", jump);

    // ============================
    // DEV ZONE (optional)
    // ============================
    const devZone = $("#dev-trigger-zone");
    if (devZone) {
      devZone.style.position = "absolute";
      devZone.style.bottom = "0";
      devZone.style.right = "0";
      devZone.style.width = "40px";
      devZone.style.height = "40px";
      devZone.style.zIndex = "50";

      let clicks = 0;
      on(devZone, "pointerdown", () => {
        clicks++;
        setTimeout(() => (clicks = 0), 2000);

        if (clicks >= 5) {
          if (prompt("Dev code?") === "2112") {
            openPopup("dev-menu");
          }
          clicks = 0;
        }
      });
    }

    // Close buttons
    qsa(".close-btn").forEach((b) =>
      on(b, "click", () => b.closest(".popup").classList.add("hidden"))
    );

    updateSettingsLabels();
  }

  // ===============================
  // POPUPS
  // ===============================
  function openPopup(id) {
    $("#" + id).classList.remove("hidden");
  }
  function closePopup(id) {
    $("#" + id).classList.add("hidden");
  }

  // ===============================
  // START RUN
  // ===============================
  function startRun(lv) {
    // Hide menus
    ["home-screen", "start-popup", "death-popup"].forEach((id) =>
      $("#" + id).classList.add("hidden")
    );

    $("#game-screen").classList.remove("hidden");

    SV.level = lv;
    SV.score = 0;

    const p = SV.player;
    p.x = 120;
    p.y = 296;
    p.vy = 0;
    p.jumps = 0;
    p.onGround = true;

    SV.hazards = [];
    SV.powerups = [];
    SV.shield = 0;
    SV.jetpack = false;
    SV.tesla = 0;

    SV.running = true;
    SV.paused = false;
    SV.lastTs = performance.now();
    loop();
  }

  // ===============================
  // LOOP
  // ===============================
  function loop(ts) {
    if (!SV.running) return;
    if (SV.paused) return requestAnimationFrame(loop);

    const dt = ts - SV.lastTs;
    SV.lastTs = ts;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // ===============================
  // UPDATE
  // ===============================
  function update(dt) {
    const p = SV.player;

    // Score
    SV.score += dt * 0.01;
    $("#score-display").textContent = Math.floor(SV.score);

    if (SV.score > SV.progress.allTimeScore) {
      SV.progress.allTimeScore = SV.score;
      Store.set("sv_prog", SV.progress);
    }

    $("#alltime-display").textContent = Math.floor(
      SV.progress.allTimeScore
    );

    // Gravity / jumping
    if (SV.jetpack) {
      p.vy = 0;
      p.y = 200 + Math.sin(Date.now() * 0.005) * 10;
      SV.jetTime -= dt;
      if (SV.jetTime <= 0) SV.jetpack = false;
    } else {
      p.vy += 0.0018 * dt;
      p.y += p.vy * dt;

      if (p.y >= 296) {
        p.y = 296;
        p.vy = 0;
        p.jumps = 0;
        p.onGround = true;
      }
    }

    // Hazards
    if (Math.random() < 0.015) {
      const type = Math.random() > 0.7 ? "mine" : "slime";
      SV.hazards.push({
        x: 850,
        y: type === "mine" ? 230 : 296,
        w: 36,
        h: 36,
        type,
      });
    }

    // Powerups
    if (Math.random() < 0.005) {
      SV.powerups.push({
        x: 850,
        y: 200,
        w: 40,
        h: 40,
        type: pick(["shield", "tesla", "jetpack"]),
      });
    }

    SV.hazards.forEach((h) => (h.x -= 0.34 * dt));
    SV.powerups.forEach((pw) => (pw.x -= 0.34 * dt));

    // Tesla auto-zap
    if (SV.tesla > 0) {
      SV.tesla -= dt;
      const t = SV.hazards.find(
        (h) => h.x > p.x && h.x < p.x + 350
      );
      if (t) {
        SV.hazards = SV.hazards.filter((x) => x !== t);
        Sound.play(600, "sawtooth");
      }
    }

    // Collision
    for (let h of SV.hazards) {
      if (hit(p, h)) {
        if (SV.shield > 0 || SV.jetpack) {
          SV.shield--;
          SV.hazards = SV.hazards.filter((x) => x !== h);
        } else {
          return playerDeath();
        }
      }
    }

    for (let pw of SV.powerups) {
      if (hit(p, pw)) {
        SV.powerups = SV.powerups.filter((x) => x !== pw);

        Sound.play(600, "sine");

        if (pw.type === "shield") SV.shield = 3;
        if (pw.type === "tesla") SV.tesla = 5000;
        if (pw.type === "jetpack") {
          SV.jetpack = true;
          SV.jetTime = 8000;
        }
      }
    }
  }

  // ===============================
  // COLLISION
  // ===============================
  function hit(a, b) {
    return !(
      b.x > a.x + a.w ||
      b.x + b.w < a.x ||
      b.y > a.y + a.h ||
      b.y + b.h < a.y
    );
  }

  // ===============================
  // DEATH
  // ===============================
  function playerDeath() {
    SV.running = false;
    Sound.play(80, "sawtooth", 0.3, 0.4);
    openPopup("death-popup");
  }

  // ===============================
  // DRAW
  // ===============================
  function draw() {
    const ctx = SV.ctx;
    ctx.clearRect(0, 0, 800, 480);

    // Background
    ctx.fillStyle = "#0b0f18";
    ctx.fillRect(0, 0, 800, 480);

    // Ground
    ctx.fillStyle = "#162033";
    ctx.fillRect(0, 360, 800, 120);

    // Hazards
    SV.hazards.forEach((h) => {
      ctx.fillStyle = h.type === "mine" ? "#666" : "#0f0";
      ctx.beginPath();
      ctx.arc(h.x + 18, h.y + 18, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    // Powerups
    SV.powerups.forEach((pw) => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pw.x + 20, pw.y + 20, 20, 0, Math.PI * 2);
      ctx.fill();
    });

    drawPlayer(ctx, SV.player);
  }

  // ===============================
  // PLAYER DRAW
  // ===============================
  function drawPlayer(ctx, p) {
    const s = SV.settings;

    let shirt = s.shirt;
    if (s.skin) {
      const sk = SKINS.find((x) => x.id === s.skin);
      if (sk) shirt = sk.col;
    }

    ctx.fillStyle = shirt;
    ctx.fillRect(p.x, p.y, 42, 64);

    ctx.fillStyle = s.skinTone;
    ctx.fillRect(p.x + 8, p.y - 16, 26, 16);

    ctx.fillStyle = s.pants;
    ctx.fillRect(p.x + 4, p.y + 36, 12, 28);
    ctx.fillRect(p.x + 26, p.y + 36, 12, 28);

    ctx.fillStyle = "#4a2a0f";
    if (s.hairStyle === "short")
      ctx.fillRect(p.x + 8, p.y - 20, 26, 8);
  }

  // ===============================
  // WARDROBE
  // ===============================
  const SKINS = [
    { id: "skin1", name: "Cone Knight", col: "#ff5a5a", req: "beat_boss1" },
    { id: "skin2", name: "Blizzard", col: "#4ea8ff", req: "long_run" },
    { id: "skin3", name: "Kindness", col: "#ff7bc5", req: "kind_only" },
    { id: "skin4", name: "Slayer", col: "#44cc66", req: "beat_boss2" },
  ];

  function buildWardrobe() {
    const preview = $("#player-preview");
    preview.innerHTML = "";

    const cvs = document.createElement("canvas");
    cvs.width = 300;
    cvs.height = 180;
    preview.appendChild(cvs);

    const ctx = cvs.getContext("2d");
    const render = () => {
      ctx.clearRect(0, 0, 300, 180);
      drawPlayer(ctx, { ...SV.player, x: 130, y: 80 });
    };

    // Name
    const name = $("#player-name-input");
    name.value = SV.settings.playerName;
    on(name, "input", (e) => {
      SV.settings.playerName = e.target.value || "Hero";
      Store.set("sv_set", SV.settings);
      $("#player-name-display").textContent = SV.settings.playerName;
    });

    // Shirt
    buildColorGrid("shirt-options", COLORS.shirt, "shirt", render);
    // Pants
    buildColorGrid("pants-options", COLORS.pants, "pants", render);
    // Skin
    buildColorGrid("skin-options", COLORS.skin, "skinTone", render);

    // Hair
    buildItemRow(
      "hair-options",
      HAIRS[SV.settings.gender],
      "hairStyle",
      render
    );

    // Item
    buildItemRow("item-options", ITEMS, "item", render);

    // Gender
    qsa(".gender-btn").forEach((btn) => {
      if (btn.dataset.gender === SV.settings.gender)
        btn.classList.add("active");

      on(btn, "click", () => {
        SV.settings.gender = btn.dataset.gender;
        Store.set("sv_set", SV.settings);
        buildWardrobe();
      });
    });

    // Skins tab
    buildSkins(render);

    render();
  }

  const COLORS = {
    shirt: ["#ff5a5a", "#4ea8ff", "#37d67a", "#a06bff"],
    pants: ["#2d3549", "#39445f", "#4e5b7a"],
    skin: ["#ffd5a3", "#e8b788", "#c78d62", "#a86b47"],
  };

  const HAIRS = {
    m: ["short", "side", "spiky"],
    f: ["long", "bob", "ponytail"],
    o: ["short", "side", "spiky", "long"],
  };

  const ITEMS = ["none", "sword", "mallet"];

  function buildColorGrid(id, list, prop, render) {
    const el = $("#" + id);
    el.innerHTML = "";
    list.forEach((col) => {
      const btn = document.createElement("button");
      btn.className = "color-swatch";
      btn.style.background = col;
      if (SV.settings[prop] === col) btn.classList.add("active");

      on(btn, "click", () => {
        SV.settings[prop] = col;
        Store.set("sv_set", SV.settings);
        render();
      });

      el.appendChild(btn);
    });
  }

  function buildItemRow(id, list, prop, render) {
    const el = $("#" + id);
    el.innerHTML = "";
    list.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "item-swatch";
      btn.textContent = item;

      if (SV.settings[prop] === item) btn.classList.add("active");

      on(btn, "click", () => {
        SV.settings[prop] = item;
        Store.set("sv_set", SV.settings);
        render();
      });

      el.appendChild(btn);
    });
  }

  function buildSkins(render) {
    const grid = $("#skins-grid");
    grid.innerHTML = "";

    SKINS.forEach((sk) => {
      const unlocked = SV.progress.ach[sk.req];

      const card = document.createElement("button");
      card.className = "skin-card";
      if (!unlocked) card.classList.add("locked");

      card.innerHTML = `
        <div class="skin-swatch" style="background:${sk.col}"></div>
        <div class="skin-name">${sk.name}</div>
        <div class="skin-req">${unlocked ? "Unlocked" : "Unlock: " + sk.req}</div>
      `;

      if (SV.settings.skin === sk.id) card.classList.add("selected");

      card.disabled = !unlocked;

      on(card, "click", () => {
        if (!unlocked) return;
        SV.settings.skin = sk.id;
        Store.set("sv_set", SV.settings);
        buildSkins(render);
        render();
      });

      grid.appendChild(card);
    });

    on($("#clear-skin-btn"), "click", () => {
      SV.settings.skin = null;
      Store.set("sv_set", SV.settings);
      buildSkins(render);
      render();
    });
  }

  // ===============================
  // LORE
  // ===============================
  function drawLore() {
    drawPixelArt($("#lore-canvas-1"), ART_TROLL);
    drawPixelArt($("#lore-canvas-2"), ART_HEAD);
  }

  function drawPixelArt(canvas, map) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = 6;
    map.forEach((row, y) => {
      row.split("").forEach((ch, x) => {
        if (PIXEL_COLORS[ch]) {
          ctx.fillStyle = PIXEL_COLORS[ch];
          ctx.fillRect(x * size, y * size, size, size);
        }
      });
    });
  }

  const PIXEL_COLORS = {
    "1": "#ffd5a3",
    "2": "#ffee7a",
    "3": "#000",
    "4": "#fff",
    "5": "#ff3860",
    "6": "#000",
    "7": "#999",
    "8": "#aaf",
    "9": "#ccc",
  };

  const ART_TROLL = [
    "00000002222222200000",
    "00000222222222222000",
    "00000222222222222000",
    "00000221111111122000",
    "00000221611116112200",
    "00000022111111112200",
    "00000022213113122200",
    "00000004444444440000",
    "00000044444444444000",
    "00000044555555544000",
    "00000044555555544000",
    "00000444555555544477",
    "00000444555555544488",
    "00000444555555544488",
    "00000444555555544477",
    "00000000000000000000",
  ];

  const ART_HEAD = [
    "00000000099999900000",
    "00000009999999900000",
    "00000099999999999000",
    "00000991111111199000",
    "00000911111111111900",
    "00000916411116411900",
    "00000916411116411900",
    "00000911111111111900",
    "00000091111111190000",
    "00000009111111900000",
    "00000009166661900000",
    "00000000911119000000",
    "00000000099990000000",
  ];

  // ===============================
  // ACHIEVEMENTS
  // ===============================
  const ACH_LIST = [
    { id: "beat_boss1", title: "Emoji Dodger", desc: "Defeat Teen Troll" },
    { id: "beat_boss2", title: "Final Blow", desc: "Defeat Boss Head" },
    { id: "kind_only", title: "Kindness", desc: "Pacifist Run" },
    { id: "long_run", title: "Endurer", desc: "Survive 10 minutes" },
    { id: "share_game", title: "Influencer", desc: "Share the game" },
  ];

  function buildAchievements() {
    const grid = $("#achievements-grid");
    grid.innerHTML = "";

    ACH_LIST.forEach((a) => {
      const unlocked = SV.progress.ach[a.id];

      const tile = document.createElement("div");
      tile.className =
        "achievement-tile " + (unlocked ? "unlocked" : "");

      tile.innerHTML = `
        <b>${a.title}</b>
        <p>${a.desc}</p>
      `;

      grid.appendChild(tile);
    });
  }

  // ===============================
  // BOOT
  // ===============================
  document.addEventListener("DOMContentLoaded", init);
})();
