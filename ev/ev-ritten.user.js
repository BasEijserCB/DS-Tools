// ==UserScript==
// @name         DS Tools — EV-ritten (automatisch)
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.0.0
// @description  Zet in de Ritmonitor vanzelf een ⚡ EV bij ritten met een elektrische bus.
// @match        https://coolblue.dirextion.nl/ModuleTourMonitor*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ev/ev-ritten.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ev/ev-ritten.user.js
// ==/UserScript==

/* Dunne starter, geen tool: de code zelf staat in ev/ev-ritten.js en wordt
   net als in de launcher met stale-while-revalidate opgehaald, onder
   dezelfde cache-sleutel (ds_ev_ritten_cache). Een nieuwe versie van de
   tool komt dus vanzelf binnen; dit script hoeft zelden te veranderen.

   @grant none: het script draait in de pagina zelf, want de tool heeft
   window.ko van de Ritmonitor nodig.

   Let op: ev-ritten.js schakelt uit als hij al draait. Daarom start dit
   script hem alleen als window.__evRitten nog leeg is. Wie daarna in de
   launcher op EV-ritten klikt, zet hem dus uit — en met nog een klik weer aan. */
(function () {
  'use strict';

  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ev/ev-ritten.js';
  var CACHE = 'ds_ev_ritten_cache';
  var WACHT_MAX_MS = 60000;

  function draai(code) {
    if (window.__evRitten) return true;
    try { eval(code); return true; }
    catch (e) { console.error('[EV-ritten userscript] tool gaf een fout:', e); return false; }
  }

  function start() {
    var cached = null;
    try { cached = localStorage.getItem(CACHE); } catch (e) {}
    var gelukt = cached ? draai(cached) : false;

    fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (code) {
        if (!code || code === cached) return;
        try { localStorage.setItem(CACHE, code); }
        catch (e) { try { localStorage.removeItem(CACHE); localStorage.setItem(CACHE, code); } catch (e2) {} }
        // Geen (werkende) cache: de verse code meteen draaien. Anders geldt
        // de nieuwe versie vanaf de volgende keer dat de Ritmonitor opent.
        if (!gelukt) draai(code);
      })
      .catch(function (e) { console.error('[EV-ritten userscript] ophalen mislukt:', e); });
  }

  // Wachten tot Knockout en de rittenlijst er zijn: de Ritmonitor bouwt die
  // pas na het laden op.
  var begin = Date.now();
  (function wacht() {
    if (window.ko && document.querySelector('table.tourlist')) { start(); return; }
    if (Date.now() - begin > WACHT_MAX_MS) {
      console.warn('[EV-ritten userscript] geen rittenlijst gevonden binnen ' + WACHT_MAX_MS / 1000 + ' s');
      return;
    }
    setTimeout(wacht, 500);
  })();
})();
