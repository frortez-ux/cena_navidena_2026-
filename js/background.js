/* =========================================================
   background.js — Canvas animado: nieve + esferas navideñas
   · #bg-canvas: nieve + esferas de fondo (70% en márgenes laterales en escritorio)
   · #fg-canvas: capa frontal sutil con pocas esferas SOLO en los bordes extremos
   ========================================================= */
(function (global) {
  'use strict';

  var App = global.App;
  var rand = App.utils.rand;

  var PALETTES = [
    { name: 'rubi', light: '#ff8a98', mid: '#c22a3d', dark: '#4a0710' },
    { name: 'dorado', light: '#fff4cf', mid: '#f5c76b', dark: '#7a4f10' },
    { name: 'esmeralda', light: '#8ff0bd', mid: '#1f7a52', dark: '#06261a' },
    { name: 'azul', light: '#9fbcff', mid: '#24427f', dark: '#050c1e' }
  ];

  var canvas, ctx;
  var fgCanvas, fgCtx;
  var W = 0, H = 0, DPR = 1;
  var flakes = [];
  var ornaments = [];
  var fgOrnaments = [];
  var baseFlakeCount = 0;
  var intensity = 1;          // valor actual (suavizado)
  var targetIntensity = 1;    // 1 = normal, 2 = Bienvenida
  var ornamentVis = 1;        // opacidad global de esferas (0 en Cielo de Belén, 1 normal)
  var targetOrnamentVis = 1;
  var lastTime = 0;
  var running = false;
  var reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nieve ---------- */
  function makeFlake(randomY) {
    var depth = Math.random(); // 0 = lejos, 1 = cerca
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : rand(-40, -5),
      r: 0.6 + depth * 2.3,
      vy: 18 + depth * 44,           // px/s
      drift: rand(-12, 12),
      phase: Math.random() * Math.PI * 2,
      wobble: rand(0.4, 1.4),
      alpha: 0.35 + depth * 0.58
    };
  }

  function buildFlakes() {
    baseFlakeCount = Math.min(220, Math.round((W * H) / 9500));
    if (reducedMotion) baseFlakeCount = Math.round(baseFlakeCount * 0.4);
    var total = baseFlakeCount * 2; // reserva para el modo intenso
    flakes = [];
    for (var i = 0; i < total; i++) flakes.push(makeFlake(true));
  }

  /* ---------- Esferas ---------- */
  function bgOrnamentCount() {
    var n = W < 640 ? 7 : W < 1100 ? 11 : 15;
    return reducedMotion ? Math.ceil(n / 2) : n;
  }

  function fgOrnamentCount() {
    if (reducedMotion || W < 860) return 0; // desactivada en móvil / tablet estrecha
    return W < 1200 ? 2 : 4;
  }

  /** Elige una coordenada X favoreciendo márgenes laterales en escritorio (~70%). */
  function pickBgX(r) {
    var pad = r + 8;
    if (W >= 820) {
      if (Math.random() < 0.72) {
        // Márgenes laterales libres: izquierda 2%-18% o derecha 82%-98%
        var leftSide = Math.random() < 0.5;
        var minX = leftSide ? Math.max(pad, W * 0.02) : Math.max(pad, W * 0.82);
        var maxX = leftSide ? Math.min(W - pad, W * 0.18) : Math.min(W - pad, W * 0.98);
        return rand(minX, Math.max(minX + 1, maxX));
      }
      // 28% restante en zonas abiertas centrales
      return rand(W * 0.19, W * 0.81);
    }
    // En móvil: ligero sesgo hacia los bordes laterales
    if (Math.random() < 0.55) {
      var left = Math.random() < 0.5;
      return left ? rand(pad, Math.max(pad + 1, W * 0.25)) : rand(Math.min(W - pad - 1, W * 0.75), W - pad);
    }
    return rand(pad, Math.max(pad + 1, W - pad));
  }

  /** Coordenada X estrictamente en bordes extremos para la capa frontal (sin tapar UI). */
  function pickFgX(r, side) {
    var pad = r + 6;
    if (side === 0) {
      var maxL = Math.max(pad + 1, Math.min(W * 0.085, pad + 36));
      return rand(pad, maxL);
    }
    var minR = Math.min(W - pad - 1, Math.max(W * 0.915, W - pad - 36));
    return rand(minR, W - pad);
  }

  function makeOrnament(randomY, isFg, slotIndex) {
    var r = isFg
      ? rand(28, 42)
      : (W < 640 ? rand(18, 28) : rand(26, 44));
    var imgs = App.state.ornamentImages;
    var useImage = imgs.length > 0;
    var side = isFg ? (slotIndex % 2) : 0;
    return {
      x: isFg ? pickFgX(r, side) : pickBgX(r),
      y: randomY ? rand(-H * 0.15, H) : rand(-r * 6, -r * 3),
      r: r,
      vy: rand(16, 30) * (r / 32),
      swingAmp: isFg ? rand(0.1, 0.22) : rand(0.15, 0.34),
      swingSpeed: rand(0.65, 1.2),
      phase: Math.random() * Math.PI * 2,
      palette: App.utils.pick(PALETTES),
      imageIndex: useImage ? Math.floor(Math.random() * imgs.length) : -1,
      alpha: isFg ? rand(0.92, 1) : rand(0.88, 1),
      side: side
    };
  }

  function buildOrnaments() {
    ornaments = [];
    var n = bgOrnamentCount();
    for (var i = 0; i < n; i++) ornaments.push(makeOrnament(true, false, i));

    fgOrnaments = [];
    var fn = fgOrnamentCount();
    for (var j = 0; j < fn; j++) fgOrnaments.push(makeOrnament(true, true, j));
  }

  function roundRect(targetCtx, x, y, w, h, rr) {
    targetCtx.beginPath();
    targetCtx.moveTo(x + rr, y);
    targetCtx.lineTo(x + w - rr, y);
    targetCtx.quadraticCurveTo(x + w, y, x + w, y + rr);
    targetCtx.lineTo(x + w, y + h - rr);
    targetCtx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    targetCtx.lineTo(x + rr, y + h);
    targetCtx.quadraticCurveTo(x, y + h, x, y + h - rr);
    targetCtx.lineTo(x, y + rr);
    targetCtx.quadraticCurveTo(x, y, x + rr, y);
    targetCtx.closePath();
  }

  function drawOrnament(targetCtx, o, t) {
    var angle = Math.sin(t * o.swingSpeed + o.phase) * o.swingAmp;
    var r = o.r;
    var capW = r * 0.54;
    var capH = r * 0.32;
    var ringR = r * 0.16;
    var capTop = -r - capH + r * 0.12;
    var ringCy = capTop - ringR * 0.7;
    var pivotY = ringCy - ringR - r * 0.5;

    targetCtx.save();
    targetCtx.globalAlpha = o.alpha * ornamentVis;
    targetCtx.translate(o.x, o.y + pivotY);
    targetCtx.rotate(angle);
    targetCtx.translate(0, -pivotY);

    // Hilo dorado
    targetCtx.strokeStyle = 'rgba(245,199,107,0.65)';
    targetCtx.lineWidth = 1.1;
    targetCtx.beginPath();
    targetCtx.moveTo(0, pivotY);
    targetCtx.lineTo(0, ringCy - ringR);
    targetCtx.stroke();

    // Aro superior
    targetCtx.strokeStyle = '#f5c76b';
    targetCtx.lineWidth = Math.max(1.3, r * 0.065);
    targetCtx.beginPath();
    targetCtx.arc(0, ringCy, ringR, 0, Math.PI * 2);
    targetCtx.stroke();

    // Casquillo dorado
    var capGrad = targetCtx.createLinearGradient(-capW / 2, 0, capW / 2, 0);
    capGrad.addColorStop(0, '#8a5a14');
    capGrad.addColorStop(0.35, '#fff1c1');
    capGrad.addColorStop(0.6, '#f5c76b');
    capGrad.addColorStop(1, '#7a4f10');
    targetCtx.fillStyle = capGrad;
    roundRect(targetCtx, -capW / 2, capTop, capW, capH, r * 0.06);
    targetCtx.fill();
    // Estrías del casquillo
    targetCtx.strokeStyle = 'rgba(90,60,10,0.45)';
    targetCtx.lineWidth = 0.8;
    for (var i = 1; i < 4; i++) {
      var sx = -capW / 2 + (capW / 4) * i;
      targetCtx.beginPath();
      targetCtx.moveTo(sx, capTop + r * 0.04);
      targetCtx.lineTo(sx, capTop + capH - r * 0.04);
      targetCtx.stroke();
    }

    // Cuerpo de la esfera
    var img = o.imageIndex >= 0 ? App.state.ornamentImages[o.imageIndex] : null;
    var imgReady = img && img.complete && img.naturalWidth > 0;

    targetCtx.save();
    targetCtx.shadowColor = imgReady ? 'rgba(245,199,107,0.55)' : o.palette.mid;
    targetCtx.shadowBlur = r * 0.7;
    targetCtx.beginPath();
    targetCtx.arc(0, 0, r, 0, Math.PI * 2);

    if (imgReady) {
      targetCtx.fillStyle = '#071024';
      targetCtx.fill();
      targetCtx.shadowBlur = 0;
      targetCtx.clip();
      var s = Math.min(img.naturalWidth, img.naturalHeight);
      targetCtx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, -r, -r, r * 2, r * 2);
      // Viñeta de cristal muy suave para no oscurecer las caras
      var vg = targetCtx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.45, 0, 0, r);
      vg.addColorStop(0, 'rgba(255,255,255,0)');
      vg.addColorStop(1, 'rgba(7,16,36,0.28)');
      targetCtx.fillStyle = vg;
      targetCtx.fillRect(-r, -r, r * 2, r * 2);
    } else {
      var g = targetCtx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, o.palette.light);
      g.addColorStop(0.45, o.palette.mid);
      g.addColorStop(1, o.palette.dark);
      targetCtx.fillStyle = g;
      targetCtx.fill();
    }
    targetCtx.restore();

    // Borde dorado nítido
    targetCtx.strokeStyle = imgReady ? 'rgba(245,199,107,0.95)' : 'rgba(255,241,193,0.38)';
    targetCtx.lineWidth = imgReady ? Math.max(2, r * 0.08) : 1.2;
    targetCtx.beginPath();
    targetCtx.arc(0, 0, r, 0, Math.PI * 2);
    targetCtx.stroke();

    // Banda decorativa (solo esferas sin foto)
    if (!imgReady) {
      targetCtx.strokeStyle = 'rgba(255,241,193,0.4)';
      targetCtx.lineWidth = Math.max(1.1, r * 0.055);
      targetCtx.beginPath();
      targetCtx.ellipse(0, r * 0.05, r * 0.98, r * 0.26, 0, 0, Math.PI);
      targetCtx.stroke();
    }

    // Reflejo de cristal (más discreto sobre fotos para preservar nitidez)
    targetCtx.fillStyle = imgReady ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.36)';
    targetCtx.beginPath();
    targetCtx.ellipse(-r * 0.38, -r * 0.44, r * 0.26, r * 0.13, -0.7, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.fillStyle = imgReady ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.75)';
    targetCtx.beginPath();
    targetCtx.arc(-r * 0.52, -r * 0.22, r * 0.055, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.restore();
  }

  /* ---------- Bucle ---------- */
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    var t = now / 1000;

    intensity += (targetIntensity - intensity) * Math.min(1, dt * 1.5);
    ornamentVis += (targetOrnamentVis - ornamentVis) * Math.min(1, dt * 3.2);

    ctx.clearRect(0, 0, W, H);
    if (fgCtx) fgCtx.clearRect(0, 0, W, H);

    // Esferas de fondo
    if (ornamentVis > 0.01) {
      for (var j = 0; j < ornaments.length; j++) {
        var o = ornaments[j];
        o.y += o.vy * dt;
        if (o.y - o.r * 4 > H) ornaments[j] = makeOrnament(false, false, j);
        else {
          ctx.save();
          ctx.globalAlpha = ornamentVis;
          drawOrnament(ctx, o, t);
          ctx.restore();
        }
      }
    }

    // Nieve
    var active = Math.min(flakes.length, Math.round(baseFlakeCount * intensity));
    var speedBoost = 0.85 + intensity * 0.15;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < active; i++) {
      var f = flakes[i];
      f.y += f.vy * speedBoost * dt;
      f.x += (f.drift + Math.sin(t * f.wobble + f.phase) * 14) * dt;
      if (f.y - f.r > H || f.x < -20 || f.x > W + 20) {
        flakes[i] = makeFlake(false);
        continue;
      }
      ctx.globalAlpha = f.alpha * (0.25 + 0.75 * ornamentVis);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Capa frontal sutil (solo bordes extremos en escritorio)
    if (fgCtx && fgOrnaments.length && ornamentVis > 0.01) {
      for (var k = 0; k < fgOrnaments.length; k++) {
        var fo = fgOrnaments[k];
        fo.y += fo.vy * dt;
        if (fo.y - fo.r * 4 > H) fgOrnaments[k] = makeOrnament(false, true, k);
        else {
          fgCtx.save();
          fgCtx.globalAlpha = ornamentVis;
          drawOrnament(fgCtx, fo, t);
          fgCtx.restore();
        }
      }
    }

    global.requestAnimationFrame(frame);
  }

  function resizeCanvas(el, context) {
    el.width = Math.round(W * DPR);
    el.height = Math.round(H * DPR);
    el.style.width = W + 'px';
    el.style.height = H + 'px';
    context.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function resize() {
    DPR = Math.min(global.devicePixelRatio || 1, 2);
    W = global.innerWidth;
    H = global.innerHeight;
    resizeCanvas(canvas, ctx);
    if (fgCanvas && fgCtx) resizeCanvas(fgCanvas, fgCtx);
    buildFlakes();
    buildOrnaments();
  }

  var resizeTimer = null;

  /* ---------- API pública ---------- */
  App.Background = {
    init: function () {
      canvas = document.getElementById('bg-canvas');
      if (!canvas || !canvas.getContext) return;
      ctx = canvas.getContext('2d');
      fgCanvas = document.getElementById('fg-canvas');
      if (fgCanvas && fgCanvas.getContext) fgCtx = fgCanvas.getContext('2d');
      resize();
      global.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
      });
      running = true;
      lastTime = global.performance.now();
      global.requestAnimationFrame(frame);
    },
    /** 1 = normal, 2 = doble intensidad (Bienvenida). */
    setIntensity: function (value) {
      targetIntensity = Math.max(0.5, Math.min(2, Number(value) || 1));
    },
    /** Muestra u oculta suavemente las esferas (ocultas en el Cielo de Belén). */
    setOrnamentsVisible: function (visible) {
      targetOrnamentVis = visible ? 1 : 0;
    },
    /** Recibe un arreglo de HTMLImageElement circulares/cuadradas para las esferas. */
    setOrnamentImages: function (images) {
      App.state.ornamentImages = Array.isArray(images) ? images.slice() : [];
      if (ctx) buildOrnaments();
      App.bus.emit('ornaments:updated', { count: App.state.ornamentImages.length });
    }
  };
})(window);
