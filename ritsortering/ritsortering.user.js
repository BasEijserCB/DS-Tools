// ==UserScript==
// @name         DS Tools — Ritsortering (automatisch)
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.0.0
// @description  Sorteert de ritten in de Ritmonitor vanzelf op netwerk en nummer (1M, 1X, 2M, BI), met een lichte kleur per netwerk.
// @match        https://coolblue.dirextion.nl/ModuleTourMonitor*
// @match        https://coolblue.dirextion.nl/moduletourmonitor*
// @match        https://coolblue.dirextion.nl/Moduletourmonitor*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ritsortering/ritsortering.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ritsortering/ritsortering.user.js
// ==/UserScript==

/* Dunne starter, geen tool: de code staat in ritsortering/ritsortering.js en
   wordt net als in de launcher met stale-while-revalidate opgehaald, onder
   dezelfde cache-sleutel (ds_ritsortering_cache).

   ritsortering.js schakelt uit als hij al draait; daarom start dit script hem
   alleen als window.__ritSortering leeg is. Een klik in de launcher zet hem
   daarna uit, en met nog een klik weer aan. */
(function () {
  'use strict';

  // DS Tools: module van het Tampermonkey-script DS Tools (launcher.js, AUTO).
  if (window.__dsAuto && window.__dsAuto['auto-ritsortering']) return;
  (window.__dsAuto = window.__dsAuto || {})['auto-ritsortering'] = true;

  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ritsortering/ritsortering.js';
  var CACHE = 'ds_ritsortering_cache';
  var WACHT_MAX_MS = 60000;

  function draai(code) {
    if (window.__ritSortering) return true;
    window.__ritSorteringStil = true;   // geen bevestiging bij automatisch starten
    try { eval(code); return true; }
    catch (e) { console.error('[Ritsortering userscript] tool gaf een fout:', e); return false; }
    finally { window.__ritSorteringStil = false; }
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
        if (!gelukt) draai(code);
      })
      .catch(function (e) { console.error('[Ritsortering userscript] ophalen mislukt:', e); });
  }

  // Wachten tot Knockout en de rittenlijst er zijn.
  var begin = Date.now();
  (function wacht() {
    if (window.ko && document.querySelector('table.tourlist')) { start(); return; }
    if (Date.now() - begin > WACHT_MAX_MS) {
      console.warn('[Ritsortering userscript] geen rittenlijst gevonden binnen ' + WACHT_MAX_MS / 1000 + ' s');
      return;
    }
    setTimeout(wacht, 500);
  })();
})();
