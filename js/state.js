/* =========================================================
   state.js — Estado global, constantes y utilidades
   Script clásico (sin módulos) para poder concatenarse en build.js
   ========================================================= */
(function (global) {
  'use strict';

  var App = (global.App = global.App || {});

  /* ---------- Constantes ---------- */
  App.CONST = Object.freeze({
    APP_NAME: 'CENA NAVIDEÑA 2026',
    PASSWORD: 'cenanavideña2026',
    TOTAL_SLOTS: 30,
    EVENT_DATE_ISO: '2026-12-18T19:00:00-06:00',

    MEDIA_DEFAULTS: Object.freeze({
      fotoGrupal: './foto_grupal.jpg',
      fotoNacimiento: './foto_nacimiento.jpg',
      musica1: './musica_1.mp3',
      musica2: './musica_2.mp3',
      musica3: './musica_3.mp3'
    }),

    MEDIA_LABELS: Object.freeze({
      fotoGrupal: 'Foto Grupal',
      fotoNacimiento: 'Foto del Nacimiento',
      musica1: 'Pista 1 · Principal',
      musica2: 'Pista 2 · Estrella',
      musica3: 'Pista 3 · Cielo de Belén'
    }),

    TRACKS: Object.freeze({
      1: { key: 'musica1', name: 'Pista 1 · Principal' },
      2: { key: 'musica2', name: 'Pista 2 · Estrella' },
      3: { key: 'musica3', name: 'Pista 3 · Cielo de Belén' }
    }),

    WELCOME_TEXT:
      'Este año se celebra por tercera vez la cena navideña, donde todos nos volvemos a reunir una vez en el año, espero que este año sea otra experiencia maravillosa.',

    STAR_MESSAGE:
      'Nunca Olvidemos el verdadero sentido y significado de la Navidad, que esta navidad toda tu familia este bendecida y unida, que el siguiente año nuevamente puedan disfrutar una navidad juntos y que Dios les de un año 2027 lleno de maravillas',

    EVENT_DATE_LABEL: '18 de diciembre de 2026 · 7:00 PM',

    LOCATION_DEFAULTS: Object.freeze({
      address: 'Residencial Monte Cielo, Managua',
      dateTime: '18 de diciembre de 2026 · 7:00 PM',
      references: 'Al llegar a la residencial, pregunta en la caseta por la casa de la Cena Navideña. Busca la entrada con luces doradas.',
      gmapsUrl: 'https://www.google.com/maps/search/?api=1&query=Residencial%20Monte%20Cielo%2C%20Managua',
      wazeUrl: 'https://waze.com/ul?q=Residencial%20Monte%20Cielo%20Managua&navigate=yes'
    }),

    FOOD_CATEGORIES: Object.freeze([
      Object.freeze({
        id: 'arroz',
        name: 'Arroz',
        shortName: 'Arroz',
        icon: '🍚',
        slots: 4,
        color: '#9b1c2c',
        text: 'Te toca llevar arroz, una libra de arroz, esa libra de arroz debe llevar zanahoria y maiz, solamente, que intente llegar caliente y bien rico'
      }),
      Object.freeze({
        id: 'pollo',
        name: 'Pollo',
        shortName: 'Pollo',
        icon: '🍗',
        slots: 8,
        color: '#164a37',
        text: 'El pollo tiene que ser uno entero, de los que venden en el super, que ya vienen asado, para partirlo en 4 piezas, si viene frio aqui en la casa lo calentamos'
      }),
      Object.freeze({
        id: 'pan',
        name: 'Pan',
        shortName: 'Pan',
        icon: '🥖',
        slots: 2,
        color: '#b8862f',
        text: 'Te toca llevar el pan, lleva una cantidad que rinda para 15 personas, puede ser pan del super, que venden ya en bolsas, pero si o si para 15 personas'
      }),
      Object.freeze({
        id: 'ensalada',
        name: 'Ensalada',
        shortName: 'Ensalada',
        icon: '🥗',
        slots: 2,
        color: '#1f5e46',
        text: 'Te toco la ensalada, tienes libertad de escoger que ensalaa hacer, pero ten en cuenta que si vas a ponerle algun aderezo, llevar aparte'
      }),
      Object.freeze({
        id: 'bebidas',
        name: 'Bebidas',
        shortName: 'Bebidas',
        icon: '🥤',
        slots: 4,
        color: '#1d3a6d',
        text: 'Tienes que llevar bebidas, lleva 3 botellas de 3 litros, de la gaseosa o jugo que quieras, tienes libertad en elegir el tipo de bebida'
      }),
      Object.freeze({
        id: 'postres',
        name: 'Postres',
        shortName: 'Postres',
        icon: '🍰',
        slots: 4,
        color: '#7c1d38',
        text: 'Te toca llevar el postre, tienes libertad total de que tipo de postre llevar, pero ten en cuenta que debe rendir para 10 personas, y que debe durar la noche entera, si necesita refrigeración, se guarda en mi refrigeradora, hazlo rico y dulce'
      }),
      Object.freeze({
        id: 'snacks',
        name: 'Snacks',
        shortName: 'Snacks',
        icon: '🥨',
        slots: 4,
        color: '#9e6821',
        text: 'Te toca llevar snacks para la noche, tienes que llevar una cantidad que alcance para 15 personas, de cualquier tipo de snacks que quieras llevar, puede ser navideño o de cualquier tipo'
      }),
      Object.freeze({
        id: 'hielo',
        name: 'Hielo',
        shortName: 'Hielo',
        icon: '🧊',
        slots: 1,
        color: '#1f4f73',
        text: 'Te toca llevar hielo, lleva unas 2 bolsas de hielo grandes, que son de 50 libras'
      }),
      Object.freeze({
        id: 'desechables',
        name: 'Platos, vasos, cubiertos y bandejas',
        shortName: 'Platos y vasos',
        icon: '🍽️',
        slots: 1,
        color: '#6b2737',
        text: 'Los platos, vasos y cubiertos que sean al menos 60, los empaques unos 15 y bandejas de aluminio con 4 es suficiente'
      })
    ]),

    PAPIRO_TYPES: Object.freeze(['Deseo', 'Gratitud', 'Cariño', 'Recuerdo']),

    STAR_COLORS: Object.freeze([
      Object.freeze({ id: 'dorada', name: 'Dorada', hex: '#f5c76b', glow: '#fff1c1' }),
      Object.freeze({ id: 'marfil', name: 'Marfil', hex: '#fff4dc', glow: '#ffffff' }),
      Object.freeze({ id: 'celeste', name: 'Celeste', hex: '#8fd3ff', glow: '#d6f0ff' }),
      Object.freeze({ id: 'rosa', name: 'Rosa cálido', hex: '#ff9eb5', glow: '#ffd6e2' }),
      Object.freeze({ id: 'esmeralda', name: 'Esmeralda', hex: '#6ce8b0', glow: '#c8ffea' })
    ]),

    QUICK_PHRASES: Object.freeze([
      'Que esta noche nos regale risas inolvidables y un 2027 lleno de salud y bendiciones.',
      'Gracias por ser parte de esta tradición tan linda; qué alegría volver a vernos todos.',
      'Brindo por nuestra amistad, por los momentos vividos y por muchas cenas navideñas más.',
      'Que la paz y la luz de la Navidad acompañen siempre a sus hogares y familias.'
    ]),

    DEFAULT_SKY_STARS: Object.freeze([
      Object.freeze({
        id: 'welcome-1',
        author: 'Cena Navideña 2026',
        to: 'Todos los amigos',
        type: 'Deseo',
        colorId: 'dorada',
        message: 'Que esta tercera cena navideña ilumine nuestro corazón y nos encuentre unidos muchos años más.',
        x: 0.24,
        y: 0.34,
        createdAt: 1766000000001,
        isDefault: true
      }),
      Object.freeze({
        id: 'welcome-2',
        author: 'La Estrella de Belén',
        to: 'Cada hogar aquí presente',
        type: 'Gratitud',
        colorId: 'marfil',
        message: 'Gracias por compartir la mesa, el tiempo y el cariño que hacen especial cada diciembre.',
        x: 0.50,
        y: 0.25,
        createdAt: 1766000000002,
        isDefault: true
      }),
      Object.freeze({
        id: 'welcome-3',
        author: 'Noche de Belén',
        to: 'Todos los amigos',
        type: 'Cariño',
        colorId: 'celeste',
        message: 'Que el 2027 traiga salud, paz, proyectos cumplidos y motivos de sobra para celebrar juntos.',
        x: 0.76,
        y: 0.37,
        createdAt: 1766000000003,
        isDefault: true
      })
    ]),

    STORAGE_KEYS: Object.freeze({
      lastName: 'cena2026_lastName',
      volume: 'cena2026_volume',
      location: 'cena2026_location',
      roulette: 'cena2026_estado_ruleta',
      sky: 'cena2026_cielo_estrellas'
    })
  });

  /* ---------- Estado global ---------- */
  var defaults = App.CONST.MEDIA_DEFAULTS;

  App.state = {
    user: { name: '', normalized: '' },
    currentScreen: 'login',
    media: {
      fotoGrupal: { src: defaults.fotoGrupal, loaded: false, source: 'default' },
      fotoNacimiento: { src: defaults.fotoNacimiento, loaded: false, source: 'default' },
      musica1: { src: defaults.musica1, loaded: false, source: 'default' },
      musica2: { src: defaults.musica2, loaded: false, source: 'default' },
      musica3: { src: defaults.musica3, loaded: false, source: 'default' }
    },
    // Imágenes circulares (HTMLImageElement) para las esferas del fondo
    ornamentImages: [],
    // Ubicación de la casa (editable desde el Organizador en la Fase 5)
    location: Object.assign({}, App.CONST.LOCATION_DEFAULTS),
    // Contadores mostrados en el Hub (alimentados en las Fases 3 y 4)
    assignedCount: 0,
    skyStarsCount: 0
  };

  // Carga ubicación personalizada guardada previamente (si existe)
  try {
    var savedLoc = global.localStorage.getItem(App.CONST.STORAGE_KEYS.location);
    if (savedLoc) Object.assign(App.state.location, JSON.parse(savedLoc));
  } catch (e) { /* sin datos guardados */ }

  /* ---------- Bus de eventos mínimo ---------- */
  var listeners = {};
  App.bus = {
    on: function (evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return function off() {
        listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; });
      };
    },
    emit: function (evt, payload) {
      (listeners[evt] || []).slice().forEach(function (fn) {
        try { fn(payload); } catch (err) { console.error('[bus] ' + evt, err); }
      });
    }
  };

  /* ---------- Utilidades ---------- */
  App.utils = {
    /** Normaliza un nombre: minúsculas, sin acentos, espacios simples. */
    normalizeName: function (name) {
      return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    },
    /** Limpia espacios y capitaliza cada palabra para mostrar. */
    prettyName: function (name) {
      return String(name || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(function (w) { return w ? w.charAt(0).toLocaleUpperCase('es') + w.slice(1) : w; })
        .join(' ');
    },
    firstName: function (name) {
      return App.utils.prettyName(name).split(' ')[0] || '';
    },
    rand: function (min, max) { return min + Math.random() * (max - min); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    storage: {
      get: function (key, fallback) {
        try {
          var v = global.localStorage.getItem(key);
          return v === null ? fallback : v;
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try { global.localStorage.setItem(key, value); } catch (e) { /* almacenamiento no disponible */ }
      }
    }
  };

  /** Marca un medio como cargado / no cargado y notifica. */
  App.setMediaStatus = function (key, loaded) {
    var item = App.state.media[key];
    if (!item || item.loaded === loaded) return;
    item.loaded = loaded;
    App.bus.emit('media:updated', { key: key, loaded: loaded });
  };

  App.countLoadedMedia = function () {
    var m = App.state.media;
    return Object.keys(m).filter(function (k) { return m[k].loaded; }).length;
  };

  /** Actualiza la ubicación, la persiste y notifica (usado por el Organizador). */
  App.setLocation = function (patch) {
    Object.assign(App.state.location, patch || {});
    App.utils.storage.set(App.CONST.STORAGE_KEYS.location, JSON.stringify(App.state.location));
    App.bus.emit('location:updated', App.state.location);
  };

  /** Actualiza el contador "X / 30 asignados" (usado por la Fase 3). */
  App.setAssignedCount = function (n) {
    App.state.assignedCount = Math.max(0, Math.min(App.CONST.TOTAL_SLOTS, Number(n) || 0));
    App.bus.emit('assignments:count', App.state.assignedCount);
  };

  /** Actualiza el contador de estrellas encendidas (usado por la Fase 4). */
  App.setSkyStarsCount = function (n) {
    App.state.skyStarsCount = Math.max(0, Number(n) || 0);
    App.bus.emit('sky:count', App.state.skyStarsCount);
  };
})(window);
