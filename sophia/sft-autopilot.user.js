// ==UserScript==
// @name         SFT autopilot — vanzelf op Cpc repair approval
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.0.1
// @description  Opent het overlay van de SFT autopilot zodra Cpc repair → Approval in beeld komt. Start autopilot blijft een klik.
// @match        https://sophia.mendixcloud.com/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/sophia/sft-autopilot.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/sophia/sft-autopilot.user.js
// ==/UserScript==

/* Dunne starter, geen tool. Doet precies wat de bladwijzer SFT 🤖 doet (zie
   ~/Documents/Sophia tool/Working Files/sft_persoonlijk_loader.txt): de code
   van de persoonlijke build uit het eigen GAS-project halen, met dezelfde
   cache-sleutels (sft_p_code_cache / sft_p_version) als die bladwijzer en de
   launcher. Geen dubbele downloads; een nieuwe pN komt vanzelf binnen.

   Wat er gebeurt: zonder open case doet de autopilot bij het laden alleen
   startTool() + "klaar om te starten" — het overlay met de knop
   Start autopilot ⚡. Die knop blijft een bewuste klik (p11: de bladwijzer-klik
   start niets), dit script drukt er nooit op.

   Sophia is Mendix: één pagina (index.html), de URL verandert niet bij het
   wisselen van scherm. Het scherm wordt dus herkend aan de paginatitel
   "Cpc repair approval" buiten een venster, plus de lijst (.mx-name-grid1).
   Het approval-venster van een case heet ook "Cpc repair approval" — vandaar
   "buiten een venster".

   Eén keer per bezoek aan het scherm. Weer gewapend pas als de paginatitel
   weg is geweest (ander scherm). Nooit als er al een #cpc-overlay staat (SFT 🤚,
   SFT 🤖 of een lopende autopilot), en nooit met een open case of venster:
   dan zou de autopilot zijn enkele flow op die case starten. */
(function () {
  'use strict';

  // DS Tools: dit script is ook een module van het Tampermonkey-script DS Tools
  // (launcher.js, lijst AUTO). Nooit dubbel: wie het eerst draait claimt de plek.
  if (window.__dsAuto && window.__dsAuto['auto-sft-autopilot']) return;
  (window.__dsAuto = window.__dsAuto || {})['auto-sft-autopilot'] = true;

  var U = 'https://script.google.com/a/macros/coolblue.nl/s/AKfycbzvJcH6rRJNkWjepNzg6Ohuua0zNU95s31cBBY5XdlT5wxJkGaiOZGnMY0YSM1vBAjdmw/exec';
  var CACHE = 'sft_p_code_cache';
  var VERSIE = 'sft_p_version';
  var RUST_MS = 700;      // scherm moet zo lang klaar staan (lijst geladen) voor we starten
  var TIK_MS = 300;       // hooguit één controle per zoveel ms bij DOM-wijzigingen
  var TAG = '[SFT autopilot userscript]';

  // Indirect eval: de code draait in de globale scope van de pagina, zonder
  // de variabelen van dit script te zien (de tool is één IIFE met een
  // 'javascript:'-label ervoor, dat is in eval een gewoon label).
  function draai(code) {
    try { (0, eval)(code); return true; }
    catch (e) { console.error(TAG, 'tool gaf een fout:', e); return false; }
  }

  function start() {
    var cached = null;
    try { cached = localStorage.getItem(CACHE); } catch (e) {}
    var gelukt = cached ? draai(cached) : false;
    console.log(TAG, cached ? (gelukt ? 'autopilot geladen uit cache' : 'cache gaf een fout, verse versie volgt') : 'nog geen cache, ophalen…');

    fetch(U)
      .then(function (r) { return r.text(); })
      .then(function (t) {
        if (!t || t.indexOf('javascript:') === -1 || t === cached) return;
        try { localStorage.setItem(CACHE, t); }
        catch (e) { try { localStorage.removeItem(CACHE); localStorage.setItem(CACHE, t); } catch (e2) { console.error(TAG, 'cache kon niet opgeslagen worden:', e2); } }
        var m = t.match(/Sophia Filter Tool v([0-9.]+)/);
        if (m) { try { localStorage.setItem(VERSIE, m[1]); } catch (e) {} }
        // Geen (werkende) cache: de verse code meteen draaien. Anders geldt de
        // nieuwe versie vanaf het volgende bezoek, net als bij de bladwijzer.
        if (!gelukt) draai(t);
      })
      .catch(function (e) { console.error(TAG, 'ophalen mislukt:', e); });
  }

  function zichtbaar(el) {
    return !!(el && el.getClientRects().length);
  }
  var VENSTER = '.modal-dialog, .modal-content, .mx-window, .mx-dialog, [role="dialog"]';

  var TITEL = /^\s*cpc repair approval\s*$/i;
  function titelBuitenVenster(el) {
    return !!el && !el.closest(VENSTER) && !el.closest('#cpc-overlay') && zichtbaar(el);
  }
  function opApprovalScherm() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      if (TITEL.test(n.nodeValue) && titelBuitenVenster(n.parentElement)) return true;
    }
    // Terugval: titel over meerdere tekstknopen verdeeld (bv. een <span> erin).
    var koppen = document.querySelectorAll('h1, h2, h3, .mx-title, [class*="pageTitle"]');
    for (var i = 0; i < koppen.length; i++) {
      if (TITEL.test((koppen[i].textContent || '').replace(/\s+/g, ' ')) && titelBuitenVenster(koppen[i])) return true;
    }
    return false;
  }
  function lijst() {
    return document.querySelector('.mx-name-grid1') || document.querySelector('.mx-datagrid');
  }
  // Zelfde test als proofKnop() in de autopilot: staat deze knop er, dan is
  // er een case open en zou de autopilot meteen zijn enkele flow draaien.
  function caseOpen() {
    var knoppen = document.querySelectorAll('button');
    for (var i = 0; i < knoppen.length; i++) {
      if (zichtbaar(knoppen[i]) && /proof of purchase/i.test(knoppen[i].innerText || '')) return true;
    }
    return false;
  }
  function vensterOpen() {
    var v = document.querySelectorAll(VENSTER);
    for (var i = 0; i < v.length; i++) if (zichtbaar(v[i])) return true;
    return false;
  }

  var gewapend = true;
  var klaarSinds = 0;

  function controleer() {
    if (!opApprovalScherm()) {
      if (!gewapend) console.log(TAG, 'scherm verlaten — volgende keer weer automatisch');
      gewapend = true;
      klaarSinds = 0;
      return;
    }
    if (!gewapend) return;
    if (document.getElementById('cpc-overlay')) {
      gewapend = false;
      console.log(TAG, 'overlay staat er al — niets gedaan');
      return;
    }
    if (!lijst() || caseOpen() || vensterOpen()) { klaarSinds = 0; return; }
    if (!klaarSinds) {
      klaarSinds = Date.now();
      setTimeout(controleer, RUST_MS + 50);
      return;
    }
    if (Date.now() - klaarSinds < RUST_MS) return;
    gewapend = false;
    klaarSinds = 0;
    console.log(TAG, 'Cpc repair approval in beeld — autopilot openen');
    start();
  }

  var gepland = false;
  function plan() {
    if (gepland) return;
    gepland = true;
    setTimeout(function () { gepland = false; controleer(); }, TIK_MS);
  }

  new MutationObserver(plan).observe(document.body, { childList: true, subtree: true });
  console.log(TAG, 'v1.0.0 actief, wacht op Cpc repair → Approval');
  plan();
})();
