/* =========================================================
   sky.js — Papiro Interactivo + Cielo de Belén (Fase 4)
   · Sincronización en Firestore (artifacts/{appId}/public/data/cena2026_cielo/estrellas)
     con respaldo local automático en localStorage
   · Papiro interactivo 2 columnas con vista previa caligráfica y sello de lacre
   · Cielo de Belén en Canvas: Vía Láctea, horizonte de Belén iluminado,
     constelación interactiva, estrellas fugaces, tarjeta flotante y modo Tour
   · Audio: Pista 1 <-> Pista 3 en segundo exacto
   ========================================================= */
(function (global) {
  'use strict';

  var App = global.App;
  var C = App.CONST;
  var U = App.utils;

  var MAX_CHARS = 220;
  var TOUR_MS = 6000;

  var COLOR_MAP = {};
  C.STAR_COLORS.forEach(function (c) { COLOR_MAP[c.id] = c; });

  function $(id) { return document.getElementById(id); }

  /* =====================================================
     1. SINCRONIZACIÓN DE ESTRELLAS (Firestore / localStorage)
     ===================================================== */
  var syncMode = 'local';
  var db = null;
  var docRef = null;
  var userStars = []; // estrellas creadas por invitados

  function getActiveStars() {
    return userStars.length > 0 ? userStars : C.DEFAULT_SKY_STARS.slice();
  }

  function sanitizeStars(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (s) {
      return s && typeof s.message === 'string' && s.message.trim().length > 0;
    }).map(function (s, idx) {
      return {
        id: String(s.id || ('star-' + idx + '-' + Date.now())),
        author: U.prettyName(s.author || 'Invitado'),
        to: String(s.to || 'Todos los amigos').trim() || 'Todos los amigos',
        type: C.PAPIRO_TYPES.indexOf(s.type) !== -1 ? s.type : 'Deseo',
        colorId: COLOR_MAP[s.colorId] ? s.colorId : 'dorada',
        message: String(s.message).trim().slice(0, MAX_CHARS),
        x: typeof s.x === 'number' ? Math.max(0.08, Math.min(0.92, s.x)) : U.rand(0.12, 0.88),
        y: typeof s.y === 'number' ? Math.max(0.16, Math.min(0.68, s.y)) : U.rand(0.18, 0.64),
        createdAt: Number(s.createdAt) || Date.now(),
        isDefault: false
      };
    });
  }

  function applyStars(list) {
    userStars = sanitizeStars(list);
    var active = getActiveStars();
    App.setSkyStarsCount(active.length);
    updateSkyCounters();
    App.bus.emit('sky:updated', { stars: active, userStars: userStars.slice() });
  }

  function readLocalStars() {
    try {
      var raw = global.localStorage.getItem(C.STORAGE_KEYS.sky);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.stars) ? parsed.stars : []);
    } catch (e) { return []; }
  }

  function writeLocalStars(list) {
    try {
      global.localStorage.setItem(C.STORAGE_KEYS.sky, JSON.stringify({ stars: list, updatedAt: Date.now() }));
    } catch (e) { console.warn('[sky] No se pudo guardar en localStorage:', e); }
  }

  function initSkySync() {
    var cfg = global.__firebase_config;
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg); } catch (e) { cfg = null; }
    }
    if (cfg && typeof cfg === 'object' && global.firebase && global.firebase.firestore) {
      try {
        var fbApp = global.firebase.apps && global.firebase.apps.length
          ? global.firebase.apps[0]
          : global.firebase.initializeApp(cfg);
        db = fbApp.firestore();
        var appId = String(global.__app_id || 'cena-navidena-2026');
        docRef = db
          .collection('artifacts').doc(appId)
          .collection('public').doc('data')
          .collection('cena2026_cielo').doc('estrellas');
        syncMode = 'firestore';
        docRef.onSnapshot(function (snap) {
          var data = snap.exists ? snap.data() : null;
          applyStars(data && Array.isArray(data.stars) ? data.stars : []);
        }, function (err) {
          console.warn('[sky] Error en Firestore; usando respaldo local:', err);
          syncMode = 'local';
          applyStars(readLocalStars());
        });
        return;
      } catch (err) {
        console.warn('[sky] No se pudo iniciar Firestore para Cielo; usando local:', err);
      }
    }

    syncMode = 'local';
    applyStars(readLocalStars());
    global.addEventListener('storage', function (e) {
      if (e.key === C.STORAGE_KEYS.sky) applyStars(readLocalStars());
    });
  }

  /** Elige coordenadas (x, y) normalizadas evitando solapar estrellas cercanas. */
  function pickStarPosition(existing) {
    var best = { x: U.rand(0.12, 0.88), y: U.rand(0.18, 0.64) };
    var bestDist = -1;
    for (var attempt = 0; attempt < 24; attempt++) {
      var cand = { x: U.rand(0.10, 0.90), y: U.rand(0.17, 0.64) };
      var minD = Infinity;
      for (var i = 0; i < existing.length; i++) {
        var dx = cand.x - existing[i].x;
        var dy = (cand.y - existing[i].y) * 1.3;
        var d = Math.hypot(dx, dy);
        if (d < minD) minD = d;
      }
      if (minD > bestDist) { bestDist = minD; best = cand; }
      if (minD > 0.14) break;
    }
    return best;
  }

  function addStar(payload) {
    var pos = pickStarPosition(userStars);
    var star = {
      id: 'star-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      author: U.prettyName(payload.author || App.state.user.name || 'Invitado'),
      to: String(payload.to || 'Todos los amigos').trim() || 'Todos los amigos',
      type: C.PAPIRO_TYPES.indexOf(payload.type) !== -1 ? payload.type : 'Deseo',
      colorId: COLOR_MAP[payload.colorId] ? payload.colorId : 'dorada',
      message: String(payload.message || '').trim().slice(0, MAX_CHARS),
      x: pos.x,
      y: pos.y,
      createdAt: Date.now()
    };

    if (syncMode === 'firestore' && db && docRef) {
      return db.runTransaction(function (tx) {
        return tx.get(docRef).then(function (snap) {
          var arr = snap.exists && snap.data() && Array.isArray(snap.data().stars)
            ? snap.data().stars.slice()
            : [];
          arr.push(star);
          tx.set(docRef, { stars: arr, updatedAt: Date.now() }, { merge: true });
          return arr;
        });
      }).then(function (arr) {
        applyStars(arr);
        return star;
      }).catch(function (err) {
        console.error('[sky] Error guardando en Firestore:', err);
        var next = readLocalStars().concat([star]);
        writeLocalStars(next);
        applyStars(next);
        return star;
      });
    }

    var localList = readLocalStars().concat([star]);
    writeLocalStars(localList);
    applyStars(localList);
    return Promise.resolve(star);
  }

  function removeStar(id) {
    if (!id) return Promise.resolve(false);
    if (syncMode === 'firestore' && db && docRef) {
      return db.runTransaction(function (tx) {
        return tx.get(docRef).then(function (snap) {
          var arr = snap.exists && snap.data() && Array.isArray(snap.data().stars) ? snap.data().stars : [];
          var next = arr.filter(function (s) { return s.id !== id; });
          tx.set(docRef, { stars: next, updatedAt: Date.now() });
          return next;
        });
      }).then(function (next) {
        applyStars(next);
        return true;
      });
    }
    var next = readLocalStars().filter(function (s) { return s.id !== id; });
    writeLocalStars(next);
    applyStars(next);
    return Promise.resolve(true);
  }

  function clearStars() {
    if (syncMode === 'firestore' && docRef) {
      return docRef.set({ stars: [], updatedAt: Date.now() }).then(function () {
        applyStars([]);
        return true;
      });
    }
    writeLocalStars([]);
    applyStars([]);
    return Promise.resolve(true);
  }

  /* =====================================================
     2. CONFETI DORADO AL SELLAR PAPIRO
     ===================================================== */
  var goldConfRaf = 0;
  function launchGoldenConfetti() {
    var c = $('confetti-canvas');
    if (!c || !c.getContext) return;
    var gctx = c.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var cw = global.innerWidth, ch = global.innerHeight;
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var colors = ['#f5c76b', '#fff1c1', '#ffe08a', '#ffffff', '#d9a441'];
    var parts = [];
    var total = cw < 640 ? 75 : 120;
    for (var i = 0; i < total; i++) {
      var ang = U.rand(-Math.PI, 0);
      var spd = U.rand(180, 520);
      parts.push({
        x: cw * U.rand(0.45, 0.85),
        y: ch * U.rand(0.35, 0.65),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - U.rand(40, 140),
        s: U.rand(4, 10),
        rot: U.rand(0, Math.PI * 2),
        vrot: U.rand(-8, 8),
        color: U.pick(colors),
        life: U.rand(1.8, 3.0),
        age: 0
      });
    }

    var last = global.performance.now();
    global.cancelAnimationFrame(goldConfRaf);
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      gctx.clearRect(0, 0, cw, ch);
      var alive = 0;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        p.age += dt;
        if (p.age >= p.life) continue;
        alive++;
        p.vy += 420 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        var a = p.age > p.life * 0.65 ? 1 - (p.age - p.life * 0.65) / (p.life * 0.35) : 1;
        gctx.save();
        gctx.globalAlpha = Math.max(0, a);
        gctx.translate(p.x, p.y);
        gctx.rotate(p.rot);
        gctx.fillStyle = p.color;
        gctx.fillRect(-p.s / 2, -p.s * 0.35, p.s, p.s * 0.7);
        gctx.restore();
      }
      if (alive > 0) goldConfRaf = global.requestAnimationFrame(tick);
      else gctx.clearRect(0, 0, cw, ch);
    }
    goldConfRaf = global.requestAnimationFrame(tick);
  }

  /* =====================================================
     3. PAPIRO INTERACTIVO
     ===================================================== */
  var papiroState = {
    type: 'Deseo',
    to: 'Todos los amigos',
    colorId: 'dorada',
    message: '',
    sealing: false
  };
  var sealTimer = null;

  function setupPapiro() {
    var typesBox = $('papiro-types');
    var colorsBox = $('papiro-colors');
    var phrasesBox = $('papiro-phrases');
    var toInput = $('papiro-to');
    var msgInput = $('papiro-msg');
    var form = $('papiro-form');

    // Chips de tipo
    typesBox.innerHTML = '';
    C.PAPIRO_TYPES.forEach(function (type) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-pill' + (type === papiroState.type ? ' is-active' : '');
      btn.textContent = type;
      btn.dataset.type = type;
      btn.addEventListener('click', function () {
        papiroState.type = type;
        typesBox.querySelectorAll('.chip-pill').forEach(function (b) {
          b.classList.toggle('is-active', b.dataset.type === type);
        });
        renderPapiroPreview();
      });
      typesBox.appendChild(btn);
    });

    // Selector de 5 colores de estrella
    colorsBox.innerHTML = '';
    C.STAR_COLORS.forEach(function (col) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-color-btn' + (col.id === papiroState.colorId ? ' is-active' : '');
      btn.dataset.color = col.id;
      btn.title = col.name;
      btn.innerHTML = '<span class="sc-dot" style="background:' + col.hex + ';box-shadow:0 0 10px ' + col.glow + '"></span><span class="sc-lbl">' + col.name + '</span>';
      btn.addEventListener('click', function () {
        papiroState.colorId = col.id;
        colorsBox.querySelectorAll('.star-color-btn').forEach(function (b) {
          b.classList.toggle('is-active', b.dataset.color === col.id);
        });
        renderPapiroPreview();
      });
      colorsBox.appendChild(btn);
    });

    // Frases rápidas de inspiración
    phrasesBox.innerHTML = '';
    var shortLabels = ['✨ Bendiciones 2027', '💛 Gratitud', '🥂 Amistad', '🕊️ Paz familiar'];
    C.QUICK_PHRASES.forEach(function (phrase, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phrase-chip';
      btn.textContent = shortLabels[idx] || ('Idea ' + (idx + 1));
      btn.title = phrase;
      btn.addEventListener('click', function () {
        msgInput.value = phrase.slice(0, MAX_CHARS);
        papiroState.message = msgInput.value;
        renderPapiroPreview();
        msgInput.focus();
      });
      phrasesBox.appendChild(btn);
    });

    toInput.addEventListener('input', function () {
      papiroState.to = toInput.value;
      renderPapiroPreview();
    });

    msgInput.addEventListener('input', function () {
      if (msgInput.value.length > MAX_CHARS) msgInput.value = msgInput.value.slice(0, MAX_CHARS);
      papiroState.message = msgInput.value;
      renderPapiroPreview();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (papiroState.sealing) return;
      var text = msgInput.value.trim();
      if (text.length < 4) {
        App.toast('Escribe un mensaje breve antes de sellar tu papiro ✨');
        msgInput.focus();
        return;
      }

      papiroState.sealing = true;
      var submitBtn = $('btn-seal-papiro');
      submitBtn.disabled = true;

      var seal = $('papiro-seal');
      seal.classList.remove('is-stamped');
      void seal.offsetWidth;
      seal.classList.add('is-stamped');
      launchGoldenConfetti();

      addStar({
        author: App.state.user.name || 'Invitado',
        to: toInput.value.trim() || 'Todos los amigos',
        type: papiroState.type,
        colorId: papiroState.colorId,
        message: text
      }).then(function (created) {
        App.toast('✨ ¡Tu estrella ya brilla en el Cielo de Belén!', 3000);
        clearTimeout(sealTimer);
        sealTimer = setTimeout(function () {
          papiroState.sealing = false;
          submitBtn.disabled = false;
          msgInput.value = '';
          papiroState.message = '';
          seal.classList.remove('is-stamped');
          renderPapiroPreview();
          openSky(created.id);
        }, 1350);
      });
    });

    renderPapiroPreview();
  }

  function renderPapiroPreview() {
    var col = COLOR_MAP[papiroState.colorId] || C.STAR_COLORS[0];
    var author = App.state.user.name || 'Tu nombre';
    var toText = (papiroState.to || '').trim() || 'Todos los amigos';
    var msg = (papiroState.message || '').trim();

    $('pv-type').textContent = papiroState.type;
    $('pv-star-dot').style.background = col.hex;
    $('pv-star-dot').style.boxShadow = '0 0 10px ' + col.glow;
    $('pv-to').textContent = 'Para: ' + toText;
    $('pv-body').textContent = msg || 'Escribe aquí tu deseo, gratitud o recuerdo para esta noche mágica…';
    $('pv-body').classList.toggle('is-placeholder', !msg);
    $('pv-author').textContent = '— ' + author;
    $('papiro-count').textContent = (papiroState.message || '').length + ' / ' + MAX_CHARS;
  }

  function triggerUnroll() {
    var scroll = $('papiro-scroll');
    if (!scroll) return;
    scroll.classList.remove('is-unrolled');
    void scroll.offsetWidth;
    scroll.classList.add('is-unrolled');
  }

  /* =====================================================
     4. CIELO DE BELÉN INTERACTIVO (Canvas pantalla completa)
     ===================================================== */
  var skyCanvas, skyCtx;
  var SW = 0, SH = 0, SDPR = 1;
  var skyRunning = false;
  var skyRaf = 0;
  var bgStars = [];
  var milkyDots = [];
  var shootingStars = [];
  var nextShootAt = 0;
  var bethlehemSeed = [];
  var selectedIndex = -1;
  var hoveredIndex = -1;
  var tourActive = false;
  var tourTimer = null;

  function buildSkyBackdrop() {
    bgStars = [];
    var n = SW < 640 ? 110 : 210;
    for (var i = 0; i < n; i++) {
      bgStars.push({
        x: Math.random() * SW,
        y: Math.random() * SH * 0.84,
        r: U.rand(0.5, 1.7),
        alpha: U.rand(0.25, 0.9),
        speed: U.rand(0.8, 2.8),
        phase: Math.random() * Math.PI * 2
      });
    }

    // Polvo estelar diagonal para la Vía Láctea
    milkyDots = [];
    var mCount = SW < 640 ? 120 : 240;
    for (var m = 0; m < mCount; m++) {
      var u = Math.random();
      var spread = (Math.random() - 0.5) * 0.22 + (Math.random() - 0.5) * 0.12;
      var mx = u * SW + spread * SW * 0.35;
      var my = (0.72 - u * 0.62 + spread) * SH;
      milkyDots.push({
        x: mx,
        y: my,
        r: U.rand(0.4, 1.3),
        alpha: U.rand(0.08, 0.35)
      });
    }

    // Edificios estilizados del horizonte de Belén
    bethlehemSeed = [];
    var count = SW < 640 ? 18 : 34;
    for (var b = 0; b < count; b++) {
      var bx = (b / count) * SW + U.rand(-6, 6);
      var bw = U.rand(SW / count * 0.75, SW / count * 1.45);
      var bh = U.rand(22, SW < 640 ? 54 : 74);
      var hasDome = Math.random() < 0.36;
      var windows = [];
      var wRows = Math.floor(bh / 18);
      var wCols = Math.max(1, Math.floor(bw / 15));
      for (var r = 0; r < wRows; r++) {
        for (var c = 0; c < wCols; c++) {
          if (Math.random() < 0.55) {
            windows.push({
              rx: 0.2 + (c + 0.3) / (wCols + 0.4) * 0.65,
              ry: 0.22 + (r / Math.max(1, wRows)) * 0.55,
              phase: Math.random() * Math.PI * 2
            });
          }
        }
      }
      bethlehemSeed.push({ x: bx, w: bw, h: bh, dome: hasDome, windows: windows });
    }
  }

  function resizeSky() {
    if (!skyCanvas) return;
    var rect = skyCanvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    SDPR = Math.min(global.devicePixelRatio || 1, 2);
    var nw = Math.round(rect.width * SDPR);
    var nh = Math.round(rect.height * SDPR);
    if (skyCanvas.width === nw && skyCanvas.height === nh && SW === rect.width && SH === rect.height) return;
    SW = rect.width;
    SH = rect.height;
    skyCanvas.width = nw;
    skyCanvas.height = nh;
    skyCtx.setTransform(SDPR, 0, 0, SDPR, 0, 0);
    buildSkyBackdrop();
  }

  function spawnShootingStar(originX, originY) {
    var fromClick = typeof originX === 'number' && typeof originY === 'number';
    var x = fromClick ? originX : U.rand(SW * 0.1, SW * 0.9);
    var y = fromClick ? originY : U.rand(SH * 0.06, SH * 0.42);
    var goRight = fromClick ? (x < SW * 0.5) : (Math.random() < 0.6);
    var ang = goRight ? U.rand(0.28, 0.52) : Math.PI - U.rand(0.28, 0.52);
    var speed = U.rand(520, 820);
    shootingStars.push({
      x: x,
      y: y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      len: U.rand(85, 160),
      age: 0,
      life: U.rand(0.65, 1.05)
    });
  }

  function starCoords(star) {
    return {
      x: star.x * SW,
      y: star.y * SH
    };
  }

  function drawMilkyWay() {
    skyCtx.save();
    skyCtx.translate(SW * 0.5, SH * 0.42);
    skyCtx.rotate(-0.46);
    var band = skyCtx.createLinearGradient(0, -SH * 0.18, 0, SH * 0.18);
    band.addColorStop(0, 'rgba(130, 165, 230, 0)');
    band.addColorStop(0.35, 'rgba(140, 175, 240, 0.06)');
    band.addColorStop(0.5, 'rgba(245, 220, 175, 0.09)');
    band.addColorStop(0.65, 'rgba(130, 165, 230, 0.055)');
    band.addColorStop(1, 'rgba(130, 165, 230, 0)');
    skyCtx.fillStyle = band;
    skyCtx.fillRect(-SW, -SH * 0.18, SW * 2, SH * 0.36);
    skyCtx.restore();

    skyCtx.fillStyle = '#e8f1ff';
    for (var i = 0; i < milkyDots.length; i++) {
      var d = milkyDots[i];
      skyCtx.globalAlpha = d.alpha;
      skyCtx.beginPath();
      skyCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      skyCtx.fill();
    }
    skyCtx.globalAlpha = 1;
  }

  function drawBethlehemHorizon(t) {
    var base = SH;
    var hScale = Math.min(1, SH / 760);

    // Resplandor cálido en el horizonte detrás de Belén
    var glow = skyCtx.createRadialGradient(SW * 0.5, base - 20, 10, SW * 0.5, base - 10, SW * 0.52);
    glow.addColorStop(0, 'rgba(245, 199, 107, 0.24)');
    glow.addColorStop(0.45, 'rgba(184, 120, 45, 0.1)');
    glow.addColorStop(1, 'rgba(7, 16, 36, 0)');
    skyCtx.fillStyle = glow;
    skyCtx.fillRect(0, base - SH * 0.34, SW, SH * 0.34);

    // Colina trasera
    skyCtx.fillStyle = '#09142b';
    skyCtx.beginPath();
    skyCtx.moveTo(0, base);
    skyCtx.lineTo(0, base - 68 * hScale);
    skyCtx.quadraticCurveTo(SW * 0.28, base - 115 * hScale, SW * 0.52, base - 76 * hScale);
    skyCtx.quadraticCurveTo(SW * 0.78, base - 105 * hScale, SW, base - 64 * hScale);
    skyCtx.lineTo(SW, base);
    skyCtx.closePath();
    skyCtx.fill();

    // Silueta de casitas y cúpulas de Belén
    skyCtx.fillStyle = '#050b1a';
    for (var i = 0; i < bethlehemSeed.length; i++) {
      var b = bethlehemSeed[i];
      var bh = b.h * hScale;
      var by = base - bh - 18 * hScale;
      skyCtx.fillRect(b.x, by, b.w, bh + 22);
      if (b.dome) {
        skyCtx.beginPath();
        skyCtx.arc(b.x + b.w * 0.5, by, b.w * 0.34, Math.PI, 0);
        skyCtx.fill();
      }
    }

    // Ventanas iluminadas con luz cálida parpadeando muy suavemente
    for (var j = 0; j < bethlehemSeed.length; j++) {
      var bd = bethlehemSeed[j];
      var bdh = bd.h * hScale;
      var bdy = base - bdh - 18 * hScale;
      for (var w = 0; w < bd.windows.length; w++) {
        var win = bd.windows[w];
        var flick = 0.68 + 0.32 * Math.sin(t * 1.5 + win.phase);
        skyCtx.fillStyle = 'rgba(255, 214, 122, ' + flick.toFixed(2) + ')';
        skyCtx.fillRect(bd.x + bd.w * win.rx, bdy + bdh * win.ry, 3.2, 4.6);
      }
    }

    // Colina delantera oscura (cierra el horizonte)
    skyCtx.fillStyle = '#030712';
    skyCtx.beginPath();
    skyCtx.moveTo(0, base);
    skyCtx.lineTo(0, base - 26 * hScale);
    skyCtx.quadraticCurveTo(SW * 0.32, base - 46 * hScale, SW * 0.62, base - 24 * hScale);
    skyCtx.quadraticCurveTo(SW * 0.85, base - 38 * hScale, SW, base - 22 * hScale);
    skyCtx.lineTo(SW, base);
    skyCtx.closePath();
    skyCtx.fill();
  }

  function drawWishStar(x, y, col, t, idx, isSelected, isHovered) {
    var pulse = 1 + Math.sin(t * 2.5 + idx * 1.1) * 0.1;
    var baseR = (SW < 640 ? 8.5 : 10.5) * (isSelected ? 1.45 : isHovered ? 1.25 : 1) * pulse;

    // Halo
    var halo = skyCtx.createRadialGradient(x, y, 0, x, y, baseR * 3.4);
    halo.addColorStop(0, col.glow);
    halo.addColorStop(0.28, col.hex);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    skyCtx.save();
    skyCtx.globalAlpha = isSelected ? 0.92 : 0.65;
    skyCtx.fillStyle = halo;
    skyCtx.beginPath();
    skyCtx.arc(x, y, baseR * 3.4, 0, Math.PI * 2);
    skyCtx.fill();

    // Anillo de foco si está seleccionada
    if (isSelected) {
      skyCtx.strokeStyle = col.glow;
      skyCtx.lineWidth = 1.4;
      skyCtx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 4);
      skyCtx.beginPath();
      skyCtx.arc(x, y, baseR * 2.1, 0, Math.PI * 2);
      skyCtx.stroke();
    }

    // Estrella de 4 puntas + 4 diagonales
    skyCtx.globalAlpha = 1;
    skyCtx.fillStyle = '#ffffff';
    skyCtx.shadowColor = col.hex;
    skyCtx.shadowBlur = 14;
    skyCtx.beginPath();
    for (var p = 0; p < 16; p++) {
      var ang = (Math.PI / 8) * p - Math.PI / 2;
      var rr = p % 2 === 1 ? baseR * 0.18 : (p % 4 === 0 ? baseR * 1.45 : baseR * 0.6);
      skyCtx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    skyCtx.closePath();
    skyCtx.fill();
    skyCtx.restore();
  }

  function renderSky(now) {
    if (!skyRunning) return;
    skyRaf = global.requestAnimationFrame(renderSky);
    if (!SW || !SH) { resizeSky(); if (!SW) return; }

    var t = now / 1000;

    // Fondo degradado de noche profunda
    var bg = skyCtx.createLinearGradient(0, 0, 0, SH);
    bg.addColorStop(0, '#020612');
    bg.addColorStop(0.55, '#07122b');
    bg.addColorStop(1, '#102145');
    skyCtx.fillStyle = bg;
    skyCtx.fillRect(0, 0, SW, SH);

    drawMilkyWay();

    // Estrellas de fondo tintineando
    skyCtx.fillStyle = '#ffffff';
    for (var i = 0; i < bgStars.length; i++) {
      var s = bgStars[i];
      var tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      skyCtx.globalAlpha = s.alpha * tw;
      skyCtx.beginPath();
      skyCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      skyCtx.fill();
    }
    skyCtx.globalAlpha = 1;

    // Estrellas fugaces automáticas
    if (now >= nextShootAt) {
      spawnShootingStar();
      nextShootAt = now + U.rand(3200, 6800);
    }

    for (var k = shootingStars.length - 1; k >= 0; k--) {
      var sh = shootingStars[k];
      sh.age += 0.016;
      if (sh.age >= sh.life) { shootingStars.splice(k, 1); continue; }
      sh.x += sh.vx * 0.016;
      sh.y += sh.vy * 0.016;
      var fade = 1 - sh.age / sh.life;
      var mag = Math.hypot(sh.vx, sh.vy) || 1;
      var tx = sh.x - (sh.vx / mag) * sh.len;
      var ty = sh.y - (sh.vy / mag) * sh.len;
      var grad = skyCtx.createLinearGradient(sh.x, sh.y, tx, ty);
      grad.addColorStop(0, 'rgba(255, 248, 224, ' + fade.toFixed(2) + ')');
      grad.addColorStop(1, 'rgba(245, 199, 107, 0)');
      skyCtx.strokeStyle = grad;
      skyCtx.lineWidth = 2;
      skyCtx.beginPath();
      skyCtx.moveTo(sh.x, sh.y);
      skyCtx.lineTo(tx, ty);
      skyCtx.stroke();
    }

    // Constelación conectada de los amigos
    var stars = getActiveStars();
    if (stars.length > 1) {
      skyCtx.save();
      skyCtx.strokeStyle = 'rgba(245, 199, 107, 0.24)';
      skyCtx.lineWidth = 1.1;
      skyCtx.setLineDash([4, 6]);
      skyCtx.beginPath();
      for (var c = 0; c < stars.length; c++) {
        var pt = starCoords(stars[c]);
        if (c === 0) skyCtx.moveTo(pt.x, pt.y);
        else skyCtx.lineTo(pt.x, pt.y);
      }
      skyCtx.stroke();
      skyCtx.restore();
    }

    // Estrellas de los amigos + etiqueta de autor
    for (var w = 0; w < stars.length; w++) {
      var ws = stars[w];
      var pos = starCoords(ws);
      var col = COLOR_MAP[ws.colorId] || C.STAR_COLORS[0];
      var isSel = w === selectedIndex;
      var isHov = w === hoveredIndex;
      drawWishStar(pos.x, pos.y, col, t, w, isSel, isHov);

      skyCtx.save();
      skyCtx.font = (isSel || isHov ? '600 12px' : '500 11px') + ' "Plus Jakarta Sans", system-ui, sans-serif';
      skyCtx.textAlign = 'center';
      skyCtx.fillStyle = isSel ? '#fff6d8' : 'rgba(246, 239, 224, 0.72)';
      skyCtx.shadowColor = 'rgba(0,0,0,0.85)';
      skyCtx.shadowBlur = 4;
      var label = ws.author.length > 18 ? ws.author.slice(0, 17) + '…' : ws.author;
      skyCtx.fillText(label, pos.x, pos.y + (isSel ? 28 : 22));
      skyCtx.restore();
    }

    drawBethlehemHorizon(t);
  }

  function findStarAt(px, py) {
    var stars = getActiveStars();
    var hitR = SW < 640 ? 30 : 26;
    var best = -1, bestD = hitR;
    for (var i = 0; i < stars.length; i++) {
      var pt = starCoords(stars[i]);
      var d = Math.hypot(px - pt.x, py - pt.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /* ---------- Tarjeta papiro flotante y Tour ---------- */
  function showStarCard(index) {
    var stars = getActiveStars();
    if (!stars.length) { hideStarCard(); return; }
    selectedIndex = ((index % stars.length) + stars.length) % stars.length;
    var star = stars[selectedIndex];
    var col = COLOR_MAP[star.colorId] || C.STAR_COLORS[0];

    $('sp-type').textContent = star.type;
    $('sp-dot').style.background = col.hex;
    $('sp-dot').style.boxShadow = '0 0 10px ' + col.glow;
    $('sp-index').textContent = (selectedIndex + 1) + ' / ' + stars.length;
    $('sp-to').textContent = 'Para: ' + star.to;
    $('sp-msg').textContent = star.message;
    $('sp-author').textContent = '— ' + star.author;

    $('sky-popover').classList.add('is-open');
  }

  function hideStarCard() {
    selectedIndex = -1;
    var pop = $('sky-popover');
    if (pop) pop.classList.remove('is-open');
  }

  function setTour(active) {
    tourActive = !!active;
    var btn = $('btn-sky-tour');
    if (btn) {
      btn.classList.toggle('is-active', tourActive);
      btn.textContent = tourActive ? '⏸ Detener Tour' : '✨ Tour';
    }
    clearInterval(tourTimer);
    if (tourActive) {
      var startIdx = selectedIndex >= 0 ? selectedIndex : 0;
      showStarCard(startIdx);
      tourTimer = setInterval(function () {
        if (!skyRunning) { setTour(false); return; }
        showStarCard(selectedIndex + 1);
      }, TOUR_MS);
    }
  }

  function updateSkyCounters() {
    var n = getActiveStars().length;
    var label = '⭐ ' + n + (n === 1 ? ' estrella' : ' estrellas');
    var el = $('sky-counter');
    if (el) el.textContent = label;
    var menuEl = $('sky-menu-count');
    if (menuEl) menuEl.textContent = label + ' encendidas';
  }

  function startSkyLoop() {
    if (skyRunning) return;
    skyRunning = true;
    resizeSky();
    nextShootAt = global.performance.now() + 1800;
    skyRaf = global.requestAnimationFrame(renderSky);
  }

  function stopSkyLoop() {
    skyRunning = false;
    global.cancelAnimationFrame(skyRaf);
    setTour(false);
    hideStarCard();
  }

  function setupSkyCanvasEvents() {
    skyCanvas.addEventListener('click', function (e) {
      var rect = skyCanvas.getBoundingClientRect();
      var px = e.clientX - rect.left;
      var py = e.clientY - rect.top;
      var hit = findStarAt(px, py);
      if (hit >= 0) {
        if (tourActive) setTour(false);
        showStarCard(hit);
      } else {
        spawnShootingStar(px, py);
        if (selectedIndex >= 0 && !tourActive) hideStarCard();
      }
    });

    skyCanvas.addEventListener('mousemove', function (e) {
      var rect = skyCanvas.getBoundingClientRect();
      hoveredIndex = findStarAt(e.clientX - rect.left, e.clientY - rect.top);
      skyCanvas.style.cursor = hoveredIndex >= 0 ? 'pointer' : 'crosshair';
    });

    skyCanvas.addEventListener('mouseleave', function () {
      hoveredIndex = -1;
    });

    $('sp-prev').addEventListener('click', function () {
      if (tourActive) setTour(false);
      showStarCard(selectedIndex - 1);
    });
    $('sp-next').addEventListener('click', function () {
      if (tourActive) setTour(false);
      showStarCard(selectedIndex + 1);
    });
    $('sp-close').addEventListener('click', function () {
      if (tourActive) setTour(false);
      hideStarCard();
    });
    $('btn-sky-tour').addEventListener('click', function () {
      setTour(!tourActive);
    });
    $('btn-sky-write').addEventListener('click', function () {
      openPapiro();
    });
    $('btn-papiro-sky').addEventListener('click', function () {
      openSky();
    });
  }

  /* =====================================================
     5. NAVEGACIÓN Y CONEXIÓN CON EL HUB
     ===================================================== */
  function openPapiro() {
    App.Modal.close('modal-sky-menu');
    renderPapiroPreview();
    App.showScreen('papiro');
    triggerUnroll();
  }

  function openSky(focusStarId) {
    App.Modal.close('modal-sky-menu');
    App.showScreen('sky');
    if (focusStarId) {
      var stars = getActiveStars();
      var idx = stars.findIndex(function (s) { return s.id === focusStarId; });
      if (idx >= 0) {
        setTimeout(function () {
          if (App.state.currentScreen === 'sky') showStarCard(idx);
        }, 350);
      }
    }
  }

  App.Sky = {
    init: function () {
      App.registerScreen('papiro');
      App.registerScreen('sky');

      skyCanvas = $('sky-canvas');
      if (skyCanvas && skyCanvas.getContext) skyCtx = skyCanvas.getContext('2d');

      setupPapiro();
      if (skyCanvas) setupSkyCanvasEvents();
      initSkySync();

      // Conectar Tarjeta 3 del Hub con acceso directo tanto al Papiro como al Cielo
      if (App.Hub) {
        App.Hub.setCardHandler('sky', function () {
          updateSkyCounters();
          App.Modal.open('modal-sky-menu');
        });
      }
      var goPapiro = $('btn-menu-papiro');
      var goSky = $('btn-menu-sky');
      if (goPapiro) goPapiro.addEventListener('click', openPapiro);
      if (goSky) goSky.addEventListener('click', function () { openSky(); });

      if (global.ResizeObserver && skyCanvas) {
        new ResizeObserver(function () { if (skyRunning) resizeSky(); }).observe(skyCanvas);
      } else {
        global.addEventListener('resize', function () { if (skyRunning) resizeSky(); });
      }

      App.bus.on('screen:change', function (e) {
        if (e.screen === 'papiro') {
          renderPapiroPreview();
        }
        if (e.screen === 'sky') {
          App.Background.setOrnamentsVisible(false);
          App.Audio.switchTo(3);
          startSkyLoop();
        } else if (e.previous === 'sky') {
          stopSkyLoop();
          App.Background.setOrnamentsVisible(true);
          if (e.screen !== 'login') App.Audio.returnToMain();
        }
      });

      updateSkyCounters();
    },

    openPapiro: openPapiro,
    openSky: openSky,
    getStars: getActiveStars,
    getUserStars: function () { return userStars.slice(); },
    removeStar: removeStar,
    clearStars: clearStars
  };
})(window);
