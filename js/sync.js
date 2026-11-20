/* =========================================================
   sync.js — Sincronización en tiempo real de los 30 cupos
   · Firebase Firestore (transacciones atómicas en
     artifacts/{appId}/public/data/cena2026_asignaciones/estado_ruleta)
   · Respaldo local automático transparente (localStorage + storage event)
     cuando no hay configuración de Firebase definida.
   ========================================================= */
(function (global) {
  'use strict';

  var App = global.App;
  var C = App.CONST;
  var U = App.utils;

  var CAT_MAP = {};
  C.FOOD_CATEGORIES.forEach(function (cat) { CAT_MAP[cat.id] = cat; });

  var mode = 'local'; // 'firestore' | 'local'
  var db = null;
  var docRef = null;
  var unsub = null;

  var state = {
    assignments: {}, // { [normalizedName]: { name, normalized, categoryId, timestamp } }
    counts: {},      // { [categoryId]: number }
    totalAssigned: 0
  };

  function emptyCounts() {
    var c = {};
    C.FOOD_CATEGORIES.forEach(function (cat) { c[cat.id] = 0; });
    return c;
  }

  /** Recalcula contadores y valida integridad de un mapa de asignaciones. */
  function normalizeData(rawAssignments) {
    var clean = {};
    var counts = emptyCounts();
    var total = 0;

    if (rawAssignments && typeof rawAssignments === 'object') {
      Object.keys(rawAssignments).forEach(function (key) {
        var entry = rawAssignments[key];
        if (!entry || !entry.categoryId || !CAT_MAP[entry.categoryId]) return;
        var norm = U.normalizeName(entry.normalized || entry.name || key);
        if (!norm || clean[norm]) return;
        if (counts[entry.categoryId] >= CAT_MAP[entry.categoryId].slots) return;
        clean[norm] = {
          name: U.prettyName(entry.name || key),
          normalized: norm,
          categoryId: entry.categoryId,
          timestamp: Number(entry.timestamp) || Date.now()
        };
        counts[entry.categoryId]++;
        total++;
      });
    }

    return { assignments: clean, counts: counts, totalAssigned: total };
  }

  function applyState(rawAssignments) {
    state = normalizeData(rawAssignments);
    App.setAssignedCount(state.totalAssigned);
    App.bus.emit('sync:updated', App.Sync.getSnapshot());
  }

  /* ---------- Respaldo local (localStorage) ---------- */
  function readLocal() {
    try {
      var raw = global.localStorage.getItem(C.STORAGE_KEYS.roulette);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && parsed.assignments) ? parsed.assignments : {};
    } catch (e) {
      return {};
    }
  }

  function writeLocal(assignments) {
    try {
      global.localStorage.setItem(C.STORAGE_KEYS.roulette, JSON.stringify({
        assignments: assignments,
        updatedAt: Date.now()
      }));
    } catch (e) {
      console.warn('[sync] No se pudo guardar en localStorage:', e);
    }
  }

  function initLocal() {
    mode = 'local';
    applyState(readLocal());
    global.addEventListener('storage', function (e) {
      if (e.key === C.STORAGE_KEYS.roulette) {
        applyState(readLocal());
      }
    });
  }

  /* ---------- Firebase Firestore (opcional, si existe __firebase_config) ---------- */
  function getFirebaseConfig() {
    var cfg = global.__firebase_config;
    if (!cfg) return null;
    if (typeof cfg === 'string') {
      try { return JSON.parse(cfg); } catch (e) { return null; }
    }
    return typeof cfg === 'object' ? cfg : null;
  }

  function initFirestore(cfg) {
    if (!global.firebase || !global.firebase.firestore) {
      console.info('[sync] __firebase_config presente pero SDK de Firebase no cargado; usando respaldo local.');
      initLocal();
      return;
    }
    try {
      var fbApp = global.firebase.apps && global.firebase.apps.length
        ? global.firebase.apps[0]
        : global.firebase.initializeApp(cfg);
      db = fbApp.firestore();

      var appId = String(global.__app_id || 'cena-navidena-2026');
      docRef = db
        .collection('artifacts').doc(appId)
        .collection('public').doc('data')
        .collection('cena2026_asignaciones').doc('estado_ruleta');

      mode = 'firestore';
      unsub = docRef.onSnapshot(function (snap) {
        var data = snap.exists ? snap.data() : null;
        applyState(data && data.assignments ? data.assignments : {});
      }, function (err) {
        console.warn('[sync] Error en Firestore; activando respaldo local:', err);
        if (unsub) { try { unsub(); } catch (e) { /* ignorar */ } unsub = null; }
        initLocal();
      });
    } catch (err) {
      console.warn('[sync] No se pudo iniciar Firestore; usando respaldo local:', err);
      initLocal();
    }
  }

  /* ---------- Operaciones atómicas ---------- */
  function claimInObject(assignmentsMap, pretty, norm, categoryId) {
    var current = normalizeData(assignmentsMap);
    if (current.assignments[norm]) {
      return { ok: true, alreadyAssigned: true, assignment: current.assignments[norm], assignments: current.assignments };
    }
    var cat = CAT_MAP[categoryId];
    if (!cat) return { ok: false, reason: 'invalid', assignments: current.assignments };
    if (current.counts[categoryId] >= cat.slots) {
      return { ok: false, reason: 'full', assignments: current.assignments };
    }
    var entry = {
      name: pretty,
      normalized: norm,
      categoryId: categoryId,
      timestamp: Date.now()
    };
    current.assignments[norm] = entry;
    return { ok: true, alreadyAssigned: false, assignment: entry, assignments: current.assignments };
  }

  /* ---------- API pública ---------- */
  App.Sync = {
    init: function () {
      var cfg = getFirebaseConfig();
      if (cfg) initFirestore(cfg);
      else initLocal();
    },

    getMode: function () { return mode; },

    getCategory: function (id) { return CAT_MAP[id] || null; },

    getSnapshot: function () {
      var byCategory = {};
      C.FOOD_CATEGORIES.forEach(function (cat) { byCategory[cat.id] = []; });
      Object.keys(state.assignments).forEach(function (k) {
        var a = state.assignments[k];
        if (byCategory[a.categoryId]) byCategory[a.categoryId].push(a);
      });
      Object.keys(byCategory).forEach(function (id) {
        byCategory[id].sort(function (a, b) { return a.timestamp - b.timestamp; });
      });
      return {
        assignments: Object.assign({}, state.assignments),
        counts: Object.assign({}, state.counts),
        byCategory: byCategory,
        totalAssigned: state.totalAssigned,
        totalSlots: C.TOTAL_SLOTS
      };
    },

    getUserAssignment: function (nameOrNormalized) {
      var norm = U.normalizeName(nameOrNormalized);
      return norm && state.assignments[norm] ? state.assignments[norm] : null;
    },

    getRemaining: function (categoryId) {
      var cat = CAT_MAP[categoryId];
      if (!cat) return 0;
      return Math.max(0, cat.slots - (state.counts[categoryId] || 0));
    },

    getAvailableCategories: function () {
      return C.FOOD_CATEGORIES.filter(function (cat) {
        return App.Sync.getRemaining(cat.id) > 0;
      });
    },

    /** Registra atómicamente una categoría para un invitado. */
    claimCategory: function (name, categoryId) {
      var pretty = U.prettyName(name);
      var norm = U.normalizeName(name);
      if (!norm) return Promise.resolve({ ok: false, reason: 'empty_name' });

      if (mode === 'firestore' && db && docRef) {
        return db.runTransaction(function (tx) {
          return tx.get(docRef).then(function (snap) {
            var existing = snap.exists && snap.data() && snap.data().assignments ? snap.data().assignments : {};
            var res = claimInObject(existing, pretty, norm, categoryId);
            if (res.ok && !res.alreadyAssigned) {
              tx.set(docRef, { assignments: res.assignments, updatedAt: Date.now() }, { merge: true });
            }
            return res;
          });
        }).then(function (res) {
          applyState(res.assignments);
          return { ok: res.ok, alreadyAssigned: !!res.alreadyAssigned, assignment: res.assignment || null, reason: res.reason };
        }).catch(function (err) {
          console.error('[sync] Error en transacción Firestore:', err);
          return { ok: false, reason: 'error' };
        });
      }

      // Modo local: relee justo antes de escribir para evitar conflictos entre pestañas
      var latest = readLocal();
      var res = claimInObject(latest, pretty, norm, categoryId);
      if (res.ok && !res.alreadyAssigned) {
        writeLocal(res.assignments);
      }
      applyState(res.assignments);
      return Promise.resolve({
        ok: res.ok,
        alreadyAssigned: !!res.alreadyAssigned,
        assignment: res.assignment || null,
        reason: res.reason
      });
    },

    /** Elimina una asignación puntual (para el Organizador en Fase 5). */
    removeAssignment: function (nameOrNormalized) {
      var norm = U.normalizeName(nameOrNormalized);
      if (!norm) return Promise.resolve(false);

      if (mode === 'firestore' && db && docRef) {
        return db.runTransaction(function (tx) {
          return tx.get(docRef).then(function (snap) {
            var existing = snap.exists && snap.data() && snap.data().assignments ? Object.assign({}, snap.data().assignments) : {};
            if (!existing[norm]) return { changed: false, assignments: existing };
            delete existing[norm];
            tx.set(docRef, { assignments: existing, updatedAt: Date.now() });
            return { changed: true, assignments: existing };
          });
        }).then(function (res) {
          applyState(res.assignments);
          return res.changed;
        });
      }

      var latest = Object.assign({}, readLocal());
      if (!latest[norm]) return Promise.resolve(false);
      delete latest[norm];
      writeLocal(latest);
      applyState(latest);
      return Promise.resolve(true);
    },

    /** Reinicia toda la ruleta (para el Organizador en Fase 5). */
    resetAll: function () {
      if (mode === 'firestore' && docRef) {
        return docRef.set({ assignments: {}, updatedAt: Date.now() }).then(function () {
          applyState({});
          return true;
        });
      }
      writeLocal({});
      applyState({});
      return Promise.resolve(true);
    }
  };
})(window);
