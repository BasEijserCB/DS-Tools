// ==UserScript==
// @name         DS Tools — Manco-knoppen bij CBF-orders
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.0.0
// @description  Knoppen "Manco: niet aangekomen" en "Manco: retour magazijn" naast het visit-tabje van een CBF-order in DireXtion Basic: één klik opent Probleem toevoegen en vult Moment en Probleem type in. Opslaan doe je zelf.
// @match        https://coolblue.dirextion.nl/Basic/*
// @match        https://coolblue.dirextion.nl/basic/*
// @match        https://coolblue.dirextion.nl/BASIC/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/probleem/manco-knoppen.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/probleem/manco-knoppen.user.js
// ==/UserScript==

/* Een manco op een CBF-order kost in Basic vijf klikken die bijna altijd
   hetzelfde zijn: rechtsklik op het visit-tabje → Probleem toevoegen →
   Moment → Probleem type. Deze knoppen doen dat in één klik. Opslaan blijft
   (voorlopig) met de hand: de dialoog blijft open staan, ingevuld.

   Alleen bij een CBF-order: het veld Depot (Eigenschappen) begint met
   "Fietshub" (NL/BE) of "Bikedepot" (DE); terugval: Kanaal "CoolblueFietst".
   Vastgesteld met probleem/probe-probleem-toevoegen.js (18-11-2026):
   Depot "Fietshub Utrecht", Kanaal "CoolblueFietst", Netwerk "FTS".

   De weg is die van de gebruiker, alleen dan nagebootst:
   1. contextmenu op het visit-tabje (li#Visits_AT0) → ul.dynamic-context-menu
      (onzichtbaar gemaakt zolang het script ermee bezig is);
   2. klik op "Probleem toevoegen" → DevExtreme-popup met Moment *,
      Probleem type *, Opmerking, Interne opmerking, Annuleren / Opslaan;
   3. Moment = de optie die met "5." begint, Probleem type = de optie met de
      reden in de tekst (bij meer dan één: die met "manco"). Gezet via de API
      van het veld (option('value')), niet door in de lijst te klikken.
      Probleem type wordt opnieuw opgezocht na het zetten van Moment: die
      lijst lijkt van Moment af te hangen (na Moment 5 stonden er alleen
      manco-typen in).
   Opmerking en Interne opmerking blijven leeg.

   De eerste klik per paginalading zet beide keuzelijsten volledig in de
   console (filter: DS Manco). @grant none: het script heeft jQuery /
   DevExpress van de pagina nodig.

   Basic wisselt van order zonder nieuwe pagina; een MutationObserver kijkt
   bij elke wijziging of er (nog) een CBF-order open staat. De knoppen zweven
   (position:fixed op body, buiten de tabbalk van DevExpress) rechts van het
   tabje en schuiven mee bij scrollen, venstergrootte en elke seconde. */
(function () {
  'use strict';

  var VERSIE = '1.0.0';
  var ID = 'ds-manco-knoppen';
  var LOG = '[DS Manco userscript]';
  var MOMENT = /^\s*5\s*[.)]/;          // "5. …" — de optie die DS kiest
  var KNOPPEN = [
    { naam: 'Manco: niet aangekomen', reden: 'niet aangekomen' },
    { naam: 'Manco: retour magazijn', reden: 'retour magazijn' }
  ];

  console.info(LOG + ' v' + VERSIE + ' actief op ' + location.pathname);
  var vorigeToestand = '';
  function toestand(t) { if (t === vorigeToestand) return; vorigeToestand = t; console.info(LOG + ' ' + t); }

  // ── Hulpjes ──────────────────────────────────────────────────
  function zichtbaar(el) { return !!el && el.isConnected && el.getClientRects().length > 0; }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function pauze(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  // Herhaalt fn tot hij iets oplevert, of tot ms om is (dan null).
  function wachtOp(fn, ms) {
    var t0 = Date.now();
    return new Promise(function (ok) {
      (function stap() {
        var r = null;
        try { r = fn(); } catch (e) {}
        if (r) return ok(r);
        if (Date.now() - t0 > ms) return ok(null);
        setTimeout(stap, 100);
      })();
    });
  }

  // ── Is er een CBF-order open? ────────────────────────────────
  function veld(label) {
    var fields = document.querySelectorAll('.details-field'), reserve = '';
    for (var i = 0; i < fields.length; i++) {
      var l = fields[i].querySelector('.details-field-label'), v = fields[i].querySelector('.details-field-value');
      if (!l || !v || norm(l.textContent) !== norm(label)) continue;
      var w = v.textContent.replace(/\s+/g, ' ').trim();
      if (zichtbaar(fields[i])) return w;
      if (!reserve) reserve = w;
    }
    return reserve;
  }
  function visitTab() {
    var t = document.getElementById('Visits_AT0') || document.querySelector('li[id^="Visits_AT"]');
    return zichtbaar(t) ? t : null;
  }
  function isCbf() {
    var depot = veld('Depot');
    if (/fiets|bike/i.test(depot)) return 'depot ' + depot;
    var kanaal = veld('Kanaal');
    if (/coolbluefietst/i.test(kanaal)) return 'kanaal ' + kanaal;
    return '';
  }

  // ── DevExtreme ───────────────────────────────────────────────
  var EDITORS = '.dx-selectbox, .dx-lookup, .dx-tagbox, .dx-dropdowneditor, .dx-autocomplete';
  var WIDGETS = ['dxSelectBox', 'dxLookup', 'dxTagBox', 'dxDropDownBox', 'dxAutocomplete'];
  function dxInstantie(el) {
    for (var i = 0; i < WIDGETS.length; i++) {
      var n = WIDGETS[i];
      try { var W = window.DevExpress && DevExpress.ui && DevExpress.ui[n]; var a = W && W.getInstance && W.getInstance(el); if (a) return a; } catch (e) {}
      try { if (window.jQuery) { var b = window.jQuery(el).data(n); if (b) return b; } } catch (e) {}
    }
    return null;
  }

  // Het veld bij een label ("Moment", "Probleem type"): vanaf de labeltekst
  // omhoog tot er een keuzeveld ná het label in zit.
  // De widget-root komt in documentvolgorde vóór zijn binnenkant, en
  // .dx-dropdowneditor matcht niet op .dx-dropdowneditor-input-wrapper.
  function editorBij(dialoog, label) {
    var re = new RegExp('^' + label + '\\s*[:*]?\\s*\\*?$', 'i');
    var w = document.createTreeWalker(dialoog, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return re.test(n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
    });
    while (w.nextNode()) {
      var lbl = w.currentNode.parentElement;
      for (var e = lbl; e && e !== dialoog.parentElement; e = e.parentElement) {
        var kand = e.querySelectorAll(EDITORS);
        for (var i = 0; i < kand.length; i++) {
          if (!(lbl.compareDocumentPosition(kand[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          var inst = dxInstantie(kand[i]);
          if (inst) return inst;
        }
      }
    }
    return null;
  }

  function tekstVan(inst, item) {
    if (item == null) return '';
    if (typeof item !== 'object') return String(item);
    var d = inst.option('displayExpr');
    try { if (typeof d === 'function') return String(d(item)); if (typeof d === 'string' && d) return String(item[d]); } catch (e) {}
    return String(item.text || item.Text || item.name || item.Name || item.Description || item.description || '');
  }
  function waardeVan(inst, item) {
    var v = inst.option('valueExpr');
    if (item == null || typeof item !== 'object' || !v || v === 'this') return item;
    try { return typeof v === 'function' ? v(item) : item[v]; } catch (e) { return item; }
  }
  function plat(lijst) {
    var r = [];
    (lijst || []).forEach(function (x) {
      if (x && typeof x === 'object' && Array.isArray(x.items) && 'key' in x) r = r.concat(plat(x.items));
      else r.push(x);
    });
    return r;
  }
  // Alle opties, ook als de lijst per pagina laadt: via de store, met het
  // filter van de DataSource (dat filter is waarschijnlijk de koppeling aan Moment).
  function opties(inst) {
    var ds = null;
    try { ds = inst.getDataSource && inst.getDataSource(); } catch (e) {}
    if (!ds) return Promise.resolve(plat(inst.option('items')));
    var o = {};
    try { var f = ds.filter(); if (f) o.filter = f; } catch (e) {}
    return Promise.resolve(ds.store().load(o))
      .then(function (r) { return plat(Array.isArray(r) ? r : (r && r.data) || []); })
      .catch(function () { return plat(ds.items()); });
  }
  function zet(inst, item) {
    var v = waardeVan(inst, item);
    inst.option('value', inst.NAME === 'dxTagBox' ? [v] : v);
  }

  var lijstenGelogd = false;
  function logLijst(naam, inst, items) {
    if (lijstenGelogd) return;
    console.info(LOG + ' ' + naam + ' (' + items.length + ' opties, valueExpr ' + inst.option('valueExpr') + '):\n' +
      items.map(function (x) { return '  ' + JSON.stringify(waardeVan(inst, x)) + ' = ' + tekstVan(inst, x); }).join('\n'));
  }

  // ── De weg: rechtsklik → Probleem toevoegen → invullen ───────
  function menu() {
    var m = [].filter.call(document.querySelectorAll('ul.dynamic-context-menu'), zichtbaar)[0];
    return m || null;
  }
  function menuItem(m) {
    var els = m.querySelectorAll('li, a, span, div');
    for (var i = 0; i < els.length; i++) if (norm(els[i].textContent) === 'probleem toevoegen' && zichtbaar(els[i])) {
      // Het diepste element met precies die tekst; de klik bubbelt naar de li.
      var el = els[i];
      while (el.children.length === 1 && norm(el.children[0].textContent) === 'probleem toevoegen') el = el.children[0];
      return el;
    }
    return null;
  }
  function dialoog() {
    var d = document.querySelectorAll('.dx-overlay-content, [role="dialog"]');
    for (var i = d.length - 1; i >= 0; i--) {
      if (!zichtbaar(d[i])) continue;
      var t = norm(d[i].textContent);
      if (t.indexOf('probleem toevoegen') !== -1 && t.indexOf('moment') !== -1 && t.indexOf('probleem type') !== -1) return d[i];
    }
    return null;
  }
  function muis(el, type, knop) {
    var r = el.getBoundingClientRect(), x = r.left + Math.min(r.width / 2, 20), y = r.top + r.height / 2;
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: knop, buttons: knop === 2 ? 2 : 1, clientX: x, clientY: y, screenX: x, screenY: y }));
  }

  async function openMenu(tab) {
    // Eerst alleen contextmenu (zoals de browser), op het label, het tabje en het icoon.
    var doelen = [tab.querySelector('label'), tab, tab.querySelector('.fa-layers')].filter(Boolean);
    for (var i = 0; i < doelen.length; i++) {
      muis(doelen[i], 'contextmenu', 2);
      var m = await wachtOp(menu, 600);
      if (m) return m;
    }
    // Terugval: sommige menu's reageren op de rechtermuisknop zelf.
    muis(doelen[0], 'mousedown', 2); muis(doelen[0], 'mouseup', 2);
    return wachtOp(menu, 800);
  }

  async function openDialoog(m) {
    var item = menuItem(m);
    if (!item) throw new Error('"Probleem toevoegen" staat niet in het menu');
    item.click();
    var d = await wachtOp(dialoog, 2500);
    if (d) return d;
    if (menu()) { muis(item, 'mousedown', 0); muis(item, 'mouseup', 0); }
    d = await wachtOp(dialoog, 4000);
    if (!d) throw new Error('de dialoog Probleem toevoegen verscheen niet');
    return d;
  }

  async function kiesMoment(d) {
    var inst = await wachtOp(function () { return editorBij(d, 'Moment'); }, 3000);
    if (!inst) throw new Error('veld Moment niet gevonden');
    var items = await opties(inst);
    logLijst('Moment', inst, items);
    var keuze = items.filter(function (x) { return MOMENT.test(tekstVan(inst, x)); })[0];
    if (!keuze) throw new Error('geen Moment die met "5." begint');
    zet(inst, keuze);
    return tekstVan(inst, keuze);
  }

  async function kiesType(d, reden) {
    var t0 = Date.now(), laatste = [];
    // Herhalen: de lijst ververst (vermoedelijk) pas na het zetten van Moment.
    while (Date.now() - t0 < 5000) {
      var inst = editorBij(d, 'Probleem type');
      if (inst) {
        var items = await opties(inst);
        laatste = items.map(function (x) { return tekstVan(inst, x); });
        var raak = items.filter(function (x) { return norm(tekstVan(inst, x)).indexOf(reden) !== -1; });
        if (raak.length > 1) {
          var manco = raak.filter(function (x) { return norm(tekstVan(inst, x)).indexOf('manco') !== -1; });
          if (manco.length) raak = manco;
        }
        if (raak.length) {
          logLijst('Probleem type', inst, items);
          if (raak.length > 1) console.warn(LOG + ' meer dan één Probleem type met "' + reden + '"; de eerste gekozen:', raak.map(function (x) { return tekstVan(inst, x); }));
          zet(inst, raak[0]);
          // Wist DireXtion het veld nog (na een late verversing door Moment)? Dan opnieuw.
          await pauze(500);
          var nu = editorBij(d, 'Probleem type');
          var v = nu && nu.option('value');
          if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) return tekstVan(inst, raak[0]);
          continue;
        }
      }
      await pauze(400);
    }
    console.warn(LOG + ' Probleem type-opties:', laatste);
    throw new Error('geen Probleem type met "' + reden + '"' + (laatste.length ? '' : ' (veld of lijst niet gevonden)'));
  }

  var bezig = false;
  async function klik(item, groep) {
    if (bezig) return;
    var tab = visitTab();
    if (!tab) { melding(groep, 'Geen visit-tabje gevonden.', false); return; }
    bezig = true;
    groep.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    melding(groep, 'Bezig…', null);
    document.documentElement.classList.add(ID + '-bezig');
    try {
      var d = dialoog();
      if (!d) {
        var m = await openMenu(tab);
        if (!m) throw new Error('het rechtsklikmenu van het visit-tabje ging niet open');
        d = await openDialoog(m);
      }
      document.documentElement.classList.remove(ID + '-bezig');
      var moment = await kiesMoment(d);
      var type = await kiesType(d, item.reden);
      lijstenGelogd = true;
      console.info(LOG + ' ingevuld — Moment: ' + moment + ' · Probleem type: ' + type);
      melding(groep, '✓ Ingevuld — controleer en klik Opslaan', true);
    } catch (e) {
      console.error(LOG + ' ' + item.naam + ':', e);
      melding(groep, '✗ ' + (e && e.message || e), false);
    } finally {
      document.documentElement.classList.remove(ID + '-bezig');
      bezig = false;
      groep.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    }
  }

  // ── Knoppen ──────────────────────────────────────────────────
  // Zelfde accent als de Same day / Next day-knoppen: licht oranje vlak,
  // dun fel oranje randje.
  function stijl() {
    if (document.getElementById(ID + '-stijl')) return;
    var s = document.createElement('style');
    s.id = ID + '-stijl';
    s.textContent =
      '#' + ID + '{position:fixed;z-index:2;display:flex;align-items:center;gap:6px;white-space:nowrap;' +
        'font-family:inherit;font-size:11px;line-height:normal;}' +
      '#' + ID + ' button{font-family:inherit;font-size:11px;font-weight:400;line-height:16px;height:20px;' +
        'margin:0;padding:0 8px;border:1px solid #ff8c1a;border-radius:2px;background:#fdf0e4;color:#333;' +
        'cursor:pointer;box-shadow:none;text-transform:none;}' +
      '#' + ID + ' button:hover{background:#fbe1c8;}' +
      '#' + ID + ' button:disabled{opacity:.55;cursor:default;}' +
      '#' + ID + ' .melding{font-size:11px;color:#666;}' +
      '#' + ID + ' .melding.goed{color:#155724;}' +
      '#' + ID + ' .melding.fout{color:#E50000;}' +
      // Het menu niet laten flitsen terwijl het script erdoorheen klikt.
      '.' + ID + '-bezig ul.dynamic-context-menu{opacity:0 !important;}';
    (document.head || document.documentElement).appendChild(s);
  }

  var meldingTimer = null;
  function melding(groep, tekst, goed) {
    var m = groep.querySelector('.melding');
    m.textContent = tekst;
    m.className = 'melding' + (goed === true ? ' goed' : goed === false ? ' fout' : '');
    m.title = tekst;
    clearTimeout(meldingTimer);
    if (goed !== null) meldingTimer = setTimeout(function () { m.textContent = ''; m.className = 'melding'; }, goed ? 6000 : 12000);
    plaats();
  }

  function maakGroep() {
    var groep = document.createElement('div');
    groep.id = ID;
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchend'].forEach(function (t) {
      groep.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    KNOPPEN.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.naam;
      b.title = 'Probleem toevoegen met Moment 5 en Probleem type "' + item.reden + '".\nOpslaan doe je zelf.';
      b.addEventListener('click', function (e) { e.preventDefault(); klik(item, groep); });
      groep.appendChild(b);
    });
    var m = document.createElement('span');
    m.className = 'melding';
    groep.appendChild(m);
    return groep;
  }

  // ── Plaatsen: rechts van het visit-tabje ─────────────────────
  var RUIMTE = 8;
  function plaats() {
    var g = document.getElementById(ID), tab = visitTab();
    if (!g || !tab) return;
    var r = tab.getBoundingClientRect(), gb = g.getBoundingClientRect();
    var links = r.right + RUIMTE, boven = r.top + (r.height - gb.height) / 2;
    // Past het niet rechts in beeld, dan onder het tabje.
    if (links + gb.width > document.documentElement.clientWidth - RUIMTE) { links = r.left; boven = r.bottom + 4; }
    g.style.left = Math.round(links) + 'px';
    g.style.top = Math.round(boven) + 'px';
  }

  function controleer() {
    var g = document.getElementById(ID);
    var tab = visitTab();
    var cbf = tab ? isCbf() : '';
    if (!tab || !cbf) {
      if (g && !bezig) g.remove();
      toestand(!tab ? 'geen knoppen: geen order open (geen visit-tabje)' : 'geen knoppen: geen CBF-order (Depot "' + veld('Depot') + '")');
      return;
    }
    if (!g) { stijl(); g = maakGroep(); document.body.appendChild(g); }
    plaats();
    toestand('knoppen staan er (' + cbf + ', visit ' + (tab.textContent.trim() || '?') + ')');
  }

  var timer = null;
  new MutationObserver(function () {
    if (timer) return;
    timer = setTimeout(function () { timer = null; controleer(); }, 250);
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', plaats);
  window.addEventListener('scroll', plaats, true);
  setInterval(function () { if (document.getElementById(ID)) plaats(); }, 1000);   // splitters, inklappen
  controleer();
})();
