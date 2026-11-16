// ==UserScript==
// @name         DS Tools — DS Logboek in DireXtion Basic
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.2.3
// @description  Knop DS Logboek onder het vergrootglas; het logboek schuift uit vanaf de linkerrand, zoals het filterpaneel.
// @match        https://coolblue.dirextion.nl/Basic/*
// @match        https://coolblue.dirextion.nl/basic/*
// @match        https://coolblue.dirextion.nl/BASIC/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-basic.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-basic.user.js
// ==/UserScript==

/* Dunne starter: ds-logboek.js wordt met stale-while-revalidate geladen onder
   dezelfde cache-sleutel als de bookmarklet en de launcher (ds_app_prod_cache).

   1. Knop (v1.2.0). Een vierkante knop direct onder het vergrootglas aan de
      linkerrand, in dezelfde stijl, met een klembord-icoon; een oranje stip
      zolang er een weggeschoven logboek wacht (v1.2.3). Zichtbaar bij een open order (visit-tabje met cijfers rechts-
      boven) of zolang er een weggeschoven logboek is; verborgen als het
      filterpaneel openstaat. v1.1.x had een tabknop naast Rit overzicht.
   2. Gedrag, zoals het filterpaneel. Klik: het logboek schuift uit vanaf de
      linkerrand, de knop rijdt mee naar de rechterbovenhoek van het paneel.
      Nog een klik: het paneel schuift weg en het gesprek blijft bewaard; alleen
      × in het logboek beëindigt het. Klik op het vergrootglas: het logboek
      schuift weg, één lade tegelijk.
   3. Orderwissel. Basic wisselt van order zonder nieuwe pagina; het logboek
      leest de order maar één keer. Verandert het ordernummer terwijl het
      logboek open is, dan komt er bovenin het paneel een balk met
      "Opnieuw starten" (parkeert eerst als er al iets beantwoord is) of
      "Negeren". Terug naar de oude order = balk weer weg. */
(function () {
  'use strict';

  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ds-logboek.js';
  var CACHE = 'ds_app_prod_cache';
  var KNOP_ID = 'ds-logboek-tabknop';
  var BALK_ID = 'ds-logboek-wisselbalk';
  var ORANJE = '#e67e22';
  var VERSIE = '1.2.3';

  // Diagnose (v1.1.8): in de console (F12, filter "DS Logboek userscript") is te
  // zien óf het script draait en waarom de knop er (niet) staat. Alleen bij een
  // verandering van toestand, zodat de console niet volloopt.
  console.info('[DS Logboek userscript] v' + VERSIE + ' actief op ' + location.pathname);
  var vorigeToestand = '';
  function toestand(t) { if (t === vorigeToestand) return; vorigeToestand = t; console.info('[DS Logboek userscript] ' + t); }


  // ── Code laden (stale-while-revalidate) ──────────────────────
  var verseCode = null;
  function leesCache() { try { return localStorage.getItem(CACHE); } catch (e) { return null; } }
  fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (code) {
      verseCode = code;
      if (code && code !== leesCache()) {
        try { localStorage.setItem(CACHE, code); }
        catch (e) { try { localStorage.removeItem(CACHE); localStorage.setItem(CACHE, code); } catch (e2) {} }
      }
    })
    .catch(function (e) { console.error('[DS Logboek userscript] ophalen mislukt:', e); });

  function startLogboek() {
    var code = leesCache() || verseCode;
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
      if (!el || el.closest('#' + KNOP_ID + ', #' + BALK_ID + ', #ds-combi-wrapper')) continue;
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
      if (el.children.length > 1 || el.id === KNOP_ID || el.textContent.trim() !== naam) continue;
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

  function loepPunten() {
    var tab = lijstTab('Orders') || lijstTab('Problemen') || lijstTab('Rit overzicht');
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
      if (!el || el.closest('#' + KNOP_ID + ', #ds-combi-wrapper')) continue;
      var box = null;
      for (var e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
        var r = e.getBoundingClientRect();
        if (!(r.left <= 20 && r.width <= 80 && r.height <= 80)) break;
        if (r.width >= 14 && r.height >= 14 && zichtbareTekst(e) < 15) box = e;
      }
      if (box) return box;
    }
    meldLoepOnderzoek(punten);
    return null;
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

  // ── Knop: een tweede knop onder het vergrootglas ──────────────
  // Zelfde maat, rand, achtergrond en icoonkleur als het vergrootglas (computed
  // style, geen klassen: DireXtion's eigen klikafhandeling grijpt er dan niet op
  // in), met een klembord als lijnicoon. Geen eigen accent meer (v1.2.3): net als
  // de knoppen in de linkerbalk van de planningsmodule krijgt hij alleen een stip
  // als er iets aan de hand is — oranje zolang er een weggeschoven logboek wacht.
  // Open: hij vormt een tab met het paneel, zonder rand ertussen.
  var GAT = 6;                    // ruimte tussen vergrootglas en onze knop
  var IN_MS = 260, UIT_MS = 200;  // zelfde tempo als het inschuiven in ds-logboek.js
  var loep = null;
  var verborgen = false;          // logboek bestaat maar is weggeschoven
  var schuifToken = 0;

  function maakKnop(lp) {
    var cs = getComputedStyle(lp);
    var ic = lp.querySelector('svg, img, i, [class*="icon"]');
    var icH = ic ? Math.round(ic.getBoundingClientRect().height) : 0;
    if (!(icH >= 10 && icH <= 32)) icH = 18;
    var k = document.createElement('div');
    k.id = KNOP_ID;
    k.title = 'DS Logboek';
    k.setAttribute('role', 'button');
    k.innerHTML = '<svg viewBox="0 0 24 24" width="' + icH + '" height="' + icH + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="8.5" y="2.5" width="7" height="4" rx="1"/>' +
      '<path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/></svg>';
    var st = k.style;
    st.position = 'fixed';
    st.zIndex = '1000';           // boven DireXtion, onder het logboek (999999)
    st.boxSizing = 'border-box';
    st.display = 'flex';
    st.alignItems = 'center';
    st.justifyContent = 'center';
    st.color = getComputedStyle(ic || lp).color || '#333333';
    st.backgroundColor = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ? '#fff' : cs.backgroundColor;
    ['Top', 'Right', 'Bottom', 'Left'].forEach(function (z) {
      st['border' + z] = cs['border' + z + 'Width'] + ' ' + cs['border' + z + 'Style'] + ' ' + cs['border' + z + 'Color'];
    });
    st.borderRadius = cs.borderRadius;
    st.cursor = 'pointer';
    // Stijl op de linkerrand bewaren: open wordt hij tijdelijk een tab van het paneel.
    k._rail = { borderTop: st.borderTop, borderRight: st.borderRight, borderBottom: st.borderBottom,
      borderLeft: st.borderLeft, borderRadius: st.borderRadius, backgroundColor: st.backgroundColor };
    var stip = document.createElement('span');
    stip.className = 'ds-logboek-stip';
    stip.style.cssText = 'position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-radius:50%;' +
      'background:' + ORANJE + ';box-shadow:0 0 0 1.5px #fff;display:none;';
    k.appendChild(stip);
    k.addEventListener('mouseenter', function () { k.style.backgroundImage = 'linear-gradient(rgba(0,0,0,0.05),rgba(0,0,0,0.05))'; });
    k.addEventListener('mouseleave', function () { k.style.backgroundImage = 'none'; });
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'dxclick'].forEach(function (ev) {
      k.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    k.addEventListener('click', klik);
    return k;
  }

  function wrapperNu() {
    var a = window.__dsLogboek;
    return a && a.wrapper && a.wrapper.isConnected ? a.wrapper : null;
  }

  // Dicht: onder het vergrootglas. Open: tegen de rechterbovenhoek van het
  // paneel, zoals het vergrootglas bij een open filterpaneel. Tijdens het
  // schuiven rijdt hij mee met de rand en stopt hij bij de linkerrand.
  function plaatsKnop(k) {
    if (!loep || !loep.isConnected) return;
    var rl = loep.getBoundingClientRect();
    var left = rl.left, top = rl.bottom + GAT, vast = false, rand = '';
    var w = wrapperNu();
    if (w && w.style.visibility !== 'hidden') {
      var rw = w.getBoundingClientRect();
      if (rw.right - 1 > left) {
        left = rw.right - 1; top = rw.top; vast = true;
        var cw = getComputedStyle(w);
        rand = cw.borderRightWidth + ' solid ' + cw.borderRightColor;
      }
    }
    // Vast aan het paneel: geen linkerrand, randkleur van het paneel, en boven het
    // paneel (z-index) zodat hij diens rechterrand over zijn hoogte afdekt — een tab.
    var rs = k._rail || {};
    k.style.borderTop = vast ? rand : rs.borderTop;
    k.style.borderRight = vast ? rand : rs.borderRight;
    k.style.borderBottom = vast ? rand : rs.borderBottom;
    k.style.borderLeft = vast ? '0' : rs.borderLeft;
    k.style.borderRadius = vast ? '0' : rs.borderRadius;
    k.style.backgroundColor = vast ? '#fff' : rs.backgroundColor;
    k.style.zIndex = vast ? '1000000' : '1000';
    var stip = k.querySelector('.ds-logboek-stip');
    if (stip) stip.style.display = (w && verborgen) ? 'block' : 'none';
    k.title = (w && verborgen) ? 'DS Logboek — gesprek staat klaar' : 'DS Logboek';
    k.style.left = Math.round(left) + 'px';
    k.style.top = Math.round(top) + 'px';
    k.style.width = Math.round(rl.width) + 'px';
    k.style.height = Math.round(rl.height) + 'px';
  }

  // De knop een tijdje elk beeld volgen (tijdens het schuiven).
  function volg(ms) {
    var eind = performance.now() + ms;
    (function stap() {
      var k = document.getElementById(KNOP_ID);
      if (k) plaatsKnop(k);
      if (performance.now() < eind) requestAnimationFrame(stap);
    })();
    setTimeout(function () { var k = document.getElementById(KNOP_ID); if (k) plaatsKnop(k); }, ms + 20);
  }

  function zonderBeweging() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // Wegschuiven, niet sluiten: het gesprek blijft staan (zoals de ingevulde
  // velden van het filterpaneel). Alleen × in het logboek beëindigt het.
  function verberg(w) {
    var t = ++schuifToken;
    verborgen = true;
    var r = w.getBoundingClientRect();
    w.style.transition = zonderBeweging() ? 'none' : 'transform ' + UIT_MS + 'ms cubic-bezier(0.4, 0, 1, 1)';
    w.style.transform = 'translateX(' + -(Math.round(r.right) + 12) + 'px)';
    w.style.pointerEvents = 'none';
    setTimeout(function () { if (t === schuifToken) w.style.visibility = 'hidden'; }, UIT_MS + 20);
    volg(UIT_MS + 60);
  }

  function toon(w) {
    ++schuifToken;
    verborgen = false;
    w.style.visibility = '';
    w.style.pointerEvents = '';
    w.style.transition = zonderBeweging() ? 'none' : 'transform ' + IN_MS + 'ms cubic-bezier(0.2, 0, 0, 1)';
    w.style.transform = 'translateX(0)';
    volg(IN_MS + 60);
  }

  function klik() {
    var w = wrapperNu();
    if (!w) { startLogboek(); return; }
    if (verborgen) toon(w); else verberg(w);
  }

  function zorgVoorKnop() {
    var k = document.getElementById(KNOP_ID);
    var w = wrapperNu();
    if (!w) verborgen = false;
    // Zichtbaar bij een open order, of als er een (weggeschoven) logboek is.
    if (!w && !orderTab()) {
      toestand('geen knop: geen open order gevonden (visit-tabje met cijfers rechtsboven)');
      if (k) k.remove();
      return;
    }
    var gevonden = vindLoep();
    if (gevonden) loep = gevonden;
    // Ligt ons eigen paneel er (bij een laag scherm) overheen, dan het oude houden.
    else if (!(loep && loep.isConnected && w && !verborgen)) loep = null;
    if (!loep) {
      toestand('geen knop: vergrootglas linksboven niet gevonden (of het filterpaneel staat open)');
      if (k) k.style.display = 'none';
      return;
    }
    if (!k) { k = maakKnop(loep); document.body.appendChild(k); }
    k.style.display = 'flex';
    plaatsKnop(k);
    toestand('knop staat er (order ' + huidigeOrder() + ')');
  }

  // ── Plek van het logboek ──────────────────────────────────────
  // Tegen de linkerrand, met de bovenkant gelijk aan onze knop (het vergrootglas
  // blijft erboven bereikbaar). Past hij daar niet in de hoogte, dan schuift hij
  // omhoog. ds-logboek.js schuift hem zelf in (DS_LOGBOEK_SCHUIVEN, v1.47.0).
  window.DS_LOGBOEK_SCHUIVEN = true;
  // Op Basic standaard het DireXtion-uiterlijk (logboek v1.48.0). Een eigen
  // keuze wint: localStorage ds_logboek_thema = 'standaard' geeft het oude terug.
  window.DS_LOGBOEK_THEMA = 'dirextion';

  function plaatsPaneel(w) {
    if (!loep || !loep.isConnected) loep = vindLoep();
    if (!loep) return;
    var top = Math.round(loep.getBoundingClientRect().bottom + GAT);
    var h = w.getBoundingClientRect().height;
    if (top + h > window.innerHeight - 8) top = Math.max(8, Math.round(window.innerHeight - 8 - h));
    w.style.left = '0px';
    w.style.bottom = 'auto';
    w.style.top = top + 'px';
    w.style.borderLeftWidth = '0';
    w.style.borderTopLeftRadius = '0';
    w.style.borderBottomLeftRadius = '0';
  }

  window.DS_LOGBOEK_PLEK = function (w) {
    // Ook als het logboek met de bookmarklet of de launcher gestart is.
    openOrder = huidigeOrder();
    genegeerd = '';
    verborgen = false;
    plaatsPaneel(w);
    // Hoogte wisselt met de S/M/L-knop in het logboek: opnieuw passen.
    if (window.ResizeObserver) new ResizeObserver(function () {
      if (!w.isConnected) return;
      plaatsPaneel(w);
      var k = document.getElementById(KNOP_ID);
      if (k) plaatsKnop(k);
    }).observe(w);
    volg(IN_MS + 450);   // inschuiven in ds-logboek.js (met vangnet tot 410 ms)
  };

  window.addEventListener('resize', function () { var w = wrapperNu(); if (w) plaatsPaneel(w); zorgVoorKnop(); });
  // Klik op het vergrootglas terwijl het logboek open is: logboek weg, zodat het
  // filterpaneel er niet onder valt. Eén lade tegelijk.
  document.addEventListener('click', function (e) {
    var w = wrapperNu();
    if (w && !verborgen && loep && loep.contains(e.target)) verberg(w);
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
    if (timer) return;
    timer = setTimeout(function () { timer = null; zorgVoorKnop(); controleerWissel(); }, 250);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  zorgVoorKnop();
})();
