/* ─────────────────────────────────────────────────────────────
   EV-RITTEN — elektrische ritten herkenbaar in de Ritmonitor
   Draait op coolblue.dirextion.nl/ModuleTourMonitor.
   Staat los van het DS Logboek; de Extra rijtijd-tool leest dezelfde
   data (KEY_DATA) om EV-ritten in zijn kandidatenlijst te markeren.

   WAAROM
   De Ritmonitor zegt niet welke bus een rit rijdt, laat staan of die
   elektrisch is. Fleetio weet dat wel, en de sheet "Unplanneds tool
   Delivery Support" koppelt elke route van vandaag aan een kenteken.

   HOE
   - Data via JSONP uit gas-laadvermogen.js (zelfde endpoint als de
     Laadvermogen-tool): `ev` = route-ids met een elektrische bus,
     `onbekend` = route-ids waarvan de brandstof niet te bepalen is.
   - Koppelen op `referenceId` uit het Knockout-viewmodel van elke rij in
     table.tourlist. Dat is route_id in de sheet (vastgesteld 15-11-2026:
     44 van 46). Let op: `id` van de Ritmonitor (991717…) is een ander,
     intern nummer en matcht nooit. `truckName` is leeg — op kenteken
     koppelen kan dus niet.
   - De rittenlijst wordt door SignalR/Knockout steeds opnieuw getekend:
     een MutationObserver zet de markering na elke wijziging terug.
   - EV-rit: ⚡-chip vóór de ritnaam en een groene linkerrand.
     Onbekend: geen markering, alleen een telling in het pilletje.

   NIET TOEGEPAST ALS
   de sheet van een andere dag is dan de ritten in de Ritmonitor.

   AAN/UIT
   Nog een keer starten zet de markering uit.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var EV_VERSION = '1.0.0';

  // /exec-URL van gas-laadvermogen.js (zelfde als in laadvermogen.js).
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbxcg30KXrBjnnnt2e8wb_ThaLP43LkvMuKrUFdQ8Y11ZjkJC6GcwIjUFc_bWFRxQS_EtA/exec';

  // Gedeeld met tourtool/extra-rijtijd.js — zelfde sleutel, zelfde vorm
  // { tijd: ms, data: { ok, datum, ev:[...], onbekend:[...] } }.
  var KEY_DATA = 'ev_ritten_data';
  var DATA_MAX_MIN = 30;
  var TIMEOUT_MS = 15000;

  var STYLE_ID = 'ev-ritten-style';
  var PILL_ID = 'ev-ritten-pill';
  var CHIP = 'ev-ritten-chip';
  var RIJ = 'ev-ritten-rij';

  // ── Aan/uit ───────────────────────────────────────────────────────────────
  if (window.__evRitten && window.__evRitten.stop) {
    window.__evRitten.stop();
    return;
  }

  if (!/ModuleTourMonitor/i.test(location.pathname) || !window.ko) {
    alert('EV-ritten werkt alleen in de Ritmonitor (ModuleTourMonitor).');
    return;
  }

  function lees(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function bewaar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uw(v) { try { return window.ko.unwrap(v); } catch (e) { return v; } }

  // ── Data ophalen (JSONP) ──────────────────────────────────────────────────
  var data = null, fout = '', bezig = false;

  function haalData(forceer, klaar) {
    var c = lees(KEY_DATA);
    if (!forceer && c && c.data && c.data.ok && c.data.ev && Date.now() - c.tijd < DATA_MAX_MIN * 60000) {
      data = c.data; fout = ''; klaar(); return;
    }
    if (bezig) return;
    bezig = true;
    var naam = '__evRittenCb' + Date.now();
    var s = document.createElement('script');
    var timer = setTimeout(function () { af('geen antwoord van de sheet binnen ' + TIMEOUT_MS / 1000 + ' s'); }, TIMEOUT_MS);
    function af(melding, d) {
      clearTimeout(timer);
      bezig = false;
      try { delete window[naam]; } catch (e) { window[naam] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
      if (d && d.ok && d.ev) {
        data = d; fout = '';
        bewaar(KEY_DATA, { tijd: Date.now(), data: d });
      } else {
        fout = melding || (d && d.fout) ||
          (d && d.ok ? 'endpoint levert nog geen EV-data (nieuwe versie van gas-laadvermogen.js niet geïmplementeerd)' : 'onbekende fout');
        if (!data && c && c.data && c.data.ok && c.data.ev) data = c.data;
        console.error('[EV-ritten] ophalen mislukt:', fout);
      }
      klaar();
    }
    window[naam] = function (d) { af(null, d); };
    s.onerror = function () { af('sheet niet bereikbaar (netwerk of deployment)'); };
    s.src = GAS_URL + '?callback=' + naam + '&t=' + Date.now();
    document.head.appendChild(s);
  }

  // ── Ritmonitor ────────────────────────────────────────────────────────────
  function lijst() { return document.querySelector('table.tourlist'); }

  // Datum van de ritten in beeld: de meest voorkomende startdag in de lijst.
  // Het filter heeft ook een datum, maar het formaat daarvan is niet
  // vastgesteld; de ritten zelf zijn eenduidig.
  function msUit(v) {
    v = uw(v);
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return v.getTime();
    var m = String(v).match(/\/Date\((-?\d+)/);
    if (m) return Number(m[1]);
    var t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  function isoDag(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function ritDatum(tours) {
    var tel = {}, beste = '', n = 0;
    tours.forEach(function (t) {
      var ms = msUit(t.planStartDatestamp);
      if (ms === null) return;
      var d = isoDag(ms);
      tel[d] = (tel[d] || 0) + 1;
      if (tel[d] > n) { n = tel[d]; beste = d; }
    });
    return beste;
  }

  // Alle rijen per rit: een rit kan meer dan één <tr> beslaan.
  function rittenInBeeld() {
    var t = lijst(), uit = [], perRef = {};
    if (!t) return uit;
    var rijen = t.querySelectorAll('tr');
    for (var i = 0; i < rijen.length; i++) {
      var d = null;
      try { d = window.ko.dataFor(rijen[i]); } catch (e) {}
      if (!d || uw(d.referenceId) == null) continue;
      var ref = String(uw(d.referenceId));
      if (!perRef[ref]) {
        perRef[ref] = { ref: ref, naam: String(uw(d.name) || ''), tour: d, rijen: [] };
        uit.push(perRef[ref]);
      }
      perRef[ref].rijen.push(rijen[i]);
    }
    return uit;
  }

  // Het element dat precies de ritnaam als tekst heeft. Gevonden op inhoud,
  // niet op celpositie: de opbouw van de rij is niet vastgelegd.
  function naamElement(rit) {
    for (var r = 0; r < rit.rijen.length; r++) {
      var els = rit.rijen[r].querySelectorAll('td, span, div, a, b, strong');
      for (var i = els.length - 1; i >= 0; i--) {
        if (els[i].children.length === 0 && els[i].textContent.trim() === rit.naam) return els[i];
      }
    }
    return null;
  }

  // ── Markeren ──────────────────────────────────────────────────────────────
  var stand = { ev: 0, onbekend: 0, ritten: 0, reden: '' };
  var evSet = {}, onbekendSet = {};

  function zetSets() {
    evSet = {}; onbekendSet = {};
    if (!data) return;
    (data.ev || []).forEach(function (id) { evSet[String(id)] = true; });
    (data.onbekend || []).forEach(function (id) { onbekendSet[String(id)] = true; });
  }

  function wisMarkering() {
    var t = document.querySelectorAll('.' + CHIP);
    for (var i = 0; i < t.length; i++) t[i].parentNode.removeChild(t[i]);
    var r = document.querySelectorAll('.' + RIJ);
    for (var j = 0; j < r.length; j++) r[j].classList.remove(RIJ);
  }

  function markeer(rit) {
    rit.rijen.forEach(function (tr) { if (!tr.classList.contains(RIJ)) tr.classList.add(RIJ); });
    for (var r = 0; r < rit.rijen.length; r++) {
      if (rit.rijen[r].querySelector('.' + CHIP)) return;
    }
    var chip = document.createElement('span');
    chip.className = CHIP;
    chip.textContent = '⚡';
    chip.title = 'Elektrische bus (Fleetio, via de sheet van vannacht)';
    var el = naamElement(rit);
    if (el && el.parentNode) el.parentNode.insertBefore(chip, el);
    else {
      var td = rit.rijen[0].querySelector('td');
      if (td) td.insertBefore(chip, td.firstChild);
    }
  }

  function ontmarkeer(rit) {
    rit.rijen.forEach(function (tr) {
      if (tr.classList.contains(RIJ)) tr.classList.remove(RIJ);
      var c = tr.querySelectorAll('.' + CHIP);
      for (var i = 0; i < c.length; i++) c[i].parentNode.removeChild(c[i]);
    });
  }

  function pasToe() {
    var ritten = rittenInBeeld();
    stand = { ev: 0, onbekend: 0, ritten: ritten.length, reden: '' };
    var tours = ritten.map(function (r) { return r.tour; });
    var dag = ritDatum(tours);
    if (!data) stand.reden = fout || 'nog geen data';
    else if (dag && data.datum && dag !== data.datum) {
      stand.reden = 'sheet is van ' + nlDatum(data.datum) + ', ritten van ' + nlDatum(dag);
    }
    ritten.forEach(function (rit) {
      if (stand.reden) { ontmarkeer(rit); return; }
      if (evSet[rit.ref]) { stand.ev++; markeer(rit); }
      else {
        ontmarkeer(rit);
        if (onbekendSet[rit.ref] || !(rit.ref in bekend)) stand.onbekend++;
      }
    });
    toonPill();
  }

  // Alles wat de sheet kent (routes + zonder); wat er niet in staat is
  // na de nachtelijke verversing aangemaakt en dus ook onbekend.
  var bekend = {};
  function zetBekend() {
    bekend = {};
    if (!data) return;
    Object.keys(data.routes || {}).forEach(function (id) { bekend[id] = true; });
    Object.keys(data.zonder || {}).forEach(function (id) { bekend[id] = true; });
  }

  function nlDatum(iso) {
    var m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '-' + m[2] : iso;
  }

  // ── Stijl ─────────────────────────────────────────────────────────────────
  function zetStijl() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.' + CHIP + '{display:inline-block;margin-right:4px;padding:0 4px;border-radius:4px;' +
        'background:#d4edda;color:#155724;border:1px solid #00B900;font-size:10px;font-weight:700;' +
        'line-height:14px;vertical-align:middle;cursor:default;}' +
      'tr.' + RIJ + ' > td:first-child{box-shadow:inset 3px 0 0 #00B900;}';
    document.head.appendChild(st);
  }

  // ── Pilletje linksonder ───────────────────────────────────────────────────
  function toonPill() {
    var p = document.getElementById(PILL_ID);
    if (!p) {
      p = document.createElement('div');
      p.id = PILL_ID;
      p.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:100000;padding:4px 8px 4px 10px;' +
        'border-radius:4px;font:11px "Segoe UI",sans-serif;color:#333;box-shadow:0 1px 4px rgba(0,0,0,.25);' +
        'display:flex;gap:8px;align-items:center;';
      document.body.appendChild(p);
    }
    var tekst, achter, rand;
    if (stand.reden) {
      tekst = 'EV-ritten niet getoond: ' + stand.reden;
      achter = '#fff8e1'; rand = '#ffc107';
    } else {
      tekst = '⚡ ' + stand.ev + ' EV-rit' + (stand.ev === 1 ? '' : 'ten') + ' van ' + stand.ritten +
        (stand.onbekend ? ' · ' + stand.onbekend + ' onbekend' : '');
      achter = '#d4edda'; rand = '#00B900';
    }
    if (fout && !stand.reden) tekst += ' · ⚑ ' + fout;
    p.style.background = achter;
    p.style.border = '1px solid ' + rand;
    p.innerHTML = '';
    var t = document.createElement('span');
    t.textContent = tekst;
    t.title = 'EV-ritten v' + EV_VERSION +
      (data ? ' · sheet ' + data.datum + ', opgehaald ' + data.opgehaald : '') +
      '\nOnbekend = geen kenteken, kenteken niet in Fleetio, of rit na de nachtelijke verversing aangemaakt.';
    var ver = document.createElement('button');
    ver.textContent = '↻';
    ver.title = 'Opnieuw ophalen uit de sheet';
    var weg = document.createElement('button');
    weg.textContent = '×';
    weg.title = 'EV-markering uitzetten';
    [ver, weg].forEach(function (b) {
      b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:13px;line-height:1;padding:0;color:#333;';
    });
    ver.onclick = function () { haalData(true, klaar); };
    weg.onclick = function () { stop(); };
    p.appendChild(t); p.appendChild(ver); p.appendChild(weg);
  }

  // ── Bijhouden ─────────────────────────────────────────────────────────────
  // Alleen reageren op wijzigingen in de rittenlijst (of een nieuwe lijst),
  // niet op de kaart. pasToe() is idempotent: een tweede ronde na de eigen
  // wijzigingen verandert niets meer, dus dit loopt niet rond.
  var timer = null, obs = null;
  function gepland() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; pasToe(); }, 250);
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
  function kijk() {
    obs = new MutationObserver(function (lijstM) {
      for (var i = 0; i < lijstM.length; i++) if (relevant(lijstM[i])) { gepland(); return; }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stop() {
    if (obs) obs.disconnect();
    if (timer) clearTimeout(timer);
    wisMarkering();
    var p = document.getElementById(PILL_ID); if (p) p.remove();
    var s = document.getElementById(STYLE_ID); if (s) s.remove();
    window.__evRitten = null;
  }

  function klaar() { zetSets(); zetBekend(); pasToe(); }

  // ── Start ─────────────────────────────────────────────────────────────────
  window.__evRitten = { stop: stop, pasToe: pasToe, versie: EV_VERSION };
  zetStijl();
  kijk();
  haalData(false, klaar);
})();
