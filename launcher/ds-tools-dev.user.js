// ==UserScript==
// @name         DS Tools (dev)
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.0.0
// @description  DS Tools voor ontwikkelen en testen: draait ook de modules die nog op test staan. Installeer dit óf het gewone DS Tools-script, niet allebei.
// @match        https://coolblue.dirextion.nl/*
// @match        https://coolbluebezorgt.dirextion.nl/*
// @match        https://sophia.mendixcloud.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/launcher/ds-tools-dev.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/launcher/ds-tools-dev.user.js
// ==/UserScript==

/* DEV-variant van launcher/ds-tools.user.js (alleen DS_TOOLS_MODUS verschilt). Het Tampermonkey-script van DS Tools. Bevat zelf geen toolcode: het laadt
   launcher/launcher.js (zelfde cache als de DS Tools-bladwijzer) in modus 'auto',
   en de launcher start de modules uit zijn lijst AUTO die bij deze pagina horen
   en op productie staan (beheerpagina). Het dev-script (ds-tools-dev.user.js) is
   identiek op DS_TOOLS_MODUS na: 'auto-dev' draait ook de test-modules.

   Dit bestand hoeft vrijwel nooit te veranderen: een nieuwe module of een nieuwe
   versie is een push naar GitHub. Alleen een nieuwe website vraagt een @match
   (en dan @version ophogen; Tampermonkey haalt het zelf binnen een dag op).

   Geen 'use strict' hier: de launcher wordt met een directe eval uitgevoerd en
   zou dan strict worden, en dat is hij nooit geweest.
   @grant none: de modules hebben jQuery, ASPx, ko enz. van de pagina nodig. */
(function () {
  var DS_TOOLS_MODUS = 'auto-dev';
  var CACHE = 'ds_launcher_prod_cache';
  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/launcher/launcher.js';
  // Een launcher van vóór de automatische modules kent 'auto' niet en zou hier
  // de balk tonen; die draaien we niet, ook niet uit de cache.
  var MERK = 'DS_TOOLS_AUTO_V1';
  function bewaar(code) {
    try { localStorage.setItem(CACHE, code); }
    catch (e) { try { localStorage.removeItem(CACHE); localStorage.setItem(CACHE, code); } catch (e2) { console.error('[DS Tools auto] launcher opslaan mislukt (localStorage vol?)'); } }
  }
  var cached = null;
  try { cached = localStorage.getItem(CACHE); } catch (e) {}
  if (cached && cached.indexOf(MERK) === -1) cached = null;
  var stuk = 0;
  if (cached) { try { eval(cached); } catch (e) { stuk = 1; console.error('[DS Tools auto] gecachete launcher faalt:', e); } }
  fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (code) {
      if (!code || code === cached) { if (stuk) console.error('[DS Tools auto] ook de nieuwste launcher faalt'); return; }
      bewaar(code);
      if ((!cached || stuk) && code.indexOf(MERK) !== -1) {
        try { eval(code); } catch (e) { console.error('[DS Tools auto] launcher faalt:', e); }
      }
    })
    .catch(function (e) { console.error('[DS Tools auto] launcher ophalen mislukt:', e); });
})();
