/* ─────────────────────────────────────────────────────────────
   PLANNING-INSTELLINGEN — vaste instellingen in de planningsmodule
   Draait op coolblue.dirextion.nl/ModulePlanningBeta.

   Leesbare versie van de losse bookmarklet "planning refresh"
   (planning refresh/planning_refresh.gs). Wordt geladen door de
   combi-loader (loader-planning-combi-bookmarklet.js), samen met
   laadvermogen.js. De losse bookmarklet blijft ongewijzigd bestaan.

   WAT HET ZET
   - Vinkjes "rit op kaart" en "visit op kaart" (showTourOnMap,
     showVisitOnMap) aan, met een echte klik, ook als ze pas later
     verschijnen (v1.2.0).
   - Kanaalfilter op 2mans levering (id 16), via FilterChannel.SetValue
     (v1.1.0). Staat er al een Rit overzicht, dan #quick-refresh; dat
     triggert een callback van TourGrid, en laadvermogen.js hangt aan
     EndCallback en past zich daarna vanzelf opnieuw toe.
   - Auto-reload aan.
   - Werkperiode 3 uur, eerste pauze 20 minuten.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var PLANNING_VERSION = '1.2.0';

  if (!/ModulePlanningBeta/i.test(location.href)) return;

  function vm(selector, ctx) {
    var el = document.querySelector(selector);
    if (!el || !window.ko) return null;
    var c = ko.contextFor(el);
    return c ? c[ctx] : null;
  }

  // Vinkjes "Op map tonen?" bij Rit overzicht (showTourOnMap) en bij
  // Ongeplande visits (showVisitOnMap).
  // - Echt klikken (v1.2.0). Tot v1.1.0: checked = true + een change-event.
  //   Knockout werkt zijn model bij op een klik, niet op change: het vinkje
  //   stond er dan wel, maar de kaart deed niets.
  // - Wachten tot het vinkje er is. Dat bij Rit overzicht verschijnt pas na het
  //   kiezen van een depot; automatisch bij het laden (Tampermonkey) was het er
  //   nog niet. Geen tijdslimiet: een depot kiezen kan minuten later zijn.
  // - Per vinkje-element één keer. Haalt de gebruiker het daarna weg, dan
  //   blijft het weg; tekent DireXtion het opnieuw (nieuw element), dan wordt
  //   het opnieuw aangezet.
  var VINKJES = ['showTourOnMap', 'showVisitOnMap'];
  function zetVinkjes() {
    VINKJES.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__dsGezet) return;
      el.__dsGezet = true;
      if (!el.checked) el.click();
    });
  }
  zetVinkjes();
  if (window.__planningVinkjes) window.__planningVinkjes.disconnect();
  var tik = null;
  window.__planningVinkjes = new MutationObserver(function () {
    if (tik) return;
    tik = setTimeout(function () { tik = null; zetVinkjes(); }, 300);
  });
  window.__planningVinkjes.observe(document.body, { childList: true, subtree: true });

  // Kanaal via de API van de DevExpress-combobox (zoals schuifalias.js), niet
  // meer door de verborgen input te beschrijven en ETextChanged af te vuren.
  // Die oude route werkte alleen als de pagina al helemaal klaar was (klik
  // ná het kiezen van een depot); automatisch bij het laden (Tampermonkey)
  // brak hij het opzoeken van een depot. SetValue vuurt geen callback af:
  // staat er al een Rit overzicht, dan verversen we zelf via #quick-refresh,
  // net als de knop in de pagina.
  var ch = window.FilterChannel;
  if (ch && typeof ch.SetValue === 'function' && typeof ch.GetValue === 'function') {
    if (String(ch.GetValue()) !== '16') {
      ch.SetValue('16');
      if (String(ch.GetValue()) !== '16') console.warn('[Planning-instellingen] kanaal 2mans levering (16) niet te kiezen');
      else if (window.TourGrid) {
        var ververs = document.getElementById('quick-refresh');
        if (ververs) ververs.click();
      }
    }
  } else {
    var hidden = document.getElementById('FilterChannel_VI');
    var display = document.getElementById('FilterChannel_I');
    if (hidden && display) {
      hidden.value = '16';
      display.value = '2mans levering';
      if (typeof ASPx !== 'undefined') ASPx.ETextChanged('FilterChannel');
    }
  }

  var root = vm('[data-bind*="toggleAutoReload"]', '$root');
  if (root && typeof root.autoReload === 'function' && !root.autoReload()) root.toggleAutoReload();

  var uren = vm('select[data-bind*="workingPeriodHours"]', '$data');
  if (uren && typeof uren.workingPeriodHours === 'function') uren.workingPeriodHours(3);

  var pauze = vm('select[data-bind*="firstWorkingBreakPeriodMinutes"]', '$data');
  if (pauze && typeof pauze.firstWorkingBreakPeriodMinutes === 'function') pauze.firstWorkingBreakPeriodMinutes(20);

  console.log('[Planning-instellingen] v' + PLANNING_VERSION + ' toegepast');
})();
