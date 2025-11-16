/* =========================================================
   SWEETARIA: VENGEANCE — UI OVERHAUL BUILD (Matched)
   - Title -> Home -> Game flow
   - Menu buttons wired to popups & game
   - Lore compendium, Wardrobe, Achievements, Share
   - Simple endless runner core
========================================================= */
(() => {
  'use strict';

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const $ = (id) => document.getElementById(id);

  // --- Storage helper ---
  const Store = {
    get(key, def) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : def;
      } catch {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {
        console.warn('Store failed', e);
      }
    }
  };

  // --- Game state ---
  const SV = {
    settings: Store.get('sv_settings', {
      playerName: 'Hero',
      gender: 'm',
      shirt: '#ff5a5a',
      pants: '#2d3549',
      skinTone: '#ffd5a3',
      hairStyle: 'short',
      item: 'none',
      skin: null
    }),
    progress: Store.get('sv_progress', {
      ach: {},
      lastCheckpoint: 0,
      allTimeScore: 0
    }),
    running: false,
    paused: false,
    level: 1,
    score: 0,
    lastTs: 0,
    player: { x: 120, y: 296, w: 42, h: 64, vy: 0, onGround: true, jumpsUsed: 0 },
    hazards: [],
    powerups: [],
    shield: 0,
    jetpack: false,
    tesla: 0,
    ctx: null
  };

  const COLORS = {
    shirt: ['#ff5a5a', '#4ea8ff', '#37d67a', '#a06bff', '#ff8d3b', '#17c5b6'],
    pants: ['#2d3549', '#39445f', '#4e5b7a', '#273244', '#1f2738'],
    skin: ['#ffd5a3', '#e8b788', '#c78d62', '#a86b47', '#7f4d30', '#5e391f']
  };
  const ITEMS = ['none', 'sword', 'scepter', 'mallet', 'cleaver'];

  const ACHIEVEMENTS = [
    { id: 'share_game', title: 'Influencer', desc: 'Share the game' },
    { id: 'long_run', title: 'Endurer', desc: 'Survive a long run' },
    { id: 'die_lot', title: 'Glutton', desc: 'Die many times' }
  ];

  const HAIRS = {
    m: ['short', 'side', 'spiky'],
    f: ['bob', 'long', 'ponytail'],
    o: ['short', 'side', 'spiky', 'bob', 'long', 'ponytail', 'mohawk']
  };

  // POPUPS
  function openPopup(id) {
    const el = $('#' + id);
    if (!el) return;
    el.classList.remove('hidden');
    document.body.classList.add('popup-open');
  }

  function closePopup(idOrEl) {
    const el = typeof idOrEl === 'string' ? $('#' + idOrEl) : idOrEl;
    if (!el) return;
    el.classList.add('hidden');
    const anyOpen = qsa('.popup').some(p => !p.classList.contains('hidden'));
    if (!anyOpen) document.body.classList.remove('popup-open');
  }

  function init() {
    const canvas = $('#game-canvas');
    if (!canvas) return;
    SV.ctx = canvas.getContext('2d');

    // Share link defaults to current URL
    const shareInput = $('#share-link');
    if (shareInput) {
      shareInput.value = window.location.href;
    }

    // Title -> Home
    const titleScreen = $('#title-screen');
    if (titleScreen) {
      titleScreen.addEventListener('click', () => {
        titleScreen.classList.add('hidden');
        const home = $('#home-screen');
        if (home) home.classList.remove('hidden');
      });
    }

    // Home -> Game Start popup
    const playBtn = $('#play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => openPopup('game-start-popup'));
    }

    // Endless button (simple: start endless as level 99)
    const endlessBtn = $('#endless-btn');
    if (endlessBtn) {
      endlessBtn.addEventListener('click', () => {
        closePopup('game-start-popup');
        startRun(99);
      });
    }

    // Start popup buttons
    const startLast = $('#start-at-last');
    if (startLast) {
      startLast.addEventListener('click', () => {
        closePopup('game-start-popup');
        startRun(SV.progress.lastCheckpoint || 1);
      });
    }

    const startBeginning = $('#start-beginning');
    if (startBeginning) {
      startBeginning.addEventListener('click', () => {
        closePopup('game-start-popup');
        startRun(1);
      });
    }

    // Wardrobe
    const wardrobeBtn = $('#wardrobe-btn');
    if (wardrobeBtn) {
      wardrobeBtn.addEventListener('click', () => {
        openPopup('wardrobe-popup');
        initWardrobe();
      });
    }

    // Lore
    const loreBtn = $('#lore-btn');
    if (loreBtn) {
      loreBtn.addEventListener('click', () => openPopup('lore-popup'));
    }

    // Clues (placeholder, just opens the popup)
    const cluesBtn = $('#clues-btn');
    if (cluesBtn) {
      cluesBtn.addEventListener('click', () => openPopup('clues-popup'));
    }

    // Achievements
    const achBtn = $('#achievements-btn');
    if (achBtn) {
      achBtn.addEventListener('click', () => {
        buildAchievements();
        openPopup('achievements-popup');
      });
    }

    // Share
    const shareBtn = $('#share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => openPopup('share-popup'));
    }

    const copyShareBtn = $('#copy-share-btn');
    if (copyShareBtn) {
      copyShareBtn.addEventListener('click', () => {
        if (!shareInput) return;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareInput.value);
          alert('Link copied!');
          award('share_game');
        }
      });
    }

    // Return to title simply reloads
    const returnTitleBtn = $('#return-title-btn');
    if (returnTitleBtn) {
      returnTitleBtn.addEventListener('click', () => window.location.reload());
    }

    // Death popup buttons
    const deathRestart = $('#death-restart-checkpoint');
    if (deathRestart) {
      deathRestart.addEventListener('click', () => {
        closePopup('death-popup');
        startRun(SV.progress.lastCheckpoint || 1);
      });
    }

    const deathExit = $('#death-exit-main');
    if (deathExit) {
      deathExit.addEventListener('click', () => {
        closePopup('death-popup');
        const home = $('#home-screen');
        if (home) home.classList.remove('hidden');
      });
    }

    // Pause (simple toggle, no dedicated pause popup)
    const pauseBtn = $('#pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        SV.paused = !SV.paused;
        if (!SV.paused) {
          SV.lastTs = performance.now();
          requestAnimationFrame(loop);
        }
      });
    }

    // Popup close buttons
    qsa('.popup-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.popup;
        if (id) closePopup(id);
      });
    });

    // Jump controls
    const jumpFn = (e) => {
      if (!SV.running || SV.paused) return;
      if (e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      const p = SV.player;
      if (p.jumpsUsed < 2) {
        p.vy = p.jumpsUsed === 0 ? -0.66 : -0.58;
        p.jumpsUsed++;
        p.onGround = false;
      }
    };

    const jumpBtn = $('#jump-btn');
    if (jumpBtn) jumpBtn.onpointerdown = jumpFn;
    window.addEventListener('keydown', jumpFn);
    canvas.onpointerdown = jumpFn;

    // Initialize HUD name
    const hudName = $('#hud-name');
    if (hudName) hudName.textContent = `Name: ${SV.settings.playerName}`;

    updateHUD();
  }

  // --- Start Run ---
  function startRun(level) {
    SV.level = level;
    SV.score = 0;
    SV.running = true;
    SV.paused = false;
    SV.player.x = 120;
    SV.player.y = 296;
    SV.player.vy = 0;
    SV.player.jumpsUsed = 0;
    SV.hazards = [];
    SV.powerups = [];
    SV.shield = 0;
    SV.jetpack = false;
    SV.tesla = 0;

    const home = $('#home-screen');
    const game = $('#game-screen');
    if (home) home.classList.add('hidden');
    if (game) game.classList.remove('hidden');

    SV.lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  // --- Main Loop ---
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

  // --- Update ---
  function update(dt) {
    const p = SV.player;

    // Score
    SV.score += dt * 0.01;
    if (SV.score > (SV.progress.allTimeScore || 0)) {
      SV.progress.allTimeScore = SV.score;
      Store.set('sv_progress', SV.progress);
    }
    updateHUD();

    // Gravity
    p.vy += 0.0018 * dt;
    p.y += p.vy * dt;
    if (p.y >= 296) {
      p.y = 296;
      p.vy = 0;
      p.jumpsUsed = 0;
      p.onGround = true;
    }

    // Spawn hazards
    if (Math.random() < 0.015) {
      const isMine = Math.random() > 0.7;
      SV.hazards.push({
        x: 850,
        y: isMine ? 230 : 296,
        w: 36,
        h: 36,
        type: isMine ? 'mine' : 'slime'
      });
    }

    // Move hazards
    SV.hazards.forEach(h => {
      h.x -= 0.34 * dt;
    });

    // Remove off-screen hazards
    SV.hazards = SV.hazards.filter(h => h.x + h.w > 0);

    // Collision
    SV.hazards.forEach((h, i) => {
      if (rectHit(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        // no shield yet, just die
        SV.running = false;
        onDeath();
      }
    });
  }

  function onDeath() {
    award('die_lot');
    openPopup('death-popup');
  }

  function rectHit(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(
      x2 > x1 + w1 ||
      x2 + w2 < x1 ||
      y2 > y1 + h1 ||
      y2 + h2 < y1
    );
  }

  // --- Draw ---
  function draw() {
    const ctx = SV.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, 800, 480);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 800, 480);

    // Ground
    ctx.fillStyle = '#1a2435';
    ctx.fillRect(0, 360, 800, 120);

    // Hazards
    SV.hazards.forEach(h => {
      if (h.type === 'mine') {
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(h.x + 18, h.y + 18, 18, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(h.x + 18, h.y + 18, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Player
    drawPlayerSprite(ctx, SV.player.x, SV.player.y);
  }

  function drawPlayerSprite(ctx, x, y) {
    const s = SV.settings;

    // body
    ctx.fillStyle = s.shirt;
    ctx.fillRect(x, y, 42, 64);

    // head
    ctx.fillStyle = s.skinTone;
    ctx.fillRect(x + 8, y - 16, 26, 16);

    // legs
    ctx.fillStyle = s.pants;
    ctx.fillRect(x + 4, y + 36, 12, 28);
    ctx.fillRect(x + 26, y + 36, 12, 28);

    // hair
    ctx.fillStyle = '#70421b';
    if (s.hairStyle === 'short') {
      ctx.fillRect(x + 8, y - 20, 26, 8);
    }
  }

  // --- HUD ---
  function updateHUD() {
    const hudName = $('#hud-name');
    const hudLevel = $('#hud-level');
    const hudScore = $('#hud-score');
    const hudBest = $('#hud-best');

    if (hudName) hudName.textContent = `Name: ${SV.settings.playerName}`;
    if (hudLevel) hudLevel.textContent = `Level: ${SV.level}`;
    if (hudScore) hudScore.textContent = `Score: ${Math.floor(SV.score)}`;
    if (hudBest) hudBest.textContent = `Best: ${Math.floor(SV.progress.allTimeScore || 0)}`;
  }

  // --- Wardrobe ---
  function initWardrobe() {
    const preview = $('#player-preview');
    if (!preview) return;

    const cvs = document.createElement('canvas');
    cvs.width = 300;
    cvs.height = 180;
    preview.innerHTML = '';
    preview.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    const render = () => {
      ctx.clearRect(0, 0, 300, 180);
      drawPlayerSprite(ctx, 130, 80);
    };

    const nameInput = $('#player-name-input');
    if (nameInput) {
      nameInput.value = SV.settings.playerName;
      nameInput.onchange = (e) => {
        SV.settings.playerName = e.target.value || 'Hero';
        Store.set('sv_settings', SV.settings);
        updateHUD();
        render();
      };
    }

    // Gender buttons
    const genderRow = $('#gender-options');
    if (genderRow) {
      genderRow.innerHTML = '';
      ['m', 'f', 'o'].forEach(g => {
        const b = document.createElement('button');
        b.textContent = g.toUpperCase();
        b.className = 'item-swatch';
        if (SV.settings.gender === g) b.classList.add('active');
        b.onclick = () => {
          SV.settings.gender = g;
          Store.set('sv_settings', SV.settings);
          buildHair();
          render();
          qsa('#gender-options .item-swatch').forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
        };
        genderRow.appendChild(b);
      });
    }

    // Helper to build color options
    const buildColorRow = (arr, id, prop) => {
      const row = $('#' + id);
      if (!row) return;
      row.innerHTML = '';
      arr.forEach(col => {
        const b = document.createElement('button');
        b.className = 'color-swatch';
        b.style.background = col;
        if (SV.settings[prop] === col) b.classList.add('active');
        b.onclick = () => {
          SV.settings[prop] = col;
          Store.set('sv_settings', SV.settings);
          qsa('#' + id + ' .color-swatch').forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
          render();
        };
        row.appendChild(b);
      });
    };

    const buildItems = () => {
      const row = $('#item-options');
      if (!row) return;
      row.innerHTML = '';
      ITEMS.forEach(it => {
        const b = document.createElement('button');
        b.className = 'item-swatch';
        b.textContent = it;
        if (SV.settings.item === it) b.classList.add('active');
        b.onclick = () => {
          SV.settings.item = it;
          Store.set('sv_settings', SV.settings);
          qsa('#item-options .item-swatch').forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
          render();
        };
        row.appendChild(b);
      });
    };

    const buildHair = () => {
      const row = $('#hair-options');
      if (!row) return;
      row.innerHTML = '';
      const hairList = HAIRS[SV.settings.gender] || HAIRS.o;
      hairList.forEach(style => {
        const b = document.createElement('button');
        b.className = 'item-swatch';
        b.textContent = style;
        if (SV.settings.hairStyle === style) b.classList.add('active');
        b.onclick = () => {
          SV.settings.hairStyle = style;
          Store.set('sv_settings', SV.settings);
          qsa('#hair-options .item-swatch').forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
          render();
        };
        row.appendChild(b);
      });
    };

    // Tabs
    qsa('.wardrobe-tab').forEach(tab => {
      tab.onclick = () => {
        qsa('.wardrobe-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.dataset.tab;
        qsa('.wardrobe-section').forEach(sec => sec.classList.remove('active'));
        const target = $('#' + targetId);
        if (target) target.classList.add('active');
      };
    });

    // Clear skin
    const clearSkinBtn = $('#clear-skin-btn');
    if (clearSkinBtn) {
      clearSkinBtn.onclick = () => {
        SV.settings.skin = null;
        Store.set('sv_settings', SV.settings);
        render();
      };
    }

    // Build all controls
    buildColorRow(COLORS.shirt, 'shirt-options', 'shirt');
    buildColorRow(COLORS.pants, 'pants-options', 'pants');
    buildColorRow(COLORS.skin, 'skin-options', 'skinTone');
    buildItems();
    buildHair();
    render();
  }

  // --- Achievements ---
  function buildAchievements() {
    const container = $('#achievement-list');
    if (!container) return;
    container.innerHTML = '';
    const have = SV.progress.ach || {};
    ACHIEVEMENTS.forEach(a => {
      const d = document.createElement('div');
      d.className = 'achievement-tile' + (have[a.id] ? ' unlocked' : '');
      d.innerHTML = '<b>' + a.title + '</b><br><small>' + a.desc + '</small>';
      container.appendChild(d);
    });
  }

  function award(id) {
    if (!SV.progress.ach[id]) {
      SV.progress.ach[id] = true;
      Store.set('sv_progress', SV.progress);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
