/* =========================================================
   SWEETARIA: VENGEANCE — BETA 2.1 (UI Harmony)
   - Based on BETA 2.0 "Full Restoration - Corrected"
   - Updated to match new HTML/CSS:
     * Uses .popup-close
     * Uses global .popup + body.popup-open
     * Safe bindings if some elements/IDs are missing
   ========================================================= */
(() => {
  'use strict';

  // --- UTILS ---
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
  const randRange = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const $ = (id) => document.getElementById(id);

  // --- AUDIO ---
  let actx, musInt;
  const Sound = {
    init: () => {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (!actx) return;
      if (actx.state === 'suspended') actx.resume();
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
        o.connect(g);
        g.connect(actx.destination);
        o.start();
        o.stop(actx.currentTime + dur);
      } catch (e) {
        console.error('Audio Err:', e);
      }
    },
    startMusic: () => {
      if (musInt) clearInterval(musInt);
      if (!SV.settings.music || !actx) return;
      let t = 0;
      musInt = setInterval(() => {
        if (SV.paused) return;
        const freq = [110, 110, 130, 110, 165, 146, 130, 110][t % 8];
        Sound.play(freq, 'triangle', 0.05, 0.2);
        t++;
      }, 250);
    },
    stopMusic: () => {
      if (musInt) clearInterval(musInt);
    }
  };

  // --- PIXEL ART ---
  const ART = {
    troll: [
      '00000002222222200000',
      '00000222222222222000',
      '00000222222222222000',
      '00000221111111122000',
      '00000221611116112200',
      '00000022111111112200',
      '00000022213113122200',
      '00000004444444440000',
      '00000044444444444000',
      '00000044555555544000',
      '00000044555555544000',
      '00000444555555544477',
      '00000444555555544488',
      '00000444555555544488',
      '00000444555555544477',
      '00000000000000000000'
    ],
    head: [
      '00000000099999900000',
      '00000009999999900000',
      '00000099999999999000',
      '00000991111111199000',
      '00000911111111111900',
      '00000916411116411900',
      '00000916411116411900',
      '00000911111111111900',
      '00000091111111190000',
      '00000009111111900000',
      '00000009166661900000',
      '00000000911119000000',
      '00000000099990000000'
    ],
    colors: {
      '1': '#ffd5a3',
      '2': '#ffee7a',
      '3': '#000000',
      '4': '#ffffff',
      '5': '#ff3860',
      '6': '#000000',
      '7': '#999999',
      '8': '#aaaaff',
      '9': '#cccccc'
    }
  };

  // --- DATA ---
  const COLORS = {
    shirt: ['#ff5a5a', '#4ea8ff', '#37d67a', '#a06bff', '#ff8d3b', '#17c5b6'],
    pants: ['#2d3549', '#39445f', '#4e5b7a', '#273244', '#1f2738'],
    skin: ['#ffd5a3', '#e8b788', '#c78d62', '#a86b47', '#7f4d30', '#5e391f']
  };
  const ITEMS = ['none', 'sword', 'scepter', 'mallet', 'cleaver'];
  const HAIRS = {
    m: ['short', 'side', 'spiky'],
    f: ['bob', 'long', 'ponytail'],
    o: ['short', 'side', 'spiky', 'bob', 'long', 'ponytail', 'mohawk']
  };

  const SKINS = [
    { id: 'skin1', name: 'Cone Knight', req: 'beat_boss1', col: '#ff5a5a', rarity: 'rare' },
    { id: 'skin2', name: 'Blizzard', req: 'long_run', col: '#4e9cff', rarity: 'rare' },
    { id: 'skin3', name: 'Kindness', req: 'kind_only', col: '#ff7bc5', rarity: 'epic' },
    { id: 'skin4', name: 'Slayer', req: 'beat_boss2', col: '#3ba55d', rarity: 'epic' },
    { id: 'skin5', name: 'Socialite', req: 'share_game', col: '#ffd700', rarity: 'legendary' }
  ];

  const ACHIEVEMENTS = [
    { id: 'beat_boss1', title: 'Emoji Dodger', desc: 'Defeat Teen Troll' },
    { id: 'beat_boss2', title: 'Final Blow', desc: 'Defeat Boss Head' },
    { id: 'kind_only', title: 'Kindness', desc: 'Pacifist Run' },
    { id: 'share_game', title: 'Influencer', desc: 'Share the game' },
    { id: 'long_run', title: 'Endurer', desc: 'Survive 10m' },
    { id: 'die_lot', title: 'Glutton', desc: 'Die 10 times' },
    { id: 'secret_dev', title: 'The 2112', desc: 'Find Dev Menu' }
  ];

  // --- STATE & STORAGE ---
  const Store = {
    get: (k, d) => {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        console.warn('Store set failed', e);
      }
    }
  };

  const SV = {
    settings: Store.get('sv_set', {
      music: true,
      sfx: true,
      playerName: 'Hero',
      gender: 'm',
      shirt: '#ff5a5a',
      pants: '#2d3549',
      skinTone: '#ffd5a3',
      hairStyle: 'short',
      item: 'none',
      skin: null
    }),
    progress: Store.get('sv_prog', {
      ach: {},
      jumps: 0,
      lastCheckpoint: 0,
      beatBoss1: false,
      beatBoss2: false,
      endlessUnlocked: false,
      allTimeScore: 0
    }),
    running: false,
    paused: false,
    level: 1,
    score: 0,
    lastTs: 0,
    groundY: 360,
    player: { x: 120, y: 296, w: 42, h: 64, vy: 0, onGround: true, jumpsUsed: 0 },
    hazards: [],
    powerups: [],
    particles: [],
    shield: 0,
    jetpack: false,
    tesla: 0,
    jetpackTime: 0,
    boss1: { active: false, hp: 1, y: 200, anim: 0, quote: '', quoteTimer: 0, dodged: 0 },
    rpg: { active: false, hp: 100, max: 100 },
    devClicks: 0,
    ctx: null
  };

  // --- POPUP HELPERS (updated to match CSS/HTML) ---
  function openPopup(idOrEl) {
    const el = typeof idOrEl === 'string' ? $('#' + idOrEl) : idOrEl;
    if (!el) return;
    el.classList.remove('hidden');
    document.body.classList.add('popup-open');
  }

  function closePopup(idOrEl) {
    const el = typeof idOrEl === 'string' ? $('#' + idOrEl) : idOrEl;
    if (!el) return;
    el.classList.add('hidden');

    // If no visible popups remain, unlock body scroll
    const anyOpen = qsa('.popup').some(p => !p.classList.contains('hidden'));
    if (!anyOpen) {
      document.body.classList.remove('popup-open');
    }
  }

  // --- INIT ---
  function init() {
    const cvs = qs('#game-canvas');
    if (!cvs) return;
    SV.ctx = cvs.getContext('2d');

    // TITLE -> HOME
    const titleScreen = qs('#title-screen');
    if (titleScreen) {
      titleScreen.onclick = () => {
        Sound.init();
        if (SV.settings.music) Sound.startMusic();
        titleScreen.classList.add('hidden');
        const home = qs('#home-screen');
        if (home) home.classList.remove('hidden');
      };
    }

    // MAIN MENU BUTTONS (all guarded)
    const playBtn = qs('#play-btn');
    if (playBtn) {
      playBtn.onclick = () =>
        startRun(SV.progress.lastCheckpoint > 1 ? 'popup' : 1);
    }

    const endlessBtn = qs('#endless-btn');
    if (endlessBtn) {
      endlessBtn.onclick = () => {
        if (SV.progress.endlessUnlocked) startRun(99);
        else alert('Beat Story Mode to unlock.');
      };
    }

    const wardrobeBtn = qs('#wardrobe-btn');
    if (wardrobeBtn) {
      wardrobeBtn.onclick = () => {
        openPopup('wardrobe-popup');
        initWardrobe();
      };
    }

    const loreBtn = qs('#lore-btn');
    if (loreBtn) {
      loreBtn.onclick = () => {
        openPopup('lore-popup');
        drawLore();
      };
    }

    const achBtn = qs('#achievements-btn');
    if (achBtn) {
      achBtn.onclick = () => {
        buildAch();
        openPopup('achievements-popup');
      };
    }

    const shareBtn = qs('#share-btn');
    if (shareBtn) {
      shareBtn.onclick = () => openPopup('share-popup');
    }

    const settingsBtn = qs('#settings-btn') || qs('#settings-icon');
    if (settingsBtn) {
      settingsBtn.onclick = () => openPopup('settings-popup');
    }

    const returnTitleBtn = qs('#return-title-btn');
    if (returnTitleBtn) {
      returnTitleBtn.onclick = () => location.reload();
    }

    // Optional CLUES menu if you add it
    const cluesBtn = qs('#clues-btn');
    if (cluesBtn) {
      cluesBtn.onclick = () => openPopup('clues-popup');
    }

    // SHARE
    const copyShareBtn = qs('#copy-share-btn');
    if (copyShareBtn) {
      copyShareBtn.onclick = () => {
        const linkInput = qs('#share-link');
        if (linkInput && navigator.clipboard) {
          navigator.clipboard.writeText(linkInput.value);
          alert('Link copied! Socialite unlocked.');
          award('share_game');
        }
      };
    }

    // START POPUP
    const startLastBtn = qs('#start-at-last');
    if (startLastBtn) {
      startLastBtn.onclick = () => {
        closePopup('start-popup');
        startRun(SV.progress.lastCheckpoint || 1);
      };
    }

    const startBeginningBtn = qs('#start-beginning');
    if (startBeginningBtn) {
      startBeginningBtn.onclick = () => {
        closePopup('start-popup');
        startRun(1);
      };
    }

    // SETTINGS / TOGGLES
    const musicToggle = qs('#music-toggle');
    const pauseMusicBtn = qs('#pause-music-btn');
    const sfxToggle = qs('#sfx-toggle');
    const pauseSfxBtn = qs('#pause-sfx-btn');
    const resetProgressBtn = qs('#reset-progress-btn');
    const openCreditsBtn = qs('#open-credits-btn');

    const updateSettingsUI = () => {
      if (musicToggle)
        musicToggle.textContent = `Music: ${SV.settings.music ? 'ON' : 'OFF'}`;
      if (pauseMusicBtn)
        pauseMusicBtn.textContent = `Music: ${SV.settings.music ? 'ON' : 'OFF'}`;
      if (sfxToggle)
        sfxToggle.textContent = `SFX: ${SV.settings.sfx ? 'ON' : 'OFF'}`;
      if (pauseSfxBtn)
        pauseSfxBtn.textContent = `SFX: ${SV.settings.sfx ? 'ON' : 'OFF'}`;
      Store.set('sv_set', SV.settings);
    };

    const toggleMusic = () => {
      SV.settings.music = !SV.settings.music;
      SV.settings.music ? Sound.startMusic() : Sound.stopMusic();
      updateSettingsUI();
    };

    const toggleSfx = () => {
      SV.settings.sfx = !SV.settings.sfx;
      updateSettingsUI();
    };

    if (musicToggle) musicToggle.onclick = toggleMusic;
    if (pauseMusicBtn) pauseMusicBtn.onclick = toggleMusic;
    if (sfxToggle) sfxToggle.onclick = toggleSfx;
    if (pauseSfxBtn) pauseSfxBtn.onclick = toggleSfx;

    if (resetProgressBtn) {
      resetProgressBtn.onclick = () => {
        if (confirm('Reset all data?')) {
          localStorage.clear();
          location.reload();
        }
      };
    }

    if (openCreditsBtn) {
      openCreditsBtn.onclick = () => {
        closePopup('settings-popup');
        openPopup('credits-popup');
      };
    }

    // PAUSE
    const pauseBtn = qs('#pause-btn');
    const resumeBtn = qs('#resume-btn');
    const quitBtn = qs('#quit-btn');

    if (pauseBtn) {
      pauseBtn.onclick = () => {
        SV.paused = true;
        openPopup('pause-menu');
      };
    }

    if (resumeBtn) {
      resumeBtn.onclick = () => {
        closePopup('pause-menu');
        SV.paused = false;
        SV.lastTs = performance.now();
        requestAnimationFrame(loop);
      };
    }

    if (quitBtn) {
      quitBtn.onclick = () => location.reload();
    }

    // DEATH POPUP
    const deathRestart = qs('#death-restart-checkpoint');
    const deathExit = qs('#death-exit-main');

    if (deathRestart) {
      deathRestart.onclick = () => {
        closePopup('death-popup');
        startRun(SV.progress.lastCheckpoint || 1);
      };
    }

    if (deathExit) {
      deathExit.onclick = () => location.reload();
    }

    // JUMP CONTROLS
    const jumpBtn = qs('#jump-btn');
    const jump = (e) => {
      if (!SV.running || SV.paused) return;
      if (e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      const p = SV.player;
      if (p.jumpsUsed < 2) {
        p.vy = p.jumpsUsed === 0 ? -0.66 : -0.58;
        p.jumpsUsed++;
        p.onGround = false;
        Sound.play(300, 'square', 0.1);
      }
    };

    if (jumpBtn) jumpBtn.onpointerdown = jump;
    window.addEventListener('keydown', jump);
    if (cvs) cvs.onpointerdown = jump;

    // DEV MENU
    const devTrigger = qs('#dev-trigger-zone');
    if (devTrigger) {
      devTrigger.onpointerdown = () => {
        SV.devClicks++;
        setTimeout(() => (SV.devClicks = 0), 2000);
        if (SV.devClicks >= 5) {
          const code = prompt('Code?');
          if (code === '2112') {
            openPopup('dev-menu');
            award('secret_dev');
          }
          SV.devClicks = 0;
        }
      };
    }

    const devLevelButtons = qsa('#dev-menu .dev-btn');
    devLevelButtons.forEach((b) => {
      b.onclick = () => {
        closePopup('dev-menu');
        SV.running = false;
        const lv = parseInt(b.dataset.level, 10);
        if (!Number.isNaN(lv)) startRun(lv);
      };
    });

    const devPowerButtons = qsa('#dev-menu .btn[data-power]');
    devPowerButtons.forEach((b) => {
      b.onclick = () => {
        const p = b.dataset.power;
        if (p === 'shield') SV.shield = 3;
        if (p === 'tesla') SV.tesla = 5000;
        if (p === 'jetpack') {
          SV.jetpack = true;
          SV.jetpackTime = 8000;
        }
        closePopup('dev-menu');
      };
    });

    // POPUP CLOSE BUTTONS (updated: .popup-close)
    qsa('.popup-close').forEach((btn) => {
      btn.onclick = () => {
        const popup = btn.closest('.popup');
        if (popup && popup.id) closePopup(popup);
      };
    });

    updateSettingsUI();
  }

  // --- START RUN ---
  function startRun(lv) {
    if (lv === 'popup') {
      openPopup('start-popup');
      return;
    }

    const idsToHide = ['home-screen', 'start-popup', 'death-popup', 'rpg-overlay'];
    idsToHide.forEach((id) => {
      const el = qs('#' + id);
      if (el) el.classList.add('hidden');
    });

    const gameScreen = qs('#game-screen');
    if (gameScreen) gameScreen.classList.remove('hidden');

    SV.level = lv;
    SV.score = 0;
    SV.player.x = 120;
    SV.player.y = 296;
    SV.player.vy = 0;
    SV.player.jumpsUsed = 0;

    SV.hazards = [];
    SV.powerups = [];
    SV.shield = 0;
    SV.jetpack = false;
    SV.tesla = 0;
    SV.rpg.active = false;

    const nameDisplay = qs('#player-name-display');
    if (nameDisplay) {
      nameDisplay.textContent = SV.settings.playerName || 'Hero';
    }

    SV.running = true;
    SV.paused = false;
    SV.lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  // --- LOOP ---
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

  // --- UPDATE ---
  function update(dt) {
    if (SV.rpg.active) return;

    // score
    SV.score += dt * 0.01;
    const scoreDisplay = qs('#score-display');
    if (scoreDisplay) scoreDisplay.textContent = Math.floor(SV.score);

    if (SV.score > (SV.progress.allTimeScore || 0)) {
      SV.progress.allTimeScore = SV.score;
      Store.set('sv_prog', SV.progress);
    }
    const allTimeDisplay = qs('#alltime-display');
    if (allTimeDisplay) {
      allTimeDisplay.textContent = Math.floor(SV.progress.allTimeScore || 0);
    }

    const p = SV.player;

    // gravity / jetpack
    if (SV.jetpack) {
      p.vy = 0;
      p.y = 200 + Math.sin(Date.now() * 0.005) * 10;
      p.onGround = false;
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

    // hazards spawn
    if (Math.random() < 0.015) {
      const type = Math.random() > 0.7 ? 'mine' : 'slime';
      SV.hazards.push({
        x: 850,
        y: type === 'mine' ? 230 : 296,
        w: 36,
        h: 36,
        type
      });
    }

    // powerups spawn
    if (Math.random() < 0.005) {
      SV.powerups.push({
        x: 850,
        y: 200,
        w: 40,
        h: 40,
        type: pick(['shield', 'tesla', 'jetpack'])
      });
    }

    // move hazards/powerups
    SV.hazards.forEach((h) => {
      h.x -= 0.34 * dt;
    });
    SV.powerups.forEach((pw) => {
      pw.x -= 0.34 * dt;
    });

    // tesla auto-zap
    if (SV.tesla > 0) {
      SV.tesla -= dt;
      const target = SV.hazards.find((h) => h.x > p.x && h.x < p.x + 400);
      if (target) {
        target.zapped = true;
        SV.hazards = SV.hazards.filter((h) => h !== target);
        Sound.play(600, 'sawtooth', 0.1);
      }
    }

    // collisions: hazards
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

    // collisions: powerups
    SV.powerups.forEach((pw, i) => {
      if (rectHit(p.x, p.y, p.w, p.h, pw.x, pw.y, 40, 40)) {
        SV.powerups.splice(i, 1);
        Sound.play(600, 'sine');
        if (pw.type === 'shield') SV.shield = 3;
        if (pw.type === 'tesla') SV.tesla = 5000;
        if (pw.type === 'jetpack') {
          SV.jetpack = true;
          SV.jetpackTime = 8000;
        }
      }
    });
  }

  // --- DEATH ---
  function onPlayerDeath() {
    Sound.play(60, 'sawtooth', 0.5);
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

  // --- DRAW ---
  function draw() {
    const ctx = SV.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, 800, 480);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 800, 480);

    // ground
    ctx.fillStyle = '#1a2435';
    ctx.fillRect(0, 360, 800, 120);

    // hazards
    SV.hazards.forEach((h) => {
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

    // powerups
    SV.powerups.forEach((p) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x + 20, p.y + 20, 20, 0, Math.PI * 2);
      ctx.fill();
    });

    // player sprite
    drawPlayerSprite(ctx, SV.player.x, SV.player.y);

    // tesla beam
    if (SV.tesla > 0) {
      const t = SV.hazards.find((h) => h.x > SV.player.x && h.x < SV.player.x + 400);
      if (t) {
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(SV.player.x + 20, SV.player.y + 30);
        ctx.lineTo(t.x + 18, t.y + 18);
        ctx.stroke();
      }
    }
  }

  function drawPlayerSprite(ctx, x, y) {
    const s = SV.settings;
    let shirt = s.shirt;
    if (s.skin) {
      const sk = SKINS.find((k) => k.id === s.skin);
      if (sk) shirt = sk.col;
    }

    // body
    ctx.fillStyle = shirt;
    ctx.fillRect(x, y, 42, 64);

    // head
    ctx.fillStyle = s.skinTone;
    ctx.fillRect(x + 8, y - 16, 26, 16);

    // legs
    ctx.fillStyle = s.pants;
    ctx.fillRect(x + 4, y + 36, 12, 28);
    ctx.fillRect(x + 26, y + 36, 12, 28);

    // simple hair (only drawing short for now; others could be added)
    ctx.fillStyle = '#70421b';
    if (s.hairStyle === 'short') {
      ctx.fillRect(x + 8, y - 20, 26, 8);
    }
  }

  // --- WARDROBE ---
  function initWardrobe() {
    const previewContainer = qs('#player-preview');
    if (!previewContainer) return;

    const cvs = document.createElement('canvas');
    cvs.width = 300;
    cvs.height = 180;
    previewContainer.innerHTML = '';
    previewContainer.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    const render = () => {
      ctx.clearRect(0, 0, 300, 180);
      drawPlayerSprite(ctx, 130, 80);
    };

    // name
    const nameInput = qs('#player-name-input');
    if (nameInput) {
      nameInput.value = SV.settings.playerName;
      nameInput.onchange = (e) => {
        SV.settings.playerName = e.target.value || 'Hero';
        Store.set('sv_set', SV.settings);
      };
    }

    // tabs
    qsa('.wardrobe-tab').forEach((t) => {
      t.onclick = (e) => {
        qsa('.wardrobe-tab').forEach((x) => x.classList.remove('active'));
        e.target.classList.add('active');
        const tabId = e.target.dataset.tab;
        qsa('.wardrobe-content').forEach((c) =>
          c.classList.remove('active')
        );
        const target = qs('#' + tabId);
        if (target) target.classList.add('active');
      };
    });

    const build = (arr, id, prop, isColor) => {
      const el = qs('#' + id);
      if (!el) return;
      el.innerHTML = '';
      arr.forEach((val) => {
        const b = document.createElement('button');
        if (isColor) {
          b.className = 'color-swatch';
          b.style.background = val;
        } else {
          b.className = 'item-swatch';
          b.textContent = val;
        }
        if (SV.settings[prop] === val) b.classList.add('active');
        b.onclick = () => {
          SV.settings[prop] = val;
          if (prop === 'shirt') SV.settings.skin = null;
          Store.set('sv_set', SV.settings);
          render();
        };
        el.appendChild(b);
      });
    };

    const refreshHair = () => {
      const list = HAIRS[SV.settings.gender] || HAIRS.o;
      build(list, 'hair-options', 'hairStyle', false);
    };

    build(COLORS.shirt, 'shirt-options', 'shirt', true);
    build(COLORS.pants, 'pants-options', 'pants', true);
    build(COLORS.skin, 'skin-options', 'skinTone', true);
    build(ITEMS, 'item-options', 'item', false);
    refreshHair();

    // gender buttons
    qsa('.gender-btn').forEach((b) => {
      if (SV.settings.gender === b.dataset.gender) {
        b.classList.add('active');
      }
      b.onclick = () => {
        qsa('.gender-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        SV.settings.gender = b.dataset.gender;
        Store.set('sv_set', SV.settings);
        refreshHair();
        render();
      };
    });

    render();
  }

  // --- LORE ---
  function drawPixelArt(ctx, map, size) {
    map.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const col = ART.colors[char];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(x * size, y * size, size, size);
        }
      });
    });
  }

  function drawLore() {
    const c1 = qs('#lore-canvas-1');
    if (c1) {
      const ctx1 = c1.getContext('2d');
      ctx1.clearRect(0, 0, c1.width, c1.height);
      drawPixelArt(ctx1, ART.troll, 6);
    }

    const c2 = qs('#lore-canvas-2');
    if (c2) {
      const ctx2 = c2.getContext('2d');
      ctx2.clearRect(0, 0, c2.width, c2.height);
      drawPixelArt(ctx2, ART.head, 6);
    }
  }

  // --- ACHIEVEMENTS ---
  function buildAch() {
    const g = qs('#achievements-grid');
    if (!g) return;
    g.innerHTML = '';
    const have = SV.progress.ach || {};
    ACHIEVEMENTS.forEach((a) => {
      const d = document.createElement('div');
      d.className = `achievement-tile ${have[a.id] ? 'unlocked' : ''}`;
      d.innerHTML = `<b>${a.title}</b><br><small>${a.desc}</small>`;
      g.appendChild(d);
    });
  }

  function award(id) {
    if (!SV.progress.ach[id]) {
      SV.progress.ach[id] = true;
      Store.set('sv_prog', SV.progress);
    }
  }

  // --- BOOT ---
  document.addEventListener('DOMContentLoaded', init);
})();
