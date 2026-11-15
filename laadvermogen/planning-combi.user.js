// ==UserScript==
// @name         DS Tools — Planning-combi (automatisch)
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.0.0
// @description  Zet in de planningsmodule vanzelf de vaste instellingen en het echte laadvermogen uit Fleetio.
// @match        https://coolblue.dirextion.nl/ModulePlanningBeta*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/laadvermogen/planning-combi.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/laadvermogen/planning-combi.user.js
// ==/UserScript==

/* Dunne starter, geen tool: doet wat de Planning-combi-bookmarklet doet
   (eerst planning-instellingen.js, dan laadvermogen.js), met dezelfde
   cache-sleutels als die bookmarklet en de launcher. Nieuwe versies van de
   twee bestanden komen dus vanzelf binnen; dit script hoeft zelden te
   veranderen. Een nieuwe versie geldt vanaf de volgende keer dat de
   planningsmodule opent — geen toast, het draait toch al.

   Verschil met een klik: dit start tijdens het laden van de pagina. Daarom
   eerst wachten op
   - window.TourGrid (anders meldt laadvermogen.js met een alert dat hij
     alleen in de planningsmodule werkt), en
   - de werkperiode van het planningssjabloon (GetTemplates): die komt
     asynchroon binnen en zou de 3 uur anders direct weer overschrijven.
     Staat er na WACHT_SJABLOON_MS nog niets, dan toch doorgaan.

   @grant none: draait in de pagina zelf, want beide bestanden hebben ko,
   ASPx en TourGrid van de pagina nodig.

   Beide bestanden zijn veilig om twee keer te draaien: een klik op de
   bookmarklet of in de launcher daarna doet geen kwaad. */
(function () {
  'use strict';

  var BASE = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/laadvermogen/';
  var BESTANDEN = [
    { naam: 'Planning-instellingen', cache: 'ds_planning_combi_inst_cache', src: 'planning-instellingen.js' },
    { naam: 'Laadvermogen', cache: 'ds_planning_combi_lv_cache', src: 'laadvermogen.js' }
  ];
  var WACHT_GRID_MS = 60000;
  var WACHT_SJABLOON_MS = 10000;

  function log(m) { console.log('[Planning-combi userscript] ' + m); }

  function draai(naam, code) {
    try { eval(code); return true; }
    catch (e) { console.error('[Planning-combi userscript] ' + naam + ' gaf een fout:', e); return false; }
  }

  // Zelfde stale-while-revalidate als de loader: gecachete versie direct,
  // verse versie in de achtergrond. Zonder (werkende) cache draait de verse
  // code zodra hij binnen is.
  function laad(b) {
    var cached = null;
    try { cached = localStorage.getItem(b.cache); } catch (e) {}
    var gelukt = cached ? draai(b.naam, cached) : false;
    fetch(BASE + b.src + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (code) {
        if (!code || code === cached) return;
        try { localStorage.setItem(b.cache, code); }
        catch (e) { try { localStorage.removeItem(b.cache); localStorage.setItem(b.cache, code); } catch (e2) {} }
        if (!gelukt) draai(b.naam, code);
        else log(b.naam + ': nieuwe versie opgeslagen, actief vanaf de volgende keer');
      })
      .catch(function (e) { console.error('[Planning-combi userscript] ' + b.naam + ' ophalen mislukt:', e); });
  }

  function sjabloonGeladen() {
    var el = document.querySelector('select[data-bind*="workingPeriodHours"]');
    if (!el || !window.ko) return false;
    try {
      var vm = window.ko.contextFor(el).$data;
      return !!(vm && typeof vm.workingPeriodHours === 'function' && vm.workingPeriodHours());
    } catch (e) { return false; }
  }

  var begin = Date.now(), gridSinds = null;
  (function wacht() {
    var nu = Date.now();
    var grid = window.ko && window.TourGrid && document.getElementById('FilterChannel_VI');
    if (!grid) {
      if (nu - begin > WACHT_GRID_MS) { log('geen Rit overzicht gevonden binnen ' + WACHT_GRID_MS / 1000 + ' s — niets gedaan'); return; }
      setTimeout(wacht, 500); return;
    }
    if (gridSinds === null) gridSinds = nu;
    if (!sjabloonGeladen() && nu - gridSinds < WACHT_SJABLOON_MS) { setTimeout(wacht, 500); return; }
    if (!sjabloonGeladen()) log('geen sjabloonwaarden na ' + WACHT_SJABLOON_MS / 1000 + ' s — toch toegepast');
    BESTANDEN.forEach(laad);
  })();
})();
