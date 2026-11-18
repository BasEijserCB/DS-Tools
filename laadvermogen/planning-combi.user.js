// ==UserScript==
// @name         DS Tools — Planning-combi (automatisch)
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.4.4
// @description  Zet in de planningsmodule vanzelf de vaste instellingen en het echte laadvermogen uit Fleetio.
// @match        https://coolblue.dirextion.nl/ModulePlanningBeta*
// @match        https://coolblue.dirextion.nl/moduleplanningbeta*
// @match        https://coolblue.dirextion.nl/Moduleplanningbeta*
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

   Verschil met een klik: dit start tijdens het laden van de pagina. De twee
   delen starten daarom elk op hun eigen moment (v1.2.0; daarvoor wachtten
   ze samen op de grid):
   - planning-instellingen.js meteen, zodra de knoppen en velden er zijn.
     Die staan al in de pagina vóór er een depot gekozen is.
   - laadvermogen.js pas als window.TourGrid bestaat — en die bestaat pas
     als er een depot gekozen is. Zonder grid meldt laadvermogen.js met een
     alert dat hij alleen in de planningsmodule werkt. Hier wordt zonder
     tijdslimiet op gewacht: een depot kiezen kan minuten later zijn.

   Het planningssjabloon (GetTemplates) zet werkperiode en pauze asynchroon
   en kan de 3 uur / 20 min dus ná ons weer overschrijven. In plaats van
   daarop te wachten (v1.0.0 wachtte tot 10 s — te traag) kijken we
   SJABLOON_VENSTER_MS lang mee: wijzigt de werkperiode naar iets anders
   dan 3, dan draait planning-instellingen.js één keer opnieuw. Daarna
   niet meer, zodat een handmatige wijziging blijft staan.

   Vinkjes "Op map tonen?" (v1.4.0). planning-instellingen.js is
   ongewijzigd de code van de bookmarklet en werkt — op een pagina die klaar
   is. Bij het laden is dat niet zo: DireXtion hangt zijn afhandeling nog niet
   aan het vinkje bij Ongeplande visits (vinkje stond er, de kaart deed
   niets) en het vinkje bij Rit overzicht bestaat nog niet. Het moment regelen
   we hier, niet in planning-instellingen.js:
   - Een run vóórdat het Rit overzicht rijen heeft (bij laden, of de
     sjabloon-herhaling) zet de vinkjes die hij aanzette meteen terug. Anders
     slaat een latere run ze over ("staat al aan") en blijft het kapot.
   - Zodra het Rit overzicht rijen heeft (depot gekozen) draait
     planning-instellingen.js nog één keer, als een klik op de bookmarklet op
     een klare pagina. Daarvoor gaan beide vinkjes eerst netjes uit (v1.4.1),
     zodat elk vinkje een echte overgang uit → aan krijgt, ongeacht hoe het
     stond. Dat zet ook werkperiode en pauze opnieuw op 3 u / 20
     min, precies zoals die klik zou doen.

   @grant none: draait in de pagina zelf, want beide bestanden hebben ko,
   ASPx en TourGrid van de pagina nodig.

   Beide bestanden zijn veilig om twee keer te draaien: een klik op de
   bookmarklet of in de launcher daarna doet geen kwaad. */
(function () {
  'use strict';

  // DS Tools: dit script is ook een module van het Tampermonkey-script DS Tools
  // (launcher.js, lijst AUTO). Nooit dubbel: wie het eerst draait claimt de plek.
  if (window.__dsAuto && window.__dsAuto['auto-planning-combi']) return;
  (window.__dsAuto = window.__dsAuto || {})['auto-planning-combi'] = true;

  var BASE = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/laadvermogen/';
  var BESTANDEN = [
    { naam: 'Planning-instellingen', cache: 'ds_planning_combi_inst_cache', src: 'planning-instellingen.js' },
    { naam: 'Laadvermogen', cache: 'ds_planning_combi_lv_cache', src: 'laadvermogen.js' }
  ];
  var WACHT_VELDEN_MS = 10000;   // daarna instellingen toch draaien; ontbrekende velden slaat hij zelf over
  var SJABLOON_VENSTER_MS = 20000;
  var POLL_MS = 150;
  var POLL_GRID_MS = 300;

  function log(m) { console.log('[Planning-combi userscript] ' + m); }

  function draai(naam, code) {
    try { eval(code); return true; }
    catch (e) { console.error('[Planning-combi userscript] ' + naam + ' gaf een fout:', e); return false; }
  }

  // ── Moment voor de vinkjes (v1.4.0) ──
  var VINKJES = ['showTourOnMap', 'showVisitOnMap'];
  function ritRijen() { return !!document.querySelector('[id^="TourGrid"] tr.dxgvDataRow'); }   // alleen het Rit overzicht, niet Ongeplande visits

  // planning-instellingen.js draaien; is de pagina nog niet klaar, dan de
  // vinkjes die hij aanzette direct terugzetten (zonder event: DireXtion
  // luisterde nog niet, dus er valt niets terug te draaien).
  function draaiInstellingen(code) {
    var klaar = ritRijen();
    var voor = {};
    if (!klaar) VINKJES.forEach(function (id) { var el = document.getElementById(id); if (el) voor[id] = el.checked; });
    var ok = draai(BESTANDEN[0].naam, code);
    if (!klaar) VINKJES.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && voor[id] === false && el.checked) el.checked = false;
    });
    return ok;
  }

  // Zelfde stale-while-revalidate als de loader: gecachete versie direct,
  // verse versie in de achtergrond. Zonder (werkende) cache draait de verse
  // code zodra hij binnen is.
  function laad(b) {
    var cached = null;
    try { cached = localStorage.getItem(b.cache); } catch (e) {}
    var run = b === BESTANDEN[0] ? draaiInstellingen : function (code) { return draai(b.naam, code); };
    var gelukt = cached ? run(cached) : false;
    fetch(BASE + b.src + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (code) {
        if (!code || code === cached) return;
        try { localStorage.setItem(b.cache, code); }
        catch (e) { try { localStorage.removeItem(b.cache); localStorage.setItem(b.cache, code); } catch (e2) {} }
        if (!gelukt) run(code);
        else log(b.naam + ': nieuwe versie opgeslagen, actief vanaf de volgende keer');
      })
      .catch(function (e) { console.error('[Planning-combi userscript] ' + b.naam + ' ophalen mislukt:', e); });
  }

  // Komt het sjabloon ná ons binnen, dan de instellingen één keer opnieuw.
  function kijkNaarSjabloon() {
    var el = document.querySelector('select[data-bind*="workingPeriodHours"]');
    var vm = null;
    try { vm = el && window.ko ? window.ko.contextFor(el).$data : null; } catch (e) {}
    var obs = vm && vm.workingPeriodHours;
    if (!obs || typeof obs.subscribe !== 'function') return;
    var sub = obs.subscribe(function (v) {
      if (Number(v) === 3) return;
      sub.dispose();
      var code = null;
      try { code = localStorage.getItem(BESTANDEN[0].cache); } catch (e) {}
      if (code) { draaiInstellingen(code); log('sjabloon overschreef de werkperiode (' + v + ' u) — instellingen opnieuw gezet'); }
    });
    setTimeout(function () { try { sub.dispose(); } catch (e) {} }, SJABLOON_VENSTER_MS);
  }

  var begin = Date.now();
  function sinds() { return ((Date.now() - begin) / 1000).toFixed(1) + ' s'; }

  // Instellingen: zodra Knockout de knoppen gebonden heeft.
  // FilterChannel = de DevExpress-combobox zelf, niet alleen de input: die
  // bestaat pas als het besturingselement geïnitialiseerd is (v1.3.0).
  function veldenKlaar() {
    var ch = window.FilterChannel;
    if (!window.ko || !ch || typeof ch.GetValue !== 'function') return false;
    var el = document.querySelector('[data-bind*="toggleAutoReload"]');
    try { return !!(el && window.ko.contextFor(el)); } catch (e) { return false; }
  }
  (function wachtVelden() {
    if (!veldenKlaar() && Date.now() - begin < WACHT_VELDEN_MS) { setTimeout(wachtVelden, POLL_MS); return; }
    laad(BESTANDEN[0]);
    kijkNaarSjabloon();
    log('instellingen toegepast na ' + sinds());
  })();

  // Instellingen nog één keer zodra het Rit overzicht rijen heeft: dan is de
  // pagina net zo klaar als bij een klik op de bookmarklet, en bestaan beide
  // vinkjes. Geen tijdslimiet: een depot kiezen kan minuten later zijn.
  (function wachtRijen() {
    if (!ritRijen()) { setTimeout(wachtRijen, POLL_GRID_MS); return; }
    setTimeout(function () {   // even laten bijkomen na het tekenen van de grid
      var code = null;
      try { code = localStorage.getItem(BESTANDEN[0].cache); } catch (e) {}
      if (!code) { log('instellingen nog niet geladen — vinkjes niet gezet'); return; }
      // Eerst beide vinkjes netjes UIT (met change-event), zodat
      // planning-instellingen.js ze daarna echt van uit naar aan zet. Een
      // vinkje dat al aan stond zonder dat DireXtion het verwerkt had, sloeg
      // hij anders over ("staat al aan") — zo bleef dat bij Ongeplande visits
      // in v1.4.0 zichtbaar aan maar werkte het niet (v1.4.1).
      VINKJES.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.checked) {
          el.checked = false;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      draaiInstellingen(code);
      log('instellingen opnieuw toegepast nu het Rit overzicht gevuld is (' + sinds() + ')');
    }, 500);
  })();

  // Laadvermogen: pas als er een Rit overzicht is, dus na het kiezen van een depot.
  (function wachtGrid() {
    if (!(window.ko && window.TourGrid)) { setTimeout(wachtGrid, POLL_GRID_MS); return; }
    laad(BESTANDEN[1]);
    log('laadvermogen toegepast na ' + sinds());
  })();
})();
