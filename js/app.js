/* =========================================================
   app.js — Navegación entre pantallas y arranque (Fase 1)
   ========================================================= */
(function (global) {
  'use strict';

  var App = global.App;
  var C = App.CONST;
  var U = App.utils;

  function $(id) { return document.getElementById(id); }

  /* ---------- Navegación ---------- */
  var SCREENS = ['login', 'welcome', 'hub'];
  var SCREENS_WITHOUT_PLAYER = { login: true, welcome: true };

  function showScreen(name) {
    if (SCREENS.indexOf(name) === -1) return;
    var previous = App.state.currentScreen;
    SCREENS.forEach(function (s) {
      var node = $('screen-' + s);
      if (node) node.classList.toggle('is-active', s === name);
    });
    App.state.currentScreen = name;

    App.Background.setIntensity(name === 'welcome' ? 2 : 1);
    App.Audio.showPlayer(!SCREENS_WITHOUT_PLAYER[name]);

    if (name === 'welcome') startWelcomeEffects();
    else stopWelcomeEffects();

    App.bus.emit('screen:change', { screen: name, previous: previous });
  }
  App.showScreen = showScreen;

  /** Permite a otros módulos registrar nuevas pantallas (Fases 3 y 4). */
  App.registerScreen = function (name, options) {
    if (SCREENS.indexOf(name) === -1) SCREENS.push(name);
    if (options && options.hidePlayer) SCREENS_WITHOUT_PLAYER[name] = true;
  };

  /* ---------- Modales genéricos ---------- */
  var openStack = [];
  App.Modal = {
    open: function (id) {
      var modal = $(id);
      if (!modal || modal.classList.contains('is-open')) return;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      openStack.push(id);
      App.bus.emit('modal:open', { id: id });
    },
    close: function (id) {
      var modal = $(id);
      if (!modal || !modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      openStack = openStack.filter(function (m) { return m !== id; });
      App.bus.emit('modal:close', { id: id });
    },
    isOpen: function (id) {
      var modal = $(id);
      return !!(modal && modal.classList.contains('is-open'));
    }
  };

  function setupModals() {
    document.querySelectorAll('.modal').forEach(function (modal) {
      modal.querySelectorAll('[data-close-modal]').forEach(function (n) {
        n.addEventListener('click', function () { App.Modal.close(modal.id); });
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openStack.length) App.Modal.close(openStack[openStack.length - 1]);
    });
  }

  /* ---------- Aviso flotante (toast) ---------- */
  var toastTimer = null;
  App.toast = function (message, ms) {
    var t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, ms || 2600);
  };

  /* ---------- Login ---------- */
  function setupLogin() {
    var form = $('login-form');
    var nameInput = $('login-name');
    var passInput = $('login-pass');
    var passField = $('password-field');
    var toggleBtn = $('btn-toggle-pass');
    var errorBox = $('login-error');

    var last = U.storage.get(C.STORAGE_KEYS.lastName, '');
    if (last) nameInput.value = last;

    toggleBtn.addEventListener('click', function () {
      var show = passInput.type === 'password';
      passInput.type = show ? 'text' : 'password';
      toggleBtn.textContent = show ? '🙈' : '👁️';
      toggleBtn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      passInput.focus();
    });

    [nameInput, passInput].forEach(function (input) {
      input.addEventListener('input', function () {
        errorBox.textContent = '';
        passField.classList.remove('has-error');
      });
    });

    function fail(message, focusEl, shakePass) {
      errorBox.textContent = message;
      if (shakePass) passField.classList.add('has-error');
      form.classList.remove('shake');
      void form.offsetWidth; // reinicia la animación
      form.classList.add('shake');
      focusEl.focus();
    }

    form.addEventListener('animationend', function () { form.classList.remove('shake'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var rawName = nameInput.value.replace(/\s+/g, ' ').trim();
      var pass = passInput.value.normalize('NFC');

      if (rawName.length < 2) {
        fail('Escribe tu nombre completo para continuar.', nameInput, false);
        return;
      }
      if (pass !== C.PASSWORD.normalize('NFC')) {
        fail('Contraseña incorrecta. Revisa e inténtalo de nuevo.', passInput, true);
        passInput.select();
        return;
      }

      App.state.user.name = U.prettyName(rawName);
      App.state.user.normalized = U.normalizeName(rawName);
      U.storage.set(C.STORAGE_KEYS.lastName, App.state.user.name);

      passInput.value = '';
      passInput.type = 'password';
      toggleBtn.textContent = '👁️';

      $('welcome-name').textContent = App.state.user.name;
      $('hub-name').textContent = U.firstName(App.state.user.name);
      showScreen('welcome');
    });
  }

  /* ---------- Indicador de medios ---------- */
  function renderMediaIndicator() {
    var loaded = App.countLoadedMedia();
    var total = Object.keys(App.state.media).length;
    var orn = App.state.ornamentImages.length;
    var mi = $('mi-media');
    var mo = $('mi-ornaments');
    mi.textContent = '🎞️ Medios ' + loaded + '/' + total;
    mo.textContent = '🎄 Esferas ' + orn;
    mi.classList.toggle('is-on', loaded > 0);
    mo.classList.toggle('is-on', orn > 0);
    renderMediaStatusList();
  }

  function renderMediaStatusList() {
    var list = $('media-status-list');
    if (!list) return;
    var media = App.state.media;
    list.innerHTML = '';
    Object.keys(media).forEach(function (key) {
      var li = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = C.MEDIA_LABELS[key] || key;
      var badge = document.createElement('span');
      badge.className = 'badge ' + (media[key].loaded ? 'badge-ok' : 'badge-off');
      badge.textContent = media[key].loaded ? 'Cargado' : 'Pendiente';
      li.appendChild(label);
      li.appendChild(badge);
      list.appendChild(li);
    });
    var li2 = document.createElement('li');
    li2.innerHTML = '<span>🎄 Esferas de amigos</span>';
    var b2 = document.createElement('span');
    var n = App.state.ornamentImages.length;
    b2.className = 'badge ' + (n ? 'badge-ok' : 'badge-off');
    b2.textContent = n + ' fotos';
    li2.appendChild(b2);
    list.appendChild(li2);
  }

  /** Comprueba si existen las fotos por defecto en la carpeta. */
  function probeImages() {
    ['fotoGrupal', 'fotoNacimiento'].forEach(function (key) {
      var img = new Image();
      img.onload = function () { App.setMediaStatus(key, true); };
      img.onerror = function () { App.setMediaStatus(key, false); };
      img.src = App.state.media[key].src;
    });
  }

  /* ---------- Foto de Bienvenida ---------- */
  function setupWelcomePhoto() {
    var frame = document.querySelector('#screen-welcome .photo-frame');
    var img = $('welcome-photo');
    img.addEventListener('load', function () { frame.classList.add('has-photo'); });
    img.addEventListener('error', function () { frame.classList.remove('has-photo'); });
    img.src = App.state.media.fotoGrupal.src;
  }

  /* ---------- Efectos de Bienvenida ---------- */
  var BULB_COLORS = ['#ff4d5e', '#f5c76b', '#4ee39a', '#6fa8ff', '#fff1c1'];

  function buildGarland() {
    var swags = global.innerWidth < 640 ? 3 : 5;
    var bulbsPerSwag = global.innerWidth < 640 ? 5 : 6;
    var depth = 62; // en unidades del viewBox (0-100)
    var top = 8;

    // Cable (viewBox 1000 x 100)
    var d = '';
    var steps = 200;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var x = t * 1000;
      var y = top + depth * Math.abs(Math.sin(Math.PI * swags * t));
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    $('garland-path').setAttribute('d', d);

    // Focos colgando del cable
    var holder = $('garland-bulbs');
    holder.innerHTML = '';
    var total = swags * bulbsPerSwag;
    for (var b = 0; b < total; b++) {
      var tt = (b + 0.5) / total;
      var yy = top + depth * Math.abs(Math.sin(Math.PI * swags * tt));
      var bulb = document.createElement('span');
      bulb.className = 'bulb';
      bulb.style.left = (tt * 100).toFixed(2) + '%';
      bulb.style.top = 'calc(' + yy.toFixed(2) + '% + 3px)';
      bulb.style.setProperty('--c', BULB_COLORS[b % BULB_COLORS.length]);
      bulb.style.setProperty('--d', U.rand(1.1, 2.2).toFixed(2) + 's');
      bulb.style.setProperty('--delay', (-Math.random() * 2).toFixed(2) + 's');
      holder.appendChild(bulb);
    }
  }

  function buildSparkles() {
    var holder = $('sparkles');
    holder.innerHTML = '';
    var n = global.innerWidth < 640 ? 14 : 26;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'sparkle';
      s.style.left = U.rand(2, 98).toFixed(1) + '%';
      s.style.top = U.rand(8, 96).toFixed(1) + '%';
      s.style.setProperty('--s', Math.round(U.rand(8, 20)) + 'px');
      s.style.setProperty('--d', U.rand(1.8, 3.6).toFixed(2) + 's');
      s.style.setProperty('--delay', (-Math.random() * 3).toFixed(2) + 's');
      holder.appendChild(s);
    }
  }

  function startWelcomeEffects() {
    buildGarland();
    buildSparkles();
  }

  function stopWelcomeEffects() {
    var s = $('sparkles');
    if (s) s.innerHTML = '';
  }

  /* ---------- Modal Medios / Org (preparado para Fase 5) ---------- */
  function setupMediaModal() {
    function open() {
      renderMediaStatusList();
      App.Modal.open('modal-media');
    }
    $('btn-media-login').addEventListener('click', open);
    var hubBtn = $('btn-media-hub');
    if (hubBtn) hubBtn.addEventListener('click', open);
    App.openMediaModal = open;
    App.closeMediaModal = function () { App.Modal.close('modal-media'); };
  }

  /* ---------- Arranque ---------- */
  function init() {
    App.Background.init();
    App.Audio.init();

    setupModals();
    setupLogin();
    setupWelcomePhoto();
    setupMediaModal();
    if (App.Hub) App.Hub.init();
    if (App.Sync) App.Sync.init();
    if (App.Roulette) App.Roulette.init();
    if (App.Sky) App.Sky.init();

    App.bus.on('media:updated', renderMediaIndicator);
    App.bus.on('ornaments:updated', renderMediaIndicator);
    renderMediaIndicator();
    probeImages();

    $('btn-continue').addEventListener('click', function () {
      App.Audio.startMain();
      showScreen('hub');
    });

    $('btn-logout').addEventListener('click', function () {
      App.Audio.stopAll();
      App.state.user = { name: '', normalized: '' };
      showScreen('login');
      setTimeout(function () { $('login-pass').focus(); }, 400);
    });

    var resizeTimer = null;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (App.state.currentScreen === 'welcome') buildGarland();
      }, 200);
    });

    showScreen('login');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
