// ==UserScript==
// @name         DS Tools — DS Logboek in DireXtion Basic
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.1.4
// @description  Knop "📋 DS Logboek" rechts van de tabs linksboven; het logboek waarschuwt bij het wisselen van order.
// @match        https://coolblue.dirextion.nl/Basic/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-basic.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-basic.user.js
// ==/UserScript==

/* Dunne starter: ds-logboek.js wordt met stale-while-revalidate geladen onder
   dezelfde cache-sleutel als de bookmarklet en de launcher (ds_app_prod_cache).

   1. Knop. Rechts van de tabs Orders | Problemen | Rit overzicht (linksboven)
      komt een tab-achtige knop "📋 DS Logboek" (v1.1.0; v1.0.0 stond naast het
      visit-tabje rechts). Stijl gekopieerd van een niet-geselecteerde tab
      (computed style, geen klassen: zo grijpt DireXtion's eigen
      tab-klikafhandeling er niet op in), met een oranje onderlijn als teken
      dat het een add-on is. Alleen zichtbaar als er een order open staat,
      herkend aan het visit-tabje (cijfers) bovenaan het orderpaneel.
   2. Plek. Het logboek staat linksonder, zijn eigen standaardplek: op Basic
      het minst in de weg (v1.1.2).
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

  function zichtbaar(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }

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
  // Een blad-element met alleen cijfers, bovenin de rechterhelft van het scherm.
  function orderTab() {
    var els = document.querySelectorAll('a, li, span, div');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 1 || el.id === KNOP_ID) continue;
      var t = el.textContent.trim();
      if (!/^\d{6,12}$/.test(t)) continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.top > 320 || r.left < window.innerWidth * 0.4) continue;
      // Het hele tabje (met icoon), niet alleen de tekst.
      return el.closest('[role="tab"], .dx-tab, li') || el.parentElement;
    }
    return null;
  }

  // Ordersleutel: het nummer in het tabje, anders het pakbonnummer.
  function huidigeOrder() {
    var tab = orderTab();
    if (tab) return tab.textContent.trim();
    var fields = document.querySelectorAll('.details-field');
    for (var i = 0; i < fields.length; i++) {
      var lbl = fields[i].querySelector('.details-field-label p');
      var val = fields[i].querySelector('.details-field-value p');
      if (lbl && val && /^(Pakbonnummer|Order nr\. verlader)$/.test(lbl.textContent.trim())) return val.textContent.trim();
    }
    return '';
  }

  // ── Knop ──────────────────────────────────────────────────────
  // Ruimte in een echte tab meten in plaats van de padding te kopiëren: die
  // zit bij DireXtion op een element binnen de tab (v1.1.2 was te krap).
  // links = rand → icoon, gat = icoon → tekst, rechts = tekst → rand.
  function maatVan(tab) {
    var m = { links: 14, gat: 8, rechts: 14, icoon: 18 };
    try {
      var rt = tab.getBoundingClientRect();
      var ic = tab.querySelector('svg, img, i, [class*="icon"]');
      var tekst = null, walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { if (walker.currentNode.textContent.trim()) { tekst = walker.currentNode; break; } }
      if (!tekst) return m;
      var range = document.createRange(); range.selectNodeContents(tekst);
      var rx = range.getBoundingClientRect();
      if (rx.width === 0) return m;
      m.rechts = Math.round(rt.right - rx.right);
      if (ic && ic.getBoundingClientRect().width > 0) {
        var ri = ic.getBoundingClientRect();
        m.links = Math.round(ri.left - rt.left);
        m.gat = Math.round(rx.left - ri.right);
        m.icoon = Math.round(ri.height * 0.85);   // emoji oogt groter dan een lijnicoon van dezelfde hoogte
      } else {
        m.links = Math.round(rx.left - rt.left);
      }
      ['links', 'gat', 'rechts'].forEach(function (k) { if (!(m[k] >= 4 && m[k] <= 40)) m[k] = k === 'gat' ? 8 : 14; });
      if (!(m.icoon >= 12 && m.icoon <= 28)) m.icoon = 18;
    } catch (e) {}
    return m;
  }

  function maakKnop(tab) {
    var cs = getComputedStyle(tab);
    var k = document.createElement('div');
    k.id = KNOP_ID;
    k.title = 'DS Logboek openen voor deze order';
    var maat = maatVan(tab);
    var icoon = document.createElement('span');
    icoon.textContent = '📋';
    icoon.style.cssText = 'font-size:' + maat.icoon + 'px;line-height:1;margin-right:' + maat.gat + 'px;';
    k.appendChild(icoon);
    k.appendChild(document.createTextNode('DS Logboek'));
    var st = k.style;
    st.display = 'inline-flex';
    st.alignItems = 'center';
    st.boxSizing = 'border-box';
    st.height = tab.getBoundingClientRect().height + 'px';
    st.padding = '0 ' + maat.rechts + 'px 0 ' + maat.links + 'px';
    st.margin = cs.margin;
    st.font = cs.font;
    st.color = cs.color;
    st.backgroundColor = cs.backgroundColor;
    st.borderTop = cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor;
    st.borderLeft = cs.borderLeftWidth + ' ' + cs.borderLeftStyle + ' ' + cs.borderLeftColor;
    st.borderRight = cs.borderRightWidth + ' ' + cs.borderRightStyle + ' ' + cs.borderRightColor;
    st.borderBottom = '2px solid ' + ORANJE;
    st.borderRadius = cs.borderRadius;
    st.cursor = 'pointer';
    st.whiteSpace = 'nowrap';
    st.verticalAlign = 'top';
    k.addEventListener('mouseenter', function () { k.style.backgroundImage = 'linear-gradient(rgba(0,0,0,0.04),rgba(0,0,0,0.04))'; });
    k.addEventListener('mouseleave', function () { k.style.backgroundImage = 'none'; });
    // Klik niet laten doorbubbelen naar DireXtion's eigen tab-afhandeling.
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'dxclick'].forEach(function (ev) {
      k.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    k.addEventListener('click', function () {
      var open = window.__dsLogboek && window.__dsLogboek.wrapper && window.__dsLogboek.wrapper.isConnected;
      if (open) { knipper(window.__dsLogboek.wrapper); return; }
      startLogboek();
    });
    return k;
  }

  function knipper(w) {
    if (!w.animate) return;
    w.animate([{ boxShadow: '0 0 0 4px ' + ORANJE }, { boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }], { duration: 700 });
  }

  // De tabs linksboven (bij Bas: Orders | Problemen | Rit overzicht). Niet
  // iedereen heeft dezelfde tabs, dus de knop komt direct rechts van de
  // láátste tab in die rij, wat dat ook is. De rij wordt gevonden via één
  // bekende tab; de stijl komt van een niet-geselecteerde tab uit dezelfde rij.
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
  function geselecteerd(tab) {
    return /selected|active/i.test(tab.className) || tab.getAttribute('aria-selected') === 'true';
  }

  // Een "echte" tab in dezelfde rij: zelfde soort element, zelfde hoogte, met tekst.
  // De rij bevat meer dan alleen tabs (v1.1.1 zette de knop daardoor helemaal rechts).
  function tabsInRij(bekend) {
    var rb = bekend.getBoundingClientRect();
    return Array.prototype.filter.call(bekend.parentNode.children, function (t) {
      if (t.id === KNOP_ID || t.tagName !== bekend.tagName || !t.textContent.trim()) return false;
      var r = t.getBoundingClientRect();
      return r.width > 0 && r.width < 400 && Math.abs(r.height - rb.height) < 4 && Math.abs(r.top - rb.top) < 4;
    });
  }

  // De knop zweeft (position:fixed) direct rechts van de meest rechtse tab, in
  // plaats van in DireXtion's eigen rij te staan: daar bepaalt hun opmaak waar
  // hij landt. Elke controle (na DOM-wijziging en resize) zet hem opnieuw goed.
  function zorgVoorKnop() {
    var k = document.getElementById(KNOP_ID);
    // Alleen als er een order (visit) open staat: dan staat het visit-tabje rechts.
    var bekend = orderTab() ? (lijstTab('Orders') || lijstTab('Problemen') || lijstTab('Rit overzicht')) : null;
    if (!bekend) { if (k) k.remove(); return; }
    var tabs = tabsInRij(bekend);
    if (!tabs.length) tabs = [bekend];
    var laatste = tabs.reduce(function (a, t) { return t.getBoundingClientRect().right > a.getBoundingClientRect().right ? t : a; });
    if (!k) {
      var voorbeeld = tabs.filter(function (t) { return !geselecteerd(t); })[0] || laatste;
      k = maakKnop(voorbeeld);
      k.style.position = 'fixed';
      k.style.margin = '0';
      k.style.zIndex = '1000';   // boven DireXtion, onder het logboek (999999)
      document.body.appendChild(k);
    }
    var r = laatste.getBoundingClientRect();
    var gat = parseFloat(getComputedStyle(laatste).marginRight) || 2;
    k.style.left = Math.round(r.right + gat) + 'px';
    k.style.top = Math.round(r.top) + 'px';
    k.style.height = Math.round(r.height) + 'px';
    // Ligt er iets over de tabrij heen (filterpopup van het vergrootglas,
    // een dialoog), dan de knop verbergen: hij zweeft anders bovenop (v1.1.4).
    k.style.display = 'none';
    var kr = { l: r.right + gat, t: r.top, h: r.height };
    var bedekt = [6, 40].some(function (dx) { return bedektOp(laatste, kr.l + dx, kr.t + kr.h / 2); });
    k.style.display = bedekt ? 'none' : 'inline-flex';
  }
  // Wat bovenaan ligt op (x, y) hoort bij de tabrij als het een voorouder van de
  // tab is (lege ruimte naast de tabs) of binnen de rij zelf valt. Al het andere
  // (een popup, overlay of dialoog) bedekt de plek.
  function bedektOp(tab, x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return false;
    return !(el.contains(tab) || tab.parentNode.contains(el));
  }
  window.addEventListener('resize', zorgVoorKnop);
  // Een popup openen of sluiten wijzigt vaak alleen een stijl; de observer kijkt
  // niet naar attributen, dus na elke klik en toets nog even opnieuw kijken.
  function straks() { setTimeout(zorgVoorKnop, 300); }
  document.addEventListener('click', straks, true);
  document.addEventListener('keyup', straks, true);

  // ── Plek van het logboek ──────────────────────────────────────
  // Linksonder, waar ds-logboek.js hem zelf zet: daar zit hij op Basic het
  // minst in de weg (v1.1.2; v1.0.0–v1.1.1 legden hem bovenaan over de
  // orderlijst). De hook wordt alleen nog gebruikt om te onthouden voor welke
  // order het logboek geopend is.
  window.DS_LOGBOEK_PLEK = function () {
    // Ook als het logboek met de bookmarklet of de launcher gestart is.
    openOrder = huidigeOrder();
    genegeerd = '';
  };

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
