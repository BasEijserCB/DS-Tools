// ==UserScript==
// @name         DS Tools — DS Logboek in DireXtion Basic
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.3.2
// @description  Knoppen DS Logboek en Service Check onder het vergrootglas; hun panelen schuiven uit vanaf de linkerrand, zoals het filterpaneel.
// @match        https://coolblue.dirextion.nl/Basic/*
// @match        https://coolblue.dirextion.nl/basic/*
// @match        https://coolblue.dirextion.nl/BASIC/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-basic.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-basic.user.js
// ==/UserScript==

/* Dunne starter: de tools zelf worden met stale-while-revalidate geladen onder
   dezelfde cache-sleutels als de bladwijzers en de launcher — ds-logboek.js
   (ds_app_prod_cache) en extern/service-check.js (ds_servicecheck_cache).

   1. Knoppen. Onder het vergrootglas aan de linkerrand een rij knoppen in
      dezelfde stijl, met een lijnicoon, een licht oranje vlak en een dun fel
      oranje randje: DS Logboek (klembord) en Service Check (lijst met vinkjes,
      v1.3.0). Zichtbaar bij een open order (visit-tabje met cijfers rechts-
      boven) of zolang er een weggeschoven paneel is; verborgen als het
      filterpaneel openstaat.
   2. Gedrag, zoals het filterpaneel. Klik: het paneel schuift uit vanaf de
      linkerrand, op de hoogte van zijn knop, en die knop rijdt mee naar zijn
      rechterrand als tab (v1.3.1: alleen die knop). Nog een klik: wegschuiven,
      de inhoud blijft. Een andere (zichtbare) knop: wisselen. Het vergrootglas: alles weg. Alleen ×
      in een paneel sluit het. Oranje stip op het logboek = er wacht een gesprek.
   3. Orderwissel. Basic wisselt van order zonder nieuwe pagina; het logboek
      leest de order maar één keer. Verandert het ordernummer terwijl het
      logboek open is, dan komt er bovenin het paneel een balk met
      "Opnieuw starten" (parkeert eerst als er al iets beantwoord is) of
      "Negeren". Service Check zoekt opnieuw op als je hem bij een andere order
      weer opent (of met ↻). */
(function () {
  'use strict';

  // DS Tools: dit script is ook een module van het Tampermonkey-script DS Tools
  // (launcher.js, lijst AUTO). Nooit dubbel: wie het eerst draait claimt de plek.
  if (window.__dsAuto && window.__dsAuto['auto-logboek-basic']) return;
  (window.__dsAuto = window.__dsAuto || {})['auto-logboek-basic'] = true;

  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ds-logboek.js';
  var CACHE = 'ds_app_prod_cache';
  var KNOP_ID = 'ds-logboek-tabknop';
  var BALK_ID = 'ds-logboek-wisselbalk';
  var ORANJE = '#e67e22';
  // Onze eigen elementen: overslaan bij het zoeken naar visit-tabje en vergrootglas.
  var EIGEN = '#' + KNOP_ID + ', #ds-sc-knop, #ds-sc-paneel, #' + BALK_ID + ', #ds-combi-wrapper';
  var VERSIE = '1.3.2';

  // Diagnose (v1.1.8): in de console (F12, filter "DS Logboek userscript") is te
  // zien óf het script draait en waarom de knop er (niet) staat. Alleen bij een
  // verandering van toestand, zodat de console niet volloopt.
  console.info('[DS Logboek userscript] v' + VERSIE + ' actief op ' + location.pathname);
  var vorigeToestand = '';
  function toestand(t) { if (t === vorigeToestand) return; vorigeToestand = t; console.info('[DS Logboek userscript] ' + t); }


  // ── Code laden (stale-while-revalidate) ──────────────────────
  // Bij het laden van de pagina de cache verversen; een klik gebruikt de cache
  // (synchroon), anders de verse code. Zelfde sleutels als de launcher.
  function bron(src, cache) {
    var vers = null;
    function lees() { try { return localStorage.getItem(cache); } catch (e) { return null; } }
    fetch(src + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (code) {
        vers = code;
        if (code && code !== lees()) {
          try { localStorage.setItem(cache, code); }
          catch (e) { try { localStorage.removeItem(cache); localStorage.setItem(cache, code); } catch (e2) {} }
        }
      })
      .catch(function (e) { console.error('[DS Logboek userscript] ophalen mislukt (' + src.split('/').pop() + '):', e); });
    return function () { return lees() || vers; };
  }
  var logboekCode = bron(SRC, CACHE);
  var scCode = bron('https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/extern/service-check.js', 'ds_servicecheck_cache');

  function startLogboek() {
    var code = logboekCode();
    if (!code) { alert('DS Logboek is nog niet geladen. Probeer het over een paar seconden opnieuw.'); return; }
    verbergBalk();
    try { eval(code); }
    catch (e) { console.error('[DS Logboek userscript] logboek gaf een fout:', e); }
  }

  // ── Het tabje van de geopende order ──────────────────────────
  // Een stuk tekst met alleen cijfers, bovenin de rechterhelft van het scherm.
  // Gezocht op tekstknopen, niet op elementen (v1.1.9): bij een visit met een
  // waarschuwing (oranje "!" op het huisje) heeft het tabje een extra kind-
  // element, en de oude eis "hoogstens één kind" sloeg het dan over. Bij meer
  // treffers wint de bovenste: het tabje staat boven de velden (telefoonnummer,
  // afnemernummer) die ook alleen cijfers kunnen zijn.
  function orderTab() {
    var beste = null, besteTop = Infinity;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return /^\s*\d{6,12}\s*$/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
    });
    while (walker.nextNode()) {
      var el = walker.currentNode.parentElement;
      if (!el || el.closest(EIGEN)) continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.top > 320 || r.left < window.innerWidth * 0.4) continue;
      if (r.top < besteTop) { besteTop = r.top; beste = el; }
    }
    // Het hele tabje (met icoon), niet alleen de tekst.
    return beste ? (beste.closest('[role="tab"], .dx-tab, li') || beste.parentElement) : null;
  }

  // Ordersleutel: het nummer in het tabje, anders het pakbonnummer.
  function huidigeOrder() {
    var tab = orderTab();
    var cijfers = tab && tab.textContent.match(/\d{6,12}/);
    if (cijfers) return cijfers[0];
    var fields = document.querySelectorAll('.details-field');
    for (var i = 0; i < fields.length; i++) {
      var lbl = fields[i].querySelector('.details-field-label p');
      var val = fields[i].querySelector('.details-field-value p');
      if (lbl && val && /^(Pakbonnummer|Order nr\. verlader)$/.test(lbl.textContent.trim())) return val.textContent.trim();
    }
    return '';
  }

  // ── Het vergrootglas linksboven ───────────────────────────────
  // De tabs linksboven (Orders | Problemen | Rit overzicht) dienen als ankerpunt:
  // het vergrootglas staat links ervan, op dezelfde hoogte, tegen de linkerrand.
  // Gevonden met elementFromPoint en dan omhoog zolang het element klein blijft
  // en tegen de rand ligt — zo is het het hele knopvlak, niet alleen het icoon.
  // Staat het filterpaneel open, dan ligt daar een invulveld: geen vergrootglas.
  function lijstTab(naam) {
    var els = document.querySelectorAll('a, li, span, div');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 1 || el.closest(EIGEN) || el.textContent.trim() !== naam) continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.top > 320 || r.left > window.innerWidth * 0.5) continue;
      return el.closest('[role="tab"], .dx-tab, li') || el.parentElement;
    }
    return null;
  }

  // Zichtbare tekst telt, verborgen niet (v1.2.1): het vergrootglas kan in
  // dezelfde container zitten als het dichtgeklapte filterformulier, waarvan
  // de labels wel in textContent staan maar niet in innerText.
  function zichtbareTekst(e) { return (e.innerText || '').trim().length; }

  // De tab Orders (of Problemen / Rit overzicht) onthouden: lijstTab() loopt de
  // hele pagina door, en tijdens het wachten op het vergrootglas (hieronder)
  // wordt dit vaak gevraagd.
  var anker = null;
  function ankerTab() {
    if (anker && anker.isConnected && anker.getBoundingClientRect().width > 0) return anker;
    anker = lijstTab('Orders') || lijstTab('Problemen') || lijstTab('Rit overzicht');
    return anker;
  }

  function loepPunten() {
    var tab = ankerTab();
    if (!tab) return [];
    var rt = tab.getBoundingClientRect(), p = [];
    [rt.top + rt.height / 2, rt.top + 6, rt.bottom - 6].forEach(function (y) {
      [2, 6, 10, 14, 18].forEach(function (x) { p.push([x, y]); });
    });
    return p;
  }

  function vindLoep() {
    var punten = loepPunten();
    for (var i = 0; i < punten.length; i++) {
      var el = document.elementFromPoint(punten[i][0], punten[i][1]);
      if (!el || el.closest(EIGEN)) continue;
      var kandidaten = [];
      for (var e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
        var r = e.getBoundingClientRect();
        if (!(r.left <= 20 && r.width <= 80 && r.height <= 80)) break;
        if (r.width >= 14 && r.height >= 14 && zichtbareTekst(e) < 15) kandidaten.push(e);
      }
      // Het element dat getekend wordt (rand of achtergrond), van buiten naar
      // binnen (v1.2.4). v1.2.0–v1.2.3 namen de buitenste container: zat de rand
      // op een binnenste laag, dan werd onze knop groter, zonder rand en met
      // een scheve tussenruimte.
      for (var v = kandidaten.length - 1; v >= 0; v--) if (heeftVlak(kandidaten[v])) { meldLoep(kandidaten[v]); return kandidaten[v]; }
      if (kandidaten.length) { meldLoep(kandidaten[kandidaten.length - 1]); return kandidaten[kandidaten.length - 1]; }
    }
    meldLoepOnderzoek(punten);
    return null;
  }

  function heeftVlak(e) {
    var cs = getComputedStyle(e);
    var rand = ['Top', 'Right', 'Bottom', 'Left'].some(function (z) {
      return parseFloat(cs['border' + z + 'Width']) > 0 && cs['border' + z + 'Style'] !== 'none';
    });
    var vlak = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || cs.backgroundImage !== 'none';
    return rand || vlak;
  }

  // Eén keer per pagina: welk element als vergrootglas geldt, met maat en rand,
  // zodat afwijkingen in de console na te gaan zijn.
  var loepGemeld = false;
  function meldLoep(e) {
    if (loepGemeld) return;
    loepGemeld = true;
    var cs = getComputedStyle(e), r = e.getBoundingClientRect();
    var k = typeof e.className === 'string' ? e.className.trim() : '';
    console.info('[DS Logboek userscript] vergrootglas: ' + e.tagName.toLowerCase() + (k ? '.' + k.split(/\s+/).join('.') : '') +
      ' [' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ']' +
      ' rand ' + cs.borderTopWidth + '/' + cs.borderRightWidth + '/' + cs.borderBottomWidth + '/' + cs.borderLeftWidth + ' ' + cs.borderRightColor +
      ' · hoek ' + cs.borderRadius + ' · vlak ' + cs.backgroundColor + (cs.backgroundImage !== 'none' ? ' + verloop' : '') +
      ' · schaduw ' + cs.boxShadow);
  }

  // Eén keer per pagina: wat er ligt op de plek waar het vergrootglas hoort,
  // zodat een plakje uit de console genoeg is om de herkenning bij te stellen.
  var loepOnderzocht = false;
  function meldLoepOnderzoek(punten) {
    if (loepOnderzocht || !punten.length || !orderTab()) return;
    loepOnderzocht = true;
    var regels = [];
    punten.slice(0, 5).forEach(function (pt) {
      var c = [];
      for (var n = document.elementFromPoint(pt[0], pt[1]); n && n !== document.documentElement; n = n.parentElement) {
        var b = n.getBoundingClientRect();
        var k = typeof n.className === 'string' ? n.className.trim() : (n.className && n.className.baseVal) || '';
        c.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (k ? '.' + k.split(/\s+/).join('.') : '') +
          ' [' + Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height) +
          ' tekst:' + zichtbareTekst(n) + '/' + n.textContent.trim().length + ']');
        if (c.length >= 7) break;
      }
      regels.push('x=' + pt[0] + ' y=' + Math.round(pt[1]) + ': ' + c.join(' < '));
    });
    console.info('[DS Logboek userscript] onderzoek vergrootglas:\n' + regels.join('\n'));
  }

  // ── Laden: knoppen onder het vergrootglas, panelen vanaf de linkerrand ──
  // Elke lade = één knop in de rij onder het vergrootglas en één paneel dat
  // vanaf de linkerrand uitschuift, zoals het filterpaneel van DireXtion (v1.3.0:
  // DS Logboek en Service Check). Eén lade tegelijk: een andere openen, of op
  // het vergrootglas klikken, schuift de open lade weg. Wegschuiven is niet
  // sluiten — de inhoud blijft staan; alleen × in het paneel sluit.
  //
  // Knoppen: maat, schaduw en hoek van het vergrootglas (computed style, geen
  // klassen: DireXtion's klikafhandeling grijpt er dan niet op in), een lijn-
  // icoon, een licht oranje vlak en een dun fel oranje randje als eigen accent.
  // Elke knop hoort bij zijn eigen paneel: alleen die rijdt mee (zie
  // plaatsKnoppen). Een oranje stip (alleen het logboek) = er wacht een
  // weggeschoven gesprek.
  var GAT = 4;                    // ruimte tussen de knoppen (zoals de linkerbalk van de planningsmodule)
  var LICHT_ORANJE = '#fdf0e4';
  var RAND_ORANJE = '1px solid #ff8c1a';
  var IN_MS = 260, UIT_MS = 200;  // zelfde tempo als het inschuiven in ds-logboek.js
  var PANEEL_RAND = '1px solid #a9bcd8';
  var loep = null;

  var ICOON = {
    klembord: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="8.5" y="2.5" width="7" height="4" rx="1"/>' +
      '<path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
    vinklijst: '<path d="M11 6h9M11 12h9M11 18h9"/><path d="M3.5 6l1.6 1.6L8.5 4.2M3.5 12l1.6 1.6l3.4-3.4M3.5 18l1.6 1.6l3.4-3.4"/>'
  };
  function svg(naam, maat, kleur) {
    return '<svg viewBox="0 0 24 24" width="' + maat + '" height="' + maat + '" fill="none" stroke="' + (kleur || 'currentColor') + '" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICOON[naam] + '</svg>';
  }

  var LADEN = [];
  var LOGBOEK = { id: 'logboek', knopId: KNOP_ID, titel: 'DS Logboek', icoon: 'klembord', stip: true,
    paneel: wrapperNu, start: startLogboek, verborgen: false, token: 0 };
  var SC = { id: 'servicecheck', knopId: 'ds-sc-knop', titel: 'Service Check', icoon: 'vinklijst', stip: false,
    paneel: scPaneelNu, start: startServiceCheck, verborgen: false, token: 0 };
  LADEN.push(LOGBOEK, SC);

  function wrapperNu() {
    var a = window.__dsLogboek;
    return a && a.wrapper && a.wrapper.isConnected ? a.wrapper : null;
  }
  function scPaneelNu() { var p = document.getElementById('ds-sc-paneel'); return p && p.isConnected ? p : null; }

  function maakKnop(l, lp) {
    var cs = getComputedStyle(lp);
    var ic = lp.querySelector('svg, img, i, [class*="icon"]');
    var icH = ic ? Math.round(ic.getBoundingClientRect().height) : 0;
    if (!(icH >= 10 && icH <= 32)) icH = 18;
    var k = document.createElement('div');
    k.id = l.knopId;
    k.title = l.titel;
    k.setAttribute('role', 'button');
    k.innerHTML = svg(l.icoon, icH);
    var st = k.style;
    st.position = 'fixed';
    st.zIndex = '1000';           // boven DireXtion, onder de panelen
    st.boxSizing = 'border-box';
    st.display = 'flex';
    st.alignItems = 'center';
    st.justifyContent = 'center';
    st.color = getComputedStyle(ic || lp).color || '#333333';
    st.backgroundColor = LICHT_ORANJE;
    st.boxShadow = cs.boxShadow;
    ['Top', 'Right', 'Bottom', 'Left'].forEach(function (z) { st['border' + z] = RAND_ORANJE; });
    st.borderRadius = cs.borderRadius;
    st.cursor = 'pointer';
    k._hoek = cs.borderRadius;
    if (l.stip) {
      var stip = document.createElement('span');
      stip.className = 'ds-logboek-stip';
      stip.style.cssText = 'position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-radius:50%;' +
        'background:#c75f0c;box-shadow:0 0 0 1.5px #fff;display:none;';
      k.appendChild(stip);
    }
    k.addEventListener('mouseenter', function () { k.style.backgroundImage = 'linear-gradient(rgba(230,126,34,0.12),rgba(230,126,34,0.12))'; });
    k.addEventListener('mouseleave', function () { k.style.backgroundImage = 'none'; });
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'dxclick'].forEach(function (ev) {
      k.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    k.addEventListener('click', function () { klik(l); });
    return k;
  }

  // Elke knop hoort bij zijn eigen paneel (v1.3.1): alleen de knop van een
  // zichtbaar paneel rijdt mee naar diens rechterrand en vormt er een tab mee
  // (ook tijdens het wegschuiven). De andere knoppen blijven aan de linkerrand,
  // onder de panelen (z-index), zoals DireXtion's filterpaneel ook over de
  // pagina schuift. v1.3.0 liet alle knoppen met een open paneel meerijden.
  function plaatsKnoppen() {
    if (!loep || !loep.isConnected) return;
    var rl = loep.getBoundingClientRect();
    LADEN.forEach(function (l, i) {
      var k = document.getElementById(l.knopId);
      if (!k) return;
      var left = rl.left, top = knopTop(i);
      var p = l.paneel();
      var tab = false;
      if (p && p.style.visibility !== 'hidden') {
        var rw = p.getBoundingClientRect();
        if (rw.right - 1 > left) { left = rw.right - 1; tab = true; }
      }
      k.style.borderLeft = tab ? '0' : RAND_ORANJE;
      k.style.borderRadius = tab ? '0' : k._hoek;
      k.style.zIndex = tab ? '1000000' : '1000';
      var wacht = l.stip && p && l.verborgen;
      var stip = k.querySelector('.ds-logboek-stip');
      if (stip) stip.style.display = wacht ? 'block' : 'none';
      k.title = wacht ? l.titel + ' — gesprek staat klaar' : l.titel;
      k.style.left = Math.round(left) + 'px';
      k.style.top = Math.round(top) + 'px';
      k.style.width = Math.round(rl.width) + 'px';
      k.style.height = Math.round(rl.height) + 'px';
    });
  }

  // Bovenkant van de knop op plek i in de rij onder het vergrootglas.
  function knopTop(i) {
    var rl = loep.getBoundingClientRect();
    return rl.bottom + GAT + i * (rl.height + GAT);
  }

  // De knoppen een tijdje elk beeld volgen (tijdens het schuiven).
  function volg(ms) {
    var eind = performance.now() + ms;
    (function stap() {
      plaatsKnoppen();
      if (performance.now() < eind) requestAnimationFrame(stap);
    })();
    setTimeout(plaatsKnoppen, ms + 20);
  }

  function zonderBeweging() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function verberg(l) {
    var p = l.paneel();
    if (!p) return;
    var t = ++l.token;
    l.verborgen = true;
    var r = p.getBoundingClientRect();
    p.style.transition = zonderBeweging() ? 'none' : 'transform ' + UIT_MS + 'ms cubic-bezier(0.4, 0, 1, 1)';
    p.style.transform = 'translateX(' + -(Math.round(r.right) + 12) + 'px)';
    p.style.pointerEvents = 'none';
    setTimeout(function () { if (t === l.token && p.isConnected) p.style.visibility = 'hidden'; }, UIT_MS + 20);
    volg(UIT_MS + 60);
  }

  function toon(l) {
    var p = l.paneel();
    if (!p) return;
    ++l.token;
    l.verborgen = false;
    p.style.visibility = '';
    p.style.pointerEvents = '';
    p.getBoundingClientRect();    // huidige (weggeschoven) stand vastleggen, dan pas de overgang
    p.style.transition = zonderBeweging() ? 'none' : 'transform ' + IN_MS + 'ms cubic-bezier(0.2, 0, 0, 1)';
    p.style.transform = 'translateX(0)';
    volg(IN_MS + 60);
  }

  function verbergAndere(l) {
    LADEN.forEach(function (o) { if (o !== l && o.paneel() && !o.verborgen) verberg(o); });
  }

  function klik(l) {
    var p = l.paneel();
    if (!p) { verbergAndere(l); l.start(); return; }
    if (!l.verborgen) { verberg(l); return; }
    verbergAndere(l);
    if (l.bijTonen) l.bijTonen();
    toon(l);
  }

  function zorgVoorKnop() {
    var panelen = LADEN.some(function (l) { return !!l.paneel(); });
    LADEN.forEach(function (l) { if (!l.paneel()) l.verborgen = false; });
    var metOrder = !!orderTab();
    // Zichtbaar bij een open order, of zolang er een (weggeschoven) paneel is.
    if (!panelen && !metOrder) {
      toestand('geen knop: geen open order gevonden (visit-tabje met cijfers rechtsboven)');
      stopWachten();
      LADEN.forEach(function (l) { var k = document.getElementById(l.knopId); if (k) k.remove(); });
      return;
    }
    var open = LADEN.some(function (l) { return l.paneel() && !l.verborgen; });
    var gevonden = vindLoep();
    if (gevonden) loep = gevonden;
    // Ligt ons eigen paneel er (bij een laag scherm) overheen, dan het oude houden.
    else if (!(loep && loep.isConnected && open)) loep = null;
    if (!loep) {
      toestand('geen knop: vergrootglas linksboven niet gevonden (of het filterpaneel staat open)');
      LADEN.forEach(function (l) { var k = document.getElementById(l.knopId); if (k) k.style.display = 'none'; });
      wachtOpLoep();
      return;
    }
    LADEN.forEach(function (l) {
      var k = document.getElementById(l.knopId);
      if (!k) { k = maakKnop(l, loep); document.body.appendChild(k); }
      k.style.display = (metOrder || l.paneel()) ? 'flex' : 'none';
    });
    plaatsKnoppen();
    toestand('knoppen staan er (order ' + huidigeOrder() + ')');
  }

  // Filterpaneel dicht = vaak alleen een stijlwijziging, geen nieuwe elementen,
  // dus de MutationObserver ziet het niet. Zolang het vergrootglas weg is (en er
  // een order open staat) elke 400 ms kijken of het terug is (v1.2.6).
  var loepPoll = null;
  function wachtOpLoep() {
    if (loepPoll) return;
    loepPoll = setInterval(function () {
      if (vindLoep()) { stopWachten(); zorgVoorKnop(); }
    }, 400);
  }
  function stopWachten() { if (loepPoll) { clearInterval(loepPoll); loepPoll = null; } }

  // ── Plek van een paneel ───────────────────────────────────────
  // Tegen de linkerrand, met de bovenkant gelijk aan zijn eigen knop — zoals het
  // filterpaneel aan het vergrootglas hangt (v1.3.1; het vergrootglas en de
  // knoppen erboven blijven bereikbaar). Past hij daar niet in de hoogte, dan
  // schuift hij omhoog.
  function paneelTop(l, h) {
    if (!loep || !loep.isConnected) loep = vindLoep();
    if (!loep) return null;
    var top = Math.round(knopTop(LADEN.indexOf(l)));
    if (h && top + h > window.innerHeight - 8) top = Math.max(8, Math.round(window.innerHeight - 8 - h));
    return top;
  }

  function plaatsPaneel(w) {
    var top = paneelTop(LOGBOEK, w.getBoundingClientRect().height);
    if (top === null) return;
    w.style.left = '0px';
    w.style.bottom = 'auto';
    w.style.top = top + 'px';
    w.style.borderLeftWidth = '0';
    w.style.borderTopLeftRadius = '0';
    w.style.borderBottomLeftRadius = '0';
  }

  // ── Lade 1: DS Logboek ────────────────────────────────────────
  // ds-logboek.js schuift zichzelf in (DS_LOGBOEK_SCHUIVEN, v1.47.0) en krijgt op
  // Basic standaard het DireXtion-uiterlijk (DS_LOGBOEK_THEMA, v1.48.0; een eigen
  // keuze in localStorage ds_logboek_thema wint).
  window.DS_LOGBOEK_SCHUIVEN = true;
  window.DS_LOGBOEK_THEMA = 'dirextion';

  var laatsteWrapper = null;
  window.DS_LOGBOEK_PLEK = function (w, ifr) {
    laatsteWrapper = w;
    // Ook als het logboek met de bookmarklet of de launcher gestart is.
    openOrder = huidigeOrder();
    genegeerd = '';
    LOGBOEK.verborgen = false;
    verbergAndere(LOGBOEK);
    plaatsPaneel(w);
    // Hoogte wisselt met de S/M/L-knop in het logboek: opnieuw passen.
    if (window.ResizeObserver) new ResizeObserver(function () {
      if (!w.isConnected) return;
      plaatsPaneel(w);
      plaatsKnoppen();
    }).observe(w);
    volg(IN_MS + 450);   // inschuiven in ds-logboek.js (met vangnet tot 410 ms)
    // × en loggen gebeuren ín het logboek (eigen iframe-document), dus daar
    // meeluisteren: na elke klik de knoppen een tijdje laten meerijden (v1.2.5).
    try {
      var idoc = ifr && (ifr.contentDocument || ifr.contentWindow.document);
      if (idoc) idoc.addEventListener('click', function () {
        volg(UIT_MS + 500);
        setTimeout(zorgVoorKnop, UIT_MS + 450);
      }, true);
    } catch (e) {}
  };

  // ── Lade 2: Service Check ─────────────────────────────────────
  // De Service Check van David (extern/service-check.js, origineel in
  // ~/Documents/Tool David) draait ongewijzigd, met dezelfde cache als de
  // launcher. Hij leest het product uit de order en laat het Tampermonkey-script
  // "Coolblue Service Check" de Coolblue-pagina ophalen (data-svc-helper). Zijn
  // blauwe kader (#cb-svc-box, of #cb-svc-pick bij meer producten) wordt zodra
  // het verschijnt in ons paneel gezet en met CSS ontdaan van kop, positie en
  // schaduw; de statusregel uit die kop komt in onze kop. Ook een Service Check
  // die via de launcher of de bladwijzer start, komt zo in het paneel.
  // Afhankelijk van de opbouw van dat kader: eerste kind = kop, [data-body],
  // [data-status]. Verandert David die, dan hier aanpassen.
  var scOrder = '';

  function scStijl() {
    if (document.getElementById('ds-sc-stijl')) return;
    var font = '';
    try { font = getComputedStyle(document.body).fontFamily.replace(/[<>{}]/g, ''); } catch (e) {}
    var P = '#ds-sc-paneel', I = '#ds-sc-inhoud';
    var css = [
      P + '{position:fixed;left:0;width:360px;background:#fff;border:' + PANEEL_RAND + ';border-left:0;box-shadow:2px 2px 10px rgba(0,0,0,0.15);' +
        'z-index:999998;display:flex;flex-direction:column;box-sizing:border-box;font-family:' + (font || '"Segoe UI",Arial,sans-serif') + ';font-size:13px;color:#333333;}',
      P + ' .ds-sc-kop{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid #e3e3e3;flex-shrink:0;}',
      P + ' .ds-sc-titel{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:14px;color:#333333;padding-bottom:3px;border-bottom:2px solid #e67e22;white-space:nowrap;}',
      P + ' .ds-sc-status{flex:1;min-width:0;margin-left:6px;color:#666666;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      P + ' .ds-sc-knopje{background:#fff;border:1px solid #cccccc;border-radius:2px;color:#666666;font:inherit;font-size:12px;padding:2px 8px;cursor:pointer;}',
      P + ' .ds-sc-knopje:hover{border-color:#e67e22;color:#e67e22;}',
      P + ' .ds-sc-sluit{background:none;border:none;color:#999999;font-size:16px;line-height:1;cursor:pointer;padding:0 2px 0 4px;font-weight:300;}',
      P + ' .ds-sc-sluit:hover{color:#333333;}',
      I + '{overflow:auto;flex:1;min-height:0;}',
      I + ' .ds-sc-melding{padding:12px;color:#666666;line-height:1.5;}',
      // Het kader van de Service Check: geen eigen positie, kop, schaduw of hoeken.
      I + ' #cb-svc-box,' + I + ' #cb-svc-pick{position:static !important;top:auto !important;right:auto !important;width:auto !important;' +
        'max-height:none !important;overflow:visible !important;box-shadow:none !important;border-radius:0 !important;background:transparent !important;' +
        'z-index:auto !important;font:inherit !important;color:#333333 !important;}',
      I + ' #cb-svc-box>div:first-child,' + I + ' #cb-svc-pick>div:first-child{display:none !important;}',
      I + ' #cb-svc-box [data-body],' + I + ' #cb-svc-pick>div:nth-child(2){display:block !important;padding:12px !important;}',
      I + ' #cb-svc-box [data-body]>div[style*="border-radius"]{border-radius:2px !important;}'
    ];
    var s = document.createElement('style');
    s.id = 'ds-sc-stijl';
    s.textContent = css.join('\n');
    document.head.appendChild(s);
  }

  function scPaneel() {
    var p = scPaneelNu();
    if (p) return p;
    scStijl();
    p = document.createElement('div');
    p.id = 'ds-sc-paneel';
    p.innerHTML = '<div class="ds-sc-kop"><span class="ds-sc-titel">' + svg('vinklijst', 16, '#333333') + 'Service Check</span>' +
      '<span class="ds-sc-status"></span>' +
      '<button type="button" class="ds-sc-knopje" data-opnieuw title="Opnieuw opzoeken">↻</button>' +
      '<button type="button" class="ds-sc-sluit" data-sluit title="Sluiten">✕</button></div>' +
      '<div id="ds-sc-inhoud"></div>';
    p.querySelector('[data-opnieuw]').onclick = function () { draaiServiceCheck(); };
    p.querySelector('[data-sluit]').onclick = sluitServiceCheck;
    // Nieuw paneel staat buiten beeld links; toon() schuift hem erin.
    p.style.transform = 'translateX(-380px)';
    document.body.appendChild(p);
    SC.verborgen = true;
    if (window.ResizeObserver) new ResizeObserver(function () { if (p.isConnected) { plaatsScPaneel(); plaatsKnoppen(); } }).observe(p);
    plaatsScPaneel();
    return p;
  }

  function plaatsScPaneel() {
    var p = scPaneelNu();
    if (!p) return;
    var top = paneelTop(SC, 0);
    if (top === null) return;
    p.style.top = top + 'px';
    p.style.maxHeight = Math.max(200, window.innerHeight - top - 8) + 'px';
  }

  function scMelding(tekst) {
    var inhoud = document.getElementById('ds-sc-inhoud');
    if (!inhoud) return;
    inhoud.innerHTML = '';
    var m = document.createElement('div');
    m.className = 'ds-sc-melding';
    m.textContent = tekst;
    inhoud.appendChild(m);
    var st = document.querySelector('#ds-sc-paneel .ds-sc-status');
    if (st) st.textContent = '';
  }

  function draaiServiceCheck() {
    var code = scCode();
    if (!code) { scMelding('Service Check is nog niet geladen. Probeer het over een paar seconden opnieuw.'); return; }
    scOrder = huidigeOrder();
    var helper = document.documentElement.getAttribute('data-svc-helper') === '1';
    scMelding(helper ? 'Service Check zoekt de services op…'
      : 'Het Tampermonkey-script "Coolblue Service Check" staat niet aan, dus het resultaat opent in een nieuw tabblad op Coolblue.');
    try { eval(code); }
    catch (e) { console.error('[DS Logboek userscript] Service Check gaf een fout:', e); scMelding('Service Check gaf een fout: ' + (e && e.message)); }
  }

  function startServiceCheck() {
    var nieuw = !scPaneelNu();
    scPaneel();
    verbergAndere(SC);
    toon(SC);
    if (nieuw || huidigeOrder() !== scOrder) draaiServiceCheck();
  }
  // Weer tonen na wegschuiven: een andere order intussen = opnieuw opzoeken.
  SC.bijTonen = function () { if (huidigeOrder() !== scOrder) draaiServiceCheck(); };

  function sluitServiceCheck() {
    var p = scPaneelNu();
    if (!p) return;
    verberg(SC);
    setTimeout(function () { if (p.isConnected) p.remove(); SC.verborgen = false; zorgVoorKnop(); }, UIT_MS + 30);
  }

  // Het kader van de Service Check in het paneel zetten, zodra het verschijnt
  // (MutationObserver op de directe kinderen van body: meteen, zonder vertraging).
  function vangKader(el) {
    if (!el || (el.id !== 'cb-svc-box' && el.id !== 'cb-svc-pick')) return;
    if (!scPaneelNu() && !(loep && loep.isConnected)) return;   // geen balk: laat hem staan waar hij staat
    var p = scPaneel();
    var inhoud = document.getElementById('ds-sc-inhoud');
    inhoud.innerHTML = '';
    inhoud.appendChild(el);
    var status = el.querySelector('[data-status]');
    var st = p.querySelector('.ds-sc-status');
    if (st) st.textContent = status ? status.textContent : '';
    if (!scOrder) scOrder = huidigeOrder();
    if (SC.verborgen) { verbergAndere(SC); toon(SC); }
  }
  new MutationObserver(function (lijst) {
    lijst.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, vangKader); });
  }).observe(document.body, { childList: true });

  // ── Algemeen ──────────────────────────────────────────────────
  window.addEventListener('resize', function () {
    var w = wrapperNu(); if (w) plaatsPaneel(w);
    plaatsScPaneel();
    zorgVoorKnop();
  });
  // Klik op het vergrootglas terwijl een paneel open is: dat paneel weg, zodat
  // het filterpaneel er niet onder valt. Eén lade tegelijk.
  document.addEventListener('click', function (e) {
    if (loep && loep.contains(e.target)) verbergAndere(null);
    setTimeout(zorgVoorKnop, 300);
  }, true);
  document.addEventListener('keyup', function () { setTimeout(zorgVoorKnop, 300); }, true);

  // ── Orderwissel ───────────────────────────────────────────────
  var openOrder = '';
  var genegeerd = '';

  function verbergBalk() { var b = document.getElementById(BALK_ID); if (b) b.remove(); }

  function toonBalk(w, nieuw) {
    var b = document.getElementById(BALK_ID);
    var bezig = window.__dsLogboek && window.__dsLogboek.bezig && window.__dsLogboek.bezig();
    // De sleutel is het visit-id uit het tabje (of het pakbonnummer als terugval).
    var nr = function (v) { return /^\d+$/.test(v) ? 'visit ' + v : v; };
    var tekst = 'Andere order geopend' + (nieuw ? ' (' + nr(nieuw) + ')' : '') + '. ' +
      (bezig ? 'Dit gesprek hoort bij ' + nr(openOrder) + '.' : 'Het logboek staat nog op ' + nr(openOrder) + '.');
    if (b && b.getAttribute('data-nieuw') === nieuw && b.getAttribute('data-bezig') === String(bezig)) return;
    if (b) b.remove();
    b = document.createElement('div');
    b.id = BALK_ID;
    b.setAttribute('data-nieuw', nieuw);
    b.setAttribute('data-bezig', String(bezig));
    b.style.cssText = 'background:#fff8e1;color:#856404;border-bottom:1px solid #ffc107;padding:8px 10px;' +
      'font:12px/1.4 "Segoe UI",Arial,sans-serif;';
    var p = document.createElement('div');
    p.textContent = '⚠ ' + tekst;
    p.style.marginBottom = '6px';
    b.appendChild(p);
    function knop(label, primair, fn) {
      var k = document.createElement('button');
      k.textContent = label;
      k.style.cssText = 'font:600 12px "Segoe UI",Arial,sans-serif;padding:4px 10px;margin-right:6px;border-radius:4px;cursor:pointer;' +
        (primair ? 'background:#0090e3;color:#fff;border:1px solid #0090e3;' : 'background:#fff;color:#333333;border:1px solid #DDDDDD;');
      k.onclick = fn;
      b.appendChild(k);
    }
    knop(bezig ? 'Parkeren en opnieuw starten' : 'Opnieuw starten', true, function () {
      var api = window.__dsLogboek;
      if (api && api.bezig && api.bezig()) api.parkeer(); else if (api && api.wrapper) api.wrapper.remove();
      startLogboek();
    });
    knop('Negeren', false, function () { genegeerd = nieuw; verbergBalk(); });
    w.insertBefore(b, w.firstChild);
  }

  function controleerWissel() {
    var api = window.__dsLogboek;
    var w = api && api.wrapper;
    if (!w || !w.isConnected) { verbergBalk(); return; }
    var nu = huidigeOrder();
    if (!nu || !openOrder || nu === openOrder || nu === genegeerd) { verbergBalk(); return; }
    toonBalk(w, nu);
  }

  // ── Bewaken ───────────────────────────────────────────────────
  var timer = null;
  new MutationObserver(function () {
    // Paneel weg (× of loggen): knop meteen terug naar de rand, niet pas na de
    // vertraging hieronder (v1.2.5).
    if (laatsteWrapper && !laatsteWrapper.isConnected) {
      laatsteWrapper = null;
      LOGBOEK.verborgen = false;
      plaatsKnoppen();
    }
    if (timer) return;
    timer = setTimeout(function () { timer = null; zorgVoorKnop(); controleerWissel(); }, 250);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  zorgVoorKnop();
})();
