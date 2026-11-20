/* =========================================================
   audio.js — Controlador de 3 pistas reales (<audio>)
   Pista 1: Principal · Pista 2: Estrella · Pista 3: Cielo de Belén
   ========================================================= */
(function (global) {
  'use strict';

  var App = global.App;
  var C = App.CONST;

  var tracks = {};          // { 1: HTMLAudioElement, 2: ..., 3: ... }
  var available = {};       // { 1: true|false|null }
  var activeTrack = 1;      // pista que debe sonar ahora
  var mainResumeTime = 0;   // segundo exacto donde se pausó la Pista 1
  var pendingSeek = null;   // seek pendiente si la pista aún no tiene metadatos
  var volume = 0.7;
  var muted = false;
  var started = false;      // true tras el primer "Continuar a la Cena"
  var ui = {};

  function el(id) { return document.getElementById(id); }

  /* ---------- Reproducción interna ---------- */
  function safePlay(n) {
    var a = tracks[n];
    if (!a) return;
    if (available[n] === false) { updateUI(); return; }
    var p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        if (err && err.name === 'NotAllowedError') {
          console.info('[audio] Reproducción bloqueada por el navegador hasta una interacción.');
        } else if (err && err.name !== 'AbortError') {
          console.warn('[audio] No se pudo reproducir la pista ' + n + ':', err.message || err);
        }
        updateUI();
      });
    }
    updateUI();
  }

  function stop(n) {
    var a = tracks[n];
    if (!a) return;
    a.pause();
    try { a.currentTime = 0; } catch (e) { /* sin metadatos aún */ }
  }

  function seekMain(time) {
    var a = tracks[1];
    if (!a) return;
    if (a.readyState >= 1) {
      try { a.currentTime = time; } catch (e) { pendingSeek = time; }
    } else {
      pendingSeek = time;
    }
  }

  /* ---------- UI del reproductor ---------- */
  function updateUI() {
    if (!ui.root) return;
    var a = tracks[activeTrack];
    var isPlaying = !!(a && !a.paused && !a.ended);
    var name = C.TRACKS[activeTrack].name;

    ui.track.textContent = name;
    ui.play.textContent = isPlaying ? '❚❚' : '▶';
    ui.play.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir');
    ui.mute.textContent = muted || volume === 0 ? '🔇' : volume < 0.4 ? '🔉' : '🔊';
    ui.volume.value = String(volume);
    ui.root.classList.toggle('is-playing', isPlaying);

    ui.status.classList.remove('is-error');
    if (available[activeTrack] === false) {
      ui.status.textContent = 'Archivo no encontrado';
      ui.status.classList.add('is-error');
    } else if (isPlaying) {
      ui.status.textContent = muted ? 'Sonando · silenciado' : 'Sonando en bucle';
    } else {
      ui.status.textContent = 'En pausa';
    }
  }

  function applyVolume() {
    Object.keys(tracks).forEach(function (k) {
      tracks[k].volume = volume;
      tracks[k].muted = muted;
    });
    updateUI();
  }

  function bindTrack(n) {
    var a = el('audio-' + n);
    if (!a) return;
    a.loop = true;
    tracks[n] = a;
    available[n] = null;

    var key = C.TRACKS[n].key;
    a.addEventListener('loadedmetadata', function () {
      available[n] = true;
      App.setMediaStatus(key, true);
      if (n === 1 && pendingSeek !== null) {
        try { a.currentTime = pendingSeek; } catch (e) { /* ignorar */ }
        pendingSeek = null;
      }
      updateUI();
    });
    a.addEventListener('error', function () {
      available[n] = false;
      App.setMediaStatus(key, false);
      console.info('[audio] ' + C.TRACKS[n].name + ': no se encontró "' + (a.getAttribute('src') || '') + '" (se podrá cargar en ⚙️ Medios).');
      updateUI();
    });
    ['play', 'pause', 'playing', 'ended'].forEach(function (evt) { a.addEventListener(evt, updateUI); });

    // Por si la carga terminó antes de enlazar los eventos
    if (a.error) { available[n] = false; App.setMediaStatus(key, false); }
    else if (a.readyState >= 1) { available[n] = true; App.setMediaStatus(key, true); }
  }

  /* ---------- API pública ---------- */
  App.Audio = {
    init: function () {
      [1, 2, 3].forEach(bindTrack);

      ui.root = el('audio-player');
      ui.play = el('ap-play');
      ui.mute = el('ap-mute');
      ui.volume = el('ap-volume');
      ui.track = el('ap-track');
      ui.status = el('ap-status');

      var savedVol = parseFloat(App.utils.storage.get(C.STORAGE_KEYS.volume, '0.7'));
      if (!isNaN(savedVol)) volume = Math.max(0, Math.min(1, savedVol));

      ui.play.addEventListener('click', function () { App.Audio.togglePlay(); });
      ui.mute.addEventListener('click', function () { App.Audio.toggleMute(); });
      ui.volume.addEventListener('input', function () { App.Audio.setVolume(parseFloat(ui.volume.value)); });

      applyVolume();
    },

    /** Inicia (o reanuda) la Pista 1 en bucle. Llamar desde un gesto del usuario. */
    startMain: function () {
      started = true;
      if (activeTrack !== 1) { App.Audio.returnToMain(); return; }
      safePlay(1);
    },

    /** Pausa la Pista 1 guardando su segundo exacto y reproduce la Pista 2 o 3 en bucle. */
    switchTo: function (n) {
      if (n !== 2 && n !== 3) return;
      if (activeTrack === n) return;
      if (activeTrack === 1) {
        mainResumeTime = tracks[1] ? tracks[1].currentTime || 0 : 0;
        if (tracks[1]) tracks[1].pause();
      } else {
        stop(activeTrack);
      }
      activeTrack = n;
      if (tracks[n]) { try { tracks[n].currentTime = 0; } catch (e) { /* ignorar */ } }
      safePlay(n);
    },

    /** Detiene la pista secundaria y reanuda la Pista 1 en el segundo exacto donde quedó. */
    returnToMain: function () {
      if (activeTrack !== 1) {
        stop(activeTrack);
        activeTrack = 1;
        seekMain(mainResumeTime);
      }
      if (started) safePlay(1); else updateUI();
    },

    togglePlay: function () {
      var a = tracks[activeTrack];
      if (!a) return;
      if (a.paused) { started = true; safePlay(activeTrack); }
      else a.pause();
    },

    toggleMute: function () {
      muted = !muted;
      if (!muted && volume === 0) volume = 0.5;
      applyVolume();
    },

    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0));
      if (volume > 0 && muted) muted = false;
      App.utils.storage.set(C.STORAGE_KEYS.volume, String(volume));
      applyVolume();
    },

    /** Detiene todo (p. ej. al cerrar sesión) y reinicia el estado. */
    stopAll: function () {
      [1, 2, 3].forEach(stop);
      activeTrack = 1;
      mainResumeTime = 0;
      started = false;
      updateUI();
    },

    showPlayer: function (visible) {
      if (ui.root) ui.root.classList.toggle('is-hidden', !visible);
    },

    /** Reemplaza la fuente de una pista (para la Fase 5: IndexedDB / Base64). */
    setSource: function (n, url) {
      var a = tracks[n];
      if (!a || !url) return;
      var wasPlaying = !a.paused;
      available[n] = null;
      a.src = url;
      a.load();
      if (wasPlaying) safePlay(n);
      updateUI();
    },

    getActiveTrack: function () { return activeTrack; },
    getMainResumeTime: function () { return mainResumeTime; }
  };
})(window);
