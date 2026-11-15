// ==UserScript==
// @name         DS Tools — DS Logboek in DireXtion Basic
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.1.0
// @description  Knop "📋 DS Logboek" rechts van de tabs Orders | Problemen | Rit overzicht; het logboek komt over de orderlijst en waarschuwt bij het wisselen van order.
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
   2. Plek. Het logboek komt bovenaan over de orderlijst links: die heb je
      tijdens het gesprek niet meer nodig, het midden- en rechterpaneel
      (adres, telefoon, artikelen, taken) blijven vrij. Via de hook
      DS_LOGBOEK_PLEK in ds-logboek.js (v1.44.0).
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
  var MARGE = 8;

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
  function maakKnop(tab) {
    var cs = getComputedStyle(tab);
    var k = document.createElement('div');
    k.id = KNOP_ID;
    k.textContent = '📋 DS Logboek';
    k.title = 'DS Logboek openen voor deze order';
    var st = k.style;
    st.display = 'inline-flex';
    st.alignItems = 'center';
    st.boxSizing = 'border-box';
    st.height = tab.getBoundingClientRect().height + 'px';
    st.padding = cs.padding;
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

  // De tabs linksboven: Orders | Problemen | Rit overzicht. De knop komt
  // rechts van "Rit overzicht" en neemt de stijl over van een niet-geselecteerde tab.
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

  function zorgVoorKnop() {
    var bestaand = document.getElementById(KNOP_ID);
    // Alleen als er een order (visit) open staat: dan staat het visit-tabje rechts.
    var anker = orderTab() ? lijstTab('Rit overzicht') : null;
    if (!anker) { if (bestaand) bestaand.remove(); return; }
    if (bestaand && bestaand.previousElementSibling === anker) return;
    if (bestaand) bestaand.remove();
    var voorbeeld = [lijstTab('Problemen'), anker, lijstTab('Orders')].filter(function (t) { return t && !geselecteerd(t); })[0] || anker;
    anker.parentNode.insertBefore(maakKnop(voorbeeld), anker.nextSibling);
  }

  // ── Plek: bovenaan over de orderlijst ────────────────────────
  function orderlijstPaneel() {
    var els = document.querySelectorAll('a, li, span, div');
    for (var i = 0; i < els.length; i++) {
      if (els[i].children.length > 1 || els[i].textContent.trim() !== 'Orders') continue;
      var r = els[i].getBoundingClientRect();
      if (r.width === 0 || r.left > window.innerWidth * 0.3 || r.top > 320) continue;
      // Omhoog tot het paneel: breed genoeg, maar nog niet de hele pagina.
      var el = els[i], beste = null;
      while (el && el !== document.body) {
        var re = el.getBoundingClientRect();
        if (re.width > window.innerWidth * 0.6) break;
        if (re.height > window.innerHeight * 0.5) beste = el;
        el = el.parentElement;
      }
      if (beste) return beste;
    }
    return null;
  }

  var huidig = null;
  function plaats() {
    if (!huidig || !huidig.isConnected) return;
    var p = orderlijstPaneel();
    if (!p) return;   // niet gevonden: het logboek blijft linksonder, zoals altijd
    var r = p.getBoundingClientRect();
    var hoogte = huidig.offsetHeight || 620;
    var top = Math.max(MARGE, r.top + MARGE);
    if (top + hoogte > window.innerHeight - MARGE) top = Math.max(MARGE, window.innerHeight - MARGE - hoogte);
    huidig.style.top = top + 'px';
    huidig.style.bottom = 'auto';
    huidig.style.left = (r.left + MARGE) + 'px';
    huidig.style.right = 'auto';
  }
  window.DS_LOGBOEK_PLEK = function (wrapper) {
    huidig = wrapper;
    // Ook als het logboek met de bookmarklet of de launcher gestart is.
    openOrder = huidigeOrder();
    genegeerd = '';
    if (window.ResizeObserver) new ResizeObserver(plaats).observe(wrapper);
    plaats();
  };
  window.addEventListener('resize', plaats);

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
