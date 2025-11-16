/* =========================================================
   SWEETARIA: VENGEANCE — HYBRID STABLE BUILD
   Clean JS — No corruption, no === errors, DOM-safe, UI synced
   Version: stable-3-0-hybrid-3
   ========================================================= */
(() => {
  'use strict';

  // ------------------------------
  // Utility Helpers
  // ------------------------------
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const $ = (id) => document.getElementById(id);
  const on = (el, evt, fn) => { if (el) el.addEventListener(evt, fn); };

  const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randRange = (a, b) => a + Math.random() * (b - a);

  // ------------------------------
  // Local Storage Wrapper
  // ------------------------------
  const Store = {
    get: (k, d) => {
      try { return JSON.parse(localStorage.getItem(k)) || d; }
      catch { return d; }
    },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };

  // ------------------------------
  // Game State
  // ------------------------------
  const SV = {
    ctx: null,
    running: false,
    paused: false,
    level: 1,
    score: 0,
    lastTs: 0,
    groundY: 360,

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
      skin: null
    }),

    progress: Store.get("sv_prog", {
      ach: {},
      jumps: 0,
      lastCheckpoint: 0,
      beatBoss1: false,
      beatBoss2: false,
      endlessUnlocked: false,
      allTimeScore: 0
    }),

    player: { x: 120, y: 296, w: 42, h: 64, vy: 0, onGround: true, jumpsUsed: 0 },
    hazards: [],
    powerups: [],
    particles: [],
    shield: 0,
    jetpack: false,
    jetpackTime: 0,
    tesla: 0,

    devClicks: 0
  };

  // ------------------------------
  // Audio System
  // ------------------------------
  let actx, musInt;

  const Sound = {
    init: () => {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx && actx.state === "suspended") actx.resume();
    },
    play: (freq, type, vol = 0.1, dur = 0.3) => {
      if (!SV.settings.sfx || !actx) return;
      try {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + dur);
      } catch (e) { console.error("Audio error:", e); }
    },
    startMusic: () => {
      if (musInt) clearInterval(musInt);
      if (!SV.settings.music || !actx) return;
      let t = 0;
      musInt = setInterval(() => {
        if (SV.paused) return;
        const seq = [110,110,130,110,165,146,130,110];
        Sound.play(seq[t % seq.length], 'triangle', 0.05, 0.2);
        t++;
      }, 250);
    },
    stopMusic: () => clearInterval(musInt)
  };

  // ------------------------------
  // Title Screen → Home Screen
  // ------------------------------
  function bindTitleScreen() {
    const title = $('#title-screen');

    const startGame = () => {
      Sound.init();
      if (SV.settings.music) Sound.startMusic();
      title.classList.add('hidden');
      $('#home-screen').classList.remove('hidden');
    };

    on(title, "pointerdown", startGame);
    on(title, "click", startGame);
  }

  // ------------------------------
  // Main Menu Buttons
  // ------------------------------
  function bindMenus() {
    on($('#play-btn'), "click", () => {
      startRun(SV.progress.lastCheckpoint > 1 ? "popup" : 1);
    });

    on($('#endless-btn'), "click", () => {
      if (SV.progress.endlessUnlocked) startRun(99);
      else alert("Unlock Endless Mode by beating Story Mode.");
    });

    on($('#wardrobe-btn'), "click", () => { openPopup("wardrobe-popup"); initWardrobe(); });
    on($('#lore-btn'), "click", () => { openPopup("lore-popup"); drawLore(); });
    on($('#achievements-btn'), "click", () => { buildAchievements(); openPopup("achievements-popup"); });
    on($('#share-btn'), "click", () => openPopup("share-popup"));
    on($('#settings-btn'), "click", () => openPopup("settings-popup"));
    on($('#logout-btn'), "click", () => location.reload());

    on($('#open-credits-btn'), "click", () => {
      closePopup("settings-popup");
      openPopup("credits-popup");
    });

    on($('#return-title-btn'), "click", () => location.reload());
  }

  // ------------------------------
  // Popup Controls
  // ------------------------------
  function openPopup(id) {
    const el = $('#' + id);
    if (el) el.classList.remove("hidden");
  }

  function closePopup(id) {
    const el = $('#' + id);
    if (el) el.classList.add("hidden");
  }

  // Close buttons
  function bindCloseButtons() {
    qsa(".close-btn").forEach(btn => {
      on(btn, "click", () => btn.closest(".popup").classList.add("hidden"));
    });
  }

  // ------------------------------
  // Start Run
  // ------------------------------
  function startRun(level) {
    if (level === "popup") {
      openPopup("start-popup");
      return;
    }

    // Hide menus
    ['home-screen', 'start-popup', 'death-popup', 'rpg-overlay']
      .forEach(id => $('#' + id)?.classList.add("hidden"));

    $('#game-screen').classList.remove("hidden");

    SV.level = level;
    SV.score = 0;

    const p = SV.player;
    p.x = 120;
    p.y = 296;
    p.vy = 0;
    p.jumpsUsed = 0;

    SV.hazards = [];
    SV.powerups = [];
    SV.shield = 0;
    SV.jetpack = false;
    SV.tesla = 0;

    $('#player-name-display').textContent = SV.settings.playerName || "Hero";

    SV.running = true;
    SV.paused = false;
    SV.lastTs = performance.now();

    loop();
  }

  // ------------------------------
  // Main Loop
  // ------------------------------
  function loop(ts) {
    if (!SV.running) return;

    if (SV.paused) {
      requestAnimationFrame(loop);
      return;
    }

    const dt = (ts - SV.lastTs) || 16;
    SV.lastTs = ts;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ------------------------------
  // Update Game State
  // ------------------------------
  function update(dt) {
    SV.score += dt * 0.01;
    $('#score-display').textContent = Math.floor(SV.score);

    if (SV.score > SV.progress.allTimeScore) {
      SV.progress.allTimeScore = SV.score;
      Store.set("sv_prog", SV.progress);
    }
    $('#alltime-display').textContent = Math.floor(SV.progress.allTimeScore);

    const p = SV.player;

    // Gravity + Jumping
    if (SV.jetpack) {
      p.vy = 0;
      p.y = 200 + Math.sin(Date.now() * 0.005) * 10;
      p.onGround = false;
      SV.jetpackTime -= dt;
      if (SV.jetpackTime <= 0) {
        SV.jetpack = false;
      }
    } else {
      p.vy += 0.0018 * dt;
      p.y += p.vy * dt;

      if (p.y >= 296) {
        p.y = 296;
        p.vy = 0;
        p.jumpsUsed = 0;
        p.onGround = true;
      }
    }

    // Spawn Hazards
    if (Math.random() < 0.015) {
      const t = Math.random() > 0.7 ? "mine" : "slime";
      SV.hazards.push({ x: 850, y: t === "mine" ? 230 : 296, w: 36, h: 36, type: t });
    }

    // Spawn Powerups
    if (Math.random() < 0.005) {
      SV.powerups.push({
        x: 850,
        y: 200,
        w: 40,
        h: 40,
        type: pick(["shield", "tesla", "jetpack"])
      });
    }

    // Move hazards
    SV.hazards.forEach(h => h.x -= 0.34 * dt);
    SV.powerups.forEach(pu => pu.x -= 0.34 * dt);

    // Tesla auto-zap
    if (SV.tesla > 0) {
      SV.tesla -= dt;
      const target = SV.hazards.find(h => h.x > p.x && h.x < p.x + 400);
      if (target) {
        SV.hazards = SV.hazards.filter(h => h !== target);
        Sound.play(600, "sawtooth", 0.1);
      }
    }

    // Hazard collisions
    SV.hazards.forEach((h, i) => {
      if (rectHit(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        if (SV.shield > 0 || SV.jetpack) {
          SV.shield--;
          SV.hazards.splice(i, 1);
        } else {
          SV.running = false;
          onPlayerDeath();
        }
      }
    });

    // Powerup collection
    SV.powerups.forEach((pw, i) => {
      if (rectHit(p.x, p.y, p.w, p.h, pw.x, pw.y, pw.w, pw.h)) {
        SV.powerups.splice(i, 1);
        Sound.play(600, "sine");

        if (pw.type === "shield") SV.shield = 3;
        if (pw.type === "tesla") SV.tesla = 5000;
        if (pw.type === "jetpack") {
          SV.jetpack = true;
          SV.jetpackTime = 8000;
        }
      }
    });
  }

  // ------------------------------
  // Collision Helper
  // ------------------------------
  function rectHit(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x2 > x1 + w1 ||
             x2 + w2 < x1 ||
             y2 > y1 + h1 ||
             y2 + h2 < y1);
  }

  // ------------------------------
  // Draw
  // ------------------------------
  function draw() {
    const ctx = SV.ctx;
    ctx.clearRect(0, 0, 800, 480);

    // Background
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 800, 480);

    // Ground
    ctx.fillStyle = "#1a2435";
    ctx.fillRect(0, 360, 800, 120);

    // Hazards
    SV.hazards.forEach(h => {
      ctx.fillStyle = h.type === "mine" ? "#555" : "#0f0";
      ctx.beginPath();
      ctx.arc(h.x + 18, h.y + 18, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    // Powerups
    SV.powerups.forEach(p => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x + 20, p.y + 20, 20, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player
    drawPlayerSprite(ctx, SV.player.x, SV.player.y);

    // Tesla beam
    if (SV.tesla > 0) {
      const t = SV.hazards.find(h => h.x > SV.player.x && h.x < SV.player.x + 400);
      if (t) {
        ctx.strokeStyle = "#0ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(SV.player.x + 20, SV.player.y + 30);
        ctx.lineTo(t.x + 18, t.y + 18);
        ctx.stroke();
      }
    }
  }

  // ------------------------------
  // Draw Player
  // ------------------------------
  function drawPlayerSprite(ctx, x, y) {
    const s = SV.settings;

    ctx.fillStyle = s.shirt;
    ctx.fillRect(x, y, 42, 64);

    ctx.fillStyle = s.skinTone;
    ctx.fillRect(x + 8, y - 16, 26, 16);

    ctx.fillStyle = s.pants;
    ctx.fillRect(x + 4, y + 36, 12, 28);
    ctx.fillRect(x + 26, y + 36, 12, 28);

    if (s.hairStyle === "short") {
      ctx.fillStyle = "#70421b";
      ctx.fillRect(x + 8, y - 20, 26, 8);
    }
  }

  // ------------------------------
  // Player Death
  // ------------------------------
  function onPlayerDeath() {
    Sound.play(60, "sawtooth", 0.5);
    award("die_lot");
    openPopup("death-popup");
  }

  // ------------------------------
  // Jump Handling
  // ------------------------------
  function bindJump() {
    const jump = (e) => {
      if (!SV.running || SV.paused) return;
      if (e.type === "keydown" && e.code !== "Space") return;

      e.preventDefault();
      const p = SV.player;

      if (p.jumpsUsed < 2) {
        p.vy = p.jumpsUsed === 0 ? -0.66 : -0.58;
        p.jumpsUsed++;
        p.onGround = false;
        Sound.play(300, "square", 0.1);
      }
    };

    on($('#jump-btn'), "pointerdown", jump);
    on($('#game-canvas'), "pointerdown", jump);
    on(window, "keydown", jump);
  }

  // ------------------------------
  // Dev Menu Trigger
  // ------------------------------
  function bindDevMenu() {
    const zone = $('#dev-trigger-zone');
    on(zone, "pointerdown", () => {
      SV.devClicks++;
      setTimeout(() => SV.devClicks = 0, 2000);

      if (SV.devClicks >= 5) {
        if (prompt("Developer Code:") === "2112") {
          openPopup("dev-menu");
          award("secret_dev");
        }
        SV.devClicks = 0;
      }
    });

    qsa('#dev-menu .dev-btn').forEach(btn => {
      on(btn, "click", () => {
        const lv = parseInt(btn.dataset.level, 10);
        closePopup("dev-menu");
        SV.running = false;
        startRun(lv);
      });
    });

    qsa('#dev-menu [data-power]').forEach(btn => {
      on(btn, "click", () => {
        const p = btn.dataset.power;
        if (p === "shield") SV.shield = 3;
        if (p === "tesla") SV.tesla = 5000;
        if (p === "jetpack") { SV.jetpack = true; SV.jetpackTime = 8000; }
        closePopup("dev-menu");
      });
    });
  }

  // ------------------------------
  // Wardrobe
  // ------------------------------
  function initWardrobe() {
    const cvs = document.createElement("canvas");
    cvs.width = 300; cvs.height = 180;

    const preview = $('#player-preview');
    preview.innerHTML = "";
    preview.appendChild(cvs);

    const ctx = cvs.getContext("2d");

    const render = () => {
      ctx.clearRect(0, 0, 300, 180);
      drawPlayerSprite(ctx, 130, 80);
    };
    render();

    // Name
    const nameInput = $('#player-name-input');
    if (nameInput) {
      nameInput.value = SV.settings.playerName;
      on(nameInput, "input", e => {
        SV.settings.playerName = e.target.value || "Hero";
        Store.set("sv_set", SV.settings);
      });
    }

    // Tabs
    qsa(".wardrobe-tab").forEach(tab => {
      on(tab, "click", () => {
        qsa(".wardrobe-tab").forEach(t => t.classList.remove("active"));
        qsa(".wardrobe-content").forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        $('#' + tab.dataset.tab).classList.add("active");
      });
    });

    // Build color swatches
    const COLORS = {
      shirt: ['#ff5a5a','#4ea8ff','#37d67a','#a06bff','#ff8d3b','#17c5b6'],
      pants: ['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'],
      skin:  ['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f']
    };

    const ITEMS = ['none','sword','scepter','mallet','cleaver'];
    const HAIRS = {
      m: ['short','side','spiky'],
      f: ['bob','long','ponytail'],
      o: ['short','side','spiky','bob','long','ponytail','mohawk']
    };

    function build(arr, id, prop, isColor) {
      const row = $('#' + id);
      row.innerHTML = '';
      arr.forEach(val => {
        const btn = document.createElement("button");
        btn.className = isColor ? "color-swatch" : "item-swatch";
        if (isColor) btn.style.background = val;
        else btn.textContent = val;

        if (SV.settings[prop] === val) btn.classList.add("active");

        on(btn, "click", () => {
          SV.settings[prop] = val;
          if (prop === "shirt") SV.settings.skin = null;
          Store.set("sv_set", SV.settings);
          render();
          build(arr, id, prop, isColor); // refresh selection highlight
        });

        row.appendChild(btn);
      });
    }

    // Appearance options
    build(COLORS.shirt, 'shirt-options', 'shirt', true);
    build(COLORS.pants, 'pants-options', 'pants', true);
    build(COLORS.skin,  'skin-options',  'skinTone', true);
    build(ITEMS, 'item-options', 'item', false);

    // Gender + hair refresh
    function refreshHair() {
      build(HAIRS[SV.settings.gender], 'hair-options', 'hairStyle', false);
    }
    refreshHair();

    qsa(".gender-btn").forEach(btn => {
      if (SV.settings.gender === btn.dataset.gender) btn.classList.add("active");
      on(btn, "click", () => {
        SV.settings.gender = btn.dataset.gender;
        Store.set("sv_set", SV.settings);
        refreshHair();
        render();
        qsa(".gender-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Skins system
    const SKINS = [
      {id:'skin1',name:'Cone Knight',req:'beat_boss1',col:'#ff5a5a',rarity:'rare'},
      {id:'skin2',name:'Blizzard',req:'long_run',col:'#4e9cff',rarity:'rare'},
      {id:'skin3',name:'Kindness',req:'kind_only',col:'#ff7bc5',rarity:'epic'},
      {id:'skin4',name:'Slayer',req:'beat_boss2',col:'#3ba55d',rarity:'epic'},
      {id:'skin5',name:'Socialite',req:'share_game',col:'#ffd700',rarity:'legendary'}
    ];

    const grid = $('#skins-grid');
    const clearBtn = $('#clear-skin-btn');

    function rebuildSkins() {
      grid.innerHTML = "";
      SKINS.forEach(skin => {
        const unlocked = !!SV.progress.ach[skin.req];

        const card = document.createElement("button");
        card.className = "skin-card " + skin.rarity;
        if (!unlocked) card.classList.add("locked");
        if (SV.settings.skin === skin.id) card.classList.add("selected");

        card.innerHTML = `
          <div class="skin-swatch" style="background:${skin.col};"></div>
          <div class="skin-name">${skin.name}</div>
          <div class="skin-req">${unlocked ? "Unlocked" : ("Unlock: " + skin.req)}</div>
        `;

        card.disabled = !unlocked;

        on(card, "click", () => {
          SV.settings.skin = skin.id;
          Store.set("sv_set", SV.settings);
          rebuildSkins();
          render();
        });

        grid.appendChild(card);
      });
    }

    if (clearBtn) {
      on(clearBtn, "click", () => {
        SV.settings.skin = null;
        Store.set("sv_set", SV.settings);
        rebuildSkins();
        render();
      });
    }

    rebuildSkins();
  }

  // ------------------------------
  // Lore Canvas Drawing
  // ------------------------------
  function drawLore() {
    const ART = {
      troll: [
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
        "00000000000000000000"
      ],
      head: [
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
        "00000000099990000000"
      ],
      colors: {
        "1": "#ffd5a3", "2": "#ffee7a", "3": "#000",
        "4": "#fff", "5": "#ff3860", "6": "#000",
        "7": "#999", "8": "#aaf", "9": "#ccc"
      }
    };

    function drawPixel(ctx, map, size) {
      map.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          const col = ART.colors[ch];
          if (col) {
            ctx.fillStyle = col;
            ctx.fillRect(x * size, y * size, size, size);
          }
        });
      });
    }

    const c1 = $('#lore-canvas-1');
    if (c1) {
      const ctx = c1.getContext("2d");
      ctx.clearRect(0, 0, 128, 128);
      drawPixel(ctx, ART.troll, 6);
    }

    const c2 = $('#lore-canvas-2');
    if (c2) {
      const ctx = c2.getContext("2d");
      ctx.clearRect(0, 0, 128, 128);
      drawPixel(ctx, ART.head, 6);
    }
  }

  // ------------------------------
  // Achievements
  // ------------------------------
  function buildAchievements() {
    const ACH = [
      {id:'beat_boss1',title:'Emoji Dodger',desc:'Defeat Teen Troll'},
      {id:'beat_boss2',title:'Final Blow',desc:'Defeat Boss Head'},
      {id:'kind_only',title:'Kindness',desc:'Pacifist Run'},
      {id:'share_game',title:'Influencer',desc:'Share the game'},
      {id:'long_run',title:'Endurer',desc:'Survive 10m'},
      {id:'die_lot',title:'Glutton',desc:'Die 10 times'},
      {id:'secret_dev',title:'The 2112',desc:'Find Dev Menu'}
    ];

    const grid = $('#achievements-grid');
    grid.innerHTML = "";

    ACH.forEach(a => {
      const tile = document.createElement("div");
      tile.className = "achievement-tile" +
                       (SV.progress.ach[a.id] ? " unlocked" : "");
      tile.innerHTML = `<b>${a.title}</b><br><small>${a.desc}</small>`;
      grid.appendChild(tile);
    });
  }

  function award(id) {
    if (!SV.progress.ach[id]) {
      SV.progress.ach[id] = true;
      Store.set("sv_prog", SV.progress);
    }
  }

  // ------------------------------
  // SETUP
  // ------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const cvs = $('#game-canvas');
    SV.ctx = cvs.getContext("2d");

    bindTitleScreen();
    bindMenus();
    bindCloseButtons();
    bindJump();
    bindDevMenu();

    // Start-popup Continue/Restart
    on($('#start-at-last'), "click", () => {
      closePopup("start-popup");
      startRun(SV.progress.lastCheckpoint || 1);
    });
    on($('#start-beginning'), "click", () => {
      closePopup("start-popup");
      startRun(1);
    });

    // Pause menu
    on($('#pause-btn'), "click", () => {
      SV.paused = true;
      openPopup("pause-menu");
    });
    on($('#resume-btn'), "click", () => {
      closePopup("pause-menu");
      SV.paused = false;
      SV.lastTs = performance.now();
      loop();
    });
    on($('#quit-btn'), "click", () => location.reload());
    on($('#pause-music-btn'), "click", () => {
      SV.settings.music = !SV.settings.music;
      Store.set("sv_set", SV.settings);
      SV.settings.music ? Sound.startMusic() : Sound.stopMusic();
    });
    on($('#pause-sfx-btn'), "click", () => {
      SV.settings.sfx = !SV.settings.sfx;
      Store.set("sv_set", SV.settings);
    });

    // Share Button
    on($('#copy-share-btn'), "click", () => {
      navigator.clipboard.writeText($('#share-link').value);
      alert("Link copied! Achievement unlocked.");
      award("share_game");
    });

    // Reset Progress
    on($('#reset-progress-btn'), "click", () => {
      if (confirm("Really reset all progress?")) {
        localStorage.clear();
        location.reload();
      }
    });
  });

})();
