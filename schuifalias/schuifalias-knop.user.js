// ==UserScript==
// @name         DS Tools — Schuifritten alias in de linkerbalk
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.0.0
// @description  Knop onder de knoppen links in de planningsmodule: Schuifritten → alias schuift uit als lade, zoals de panelen van DireXtion zelf.
// @match        https://coolblue.dirextion.nl/ModulePlanningBeta*
// @match        https://coolblue.dirextion.nl/moduleplanningbeta*
// @match        https://coolblue.dirextion.nl/Moduleplanningbeta*
// @grant        none
// @run-at       document-idle
// @noframes
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/schuifalias/schuifalias-knop.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/schuifalias/schuifalias-knop.user.js
// ==/UserScript==

/* Schuifritten → alias als knop in de linkerbalk van de planningsmodule, onder
   de knoppen van DireXtion zelf (vergrootglas, planmonitor, …, planner).
   Module 'auto-schuifalias' van het Tampermonkey-script DS Tools.

   Opbouw (uit planning.har, 23-10-2026): nav#navLeft bevat per paneel een
   div.quick-view met een div.quick-view-content (het paneel, left:-510px als
   het dicht is) en een span.quick-view-activator (het vierkantje met het
   Font Awesome-icoon). Dit script zet er een eigen div.quick-view achter, met
   dezelfde klassen: knop en paneel krijgen zo de stijl van DireXtion (verloop,
   schaduw, ronde rechterhoeken) zonder die na te bouwen. Het uitschuiven doet
   het script zelf (de knockout-binding slideRight van DireXtion is niet te zien
   in de HAR): het paneel schuift vanaf de linkerrand naar binnen, bovenaan de
   balk, en de knop rijdt mee naar de rechterkant van het paneel, 10px onder de
   bovenkant (zoals slideButtonToTop/buttonTopOffset:10 bij DireXtion).

   Eigen accent, zoals de knoppen van DS Logboek in Basic: een dun fel oranje
   randje om de knop (als inset-schaduw, zodat de maat gelijk blijft) en een
   oranje stip zolang er een weggeschoven Schuifalias wacht.

   De tool zelf is schuifalias/schuifalias.js (v1.2.0+), geladen met dezelfde
   cache als de launcher en de losse bookmarklet (ds_schuifalias_prod_cache).
   Dit script zet window.DS_SCHUIFALIAS_HOST; de tool schrijft dan in het paneel
   van de lade in plaats van een eigen paneel rechtsboven. Ook een start via de
   launcher belandt zo in de lade (en controleert dan meteen, zoals altijd);
   via deze knop eerst een startscherm met "Controleren".
   × in de tool = lade weg; de controle, de keuzes en de markering blijven.
   Nog een klik op de knop = terug. Een andere knop in de balk = lade weg. */
(function () {
  'use strict';

  // DS Tools: dit script is ook een module van het Tampermonkey-script DS Tools
  // (launcher.js, lijst AUTO). Nooit dubbel: wie het eerst draait claimt de plek.
  if (window.__dsAuto && window.__dsAuto['auto-schuifalias']) return;
  (window.__dsAuto = window.__dsAuto || {})['auto-schuifalias'] = true;

  var VERSIE = '1.0.0';
  var LOG = '[DS Schuifalias-knop]';
  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/schuifalias/schuifalias.js';
  var CACHE = 'ds_schuifalias_prod_cache';   // zelfde als launcher en losse loader
  var ID = 'ds-schuifalias-quickview';
  var PANEL_ID = 'schuifalias-panel';         // het id waar schuifalias.js zijn stijl aan hangt
  var BREED = 440;                            // breedte van het paneel (DireXtion: 500, dashboard 800)
  var IN_MS = 240, UIT_MS = 200;
  var ICOON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/>' +
    '<circle cx="7.5" cy="7.5" r="1.5"/></svg>';

  console.info(LOG + ' v' + VERSIE + ' actief');
  function zichtbaar(el) { return !!el && el.isConnected && el.getClientRects().length > 0; }
  function zonderBeweging() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  // ── De tool: stil stale-while-revalidate, uitvoeren pas bij een klik ─────
  var verseCode = null;
  function leesCache() { try { return localStorage.getItem(CACHE); } catch (e) { return null; } }
  fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (code) {
      if (!code) return;
      verseCode = code;
      if (code === leesCache()) return;
      try { localStorage.setItem(CACHE, code); }
      catch (e) { try { localStorage.removeItem(CACHE); localStorage.setItem(CACHE, code); } catch (e2) { console.error(LOG + ' opslaan mislukt (localStorage vol?)'); } }
    })
    .catch(function (e) { console.error(LOG + ' ophalen mislukt:', e); });

  function startTool() {
    var code = verseCode || leesCache();
    inhoud.removeAttribute('data-mislukt');
    if (!code) {
      inhoud.setAttribute('data-mislukt', '');
      inhoud.innerHTML = '<div style="padding:10px;">Schuifalias is nog niet geladen. Probeer het over een paar seconden opnieuw.</div>';
      return;
    }
    HOST.startscherm = true;
    try { eval(code); }
    catch (e) {
      console.error(LOG + ' schuifalias.js gaf een fout:', e);
      inhoud.setAttribute('data-mislukt', '');
      inhoud.innerHTML = '<div style="padding:10px;color:#E50000;">Schuifalias gaf een fout: ' + String(e && e.message || e).replace(/</g, '&lt;') + '</div>';
    }
    HOST.startscherm = false;
  }

  // ── Lade ──────────────────────────────────────────────────────────────────
  var nav = null, qv = null, paneel = null, inhoud = null, knop = null, open = false, sluitTimer = null;

  var HOST = window.DS_SCHUIFALIAS_HOST = {
    paneel: function () { return inhoud; },
    toon: function () { openLade(); },
    sluit: function () { sluitLade(); },
    startscherm: false
  };
  // Gestart = de tool heeft iets in de lade gezet (niet: alleen een laad- of foutmelding).
  function gestart() { return !!inhoud && inhoud.childNodes.length > 0 && !inhoud.hasAttribute('data-mislukt'); }

  function stijl() {
    if (document.getElementById(ID + '-stijl')) return;
    var Q = '#' + ID;
    var s = document.createElement('style');
    s.id = ID + '-stijl';
    s.textContent = [
      Q + ' > .quick-view-content{max-height:none;}',
      Q + ' > .quick-view-content > .ds-sa-inhoud{overflow:auto;border:1px solid #c8c8c8;}',
      // Native vierkantje; het oranje randje als inset-schaduw, zodat de maat gelijk blijft.
      Q + ' > .quick-view-activator{cursor:pointer;color:#333333;box-shadow:0 1px 5px rgba(0,0,0,.7),inset 0 0 0 1px #ff8c1a;}',
      Q + ' > .quick-view-activator svg{display:block;margin:0 auto;}',
      Q + ' .ds-sa-stip{position:absolute;right:2px;bottom:2px;width:6px;height:6px;border-radius:50%;background:#c75f0c;display:none;pointer-events:none;}',
      Q + '.ds-sa-wacht .ds-sa-stip{display:block;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function bouw() {
    stijl();
    qv = document.createElement('div');
    qv.className = 'quick-view';
    qv.id = ID;
    paneel = document.createElement('div');
    paneel.className = 'quick-view-content';
    paneel.style.width = BREED + 'px';
    paneel.style.left = -(BREED + 10) + 'px';
    paneel.style.visibility = 'hidden';
    inhoud = document.createElement('div');
    inhoud.id = PANEL_ID;
    inhoud.className = 'white-background ds-sa-inhoud';
    paneel.appendChild(inhoud);
    knop = document.createElement('span');
    knop.className = 'quick-view-activator';
    knop.title = 'Schuifritten → alias';
    // Font Awesome van de pagina zet <i> om in een svg; lukt dat niet, dan een eigen lijnicoon.
    knop.innerHTML = '<i class="fal fa-tags" style="font-size: 16px;"></i><span class="ds-sa-stip"></span>';
    var clear = document.createElement('div');
    clear.className = 'clear';
    qv.appendChild(paneel);
    qv.appendChild(knop);
    qv.appendChild(clear);
    nav.appendChild(qv);
    knop.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (open) { sluitLade(); return; }
      openLade();
      if (gestart()) return;
      startTool();
      // De tool weigerde (melding "werkt alleen met de Rit overzicht in beeld"): geen lege lade laten staan.
      if (!inhoud.childNodes.length) sluitLade();
    });
    // Elke wijziging in de lade: stip bijwerken (de tool tekent ook als de lade dicht is).
    new MutationObserver(stip).observe(inhoud, { childList: true });
    setTimeout(icoonControle, 800);
    uitlijnen();
    console.info(LOG + ' knop staat onder de ' + nativeKnoppen().length + ' knoppen van DireXtion');
  }

  function icoonControle() {
    if (!knop || knop.querySelector('svg[data-icon="tags"]:not(.missing)')) return;
    var oud = knop.querySelectorAll('i, svg');
    for (var i = 0; i < oud.length; i++) oud[i].remove();
    knop.insertAdjacentHTML('afterbegin', ICOON_SVG);
  }

  function nativeKnoppen() {
    return [].filter.call(nav.querySelectorAll('.quick-view-activator'), function (a) { return a !== knop && !qv.contains(a) && zichtbaar(a); });
  }

  // Dicht: precies onder de laatste knop van DireXtion, met dezelfde tussenruimte.
  function uitlijnen() {
    if (!knop || open) return;
    var nat = nativeKnoppen();
    if (!nat.length) return;
    var laatste = nat[nat.length - 1].getBoundingClientRect();
    var ruimte = 2;
    if (nat.length > 1) { var a = nat[0].getBoundingClientRect(), b = nat[1].getBoundingClientRect(); ruimte = Math.max(0, Math.round(b.top - a.bottom)); }
    var r = knop.getBoundingClientRect();
    var dy = Math.round(laatste.bottom + ruimte - r.top), dx = Math.round(laatste.left - r.left);
    if (!dy && !dx) return;
    var cs = getComputedStyle(knop);
    knop.style.top = ((parseFloat(cs.top) || 0) + dy) + 'px';
    if (dx) knop.style.left = ((parseFloat(cs.left) || 0) + dx) + 'px';
  }

  // Open: de knop rijdt mee naar de rechterkant van het paneel, 10px onder de bovenkant.
  function plaatsKnop() {
    var oud = knop.style.transform;
    knop.style.transition = 'none';
    knop.style.transform = '';
    var a = knop.getBoundingClientRect();
    knop.style.transform = oud;
    void knop.offsetWidth;
    knop.style.transition = zonderBeweging() ? 'none' : 'transform ' + (open ? IN_MS : UIT_MS) + 'ms ' + (open ? 'cubic-bezier(0.2, 0, 0, 1)' : 'cubic-bezier(0.4, 0, 1, 1)');
    if (open) {
      // left loopt nog (transition): rekenen vanaf het eindpunt, niet vanaf waar het paneel nu is.
      var pr = paneel.getBoundingClientRect();
      var basis = pr.left - (parseFloat(getComputedStyle(paneel).left) || 0);
      var dx = Math.round(basis + paneel.offsetWidth - a.left);
      var dy = Math.round(pr.top + 10 - a.top);
      knop.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      knop.style.zIndex = '1000';
    } else {
      knop.style.transform = '';
      knop.style.zIndex = '';
    }
  }

  // Zo hoog als er ruimte is onder de bovenkant van het paneel.
  function hoogte() {
    inhoud.style.maxHeight = Math.max(200, window.innerHeight - paneel.getBoundingClientRect().top - 30) + 'px';
  }

  function stip() {
    if (qv) qv.classList.toggle('ds-sa-wacht', !open && gestart());
  }

  function openLade() {
    if (!qv) return;
    if (open) return;
    sluitAndere();
    open = true;
    clearTimeout(sluitTimer);
    paneel.style.visibility = '';
    hoogte();
    paneel.style.transition = zonderBeweging() ? 'none' : 'left ' + IN_MS + 'ms cubic-bezier(0.2, 0, 0, 1)';
    void paneel.offsetWidth;
    paneel.style.left = '0px';
    plaatsKnop();
    stip();
  }

  function sluitLade() {
    if (!qv || !open) return;
    open = false;
    paneel.style.transition = zonderBeweging() ? 'none' : 'left ' + UIT_MS + 'ms cubic-bezier(0.4, 0, 1, 1)';
    paneel.style.left = -(BREED + 10) + 'px';
    clearTimeout(sluitTimer);
    sluitTimer = setTimeout(function () { if (!open) paneel.style.visibility = 'hidden'; }, UIT_MS + 30);
    plaatsKnop();
    stip();
  }

  // Eén lade tegelijk. Een paneel van DireXtion staat open als het ver genoeg in
  // beeld is geschoven (dicht: left -510px); dan op zijn eigen knop klikken.
  function sluitAndere() {
    [].forEach.call(nav.querySelectorAll('.quick-view'), function (q) {
      if (q === qv) return;
      var c = q.querySelector('.quick-view-content'), k = q.querySelector('.quick-view-activator');
      if (!c || !k || !zichtbaar(c)) return;
      if (c.getBoundingClientRect().right > 60) { try { k.click(); } catch (e) {} }
    });
  }

  function koppelBalk() {
    // Een andere knop in de balk = onze lade weg (zoals het vergrootglas in Basic).
    nav.addEventListener('click', function (e) {
      var k = e.target && e.target.closest && e.target.closest('.quick-view-activator');
      if (k && k !== knop && open) sluitLade();
    }, true);
    window.addEventListener('resize', function () {
      if (open) { hoogte(); plaatsKnop(); }
      else uitlijnen();
    });
    // Knoppen van DireXtion die later verschijnen of verschuiven: af en toe opnieuw meten.
    setInterval(function () { if (qv && qv.isConnected) uitlijnen(); }, 1500);
  }

  // ── Start: wachten op nav#navLeft met de knoppen van DireXtion ────────────
  var pogingen = 0;
  (function zoek() {
    nav = document.getElementById('navLeft');
    if (nav && nav.querySelector('.quick-view-activator')) {
      if (!document.getElementById(ID)) { bouw(); koppelBalk(); }
      return;
    }
    if (++pogingen === 40) console.warn(LOG + ' nav#navLeft met knoppen nog niet gevonden; ik blijf kijken');
    setTimeout(zoek, 250);
  })();
})();
