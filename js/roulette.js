/* =========================================================
   roulette.js — Ruleta de 30 cupos, Confeti, Detalle y Lista en Vivo
   ========================================================= */
(function (global) {
  'use strict';

  var App = global.App;
  var C = App.CONST;
  var U = App.utils;

  var CATS = C.FOOD_CATEGORIES;
  var N = CATS.length;
  var SLICE = (Math.PI * 2) / N;

  function $(id) { return document.getElementById(id); }

  /* ---------- Estado de la ruleta ---------- */
  var canvas, ctx, spinBtn;
  var W = 0, DPR = 1;
  var angle = 0;           // ángulo actual de rotación (rad)
  var spinning = false;
  var winnerId = null;
  var lightsPhase = 0;
  var wheelRaf = 0;
  var wheelActive = false;
  var transitionTimer = null;

  /* ---------- Confeti en Canvas ---------- */
  var confCanvas, confCtx;
  var confetti = [];
  var confRaf = 0;
  var CONF_COLORS = ['#f5c76b', '#fff1c1', '#c22a3d', '#2ecc71', '#ffffff', '#e67e22'];

  function launchConfetti() {
    confCanvas = $('confetti-canvas');
    if (!confCanvas || !confCanvas.getContext) return;
    confCtx = confCanvas.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var cw = global.innerWidth, ch = global.innerHeight;
    confCanvas.width = Math.round(cw * dpr);
    confCanvas.height = Math.round(ch * dpr);
    confCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    confetti = [];
    var count = cw < 640 ? 90 : 140;
    for (var i = 0; i < count; i++) {
      var fromLeft = i % 2 === 0;
      var spread = U.rand(-0.7, 0.7);
      var speed = U.rand(260, 620);
      var dir = fromLeft ? -Math.PI * 0.35 + spread * 0.5 : -Math.PI * 0.65 + spread * 0.5;
      confetti.push({
        x: fromLeft ? cw * U.rand(0.15, 0.45) : cw * U.rand(0.55, 0.85),
        y: ch * U.rand(0.35, 0.65),
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed - U.rand(80, 220),
        w: U.rand(6, 12),
        h: U.rand(4, 8),
        rot: U.rand(0, Math.PI * 2),
        vrot: U.rand(-9, 9),
        color: U.pick(CONF_COLORS),
        life: U.rand(2.2, 3.6),
        age: 0
      });
    }

    var last = global.performance.now();
    global.cancelAnimationFrame(confRaf);
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      confCtx.clearRect(0, 0, cw, ch);
      var alive = 0;
      for (var j = 0; j < confetti.length; j++) {
        var p = confetti[j];
        p.age += dt;
        if (p.age >= p.life) continue;
        alive++;
        p.vy += 540 * dt;
        p.vx *= 0.992;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        var alpha = p.age > p.life * 0.7 ? 1 - (p.age - p.life * 0.7) / (p.life * 0.3) : 1;
        confCtx.save();
        confCtx.globalAlpha = Math.max(0, alpha);
        confCtx.translate(p.x, p.y);
        confCtx.rotate(p.rot);
        confCtx.fillStyle = p.color;
        confCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        confCtx.restore();
      }
      if (alive > 0) confRaf = global.requestAnimationFrame(tick);
      else confCtx.clearRect(0, 0, cw, ch);
    }
    confRaf = global.requestAnimationFrame(tick);
  }

  /* ---------- Dibujo de la Ruleta ---------- */
  function resizeWheel() {
    if (!canvas) return;
    var box = canvas.parentElement;
    if (!box) return;
    var rect = box.getBoundingClientRect();
    var size = Math.floor(Math.min(rect.width, rect.height));
    if (size < 40) return;
    DPR = Math.min(global.devicePixelRatio || 1, 2);
    var px = Math.round(size * DPR);
    if (canvas.width === px && W === size) return;
    W = size;
    canvas.width = px;
    canvas.height = px;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawWheel();
  }

  function drawWheel() {
    if (!ctx || !W) return;
    var cx = W / 2;
    var cy = W / 2;
    var outerR = W * 0.475;
    var wheelR = outerR * 0.91;

    ctx.clearRect(0, 0, W, W);

    // Sombra base
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = W * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = '#1d1206';
    ctx.fill();
    ctx.restore();

    // Aro exterior dorado
    var rimGrad = ctx.createLinearGradient(0, 0, W, W);
    rimGrad.addColorStop(0, '#fff1c1');
    rimGrad.addColorStop(0.35, '#f5c76b');
    rimGrad.addColorStop(0.7, '#9e6b1d');
    rimGrad.addColorStop(1, '#f5c76b');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Borde oscuro interior del aro
    ctx.beginPath();
    ctx.arc(cx, cy, wheelR + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#071024';
    ctx.fill();

    // Gajos rotados
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    for (var i = 0; i < N; i++) {
      var cat = CATS[i];
      var rem = App.Sync.getRemaining(cat.id);
      var isFull = rem <= 0;
      var a0 = i * SLICE;
      var a1 = a0 + SLICE;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, wheelR, a0, a1);
      ctx.closePath();

      // Gradiente radial del gajo
      var g = ctx.createRadialGradient(0, 0, wheelR * 0.15, 0, 0, wheelR);
      if (isFull) {
        g.addColorStop(0, '#182238');
        g.addColorStop(1, '#0b1222');
      } else {
        g.addColorStop(0, cat.color);
        g.addColorStop(1, shadeColor(cat.color, -28));
      }
      ctx.fillStyle = g;
      ctx.fill();

      // Resaltado si acaba de ganar
      if (winnerId && winnerId === cat.id) {
        ctx.fillStyle = 'rgba(245,199,107,0.32)';
        ctx.fill();
      }

      // Separador dorado
      ctx.strokeStyle = 'rgba(245,199,107,0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Ícono + texto radial
      ctx.save();
      ctx.rotate(a0 + SLICE / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      var iconSize = Math.max(13, Math.round(wheelR * 0.135));
      var fontSize = Math.max(9.5, Math.round(wheelR * 0.082));

      ctx.globalAlpha = isFull ? 0.38 : 1;
      ctx.font = iconSize + 'px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(cat.icon, wheelR * 0.9, 0);

      ctx.font = '700 ' + fontSize + 'px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = isFull ? 'rgba(246,239,224,0.55)' : '#fff8e7';
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 3;
      ctx.fillText(cat.shortName, wheelR * 0.74, 0);
      ctx.restore();
    }

    // Círculo central decorativo (detrás del botón HTML)
    ctx.beginPath();
    ctx.arc(0, 0, wheelR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#071024';
    ctx.fill();
    ctx.strokeStyle = '#f5c76b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();

    // Luces navideñas en el aro exterior
    var bulbCount = 18;
    var bulbRing = (outerR + wheelR) / 2;
    var bulbR = Math.max(2.6, outerR * 0.025);
    for (var b = 0; b < bulbCount; b++) {
      var ba = (Math.PI * 2 * b) / bulbCount;
      var bx = cx + Math.cos(ba) * bulbRing;
      var by = cy + Math.sin(ba) * bulbRing;
      var lit = ((b + Math.floor(lightsPhase)) % 2 === 0);
      ctx.beginPath();
      ctx.arc(bx, by, bulbR, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#fff8d6' : '#8a5a14';
      if (lit) {
        ctx.save();
        ctx.shadowColor = '#ffe49e';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fill();
      }
    }
  }

  function shadeColor(hex, percent) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = Math.max(0, Math.min(255, (num >> 16) + percent));
    var g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + percent));
    var b = Math.max(0, Math.min(255, (num & 0x0000ff) + percent));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function wheelLoop(now) {
    if (!wheelActive) return;
    wheelRaf = global.requestAnimationFrame(wheelLoop);
    var nextPhase = Math.floor(now / (spinning ? 140 : 650));
    if (nextPhase !== lightsPhase || spinning) {
      lightsPhase = nextPhase;
      if (!spinning) drawWheel();
    }
  }

  function startWheelLoop() {
    if (wheelActive) return;
    wheelActive = true;
    resizeWheel();
    drawWheel();
    wheelRaf = global.requestAnimationFrame(wheelLoop);
  }

  function stopWheelLoop() {
    wheelActive = false;
    global.cancelAnimationFrame(wheelRaf);
  }

  /* ---------- Lógica de giro ---------- */
  function pickWeightedAvailable() {
    var avail = App.Sync.getAvailableCategories();
    if (!avail.length) return null;
    var totalWeight = 0;
    avail.forEach(function (cat) { totalWeight += App.Sync.getRemaining(cat.id); });
    var roll = Math.random() * totalWeight;
    for (var i = 0; i < avail.length; i++) {
      roll -= App.Sync.getRemaining(avail[i].id);
      if (roll <= 0) return avail[i];
    }
    return avail[avail.length - 1];
  }

  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }

  function spin() {
    if (spinning) return;
    var user = App.state.user;
    if (!user.normalized) {
      App.showScreen('login');
      return;
    }

    // Si el invitado ya tiene asignación previa, bloquea y lleva directo a Detalle
    var existing = App.Sync.getUserAssignment(user.normalized);
    if (existing) {
      App.toast('Ya tienes tu asignación lista ✨');
      openDetail();
      return;
    }

    var targetCat = pickWeightedAvailable();
    if (!targetCat) {
      App.toast('¡Todos los 30 cupos de la cena ya fueron asignados! 🎄');
      return;
    }

    var targetIndex = CATS.findIndex(function (c) { return c.id === targetCat.id; });
    spinning = true;
    winnerId = null;
    updateSpinButton();

    // El puntero está arriba (-Math.PI / 2).
    // Queremos que el centro del gajo targetIndex quede bajo -Math.PI / 2 (con pequeña variación interna segura).
    var sliceCenter = targetIndex * SLICE + SLICE / 2;
    var jitter = U.rand(-SLICE * 0.3, SLICE * 0.3);
    var desiredMod = ((-Math.PI / 2 - (sliceCenter + jitter)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    var currentMod = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var delta = desiredMod - currentMod;
    if (delta <= 0) delta += Math.PI * 2;

    var extraTurns = (5 + Math.floor(Math.random() * 3)) * Math.PI * 2;
    var startAngle = angle;
    var totalDelta = extraTurns + delta;
    var duration = 4500;
    var t0 = global.performance.now();

    function animateSpin(now) {
      var p = Math.min(1, (now - t0) / duration);
      angle = startAngle + totalDelta * easeOutQuint(p);
      drawWheel();
      if (p < 1) {
        global.requestAnimationFrame(animateSpin);
      } else {
        angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        finishSpin(targetCat.id);
      }
    }
    global.requestAnimationFrame(animateSpin);
  }

  function finishSpin(categoryId) {
    var user = App.state.user;
    App.Sync.claimCategory(user.name, categoryId).then(function (res) {
      if (res.ok && res.assignment) {
        winnerId = res.assignment.categoryId;
        spinning = false;
        drawWheel();
        renderRouletteGrid();
        updateSpinButton();
        launchConfetti();

        var cat = App.Sync.getCategory(res.assignment.categoryId);
        if (cat) App.toast('🎉 ¡Te tocó ' + cat.icon + ' ' + cat.name + '!', 2800);

        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(function () {
          if (App.state.currentScreen === 'roulette') openDetail();
        }, 1300);
        return;
      }

      // Si justo se llenó por otro invitado en el mismo instante, intenta con otra disponible
      if (res.reason === 'full') {
        var fallback = pickWeightedAvailable();
        if (fallback) {
          finishSpin(fallback.id);
          return;
        }
      }

      spinning = false;
      updateSpinButton();
      App.toast('No se pudo asignar el cupo. Inténtalo de nuevo.');
    });
  }

  function updateSpinButton() {
    if (!spinBtn) return;
    var snap = App.Sync.getSnapshot();
    var full = snap.totalAssigned >= snap.totalSlots;
    var mine = App.Sync.getUserAssignment(App.state.user.normalized);
    spinBtn.disabled = spinning || full || !!mine;
    spinBtn.textContent = spinning ? '···' : (full ? 'LLENO' : 'GIRAR');
  }

  /* ---------- Renderizado de las 3 pantallas ---------- */
  function renderRouletteGrid() {
    var grid = $('roulette-grid');
    if (!grid) return;
    var snap = App.Sync.getSnapshot();
    $('roulette-counter').textContent = snap.totalAssigned + ' / ' + snap.totalSlots;

    grid.innerHTML = '';
    CATS.forEach(function (cat) {
      var rem = App.Sync.getRemaining(cat.id);
      var card = document.createElement('div');
      card.className = 'rg-card' + (rem === 0 ? ' is-full' : '') + (winnerId === cat.id ? ' is-winner' : '');
      card.innerHTML =
        '<div class="rg-top">' +
          '<span class="rg-ico">' + cat.icon + '</span>' +
          '<span class="rg-slots">' + rem + ' / ' + cat.slots + '</span>' +
        '</div>' +
        '<div class="rg-name"></div>' +
        '<div class="rg-bar"><span style="width:' + Math.round((rem / cat.slots) * 100) + '%"></span></div>';
      card.querySelector('.rg-name').textContent = cat.name;
      grid.appendChild(card);
    });
  }

  function renderDetail() {
    var assignment = App.Sync.getUserAssignment(App.state.user.normalized);
    if (!assignment) {
      App.showScreen('roulette');
      return;
    }
    var cat = App.Sync.getCategory(assignment.categoryId);
    if (!cat) return;

    $('detail-icon').textContent = cat.icon;
    $('detail-category').textContent = cat.name;
    $('detail-guest').textContent = assignment.name;
    $('detail-text').textContent = cat.text;
    var used = App.Sync.getSnapshot().counts[cat.id] || 0;
    $('detail-slots').textContent = 'Cupo ' + used + ' de ' + cat.slots;
  }

  function renderLiveList() {
    var grid = $('live-list-grid');
    if (!grid) return;
    var snap = App.Sync.getSnapshot();
    var myNorm = App.state.user.normalized;

    $('list-counter').textContent = snap.totalAssigned + ' / ' + snap.totalSlots + ' asignados';

    var actionBtn = $('btn-list-roulette');
    if (actionBtn) {
      var mine = App.Sync.getUserAssignment(myNorm);
      actionBtn.textContent = mine ? '🎁 Mi asignación' : '🎡 Ir a la Ruleta';
    }

    grid.innerHTML = '';
    CATS.forEach(function (cat) {
      var list = snap.byCategory[cat.id] || [];
      var card = document.createElement('div');
      card.className = 'll-card' + (list.length >= cat.slots ? ' is-complete' : '');

      var head = document.createElement('div');
      head.className = 'll-head';
      head.innerHTML =
        '<span class="ll-title"><span class="ll-ico">' + cat.icon + '</span><span class="ll-name"></span></span>' +
        '<span class="ll-count">' + list.length + ' / ' + cat.slots + '</span>';
      head.querySelector('.ll-name').textContent = cat.name;
      card.appendChild(head);

      var chips = document.createElement('div');
      chips.className = 'll-chips' + (cat.slots >= 6 ? ' is-two-col' : '');
      if (!list.length) {
        var empty = document.createElement('span');
        empty.className = 'll-empty';
        empty.textContent = 'Sin asignar aún';
        chips.appendChild(empty);
      } else {
        list.forEach(function (entry) {
          var chip = document.createElement('span');
          chip.className = 'll-chip' + (entry.normalized === myNorm ? ' is-me' : '');
          chip.textContent = entry.name;
          chip.title = entry.name;
          chips.appendChild(chip);
        });
      }
      card.appendChild(chips);
      grid.appendChild(card);
    });
  }

  function updateHubCards() {
    if (!App.Hub) return;
    var snap = App.Sync.getSnapshot();
    var mine = App.Sync.getUserAssignment(App.state.user.normalized);

    if (mine) {
      var cat = App.Sync.getCategory(mine.categoryId);
      App.Hub.setCardStatus('roulette', cat ? ('Te tocó: ' + cat.icon + ' ' + cat.shortName + ' · Ver detalle') : 'Ver tu asignación');
    } else if (snap.totalAssigned >= snap.totalSlots) {
      App.Hub.setCardStatus('roulette', '¡Los 30 cupos están completos!');
    } else {
      App.Hub.setCardStatus('roulette', 'Gira y descubre qué te toca llevar');
    }

    App.Hub.setCardStatus('list', snap.totalAssigned + ' / ' + snap.totalSlots + ' asignados · Ver lista');
  }

  /* ---------- Navegación ---------- */
  function openRouletteOrDetail() {
    var mine = App.Sync.getUserAssignment(App.state.user.normalized);
    if (mine) {
      openDetail();
      return;
    }
    winnerId = null;
    renderRouletteGrid();
    updateSpinButton();
    App.showScreen('roulette');
  }

  function openDetail() {
    renderDetail();
    App.showScreen('detail');
  }

  function openLiveList() {
    renderLiveList();
    App.showScreen('list');
  }

  /* ---------- Arranque ---------- */
  App.Roulette = {
    init: function () {
      App.registerScreen('roulette');
      App.registerScreen('detail');
      App.registerScreen('list');

      canvas = $('roulette-canvas');
      spinBtn = $('btn-spin');
      if (canvas && canvas.getContext) ctx = canvas.getContext('2d');

      if (spinBtn) spinBtn.addEventListener('click', spin);

      // Botones de navegación
      document.querySelectorAll('[data-go-hub]').forEach(function (btn) {
        btn.addEventListener('click', function () { App.showScreen('hub'); });
      });
      var toList = $('btn-detail-list');
      if (toList) toList.addEventListener('click', openLiveList);
      var fromList = $('btn-list-roulette');
      if (fromList) fromList.addEventListener('click', openRouletteOrDetail);

      // Conectar Tarjetas 1 y 2 del Hub
      if (App.Hub) {
        App.Hub.setCardHandler('roulette', openRouletteOrDetail);
        App.Hub.setCardHandler('list', openLiveList);
      }

      if (global.ResizeObserver && canvas && canvas.parentElement) {
        new ResizeObserver(function () { if (wheelActive) resizeWheel(); }).observe(canvas.parentElement);
      } else {
        global.addEventListener('resize', function () { if (wheelActive) resizeWheel(); });
      }

      App.bus.on('sync:updated', function () {
        updateHubCards();
        if (App.state.currentScreen === 'roulette') {
          renderRouletteGrid();
          updateSpinButton();
          drawWheel();
        } else if (App.state.currentScreen === 'list') {
          renderLiveList();
        } else if (App.state.currentScreen === 'detail') {
          if (App.Sync.getUserAssignment(App.state.user.normalized)) renderDetail();
          else App.showScreen('hub');
        }
      });

      App.bus.on('screen:change', function (e) {
        if (e.screen === 'hub') {
          updateHubCards();
        }
        if (e.screen === 'roulette') {
          // Bloquea entrar a girar si ya tiene asignación previa
          if (App.Sync.getUserAssignment(App.state.user.normalized)) {
            openDetail();
            return;
          }
          renderRouletteGrid();
          updateSpinButton();
          startWheelLoop();
        } else {
          stopWheelLoop();
          clearTimeout(transitionTimer);
        }
        if (e.screen === 'detail') renderDetail();
        if (e.screen === 'list') renderLiveList();
      });

      updateHubCards();
    },

    openRouletteOrDetail: openRouletteOrDetail,
    openDetail: openDetail,
    openLiveList: openLiveList
  };
})(window);
