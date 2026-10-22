/* =========================================================
   Bodega LAJA · script de la web
   Lo editable está al principio: CONFIG (contacto, horario,
   visitas) y VINOS (precios y fichas). La escena 3D está en
   escena.js y se carga aparte: si falla, la web sigue
   funcionando con la ilustración.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Datos editables ---------- */
  var CONFIG = {
    telefono: '+34600000000',
    telefonoVisible: '600 000 000',
    whatsapp: '34600000000',             // para wa.me, sin + ni espacios
    mensaje: 'Hola, tengo una consulta para Bodega LAJA.',
    zonaHoraria: 'Europe/Madrid',
    // Horario de tienda y visitas. 0 = domingo … 6 = sábado
    horario: {
      0: [], 1: [],
      2: [['10:00', '14:00']], 3: [['10:00', '14:00']], 4: [['10:00', '14:00']], 5: [['10:00', '14:00']],
      6: [['10:00', '14:00'], ['17:00', '20:00']]
    },
    visita: { precio: 25, horas: ['11:00', '18:00'], minPersonas: 2, maxPersonas: 12, sabados: 8, margenHoras: 3 },
    envio: { gratisDesde: 6, coste: 6 },
    maxBotellas: 24,
    mapa: 'https://www.openstreetmap.org/export/embed.html?bbox=-5.4069%2C39.3696%2C-5.3669%2C39.3896&layer=mapnik&marker=39.3796%2C-5.3869',
    claveConsentimiento: 'laja-consent',
    claveEdad: 'laja-edad'
  };

  var ORDEN_VINOS = ['blanco', 'rosado', 'tinto'];
  var VINOS = {
    blanco: {
      nombre: 'LAJA Blanco 2024', precio: 16,
      notas: 'Manzana verde, hinojo y un final salino que viene de la pizarra. Fresco y tenso.',
      uva: 'Pardina 100 %', elaboracion: '3 meses sobre lías finas', alcohol: '12,5 % vol.',
      temperatura: '8–10 °C', botellas: '6.000', maridaje: 'Tencas fritas, ensaladilla, queso de cabra joven'
    },
    rosado: {
      nombre: 'LAJA Rosado 2024', precio: 18,
      notas: 'Fresa ácida, granada y piel de naranja. Seco, con la acidez de la altura.',
      uva: 'Garnacha 100 %', elaboracion: 'Sangrado tras 6 horas de maceración', alcohol: '13 % vol.',
      temperatura: '8–10 °C', botellas: '4.000', maridaje: 'Arroces, atún rojo, migas con uvas'
    },
    tinto: {
      nombre: 'LAJA Crianza 2021', precio: 34,
      notas: 'Mora, regaliz y grafito. Tanino fino y largo, con la frescura de la altura.',
      uva: 'Tempranillo 100 %', elaboracion: '14 meses en roble francés', alcohol: '14,5 % vol.',
      temperatura: '16–17 °C', botellas: '2.400 numeradas', maridaje: 'Cordero, presa ibérica, Torta del Casar'
    }
  };

  /* ---------- Utilidades ---------- */
  var html = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function errText(e) { return (e && e.message) ? e.message : String(e); }
  function store(tipo) {
    return {
      get: function (k) { try { return window[tipo].getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window[tipo].setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
    };
  }
  var local = store('localStorage'), sesion = store('sessionStorage');
  function waLink(msg) { return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg || CONFIG.mensaje); }
  function toMin(hhmm) { var p = hhmm.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }

  // Fecha y hora actuales en Cañamero, aunque el visitante esté en otro huso horario
  function ahoraEnBodega() {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: CONFIG.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; };
      return {
        y: parseInt(get('year'), 10), m: parseInt(get('month'), 10), d: parseInt(get('day'), 10),
        day: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')],
        mins: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10)
      };
    } catch (e) {
      var d = new Date();
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function addDays(date, n) { return new Date(date.getTime() + n * 86400000); }
  function keyOf(date) { return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()); }
  function fromKey(k) { var p = k.split('-'); return utc(+p[0], +p[1], +p[2]); }
  var fmtCorto = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var fmtLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  /* ---------- Entrada (aviso de edad) ---------- */
  var resolverEntrada;
  var entrada = new Promise(function (r) { resolverEntrada = r; });

  function initEdad() {
    var gate = $('[data-age]');
    if (!gate || sesion.get(CONFIG.claveEdad) === '1') { resolverEntrada(); return; }
    var fondo = $$('main, .site-header, .site-footer, [data-backdrop]');
    gate.hidden = false;
    document.body.classList.add('is-locked');
    fondo.forEach(function (el) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); });
    var si = $('[data-age-yes]', gate), no = $('[data-age-no]', gate), msg = $('[data-age-msg]', gate);
    setTimeout(function () { si.focus(); }, 30);
    si.addEventListener('click', function () {
      sesion.set(CONFIG.claveEdad, '1');
      fondo.forEach(function (el) { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); });
      document.body.classList.remove('is-locked');
      var cerrar = function () { gate.hidden = true; gate.classList.remove('is-leaving'); resolverEntrada(); };
      if (reduceMotion) { cerrar(); return; }
      gate.classList.add('is-leaving');
      setTimeout(cerrar, 200);
    });
    no.addEventListener('click', function () { msg.hidden = false; si.focus(); });
  }

  /* ---------- Enlaces de contacto ---------- */
  function initContacto() {
    $$('[data-wa]').forEach(function (a) { a.href = waLink(a.getAttribute('data-wa-msg')); a.target = '_blank'; a.rel = 'noopener'; });
    $$('[data-tel]').forEach(function (a) { a.href = 'tel:' + CONFIG.telefono; });
    $$('[data-tel-text]').forEach(function (el) { el.textContent = CONFIG.telefonoVisible; });
  }

  /* ---------- Menú móvil ---------- */
  function initMenu() {
    var btn = $('[data-menu-toggle]'), menu = $('[data-menu]');
    if (!btn || !menu) return;
    function abrir(v) {
      menu.hidden = !v;
      btn.setAttribute('aria-expanded', String(v));
      $('.sr-only', btn).textContent = v ? 'Cerrar menú' : 'Abrir menú';
      $('use', btn).setAttribute('href', v ? '#i-close' : '#i-menu');
    }
    btn.addEventListener('click', function () { abrir(menu.hidden); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { abrir(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { abrir(false); btn.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth > 1080 && !menu.hidden) abrir(false); });
  }

  /* ---------- Progreso del scroll (lo usa también la escena 3D) ---------- */
  var hero = $('[data-hero]'), producto = $('[data-producto]');
  function progreso() {
    var vh = window.innerHeight, h = 0, p = 0, fuera = 0;
    if (hero) {
      var hr = hero.getBoundingClientRect();
      h = clamp(-hr.top / Math.max(1, hr.height - vh), 0, 1);
      fuera = clamp(-(hr.bottom - vh) / (vh * .5), 0, 1);
    }
    if (producto && producto.offsetHeight > vh * 1.2) {
      var pr = producto.getBoundingClientRect();
      p = clamp(-pr.top / Math.max(1, pr.height - vh), 0, 1);
    }
    return { hero: h, producto: p, heroFuera: fuera };
  }

  function initScroll() {
    var header = $('[data-header]');
    var stage = $('[data-stage]'), backdrop = $('[data-backdrop]');
    var stageP = $('.producto__stage');
    var ticks = $$('[data-tick]');
    var cuentaG = $('[data-count-g]'), cuentaU = $('[data-count-uvas]');
    var capitulo = -1, paso = -1, ticking = false, ultimoG = -1;

    function update() {
      ticking = false;
      if (header) header.classList.toggle('is-compact', window.scrollY > 24);
      var pr = progreso();
      var ch = pr.hero < .1 ? 0 : pr.hero < .37 ? 1 : pr.hero < .6 ? 2 : pr.hero < .88 ? 3 : 4;
      if (ch !== capitulo && stage) {
        capitulo = ch;
        stage.setAttribute('data-chapter', String(ch));
        ticks.forEach(function (li) { li.classList.toggle('is-active', +li.getAttribute('data-tick') === ch); });
      }
      if (backdrop) {
        var zoom = smooth(0, .16, pr.hero) * (1 - smooth(.86, 1, pr.hero));
        backdrop.style.setProperty('--p', zoom.toFixed(3));
        backdrop.style.setProperty('--out', pr.heroFuera.toFixed(3));
        backdrop.style.visibility = pr.heroFuera >= 1 ? 'hidden' : '';
      }
      var ps = pr.producto < .12 ? 0 : pr.producto < .45 ? 1 : pr.producto < .75 ? 2 : 3;
      if (ps !== paso && stageP) { paso = ps; stageP.setAttribute('data-paso', String(ps)); }
      var f = smooth(.06, .7, pr.producto);
      var g = Math.round(1200 * f / 10) * 10;
      if (g !== ultimoG) {
        ultimoG = g;
        if (cuentaG) cuentaG.textContent = miles(g);
        if (cuentaU) cuentaU.textContent = miles(Math.round(600 * f));
      }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- Enlace activo en el menú ---------- */
  function initNavActiva() {
    if (!('IntersectionObserver' in window)) return;
    var links = $$('.nav a[href^="#"]:not(.btn)');
    var mapa = {};
    links.forEach(function (a) { mapa[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
        var a = mapa[en.target.id];
        if (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach(function (s) { io.observe(s); });
  }

  /* ---------- Selector de vinos y pedido ---------- */
  var vinoActual = 'tinto';
  function initVinos() {
    var panel = $('[data-wine-panel]');
    if (!panel) return;
    var tabs = $$('[data-vino-tab]');
    var cantidad = 1;
    var qtyOut = $('[data-qty-value]'), totalOut = $('[data-order-total]'), envioOut = $('[data-order-envio]');
    var btnMenos = $('[data-qty="-1"]'), btnMas = $('[data-qty="1"]');
    var pedido = $('[data-order]'), indice = $('[data-vino-index]');
    var temporizador = 0;

    function pintar() {
      var v = VINOS[vinoActual];
      $$('[data-w]', panel).forEach(function (el) {
        var k = el.getAttribute('data-w');
        el.textContent = k === 'precio' ? String(v.precio) : v[k];
      });
      panel.setAttribute('aria-labelledby', 'tab-' + vinoActual);
      if (indice) indice.textContent = pad(ORDEN_VINOS.indexOf(vinoActual) + 1);
      pintarPedido();
    }
    function pintarPedido() {
      var v = VINOS[vinoActual];
      var envio = cantidad >= CONFIG.envio.gratisDesde ? 0 : CONFIG.envio.coste;
      var total = v.precio * cantidad + envio;
      qtyOut.textContent = String(cantidad);
      totalOut.textContent = String(total);
      if (envioOut) envioOut.textContent = envio ? '· envío ' + envio + ' € incluido' : '· portes gratis';
      btnMenos.disabled = cantidad <= 1;
      btnMas.disabled = cantidad >= CONFIG.maxBotellas;
      var msg = 'Hola, quiero pedir ' + cantidad + (cantidad === 1 ? ' botella' : ' botellas') + ' de ' + v.nombre +
        ' (' + (v.precio * cantidad) + ' €' + (envio ? ' + ' + envio + ' € de envío' : ', portes gratis') + '). ¿Cómo hago el pago y el envío?';
      pedido.href = waLink(msg);
      pedido.target = '_blank';
      pedido.rel = 'noopener';
    }
    function seleccionar(id, foco) {
      if (!VINOS[id]) return;
      var cambia = id !== vinoActual;
      vinoActual = id;
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-vino-tab') === id;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && foco) t.focus();
      });
      window.dispatchEvent(new CustomEvent('laja:vino', { detail: id }));
      if (!cambia) return;
      clearTimeout(temporizador);
      if (reduceMotion) { pintar(); return; }
      panel.classList.add('is-out');
      temporizador = setTimeout(function () { pintar(); panel.classList.remove('is-out'); }, 140);
    }
    function mover(delta, foco) {
      var i = (ORDEN_VINOS.indexOf(vinoActual) + delta + ORDEN_VINOS.length) % ORDEN_VINOS.length;
      seleccionar(ORDEN_VINOS[i], foco);
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { seleccionar(t.getAttribute('data-vino-tab')); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); mover(1, true); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1, true); }
        else if (e.key === 'Home') { e.preventDefault(); seleccionar(ORDEN_VINOS[0], true); }
        else if (e.key === 'End') { e.preventDefault(); seleccionar(ORDEN_VINOS[ORDEN_VINOS.length - 1], true); }
      });
    });
    var prev = $('[data-vino-prev]'), next = $('[data-vino-next]');
    if (prev) prev.addEventListener('click', function () { mover(-1); });
    if (next) next.addEventListener('click', function () { mover(1); });
    btnMenos.addEventListener('click', function () { cantidad = Math.max(1, cantidad - 1); pintarPedido(); });
    btnMas.addEventListener('click', function () { cantidad = Math.min(CONFIG.maxBotellas, cantidad + 1); pintarPedido(); });
    $$('[data-buy]').forEach(function (a) { a.addEventListener('click', function () { seleccionar(a.getAttribute('data-buy')); }); });
    pintar();
  }

  /* ---------- Reserva de la visita ---------- */
  function initReserva() {
    var form = $('[data-booking]');
    if (!form) return;
    var V = CONFIG.visita;
    var caja = $('[data-dates]', form);
    var personas = V.minPersonas;
    var out = $('[data-personas-value]', form), totalOut = $('[data-booking-total]', form);
    var menos = $('[data-personas="-1"]', form), mas = $('[data-personas="1"]', form);
    var ok = $('[data-booking-ok]', form), okText = $('[data-booking-ok-text]', form);
    var ahora = ahoraEnBodega();
    var hoyKey = keyOf(utc(ahora.y, ahora.m, ahora.d));

    function horaPasada(fechaKey, hora) {
      return fechaKey === hoyKey && toMin(hora) - ahora.mins < V.margenHoras * 60;
    }
    // Próximos sábados
    var hoy = utc(ahora.y, ahora.m, ahora.d);
    var desfase = (6 - ahora.day + 7) % 7;
    var chips = '';
    for (var i = 0; i < V.sabados; i++) {
      var f = addDays(hoy, desfase + i * 7), k = keyOf(f);
      var llena = V.horas.every(function (h) { return horaPasada(k, h); });
      chips += '<label class="chip"><input type="radio" name="fecha" value="' + k + '"' + (llena ? ' disabled' : '') + '><span>' +
        (k === hoyKey ? '<small>hoy</small>' : '') + fmtCorto.format(f).replace('.', '') + '</span></label>';
    }
    caja.innerHTML = chips;

    function actualizarHoras() {
      var sel = form.querySelector('input[name="fecha"]:checked');
      $$('input[name="hora"]', form).forEach(function (r) {
        var pasada = sel ? horaPasada(sel.value, r.value) : false;
        r.disabled = pasada;
        if (pasada && r.checked) r.checked = false;
      });
    }
    function pintarPersonas() {
      out.textContent = String(personas);
      totalOut.textContent = String(personas * V.precio);
      menos.disabled = personas <= V.minPersonas;
      mas.disabled = personas >= V.maxPersonas;
    }
    menos.addEventListener('click', function () { personas = Math.max(V.minPersonas, personas - 1); pintarPersonas(); });
    mas.addEventListener('click', function () { personas = Math.min(V.maxPersonas, personas + 1); pintarPersonas(); });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'fecha') { actualizarHoras(); mostrarError('fecha', false); }
      if (e.target.name === 'hora') mostrarError('hora', false);
      if (e.target.name === 'privacidad') mostrarError('privacidad', false);
    });
    ['nombre', 'telefono'].forEach(function (n) {
      form.elements[n].addEventListener('input', function () { if (form.elements[n].getAttribute('aria-invalid') === 'true') validarCampo(n); });
    });

    function mostrarError(nombre, visible) {
      var el = $('[data-error="' + nombre + '"]', form);
      if (el) el.hidden = !visible;
      var campo = form.elements[nombre];
      if (campo && campo.setAttribute && !campo.length) {
        campo.setAttribute('aria-invalid', visible ? 'true' : 'false');
        if (el) { if (!el.id) el.id = 'err-' + nombre; if (visible) campo.setAttribute('aria-describedby', el.id); else campo.removeAttribute('aria-describedby'); }
      }
      return !visible;
    }
    function telefonoValido(v) { return /^(\+?34)?[6789]\d{8}$/.test(v.replace(/[\s.-]/g, '')); }
    function validarCampo(n) {
      var v = form.elements[n].value.trim();
      if (n === 'nombre') return mostrarError(n, v.length < 2);
      if (n === 'telefono') return mostrarError(n, !telefonoValido(v));
      return true;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fecha = form.querySelector('input[name="fecha"]:checked');
      var hora = form.querySelector('input[name="hora"]:checked');
      var res = [
        ['fecha', mostrarError('fecha', !fecha), fecha ? null : caja.querySelector('input:not(:disabled)')],
        ['hora', mostrarError('hora', !hora), form.querySelector('input[name="hora"]:not(:disabled)')],
        ['nombre', validarCampo('nombre'), form.elements.nombre],
        ['telefono', validarCampo('telefono'), form.elements.telefono],
        ['privacidad', mostrarError('privacidad', !form.elements.privacidad.checked), form.elements.privacidad]
      ];
      for (var i = 0; i < res.length; i++) { if (!res[i][1]) { if (res[i][2]) res[i][2].focus(); ok.hidden = true; return; } }
      var dia = fmtLargo.format(fromKey(fecha.value));
      var nombre = form.elements.nombre.value.trim(), tel = form.elements.telefono.value.trim();
      var msg = 'Hola, quiero reservar la visita a la viña de Bodega LAJA: ' + dia + ' a las ' + hora.value + ', ' + personas +
        ' personas (' + (personas * V.precio) + ' €). Nombre: ' + nombre + '. Teléfono: ' + tel + '.';
      var url = waLink(msg);
      window.open(url, '_blank', 'noopener');
      okText.innerHTML = '';
      okText.appendChild(document.createTextNode('Mensaje listo para ' + dia + ' a las ' + hora.value + ', ' + personas + ' personas. Si WhatsApp no se ha abierto, '));
      var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'ábrelo aquí';
      okText.appendChild(a); okText.appendChild(document.createTextNode('.'));
      ok.hidden = false;
      ok.focus();
    });
    pintarPersonas();
    window.LAJA.reserva = function () {
      var f = form.querySelector('input[name="fecha"]:checked'), h = form.querySelector('input[name="hora"]:checked');
      return { fecha: f && f.value, hora: h && h.value, personas: personas };
    };
  }

  /* ---------- Horario y «abierto ahora» ---------- */
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function estadoHorario(now) {
    var hoy = CONFIG.horario[now.day] || [];
    for (var i = 0; i < hoy.length; i++) {
      if (now.mins >= toMin(hoy[i][0]) && now.mins < toMin(hoy[i][1])) return { abierto: true, texto: 'Abierto ahora · cierra a las ' + hoy[i][1] };
    }
    for (var d = 0; d < 8; d++) {
      var dia = (now.day + d) % 7, tramos = CONFIG.horario[dia] || [];
      for (var j = 0; j < tramos.length; j++) {
        if (d === 0 && toMin(tramos[j][0]) <= now.mins) continue;
        var cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'el ' + DIAS[dia];
        return { abierto: false, texto: 'Cerrado · abrimos ' + cuando + ' a las ' + tramos[j][0] };
      }
    }
    return { abierto: false, texto: 'Cerrado' };
  }
  function initHorario() {
    var st = $('[data-status]'), txt = $('[data-status-text]');
    if (!st || !txt) return;
    function update() {
      var now = ahoraEnBodega(), e = estadoHorario(now);
      st.setAttribute('data-state', e.abierto ? 'open' : 'closed');
      txt.textContent = e.texto;
      $$('.hours tr[data-days]').forEach(function (tr) {
        tr.classList.toggle('is-today', tr.getAttribute('data-days').split(',').map(Number).indexOf(now.day) !== -1);
      });
    }
    update();
    setInterval(update, 60000);
  }

  /* ---------- Consentimiento y mapa ---------- */
  function cargarMapa() {
    var box = $('[data-map]');
    if (!box || box.querySelector('iframe')) return;
    var f = document.createElement('iframe');
    f.src = CONFIG.mapa;
    f.title = 'Mapa con la ubicación de Bodega LAJA en Cañamero';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer';
    box.appendChild(f);
    var ph = $('[data-map-placeholder]');
    if (ph) ph.hidden = true;
  }
  function quitarMapa() {
    var box = $('[data-map]'), f = box && box.querySelector('iframe');
    if (f) f.remove();
    var ph = $('[data-map-placeholder]');
    if (ph) ph.hidden = false;
  }
  function initConsentimiento() {
    var banner = $('[data-cookie-banner]');
    var guardado = local.get(CONFIG.claveConsentimiento);
    function ocultar() {
      if (!banner || banner.hidden) return;
      if (reduceMotion) { banner.hidden = true; return; }
      banner.classList.add('is-leaving');
      setTimeout(function () { banner.hidden = true; banner.classList.remove('is-leaving'); }, 180);
    }
    function mostrar() { if (banner) banner.hidden = false; }
    if (guardado === 'accepted') cargarMapa();
    if (!guardado) entrada.then(mostrar);
    $$('[data-consent]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-consent');
        local.set(CONFIG.claveConsentimiento, v);
        if (v === 'accepted') cargarMapa(); else quitarMapa();
        ocultar();
      });
    });
    $$('[data-open-cookies]').forEach(function (b) { b.addEventListener('click', mostrar); });
    var cargar = $('[data-map-load]');
    if (cargar) cargar.addEventListener('click', cargarMapa);
  }

  /* ---------- Entradas al hacer scroll ---------- */
  function initReveal() {
    var items = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    items.forEach(function (el, i) {
      var hermanos = el.parentNode ? $$(':scope > .reveal', el.parentNode) : [];
      var n = hermanos.indexOf(el);
      if (n > 0) el.style.transitionDelay = Math.min(n, 5) * 60 + 'ms';
      io.observe(el);
    });
  }

  /* ---------- Escena 3D ---------- */
  function webglDisponible() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }
  function initEscena() {
    var canvas = $('#escena');
    var loader = $('[data-loader]'), barra = $('[data-loader-bar]'), texto = $('[data-loader-text]');
    var reintentar = $('[data-retry]'), calidad = $('[data-quality]');
    if (!canvas) return;
    if (reintentar) reintentar.addEventListener('click', function () { window.location.reload(); });

    function respaldo(msg, conReintento) {
      html.classList.add('no-webgl');
      html.classList.remove('webgl-ready');
      canvas.classList.remove('is-ready');
      if (loader) {
        loader.classList.remove('is-done');
        if (barra) barra.parentNode.hidden = true;
        if (texto) texto.textContent = msg;
        if (reintentar) reintentar.hidden = !conReintento;
        if (!conReintento) setTimeout(function () { loader.classList.add('is-done'); }, 6000);
      }
    }
    if (!webglDisponible()) { respaldo('Tu navegador no muestra 3D: estás viendo la versión ilustrada.', false); return; }

    var api = {
      canvas: canvas,
      reducido: reduceMotion,
      progreso: progreso,
      vino: function () { return vinoActual; },
      esperarEntrada: function () { return entrada; },
      onProgress: function (f, t) {
        if (barra) barra.style.transform = 'scaleX(' + clamp(f, 0, 1).toFixed(3) + ')';
        if (texto) texto.textContent = t;
      },
      onReady: function (info) {
        html.classList.add('webgl-ready');
        canvas.classList.add('is-ready');
        if (loader) loader.classList.add('is-done');
        window.LAJA.escena = info;
      },
      onQuality: function (t) { if (calidad) { calidad.textContent = t; calidad.hidden = false; } },
      onError: function (m) { respaldo(m + ' Puedes reintentarlo.', true); }
    };
    import('./escena.js').then(function (m) { return m.iniciar(api); }).catch(function (e) {
      console.warn('Escena 3D no disponible → ' + errText(e));
      respaldo(window.location.protocol === 'file:' ? 'La escena 3D necesita abrirse con un servidor (Live Server).' : 'No se pudo cargar la escena 3D.', true);
    });
  }

  /* ---------- Arranque ---------- */
  window.LAJA = { config: CONFIG, vinos: VINOS, progreso: progreso };

  function init() {
    initEdad();
    initContacto();
    initMenu();
    initScroll();
    initNavActiva();
    initVinos();
    initReserva();
    initHorario();
    initConsentimiento();
    initReveal();
    initEscena();
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
