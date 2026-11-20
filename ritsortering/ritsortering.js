/* ─────────────────────────────────────────────────────────────
   RITSORTERING — ritten in de Ritmonitor op depot, netwerk en nummer
   Draait op coolblue.dirextion.nl/ModuleTourMonitor.

   WAAROM
   De Ritmonitor sorteert standaard op referenceId (het route_id), en dat
   zegt niets: 2M-NLTI-01, 1M-NLTI-04, BI-NLTI-02 door elkaar. Gewenst:
   1M-01, 1M-02 … 1X … 2M … BI, binnen één depot.

   HOE (vastgesteld met tourtool/probe-sortering.js, 20-11-2026)
   - Viewmodel: ko.contextFor(<rij in table.tourlist>).$root. `tours` is
     een observableArray met álle ritten van de gekozen depots (Tilburg: 31,
     geen paginering); de lijst wordt daaruit getekend.
   - De tool sorteert `tours` zelf, in de pagina, en doet dat opnieuw
     zodra DireXtion de lijst vervangt (subscribe). De server en het
     keuzeveld "Sorteren op" worden niet aangeraakt: daarvan was de
     optielijst leeg en `sortProperty` zetten deed niets zichtbaars.
   - Volgorde: depotcode (NLTI…), netwerk 1M → 1X → 2M → BI → overige
     (RP …), nummer (numeriek), rest van de naam. Namen zonder dat patroon
     onderaan, op alfabet.
   - Kleur: een lichte tint per netwerk achter de ritnaam. De op-tijd-kleur
     van DireXtion zit alleen in de balk erboven (tr.progress,
     `statusColor`), dus die blijft vrij. Kleuren bewust buiten rood,
     oranje en groen.

   AAN/UIT
   Nog een keer starten zet de tool uit en zet de volgorde van DireXtion
   terug (de laatst door de pagina aangeleverde volgorde).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var RITSORTERING_VERSION = '1.0.1';

  var STYLE_ID = 'ritsortering-style';
  var NAAM = 'ritsortering-naam';
  var NETWERKEN = ['1M', '1X', '2M', 'BI'];
  // Licht vlak + iets donkerdere rand per netwerk; geen rood/oranje/groen.
  var TINT = {
    '1M': ['#cfe0f7', '#7fa6db'],
    '1X': ['#e0d4f5', '#a68bd6'],
    '2M': ['#c9ebe8', '#6fbcb4'],
    'BI': ['#f3d3e4', '#cf86b0']
  };

  // ── Aan/uit ───────────────────────────────────────────────────────────────
  if (window.__ritSortering && window.__ritSortering.stop) {
    window.__ritSortering.stop();
    melding('Ritsortering uit — volgorde van DireXtion terug');
    return;
  }
  if (!/ModuleTourMonitor/i.test(location.pathname) || !window.ko) {
    alert('Ritsortering werkt alleen in de Ritmonitor (ModuleTourMonitor).');
    return;
  }

  function uw(v) { try { return window.ko.unwrap(v); } catch (e) { return v; } }
  function log() { var a = [].slice.call(arguments); a.unshift('[Ritsortering]'); console.log.apply(console, a); }

  // ── Sorteersleutel ────────────────────────────────────────────────────────
  // "2M-NLTI-07", "2M-NLTI-07-7", "2M-NLTI-03 (VEN)", "RP-NLTI-01 Steffan"
  var PATROON = /^\s*([A-Z0-9]{2})-([A-Z]{4})-(\d+)(.*)$/i;
  function ontleed(naam) {
    var m = String(naam || '').match(PATROON);
    if (!m) return null;
    var net = m[1].toUpperCase();
    return { net: net, depot: m[2].toUpperCase(), nr: parseInt(m[3], 10), rest: m[4].trim() };
  }
  function netIndex(net) { var i = NETWERKEN.indexOf(net); return i < 0 ? NETWERKEN.length : i; }
  function vergelijk(a, b) {
    var na = String(uw(a.name) || ''), nb = String(uw(b.name) || '');
    var x = ontleed(na), y = ontleed(nb);
    if (!x || !y) return x ? -1 : y ? 1 : na.localeCompare(nb);
    if (x.depot !== y.depot) return x.depot < y.depot ? -1 : 1;
    var d = netIndex(x.net) - netIndex(y.net);
    if (d) return d;
    if (x.net !== y.net) return x.net < y.net ? -1 : 1;   // overige netwerken onderling
    if (x.nr !== y.nr) return x.nr - y.nr;
    return x.rest.localeCompare(y.rest);
  }
  function gesorteerd(arr) {
    for (var i = 1; i < arr.length; i++) if (vergelijk(arr[i - 1], arr[i]) > 0) return false;
    return true;
  }

  // ── Viewmodel ─────────────────────────────────────────────────────────────
  function koRoot() {
    var rij = document.querySelector('table.tourlist tr');
    if (!rij) return null;
    try { return window.ko.contextFor(rij).$root; } catch (e) { return null; }
  }

  var root = null, abo = null, bezig = false;
  // Laatste volgorde zoals DireXtion hem aanleverde (ids), om bij uitzetten terug te zetten.
  var paginaVolgorde = [];

  function sorteer() {
    if (!root || bezig) return;
    var arr = root.tours.peek ? root.tours.peek() : uw(root.tours);
    if (!arr || arr.length < 2 || gesorteerd(arr)) return;
    paginaVolgorde = arr.map(function (t) { return String(uw(t.id)); });
    bezig = true;
    try { root.tours.sort(vergelijk); }
    catch (e) { console.error('[Ritsortering] sorteren mislukt:', e); }
    bezig = false;
  }

  // Koppelen aan het viewmodel; opnieuw als Durandal een nieuw viewmodel maakt.
  function koppel() {
    var r = koRoot();
    if (!r || r === root) return;
    if (!r.tours || !window.ko.isObservable(r.tours) || typeof r.tours.sort !== 'function') {
      log('geen observableArray `tours` op het viewmodel — niets gesorteerd');
      return;
    }
    if (abo) { try { abo.dispose(); } catch (e) {} }
    root = r;
    // Microtask: DireXtion maakt zijn eigen update eerst af, sorteren gebeurt nog vóór het tekenen.
    abo = root.tours.subscribe(function () {
      if (bezig) return;
      Promise.resolve().then(sorteer);
    });
    sorteer();
    log('v' + RITSORTERING_VERSION + ' actief, ' + (uw(root.tours) || []).length + ' ritten');
    // Controle: tekent de lijst onze volgorde? (visibleTours zou zelf kunnen sorteren)
    var zicht = uw(root.visibleTours);
    if (zicht && zicht.length > 1 && !gesorteerd(zicht)) {
      log('let op: visibleTours volgt de sortering niet —', zicht.slice(0, 8).map(function (t) { return uw(t.name); }));
    }
  }

  function zetTerug() {
    if (!root || !paginaVolgorde.length) return;
    var pos = {};
    paginaVolgorde.forEach(function (id, i) { pos[id] = i; });
    var eind = paginaVolgorde.length;
    bezig = true;
    try {
      root.tours.sort(function (a, b) {
        var pa = pos[String(uw(a.id))], pb = pos[String(uw(b.id))];
        return (pa == null ? eind : pa) - (pb == null ? eind : pb);
      });
    } catch (e) {}
    bezig = false;
  }

  // ── Kleur achter de ritnaam ───────────────────────────────────────────────
  // Het element met de ritnaam: eerst de binding `text: name`, anders het
  // binnenste element waarvan de tekst precies de naam is.
  function naamElement(tr, naam) {
    var b = tr.querySelectorAll('[data-bind]');
    for (var i = 0; i < b.length; i++) {
      if (/(^|[\s,{])text\s*:\s*name\s*($|[,}])/.test(b[i].getAttribute('data-bind')) &&
          b[i].textContent.trim() === naam) return b[i];
    }
    var alle = tr.querySelectorAll('*'), beste = null;
    for (var j = 0; j < alle.length; j++) {
      if (alle[j].textContent.trim() === naam) beste = alle[j];   // laatste = binnenste
    }
    return beste;
  }

  var naamGemist = false;
  function kleur() {
    var t = document.querySelector('table.tourlist');
    if (!t) return;
    var rijen = t.querySelectorAll('tr.icons');
    for (var i = 0; i < rijen.length; i++) {
      var d = null;
      try { d = window.ko.dataFor(rijen[i]); } catch (e) {}
      if (!d || d.name == null) continue;
      var naam = String(uw(d.name) || '').trim();
      var p = ontleed(naam);
      var net = p && TINT[p.net] ? p.net : '';
      var el = naamElement(rijen[i], naam);
      if (!el) {
        if (!naamGemist) { naamGemist = true; log('ritnaam niet gevonden in tr.icons voor', naam, rijen[i].outerHTML.slice(0, 800)); }
        continue;
      }
      if (el.getAttribute('data-ritnet') === net) continue;
      el.classList.toggle(NAAM, !!net);
      if (net) el.setAttribute('data-ritnet', net); else el.removeAttribute('data-ritnet');
      if (net) el.title = el.title || ('Netwerk ' + net);
    }
  }

  function wisKleur() {
    var e = document.querySelectorAll('.' + NAAM);
    for (var i = 0; i < e.length; i++) { e[i].classList.remove(NAAM); e[i].removeAttribute('data-ritnet'); }
  }

  function zetStijl() {
    if (document.getElementById(STYLE_ID)) return;
    var css = '.' + NAAM + '{border-radius:3px;padding:0 4px;box-decoration-break:clone;-webkit-box-decoration-break:clone;}';
    Object.keys(TINT).forEach(function (n) {
      css += '.' + NAAM + '[data-ritnet="' + n + '"]{background:' + TINT[n][0] + ';box-shadow:inset 0 0 0 1px ' + TINT[n][1] + ';}';
    });
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── Bijhouden ─────────────────────────────────────────────────────────────
  // De lijst wordt door Knockout/SignalR steeds opnieuw getekend; na elke
  // wijziging in (of het verschijnen van) table.tourlist: koppelen en kleuren.
  var timer = null, obs = null;
  function gepland() {
    if (timer) return;
    // sorteer(): ook een gewijzigde naam (zonder nieuwe lijst) komt zo op zijn plek.
    timer = setTimeout(function () { timer = null; koppel(); sorteer(); kleur(); }, 200);
  }
  function relevant(m) {
    var el = m.target.nodeType === 1 ? m.target : m.target.parentNode;
    if (el && el.closest && el.closest('table.tourlist')) return true;
    for (var i = 0; i < m.addedNodes.length; i++) {
      var n = m.addedNodes[i];
      if (n.nodeType === 1 && (n.matches('table.tourlist') || n.querySelector('table.tourlist'))) return true;
    }
    return false;
  }

  function stop() {
    if (obs) obs.disconnect();
    if (timer) clearTimeout(timer);
    if (abo) { try { abo.dispose(); } catch (e) {} }
    zetTerug();
    wisKleur();
    var s = document.getElementById(STYLE_ID); if (s) s.remove();
    window.__ritSortering = null;
  }

  function melding(tekst) {
    var m = document.createElement('div');
    m.textContent = tekst;
    m.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:100000;padding:5px 10px;border-radius:4px;' +
      'background:#333;color:#fff;font:12px "Segoe UI",sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);';
    document.body.appendChild(m);
    setTimeout(function () { m.remove(); }, 2500);
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  window.__ritSortering = { stop: stop, sorteer: sorteer, versie: RITSORTERING_VERSION };
  zetStijl();
  koppel();
  kleur();
  obs = new MutationObserver(function (l) {
    for (var i = 0; i < l.length; i++) if (relevant(l[i])) { gepland(); return; }
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  // Het userscript start stil; via de launcher een korte bevestiging.
  if (!window.__ritSorteringStil) melding('Ritsortering aan — nog een keer klikken zet hem uit');
})();
