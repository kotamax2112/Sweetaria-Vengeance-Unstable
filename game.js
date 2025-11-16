/* =========================================================
   SWEETARIA: VENGEANCE — STABLE HYBRID BUILD (3.1)
   - Based on Beta 2.0 logic
   - Hardened title start (global fallback)
   - Safe bindings for all menus
   - No syntax errors
========================================================= */
(() => {
  'use strict';

  // --- UTILS ---
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
  const randRange = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const $ = (id) => document.getElementById(id);

  const on = (el, evt, fn, opts) => {
    if (el) el.addEventListener(evt, fn, opts || false);
  };

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
        const freq = [110,110,130,110,165,146,130,110][t % 8];
        Sound.play(freq, 'triangle', 0.05, 0.2);
        t++;
      }, 250);
    },
    stopMusic: () => {
      if (musInt) clearInterval(musInt);
    }
  };

  // --- PIXEL ART (LORE) ---
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
      '1':'#ffd5a3','2':'#ffee7a','3':'#000',
      '4':'#fff','5':'#ff3860','6':'#000',
      '7':'#999','8':'#aaf','9':'#ccc'
    }
  };

  // --- DATA ---
  const COLORS = {
    shirt:['#ff5a5a','#4ea8ff','#37d67a','#a06bff','#ff8d3b','#17c5b6'],
    pants:['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'],
    skin:['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f']
  };
  const ITEMS = ['none','sword','scepter','mallet','cleaver'];
  const HAIRS = {
    m:['short','side','spiky'],
    f:['bob','long','ponytail'],
    o:['short','side','spiky','bob','long','ponytail','mohawk']
  };

  const SKINS = [
    {id:'skin1',name:'Cone Knight',req:'beat_boss1',col:'#ff5a5a',rarity:'rare'},
    {id:'skin2',name:'Blizzard',req:'long_run',col:'#4e9cff',rarity:'rare'},
    {id:'skin3',name:'Kindness',req:'kind_only',col:'#ff7bc5',rarity:'epic'},
    {id:'skin4',name:'Slayer',req:'beat_boss2',col:'#3ba55d',rarity:'epic'},
    {id:'skin5',name:'Socialite',req:'share_game',col:'#ffd700',rarity:'legendary'}
  ];

  const ACHIEVEMENTS = [
    {id:'beat_boss1',title:'Emoji Dodger',desc:'Defeat Teen Troll'},
    {id:'beat_boss2',title:'Final Blow',desc:'Defeat Boss Head'},
    {id:'kind_only',title:'Kindness',desc:'Pacifist Run'},
    {id:'share_game',title:'Influencer',desc:'Share the game'},
    {id:'long_run',title:'Endurer',desc:'Survive 10m'},
    {id:'die_lot',title:'Glutton',desc:'Die 10 times'},
    {id:'secret_dev',title:'The 2112',desc:'Find Dev Menu'}
  ];

  // --- STATE ---
  const Store = {
    get:(k,d)=>{
      try{return JSON.parse(localStorage.getItem(k))||d;}catch{return d;}
    },
    set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))
  };

  const SV = {
    settings:Store.get('sv_set',{
      music:true,sfx:true,
      playerName:'Hero',
      gender:'m',
      shirt:'#ff5a5a',
      pants:'#2d3549',
      skinTone:'#ffd5a3',
      hairStyle:'short',
      item:'none',
      skin:null
    }),
    progress:Store.get('sv_prog',{
      ach:{},
      jumps:0,
      lastCheckpoint:0,
      beatBoss1:false,
      beatBoss2:false,
      endlessUnlocked:false,
      allTimeScore:0
    }),
    running:false,
    paused:false,
    level:1,
    score:0,
    lastTs:0,
    groundY:360,
    player:{x:120,y:296,w:42,h:64,vy:0,onGround:true,jumpsUsed:0},
    hazards:[],
    powerups:[],
    shield:0,
    jetpack:false,
    tesla:0,
    jetpackTime:0,
    devClicks:0,
    ctx:null
  };

  let titleStarted = false;

  // --- INIT ---
  function init() {
    const cvs = qs('#game-canvas');
    if (!cvs) return;
    SV.ctx = cvs.getContext('2d');

    const title = $('#title-screen');

    const beginFromTitle = () => {
      if (titleStarted) return;
      titleStarted = true;
      Sound.init();
      if (SV.settings.music) Sound.startMusic();
      title.classList.add('hidden');
      $('#home-screen').classList.remove('hidden');
    };

    // Title screen direct click
    on(title, 'pointerdown', beginFromTitle);
    on(title, 'click', beginFromTitle);

    // GLOBAL FALLBACK: any click while title visible
    on(document, 'pointerdown', () => {
      if (titleStarted) return;
      if (!title || title.classList.contains('hidden')) return;
      beginFromTitle();
    }, true);

    // Keyboard start
    on(window, 'keydown', (e) => {
      if (titleStarted) return;
      if (!title || title.classList.contains('hidden')) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        beginFromTitle();
      }
    });

    // Menu bindings
    on($('#play-btn'), 'click', () => {
      startRun(SV.progress.lastCheckpoint > 1 ? 'popup' : 1);
    });

    on($('#endless-btn'), 'click', () => {
      if (SV.progress.endlessUnlocked) startRun(99);
      else alert("Beat Story Mode to unlock.");
    });

    on($('#wardrobe-btn'), 'click', () => {
      openPopup('wardrobe-popup');
      initWardrobe();
    });

    on($('#lore-btn'), 'click', () => {
      openPopup('lore-popup');
      drawLore();
    });

    on($('#achievements-btn'), 'click', () => {
      buildAch();
      openPopup('achievements-popup');
    });

    on($('#share-btn'), 'click', () => openPopup('share-popup'));
    on($('#settings-btn'), 'click', () => openPopup('settings-popup'));
    on($('#logout-btn'), 'click', () => location.reload());
    on($('#open-credits-btn'), 'click', () => {
      closePopup('settings-popup');
      openPopup('credits-popup');
    });
    on($('#return-title-btn'), 'click', () => location.reload());

    // Share
    on($('#copy-share-btn'), 'click', () => {
      const inp = $('#share-link');
      if (navigator.clipboard && inp) {
        navigator.clipboard.writeText(inp.value);
      }
      alert("Link copied! Socialite unlocked.");
      award('share_game');
    });

    // Start popup
    on($('#start-at-last'), 'click', () => {
      closePopup('start-popup');
      startRun(SV.progress.lastCheckpoint || 1);
    });
    on($('#start-beginning'), 'click', () => {
      closePopup('start-popup');
      startRun(1);
    });

    // Settings toggles
    const updSet = () => {
      const mt = $('#music-toggle');
      const st = $('#sfx-toggle');
      const pmt = $('#pause-music-btn');
      const pst = $('#pause-sfx-btn');
      if (mt) mt.textContent = `MUSIC: ${SV.settings.music ? 'ON' : 'OFF'}`;
      if (pmt) pmt.textContent = `MUSIC: ${SV.settings.music ? 'ON' : 'OFF'}`;
      if (st) st.textContent = `SFX: ${SV.settings.sfx ? 'ON' : 'OFF'}`;
      if (pst) pst.textContent = `SFX: ${SV.settings.sfx ? 'ON' : 'OFF'}`;
      Store.set('sv_set', SV.settings);
    };

    const toggleMus = () => {
      SV.settings.music = !SV.settings.music;
      if (SV.settings.music) Sound.startMusic();
      else Sound.stopMusic();
      updSet();
    };
    const toggleSfx = () => {
      SV.settings.sfx = !SV.settings.sfx;
      updSet();
    };

    on($('#music-toggle'), 'click', toggleMus);
    on($('#pause-music-btn'), 'click', toggleMus);
    on($('#sfx-toggle'), 'click', toggleSfx);
    on($('#pause-sfx-btn'), 'click', toggleSfx);

    on($('#reset-progress-btn'), 'click', () => {
      if (confirm("Reset all data?")) {
        localStorage.clear();
        location.reload();
      }
    });

    // Pause
    on($('#pause-btn'), 'click', () => {
      SV.paused = true;
      openPopup('pause-menu');
    });
    on($('#resume-btn'), 'click', () => {
      closePopup('pause-menu');
      SV.paused = false;
      SV.lastTs = performance.now();
      loop();
    });
    on($('#quit-btn'), 'click', () => location.reload());

    // Death actions
    on($('#death-restart-checkpoint'), 'click', () => {
      closePopup('death-popup');
      startRun(SV.progress.lastCheckpoint || 1);
    });
    on($('#death-exit-main'), 'click', () => location.reload());

    // Jump
    const jump = (e) => {
      if (!SV.running || SV.paused) return;
      if (e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      const p = SV.player;
      if (p.jumpsUsed < 2) {
        p.vy = p.jumpsUsed === 0 ? -0.66 : -0.58;
        p.jumpsUsed++;
        p.onGround = false;
        Sound.play(300,'square',0.1);
      }
    };
    on($('#jump-btn'), 'pointerdown', jump);
    on($('#game-canvas'), 'pointerdown', jump);
    window.onkeydown = jump;

    // Dev Menu
    const devZone = $('#dev-trigger-zone');
    on(devZone, 'pointerdown', () => {
      SV.devClicks++;
      setTimeout(() => SV.devClicks = 0, 2000);
      if (SV.devClicks >= 5) {
        if (prompt("Code?") === "2112") {
          openPopup('dev-menu');
          award('secret_dev');
        }
        SV.devClicks = 0;
      }
    });

    qsa('#dev-menu .dev-btn').forEach(b => {
      on(b, 'click', () => {
        const lv = parseInt(b.dataset.level, 10);
        closePopup('dev-menu');
        SV.running = false;
        startRun(lv);
      });
    });

    qsa('#dev-menu [data-power]').forEach(b => {
      on(b, 'click', () => {
        const p = b.dataset.power;
        if (p === 'shield') SV.shield = 3;
        if (p === 'tesla') SV.tesla = 5000;
        if (p === 'jetpack') {
          SV.jetpack = true;
          SV.jetpackTime = 8000;
        }
        closePopup('dev-menu');
      });
    });

    // Close buttons
    qsa('.close-btn').forEach(b => {
      on(b, 'click', () => {
        const pop = b.closest('.popup');
        if (pop) pop.classList.add('hidden');
      });
    });

    updSet();
  }

  // POPUPS
  function openPopup(id){ const el = $('#'+id); if (el) el.classList.remove('hidden'); }
  function closePopup(id){ const el = $('#'+id); if (el) el.classList.add('hidden'); }

  // START RUN
  function startRun(lv) {
    if (lv === 'popup') {
      openPopup('start-popup');
      return;
    }

    ['home-screen','start-popup','death-popup','rpg-overlay'].forEach(id => {
      const el = $('#'+id);
      if (el) el.classList.add('hidden');
    });

    $('#game-screen').classList.remove('hidden');

    SV.level = lv;
    SV.score = 0;
    const p = SV.player;
    p.x = 120;
    p.y = 296;
    p.vy = 0;
    p.jumpsUsed = 0;
    p.onGround = true;

    SV.hazards = [];
    SV.powerups = [];
    SV.shield = 0;
    SV.jetpack = false;
    SV.tesla = 0;
    SV.jetpackTime = 0;

    $('#player-name-display').textContent = SV.settings.playerName || "Hero";

    SV.running = true;
    SV.paused = false;
    SV.lastTs = performance.now();
    loop();
  }

  // LOOP
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

  // UPDATE
  function update(dt) {
    SV.score += dt * 0.01;
    $('#score-display').textContent = Math.floor(SV.score);

    if (SV.score > (SV.progress.allTimeScore || 0)) {
      SV.progress.allTimeScore = SV.score;
      Store.set('sv_prog', SV.progress);
    }
    $('#alltime-display').textContent = Math.floor(SV.progress.allTimeScore || 0);

    const p = SV.player;

    // Jetpack
    if (SV.jetpack) {
      p.vy = 0;
      p.y = 200 + Math.sin(Date.now() * 0.005) * 10;
      p.onGround = false;
      SV.jetpackTime -= dt;
      if (SV.jetpackTime <= 0) {
        SV.jetpack = false;
        SV.jetpackTime = 0;
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

    // Hazards spawn
    if (Math.random() < 0.015) {
      const type = Math.random() > 0.7 ? 'mine' : 'slime';
      SV.hazards.push({ x:850, y:type === 'mine' ? 230 : 296, w:36, h:36, type });
    }

    // Powerups spawn
    if (Math.random() < 0.005) {
      SV.powerups.push({ x:850, y:200, w:40, h:40, type:pick(['shield','tesla','jetpack']) });
    }

    SV.hazards.forEach(h => h.x -= 0.34 * dt);
    SV.powerups.forEach(pu => pu.x -= 0.34 * dt);

    // Tesla auto-zap
    if (SV.tesla > 0) {
      SV.tesla -= dt;
      const t = SV.hazards.find(h => h.x > p.x && h.x < p.x + 400);
      if (t) {
        SV.hazards = SV.hazards.filter(h => h !== t);
        Sound.play(600,'sawtooth',0.1);
      }
    }

    // Collisions
    SV.hazards.forEach((h,i) => {
      if (rectHit(p.x,p.y,p.w,p.h,h.x,h.y,h.w,h.h)) {
        if (SV.shield > 0 || SV.jetpack) {
          SV.shield--;
          SV.hazards.splice(i,1);
        } else {
          SV.running = false;
          onPlayerDeath();
        }
      }
    });

    SV.powerups.forEach((pw,i) => {
      if (rectHit(p.x,p.y,p.w,p.h,pw.x,pw.y,pw.w,pw.h)) {
        SV.powerups.splice(i,1);
        Sound.play(600,'sine');
        if (pw.type === 'shield') SV.shield = 3;
        if (pw.type === 'tesla') SV.tesla = 5000;
        if (pw.type === 'jetpack') { SV.jetpack = true; SV.jetpackTime = 8000; }
      }
    });
  }

  function rectHit(x1,y1,w1,h1,x2,y2,w2,h2){
    return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1);
  }

  // DRAW
  function draw() {
    const ctx = SV.ctx;
    ctx.clearRect(0,0,800,480);

    // Background
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(0,0,800,480);

    // Ground
    ctx.fillStyle = '#162033';
    ctx.fillRect(0,360,800,120);

    // Hazards
    SV.hazards.forEach(h => {
      ctx.fillStyle = h.type === 'mine' ? '#666' : '#0f0';
      ctx.beginPath();
      ctx.arc(h.x+18,h.y+18,18,0,Math.PI*2);
      ctx.fill();
    });

    // Powerups
    SV.powerups.forEach(p => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x+20,p.y+20,20,0,Math.PI*2);
      ctx.fill();
    });

    // Player
    drawPlayerSprite(ctx, SV.player.x, SV.player.y);

    // Tesla beam
    if (SV.tesla > 0) {
      const t = SV.hazards.find(h => h.x > SV.player.x && h.x < SV.player.x + 400);
      if (t) {
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(SV.player.x+20, SV.player.y+30);
        ctx.lineTo(t.x+18, t.y+18);
        ctx.stroke();
      }
    }
  }

  function drawPlayerSprite(ctx,x,y) {
    const s = SV.settings;
    let shirt = s.shirt;
    if (s.skin) {
      const sk = SKINS.find(k => k.id === s.skin);
      if (sk) shirt = sk.col;
    }
    // body
    ctx.fillStyle = shirt;
    ctx.fillRect(x,y,42,64);

    // head
    ctx.fillStyle = s.skinTone;
    ctx.fillRect(x+8,y-16,26,16);

    // legs
    ctx.fillStyle = s.pants;
    ctx.fillRect(x+4,y+36,12,28);
    ctx.fillRect(x+26,y+36,12,28);

    // hair (simple)
    ctx.fillStyle = '#70421b';
    if (s.hairStyle === 'short') {
      ctx.fillRect(x+8,y-20,26,8);
    }
  }

  // DEATH
  function onPlayerDeath() {
    Sound.play(60,'sawtooth',0.5);
    award('die_lot');
    openPopup('death-popup');
  }

  // WARDROBE
  function initWardrobe(){
    const cvs = document.createElement('canvas');
    cvs.width = 300; cvs.height = 180;
    const preview = $('#player-preview');
    preview.innerHTML = '';
    preview.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    const render = () => {
      ctx.clearRect(0,0,300,180);
      drawPlayerSprite(ctx,130,80);
    };

    const nameInput = $('#player-name-input');
    if (nameInput) {
      nameInput.value = SV.settings.playerName;
      nameInput.onchange = e => {
        SV.settings.playerName = e.target.value || 'Hero';
        Store.set('sv_set',SV.settings);
      };
    }

    qsa('.wardrobe-tab').forEach(t => {
      t.onclick = e => {
        qsa('.wardrobe-tab').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        qsa('.wardrobe-content').forEach(c => c.classList.remove('active'));
        $('#'+e.target.dataset.tab).classList.add('active');
      };
    });

    const build = (arr,id,prop,isColor) => {
      const el = $('#'+id);
      el.innerHTML = '';
      arr.forEach(val => {
        const b = document.createElement('button');
        if (isColor){
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
          Store.set('sv_set',SV.settings);
          render();
          build(arr,id,prop,isColor);
        };
        el.appendChild(b);
      });
    };

    const refreshHair = () => {
      build(HAIRS[SV.settings.gender],'hair-options','hairStyle',false);
    };

    build(COLORS.shirt,'shirt-options','shirt',true);
    build(COLORS.pants,'pants-options','pants',true);
    build(COLORS.skin,'skin-options','skinTone',true);
    build(ITEMS,'item-options','item',false);
    refreshHair();

    qsa('.gender-btn').forEach(b => {
      if (SV.settings.gender === b.dataset.gender) b.classList.add('active');
      b.onclick = () => {
        SV.settings.gender = b.dataset.gender;
        Store.set('sv_set',SV.settings);
        refreshHair();
        render();
        qsa('.gender-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      };
    });

    // Skins
    const skinsGrid = $('#skins-grid');
    const clearBtn = $('#clear-skin-btn');

    const rebuildSkins = () => {
      skinsGrid.innerHTML = '';
      SKINS.forEach(skin => {
        const card = document.createElement('button');
        card.className = 'skin-card ' + skin.rarity;
        const unlocked = !!(SV.progress.ach && (SV.progress.ach[skin.id] || SV.progress.ach[skin.req]));
        if (!unlocked) card.classList.add('locked');
        if (SV.settings.skin === skin.id) card.classList.add('selected');

        const ach = ACHIEVEMENTS.find(a => a.id === skin.req);
        const reqText = unlocked ? 'Unlocked' : ('Unlock: ' + (ach ? ach.title : skin.req));

        card.innerHTML = `
          <div class="skin-swatch" style="background:${skin.col};"></div>
          <div class="skin-name">${skin.name}</div>
          <div class="skin-req">${reqText}</div>
        `;
        card.disabled = !unlocked;
        card.onclick = () => {
          if (!unlocked) return;
          SV.settings.skin = skin.id;
          Store.set('sv_set',SV.settings);
          rebuildSkins();
          render();
        };
        skinsGrid.appendChild(card);
      });
    };

    if (clearBtn) {
      clearBtn.onclick = () => {
        SV.settings.skin = null;
        Store.set('sv_set',SV.settings);
        rebuildSkins();
        render();
      };
    }

    rebuildSkins();
    render();
  }

  function drawPixelArt(ctx,map,size){
    map.forEach((row,y)=>{
      [...row].forEach((char,x)=>{
        const col = ART.colors[char];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(x*size,y*size,size,size);
        }
      });
    });
  }

  function drawLore(){
    const c1 = $('#lore-canvas-1');
    if (c1) {
      const ctx1 = c1.getContext('2d');
      ctx1.clearRect(0,0,128,128);
      drawPixelArt(ctx1,ART.troll,6);
    }
    const c2 = $('#lore-canvas-2');
    if (c2) {
      const ctx2 = c2.getContext('2d');
      ctx2.clearRect(0,0,128,128);
      drawPixelArt(ctx2,ART.head,6);
    }
  }

  function buildAch(){
    const g = $('#achievements-grid');
    g.innerHTML = '';
    const have = SV.progress.ach || {};
    ACHIEVEMENTS.forEach(a => {
      const d = document.createElement('div');
      d.className = 'achievement-tile ' + (have[a.id] ? 'unlocked' : '');
      d.innerHTML = `<b>${a.title}</b><br><small>${a.desc}</small>`;
      g.appendChild(d);
    });
  }

  function award(id){
    if (!SV.progress.ach[id]) {
      SV.progress.ach[id] = true;
      Store.set('sv_prog',SV.progress);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
