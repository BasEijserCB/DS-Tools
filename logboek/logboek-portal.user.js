// ==UserScript==
// @name         DS Tools — DS Logboek op de consumer portal
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.2.0
// @description  Opent DS Logboek vanzelf op de consumer portal, in de lege rechtermarge naast de pagina.
// @match        https://coolbluebezorgt.dirextion.nl/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-portal.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/logboek/logboek-portal.user.js
// ==/UserScript==

/* Dunne starter: ds-logboek.js wordt met stale-while-revalidate geladen onder
   dezelfde cache-sleutel als de bookmarklet en de launcher (ds_app_prod_cache).

   Plek: de portal heeft een smalle kolom in het midden met aan beide kanten
   lege ruimte. Het logboek komt rechts in die marge, op de hoogte van de tabs
   (Informatie / Klantgegevens / Zendinginformatie). Is de marge te smal
   (laptop, of de brede stand van 600px), dan komt het logboek tegen de
   rechterrand en krijgt alleen de kolom (#bodyContainer, 1000px) de ruimte
   links ervan: eerst door op te schuiven, en als hij daar niet op ware grootte
   past met CSS-zoom tot 75%. Nog smaller venster: niets aanpassen, het
   logboek ligt erover (v1.1.0; v1.0.0 zette padding op <html>, wat de kolom
   liet staan en een tweede witte laag gaf).

   Dat gaat via de hook DS_LOGBOEK_PLEK in ds-logboek.js (v1.44.0). Die blijft
   staan, dus ook een logboek dat daarna met de bookmarklet gestart wordt,
   komt op deze plek.

   Gesloten met × = weg voor deze paginalading. Herladen of een volgende order
   opent hem opnieuw (keuze A, 15-11-2026). */
(function () {
  'use strict';

  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/ds-logboek.js';
  var CACHE = 'ds_app_prod_cache';
  var MARGE = 16;          // afstand tot kolom en schermrand
  var WACHT_MAX_MS = 30000;

  // ── Plek bepalen ──────────────────────────────────────────────
  function zichtbaar(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }

  // De tabrij (Informatie …) en de kolom eromheen.
  function tabElement() {
    var els = document.querySelectorAll('a, li, div, span, button');
    for (var i = 0; i < els.length; i++) {
      var t = els[i].textContent.trim();
      if ((t === 'Informatie' || t === 'Information' || t === 'Informationen') && zichtbaar(els[i])) return els[i];
    }
    return null;
  }
  // De portal is één blok #bodyContainer van 1000px, gecentreerd met
  // margin:auto (probe 15-11-2026). Terugval: omhoog vanaf de tab.
  function kolom(tab) {
    var bc = document.getElementById('bodyContainer');
    if (bc) return bc;
    var el = tab, beste = null;
    while (el && el !== document.body) {
      var r = el.getBoundingClientRect();
      if (r.width < window.innerWidth * 0.95) beste = el; else break;
      el = el.parentElement;
    }
    return beste;
  }

  var MIN_ZOOM = 0.75;    // kleiner wordt de portal niet; dan overlapt het logboek liever
  var huidig = null;      // het wrapper-element dat we nu plaatsen
  var ro = null;
  var verschoven = null;  // de kolom waaraan we iets veranderd hebben

  // Alleen de kolom zelf aanpassen, nooit <html>/<body>: padding op <html>
  // (v1.0.0) liet de kolom staan en gaf een tweede witte laag.
  function herstelPagina() {
    if (!verschoven) return;
    verschoven.style.marginLeft = '';
    verschoven.style.marginRight = '';
    verschoven.style.zoom = '';
    verschoven = null;
    [document.documentElement, document.body].forEach(function (el) { el.style.backgroundPositionX = ''; });
  }

  // De witte kolom met schaduwranden is (vermoedelijk) een achtergrondafbeelding
  // op <html>/<body>, geen element: hij stond niet in de probe en bleef
  // gecentreerd staan als #bodyContainer opschoof. Schuif die achtergrond mee
  // met hetzelfde aantal pixels als het midden van de kolom (v1.2.0).
  // Meerdere lagen (bijv. ook blauwe balken) schuiven allemaal mee; een laag
  // die horizontaal herhaalt merkt daar niets van.
  function schuifAchtergrond(dx) {
    [document.documentElement, document.body].forEach(function (el) {
      var cs = getComputedStyle(el);
      if (!cs.backgroundImage || cs.backgroundImage === 'none') return;
      el.style.backgroundPositionX = cs.backgroundPositionX.split(',').map(function (x) {
        return 'calc(' + (x.trim() || '0%') + ' + ' + Math.round(dx) + 'px)';
      }).join(', ');
    });
  }

  function plaats() {
    if (!huidig || !huidig.isConnected) return;
    var tab = tabElement();
    var col = tab && kolom(tab);
    var breedte = huidig.offsetWidth || 360;
    var hoogte = huidig.offsetHeight || 620;
    var s = huidig.style;

    // Eerst meten zoals de portal zelf is.
    herstelPagina();
    var rc = col ? col.getBoundingClientRect() : null;
    var vrij = rc ? window.innerWidth - rc.right : 0;

    if (rc && vrij >= breedte + 2 * MARGE) {
      // 1. Past in de marge rechts: tegen de kolom aan, pagina ongemoeid.
      s.left = (rc.right + MARGE) + 'px';
      s.right = 'auto';
    } else {
      // Logboek tegen de rechterrand; de kolom krijgt de ruimte links ervan.
      s.left = 'auto';
      s.right = MARGE + 'px';
      if (col) {
        var ruimte = window.innerWidth - breedte - 2 * MARGE;   // links van het logboek
        if (ruimte >= rc.width) {
          // 2. Kolom past op ware grootte: opschuiven, gecentreerd in die ruimte.
          col.style.marginLeft = Math.max(0, Math.floor((ruimte - rc.width) / 2)) + 'px';
          col.style.marginRight = '0px';
          verschoven = col;
        } else {
          // 3. Past niet: kolom iets kleiner, tot MIN_ZOOM. Marges schalen mee
          //    met zoom, dus delen door z.
          var z = (ruimte - MARGE) / rc.width;
          if (z >= MIN_ZOOM) {
            col.style.zoom = String(Math.floor(z * 100) / 100);
            col.style.marginLeft = (MARGE / z) + 'px';
            col.style.marginRight = '0px';
            verschoven = col;
          }
          // Nog kleiner venster: niets aanpassen, het logboek ligt erover.
        }
      }
    }

    if (verschoven && rc) {
      var nu = col.getBoundingClientRect();
      schuifAchtergrond((nu.left + nu.right) / 2 - (rc.left + rc.right) / 2);
    }

    // Hoogte pas na het verschuiven/zoomen meten: zoom verplaatst de tab.
    var top = tab ? Math.max(MARGE, tab.getBoundingClientRect().top) : 80;
    if (top + hoogte > window.innerHeight - MARGE) top = Math.max(MARGE, window.innerHeight - MARGE - hoogte);
    s.top = top + 'px';
    s.bottom = 'auto';
  }

  // Wordt door ds-logboek.js aangeroepen zodra het paneel er staat.
  window.DS_LOGBOEK_PLEK = function (wrapper) {
    huidig = wrapper;
    if (ro) ro.disconnect();
    if (window.ResizeObserver) { ro = new ResizeObserver(plaats); ro.observe(wrapper); }
    plaats();
  };
  window.addEventListener('resize', plaats);
  // Paneel weg (×, of na het loggen) → pagina terug zoals hij was. Wordt er
  // intussen een nieuw paneel gestart, dan blijft de padding van dat paneel staan.
  new MutationObserver(function () {
    if (huidig && !huidig.isConnected) {
      var nieuw = window.__dsLogboek && window.__dsLogboek.wrapper;
      if (!nieuw || !nieuw.isConnected) { herstelPagina(); huidig = null; }
    }
  }).observe(document.body, { childList: true });

  // ── Laden ─────────────────────────────────────────────────────
  function draai(code) {
    try { eval(code); return true; }
    catch (e) { console.error('[DS Logboek userscript] logboek gaf een fout:', e); return false; }
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
      .catch(function (e) { console.error('[DS Logboek userscript] ophalen mislukt:', e); });
  }

  // Wachten tot de portal het ordernummer gerenderd heeft (Knockout).
  var begin = Date.now();
  (function wacht() {
    var el = document.querySelector("[data-bind*='OrderNumberTransport']");
    if (el && /\d{8,}/.test(el.textContent)) { start(); return; }
    if (Date.now() - begin > WACHT_MAX_MS) { console.warn('[DS Logboek userscript] geen ordernummer gevonden'); return; }
    setTimeout(wacht, 300);
  })();
})();
