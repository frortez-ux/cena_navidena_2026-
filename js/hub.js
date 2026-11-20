/* =========================================================
   hub.js — Pantalla principal (Hub)
   · Estrella de Belén + 2 ángeles (Canvas)
   · Modal de la Estrella (Pista 2)
   · Cuenta regresiva en vivo
   · 4 tarjetas principales
   · Modal de Ubicación de la Casa
   ========================================================= */
(function (global) {
  'use strict';

  var App = global.App;
  var C = App.CONST;
  var U = App.utils;

  function $(id) { return document.getElementById(id); }

  /* =====================================================
     1. ESTRELLA DE BELÉN + ÁNGELES (Canvas)
     ===================================================== */
  var T_TRAVEL = 2.8;   // viaje de las 3 estrellas
  var T_FLASH = 1.1;    // resplandor máximo
  var T_REVEAL = 1.6;   // aparición de la Estrella y los ángeles

  var stage, canvas, ctx, hitBtn, hint;
  var W = 0, H = 0, DPR = 1;
  var geo = { cx: 0, cy: 0, S: 0, starR: 0 };
  var seqStart = -1;      // ms en que inició la secuencia (-1 = estado reposo)
  var running = false;
  var rafId = 0;
  var ambient = [];       // destellos ambientales alrededor de la estrella
  var reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function computeGeometry() {
    geo.S = Math.min(H, W * 0.55);
    geo.cx = W / 2;
    geo.cy = H * 0.48;
    geo.starR = geo.S * 0.17;

    if (hitBtn) {
      var size = Math.max(64, geo.starR * 2.6);
      hitBtn.style.width = size + 'px';
      hitBtn.style.height = size + 'px';
      hitBtn.style.left = (geo.cx - size / 2) + 'px';
      hitBtn.style.top = (geo.cy - size / 2) + 'px';
    }

    ambient = [];
    var n = W < 640 ? 22 : 40;
    for (var i = 0; i < n; i++) {
      ambient.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: U.rand(0.6, 1.8),
        speed: U.rand(1, 3),
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function resizeStage() {
    if (!stage || !canvas) return;
    var rect = stage.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    DPR = Math.min(global.devicePixelRatio || 1, 2);
    var newW = Math.round(rect.width * DPR);
    var newH = Math.round(rect.height * DPR);
    if (canvas.width === newW && canvas.height === newH && W === rect.width && H === rect.height) return;
    W = rect.width;
    H = rect.height;
    canvas.width = newW;
    canvas.height = newH;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeGeometry();
  }

  /* --- Trayectorias de las 3 estrellas viajeras --- */
  function travelers() {
    var cx = geo.cx, cy = geo.cy;
    return [
      { x0: W * 0.03, y0: H * 0.12, kx: W * 0.18, ky: H * 0.95, delay: 0.0, color: '#fff1c1' },
      { x0: W * 0.97, y0: H * 0.2, kx: W * 0.86, ky: H * 0.92, delay: 0.12, color: '#ffe3a3' },
      { x0: W * 0.62, y0: -H * 0.08, kx: W * 0.98, ky: H * 0.05, delay: 0.24, color: '#ffffff' }
    ].map(function (s) { s.x1 = cx; s.y1 = cy; return s; });
  }

  function bezierPoint(s, t) {
    var it = 1 - t;
    return {
      x: it * it * s.x0 + 2 * it * t * s.kx + t * t * s.x1,
      y: it * it * s.y0 + 2 * it * t * s.ky + t * t * s.y1
    };
  }

  function drawGlow(x, y, radius, color, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
    g.addColorStop(0.25, color.replace('ALPHA', String(alpha * 0.8)));
    g.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTraveler(s, p) {
    // p: progreso 0..1 del viaje (ya con retraso aplicado)
    var steps = 26;
    for (var k = steps; k >= 0; k--) {
      var tt = easeInOutCubic(clamp01(p - k * 0.012));
      var pt = bezierPoint(s, tt);
      var a = (1 - k / steps);
      var r = geo.starR * 0.16 * (0.25 + a * 0.75);
      ctx.fillStyle = 'rgba(255,226,160,' + (a * 0.55).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    var head = bezierPoint(s, easeInOutCubic(p));
    drawGlow(head.x, head.y, geo.starR * 0.9, 'rgba(245,199,107,ALPHA)', 0.9);
    drawSparkStar(head.x, head.y, geo.starR * 0.42, 0.95);
  }

  /** Estrella de 4 puntas simple (viajeras y destellos). */
  function drawSparkStar(x, y, R, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var ang = (Math.PI / 4) * i - Math.PI / 2;
      var rr = i % 2 === 0 ? R : R * 0.18;
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Estrella de Belén: 8 puntas, rayo inferior largo, halo y destellos. */
  function drawBethlehemStar(x, y, R, t, alpha) {
    if (alpha <= 0) return;
    var pulse = 1 + Math.sin(t * 2.4) * 0.035;
    R *= pulse;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Halo amplio
    drawGlow(x, y, R * 3.2, 'rgba(245,199,107,ALPHA)', 0.42);

    // Rayos giratorios suaves
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.12);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 16; i++) {
      var len = R * (i % 2 === 0 ? 2.6 : 1.7) * (0.9 + 0.1 * Math.sin(t * 1.7 + i));
      var grad = ctx.createLinearGradient(0, 0, 0, -len);
      grad.addColorStop(0, 'rgba(255,241,193,0.38)');
      grad.addColorStop(1, 'rgba(255,241,193,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-R * 0.05, 0);
      ctx.lineTo(0, -len);
      ctx.lineTo(R * 0.05, 0);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(Math.PI / 8);
    }
    ctx.restore();

    // Rayo inferior largo (señalando el pesebre)
    var tail = ctx.createLinearGradient(x, y, x, y + R * 3.4);
    tail.addColorStop(0, 'rgba(255,248,225,0.9)');
    tail.addColorStop(1, 'rgba(255,241,193,0)');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(x - R * 0.09, y);
    ctx.lineTo(x, y + R * 3.4);
    ctx.lineTo(x + R * 0.09, y);
    ctx.closePath();
    ctx.fill();

    // Cuerpo de la estrella (4 puntas largas + 4 cortas)
    ctx.save();
    ctx.shadowColor = 'rgba(255,215,130,0.95)';
    ctx.shadowBlur = R * 0.9;
    var body = ctx.createRadialGradient(x, y, 0, x, y, R);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.35, '#fff6d8');
    body.addColorStop(0.75, '#f5c76b');
    body.addColorStop(1, '#d9a441');
    ctx.fillStyle = body;
    ctx.beginPath();
    for (var p = 0; p < 16; p++) {
      var ang = (Math.PI / 8) * p - Math.PI / 2;
      var rr;
      if (p % 2 === 1) rr = R * 0.13;
      else if (p % 4 === 0) rr = (p === 8 ? R * 1.35 : R);   // 4 puntas principales (la inferior más larga)
      else rr = R * 0.48;                                    // 4 diagonales
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Núcleo brillante
    drawGlow(x, y, R * 0.45, 'rgba(255,255,255,ALPHA)', 1);
    ctx.restore();
  }

  /** Ángel dorado luminoso. facing: 1 mira a la derecha, -1 a la izquierda. */
  function drawAngel(x, y, h, facing, t, alpha) {
    if (alpha <= 0) return;
    var s = h / 100;
    var flap = Math.sin(t * 2.6 + (facing > 0 ? 0 : 0.6));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(facing * s, s);

    var gold = ctx.createLinearGradient(-30, -60, 30, 50);
    gold.addColorStop(0, '#fff6d8');
    gold.addColorStop(0.45, '#f5c76b');
    gold.addColorStop(1, '#b8862f');

    var wingGold = ctx.createLinearGradient(-60, -60, 0, 10);
    wingGold.addColorStop(0, 'rgba(255,246,216,0.95)');
    wingGold.addColorStop(0.6, 'rgba(245,199,107,0.85)');
    wingGold.addColorStop(1, 'rgba(184,134,47,0.7)');

    ctx.shadowColor = 'rgba(245,199,107,0.85)';
    ctx.shadowBlur = 18;

    // Alas (lejana y cercana), pivotan en el hombro
    function wing(extraRot, scaleW, alphaW) {
      ctx.save();
      ctx.translate(-4, -16);
      ctx.rotate(-0.15 + flap * 0.28 + extraRot);
      ctx.scale(scaleW, 1);
      ctx.globalAlpha = alpha * alphaW;
      ctx.fillStyle = wingGold;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-14, -30, -40, -48, -58, -44);
      ctx.bezierCurveTo(-52, -36, -56, -28, -50, -22);
      ctx.bezierCurveTo(-54, -16, -50, -8, -42, -4);
      ctx.bezierCurveTo(-44, 2, -36, 8, -28, 8);
      ctx.bezierCurveTo(-26, 14, -16, 16, -8, 12);
      ctx.closePath();
      ctx.fill();
      // Plumas
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(122,79,16,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-30, -24, -50, -38);
      ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-28, -10, -44, -16);
      ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-24, 2, -36, 0);
      ctx.stroke();
      ctx.restore();
    }
    wing(-0.25, 0.85, 0.55);
    wing(0, 1, 1);

    // Túnica
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(-4, -22);
    ctx.quadraticCurveTo(8, -24, 9, -14);
    ctx.quadraticCurveTo(14, 14, 22, 42);
    ctx.quadraticCurveTo(2, 48, -20, 42);
    ctx.quadraticCurveTo(-14, 12, -10, -14);
    ctx.quadraticCurveTo(-9, -21, -4, -22);
    ctx.closePath();
    ctx.fill();

    // Pliegues de la túnica
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(122,79,16,0.35)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-4, 18, -8, 40);
    ctx.moveTo(4, -4); ctx.quadraticCurveTo(8, 18, 10, 42);
    ctx.stroke();

    // Brazos alzados alabando hacia la estrella
    ctx.shadowColor = 'rgba(245,199,107,0.85)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#f7d488';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    var lift = Math.sin(t * 1.6 + (facing > 0 ? 0 : 1)) * 2;
    ctx.beginPath();
    ctx.moveTo(4, -17);
    ctx.quadraticCurveTo(14, -24, 20, -40 + lift);
    ctx.moveTo(2, -15);
    ctx.quadraticCurveTo(16, -18, 25, -33 + lift);
    ctx.stroke();

    // Cabeza
    ctx.fillStyle = '#fff1c1';
    ctx.beginPath();
    ctx.arc(1, -31, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Halo
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(-1, -42, 8.5, 2.6, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawAmbient(t, alpha) {
    if (alpha <= 0) return;
    ctx.fillStyle = '#fff1c1';
    for (var i = 0; i < ambient.length; i++) {
      var a = ambient[i];
      var tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * a.speed + a.phase));
      ctx.globalAlpha = alpha * tw * 0.8;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render(now) {
    if (!running) return;
    rafId = global.requestAnimationFrame(render);
    if (!W || !H) { resizeStage(); if (!W) return; }

    var t = now / 1000;
    var cx = geo.cx, cy = geo.cy, R = geo.starR;
    ctx.clearRect(0, 0, W, H);

    var elapsed = seqStart < 0 ? Infinity : (now - seqStart) / 1000;
    var starAlpha = 1, starScale = 1, angelAlpha = 1, ambientAlpha = 1, flash = 0;

    if (elapsed < T_TRAVEL) {
      // a) Las 3 estrellas viajan desde distintos puntos del cielo
      starAlpha = 0; angelAlpha = 0; ambientAlpha = clamp01(elapsed / T_TRAVEL) * 0.5;
      drawAmbient(t, ambientAlpha);
      var list = travelers();
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        var p = clamp01((elapsed / T_TRAVEL - s.delay) / (1 - s.delay));
        if (p > 0) drawTraveler(s, p);
      }
      // Pre-resplandor al final del viaje
      var pre = clamp01((elapsed - (T_TRAVEL - 0.5)) / 0.5);
      if (pre > 0) drawGlow(cx, cy, R * (1 + pre * 2), 'rgba(245,199,107,ALPHA)', pre * 0.7);
      updateHint(false);
      return;
    }

    if (elapsed < T_TRAVEL + T_FLASH) {
      // b) Resplandor dorado máximo
      var f = (elapsed - T_TRAVEL) / T_FLASH;
      flash = Math.sin(Math.PI * f);
      starAlpha = clamp01(f * 1.6);
      starScale = 0.4 + 0.8 * f;
      angelAlpha = 0;
      ambientAlpha = 0.5 + 0.5 * f;
    } else if (elapsed < T_TRAVEL + T_FLASH + T_REVEAL) {
      // c) Vuelve a la normalidad: Estrella de Belén + ángeles
      var r = (elapsed - T_TRAVEL - T_FLASH) / T_REVEAL;
      starScale = 1.2 - 0.2 * easeInOutCubic(r);
      angelAlpha = easeInOutCubic(r);
    } else if (seqStart >= 0) {
      seqStart = -1; // secuencia completada
    }

    drawAmbient(t, ambientAlpha);

    // Ángeles a ambos lados
    var angelH = geo.S * 0.52;
    var offset = R * 2.75;
    var rise = (1 - angelAlpha) * angelH * 0.15;
    drawAngel(cx - offset, cy + geo.S * 0.1 + rise, angelH, 1, t, angelAlpha);
    drawAngel(cx + offset, cy + geo.S * 0.1 + rise, angelH, -1, t, angelAlpha);

    drawBethlehemStar(cx, cy, R * starScale, t, starAlpha);

    if (flash > 0) {
      drawGlow(cx, cy, geo.S * (0.4 + 1.4 * flash), 'rgba(255,214,130,ALPHA)', 0.85 * flash);
      ctx.fillStyle = 'rgba(255,236,190,' + (0.35 * flash).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    updateHint(angelAlpha >= 1);
  }

  var hintVisible = null;
  function updateHint(show) {
    if (hintVisible === show) return;
    hintVisible = show;
    if (hint) hint.classList.toggle('is-visible', show);
    if (hitBtn) hitBtn.classList.toggle('is-ready', show);
  }

  function startStage() {
    if (running) return;
    running = true;
    resizeStage();
    rafId = global.requestAnimationFrame(render);
  }

  function stopStage() {
    running = false;
    global.cancelAnimationFrame(rafId);
  }

  function playSequence() {
    hintVisible = null;
    seqStart = global.performance.now();
    if (reducedMotion) seqStart -= (T_TRAVEL + T_FLASH) * 1000;
  }

  /* =====================================================
     2. MODAL DE LA ESTRELLA (Pista 2)
     ===================================================== */
  function setupStarModal() {
    $('star-message').textContent = C.STAR_MESSAGE;

    var frame = $('nativity-frame');
    var img = $('nativity-photo');
    img.addEventListener('load', function () { frame.classList.add('has-photo'); });
    img.addEventListener('error', function () { frame.classList.remove('has-photo'); });
    img.src = App.state.media.fotoNacimiento.src;

    hitBtn.addEventListener('click', function () {
      if (seqStart >= 0) {
        // Si la secuencia sigue en curso, la completa al instante
        seqStart = global.performance.now() - (T_TRAVEL + T_FLASH + T_REVEAL) * 1000;
      }
      App.Modal.open('modal-star');
    });

    App.bus.on('modal:open', function (e) {
      if (e.id === 'modal-star') App.Audio.switchTo(2);
    });
    App.bus.on('modal:close', function (e) {
      if (e.id === 'modal-star') App.Audio.returnToMain();
    });
  }

  /* =====================================================
     3. CUENTA REGRESIVA
     ===================================================== */
  var TARGET = Date.parse(C.EVENT_DATE_ISO);
  var cdTimer = null;
  var cdEls = null;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function tickCountdown() {
    if (!cdEls) {
      cdEls = { d: $('cd-days'), h: $('cd-hours'), m: $('cd-minutes'), s: $('cd-seconds'), box: $('countdown'), done: $('cd-done') };
    }
    var diff = TARGET - Date.now();
    if (diff <= 0) {
      cdEls.box.hidden = true;
      cdEls.done.hidden = false;
      return;
    }
    var sec = Math.floor(diff / 1000);
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    cdEls.d.textContent = pad(d);
    cdEls.h.textContent = pad(h);
    cdEls.m.textContent = pad(m);
    cdEls.s.textContent = pad(s);
  }

  function startCountdown() {
    tickCountdown();
    clearInterval(cdTimer);
    cdTimer = setInterval(tickCountdown, 1000);
  }

  /* =====================================================
     4. TARJETAS
     ===================================================== */
  var cardHandlers = {
    roulette: function () { App.toast('🎡 La Ruleta de Comida se activa en la Fase 3'); },
    list: function () { App.toast('📋 La Lista en Vivo se activa en la Fase 3'); },
    sky: function () { App.toast('📜 El Papiro y el Cielo de Belén llegan en la Fase 4'); },
    location: function () { openLocation(); }
  };

  function setupCards() {
    document.querySelectorAll('.hub-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var fn = cardHandlers[card.getAttribute('data-card')];
        if (fn) fn();
      });
    });
  }

  function renderCounters() {
    $('hub-assigned').textContent = String(App.state.assignedCount);
    var n = App.state.skyStarsCount;
    $('card-sky-status').textContent = '⭐ ' + n + (n === 1 ? ' estrella encendida' : ' estrellas encendidas');
  }

  /* =====================================================
     5. MODAL DE UBICACIÓN
     ===================================================== */
  function renderLocation() {
    var loc = App.state.location;
    $('loc-address').textContent = loc.address;
    $('loc-datetime').textContent = loc.dateTime;
    $('loc-references').textContent = loc.references;
    $('loc-gmaps').href = loc.gmapsUrl;
    $('loc-waze').href = loc.wazeUrl;
  }

  function openLocation() {
    renderLocation();
    App.Modal.open('modal-location');
  }

  function copyText(text) {
    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Respaldo para file:// u orígenes no seguros
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  function setupLocation() {
    var btn = $('loc-copy');
    var original = btn.textContent;
    var timer = null;
    btn.addEventListener('click', function () {
      copyText(App.state.location.address).then(function () {
        btn.textContent = '✓ Copiada';
        btn.classList.add('is-done');
      }).catch(function () {
        btn.textContent = '⚠️ No se pudo copiar';
      }).then(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove('is-done');
        }, 2000);
      });
    });
    App.bus.on('location:updated', renderLocation);
    renderLocation();
  }

  /* =====================================================
     API pública / arranque
     ===================================================== */
  App.Hub = {
    init: function () {
      stage = $('star-stage');
      canvas = $('star-canvas');
      hitBtn = $('star-hit');
      hint = $('star-hint');
      if (!canvas || !canvas.getContext) return;
      ctx = canvas.getContext('2d');

      if (global.ResizeObserver) {
        new ResizeObserver(function () { if (running) resizeStage(); }).observe(stage);
      } else {
        global.addEventListener('resize', function () { if (running) resizeStage(); });
      }

      $('btn-relive').addEventListener('click', playSequence);

      setupStarModal();
      setupCards();
      setupLocation();
      startCountdown();
      renderCounters();

      App.bus.on('assignments:count', renderCounters);
      App.bus.on('sky:count', renderCounters);

      App.bus.on('screen:change', function (e) {
        if (e.screen === 'hub') {
          $('hub-name').textContent = U.firstName(App.state.user.name) || 'invitado';
          startStage();
          if (e.previous === 'welcome') playSequence();
        } else {
          stopStage();
          ['modal-star', 'modal-location'].forEach(function (id) { App.Modal.close(id); });
        }
      });
    },

    /** Permite a fases posteriores reemplazar la acción de una tarjeta. */
    setCardHandler: function (card, fn) { cardHandlers[card] = fn; },

    /** Cambia el texto de estado de una tarjeta (p. ej. lo que te tocó en la ruleta). */
    setCardStatus: function (card, text) {
      var el = $('card-' + card + '-status');
      if (el) el.textContent = text;
    },

    playSequence: playSequence,
    openLocation: openLocation
  };
})(window);
