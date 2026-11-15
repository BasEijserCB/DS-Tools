// ==UserScript==
// @name         DS Tools — DS Plakken in de Order wizard
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.2.0
// @description  Zet in de Order wizard (service-order) een knop "Plakken uit DS Logboek" onder Order sjabloon.
// @match        https://coolblue.dirextion.nl/Import/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/plakken/ds-plakken.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/plakken/ds-plakken.user.js
// ==/UserScript==

/* Dunne starter, geen tool: de invullogica staat in paste-bookmarklet.js en
   wordt net als in de launcher en de paste-loader met stale-while-revalidate
   opgehaald, onder dezelfde cache-sleutel (ds_paste_prod_cache).

   Wat dit script zelf doet: zodra de Order wizard opent, zet het onder het
   blok "Opties" een eigen blok "DS Logboek" met een DevExtreme-knop. Kop en
   blok nemen de klassen over van "Opties", de knop is een echte dxButton —
   zo ziet het eruit als DireXtion zelf, ook als DireXtion zijn stijl wijzigt.

   Klik = gebruikersactie, dus het klembord mag gelezen worden. Eerst kijkt dit
   script zelf of er een geldige DS Logboek-payload op staat (anders een melding
   in het blok i.p.v. stilte), daarna draait de gecachete paste-code synchroon.

   @grant none: de paste-code heeft jQuery en DevExtreme van de pagina nodig. */
(function () {
  'use strict';

  var SRC = 'https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/paste-bookmarklet.js';
  var CACHE = 'ds_paste_prod_cache';
  var MARKER = 'ds-plakken-blok';
  var GELDIG_MS = 5 * 60 * 1000;   // gelijk aan paste-bookmarklet.js

  function kaal(code) { return code && code.indexOf('javascript:') === 0 ? code.slice(11) : code; }
  function leesCache() { try { return localStorage.getItem(CACHE); } catch (e) { return null; } }
  function bewaar(code) {
    try { localStorage.setItem(CACHE, code); }
    catch (e) { try { localStorage.removeItem(CACHE); localStorage.setItem(CACHE, code); } catch (e2) {} }
  }

  // Bij het laden van de pagina de cache verversen, zodat een klik direct en
  // synchroon de jongste code heeft. Nieuwe versie geldt vanaf de volgende lading.
  var verseCode = null;
  fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (code) {
      code = kaal(code);
      verseCode = code;
      if (code && code !== leesCache()) bewaar(code);
    })
    .catch(function (e) { console.error('[DS Plakken userscript] ophalen mislukt:', e); });

  function haalCode() {
    var c = leesCache() || verseCode;
    if (c) return Promise.resolve(c);
    return fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (code) { code = kaal(code); bewaar(code); return code; });
  }

  // ── Het blok in de wizard ─────────────────────────────────────
  function leafMetTekst(root, tekst) {
    var els = root.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      if (els[i].children.length === 0 && els[i].textContent.trim() === tekst) return els[i];
    }
    return null;
  }

  function zetStatus(el, tekst, soort) {
    var kleur = { ok: '#155724', fout: '#E50000', bezig: '#999999' }[soort] || '#333333';
    el.style.color = kleur;
    el.textContent = tekst;
  }

  function plakken(knop, status) {
    zetStatus(status, 'Klembord lezen…', 'bezig');
    // readText() meteen aanroepen, nog binnen de klik.
    var lezen;
    try { lezen = navigator.clipboard.readText(); }
    catch (e) { lezen = Promise.reject(e); }

    lezen.then(function (tekst) {
      var d = null;
      try { d = JSON.parse(tekst); } catch (e) {}
      if (!d || !d.time || !(d.orderNr || d.name || d.address)) {
        zetStatus(status, 'Geen order van DS Logboek op het klembord. Klik in het logboek op 📋 Klembord.', 'fout');
        return;
      }
      if (Date.now() - d.time > GELDIG_MS) {
        zetStatus(status, 'Klembord is ouder dan 5 minuten. Klik in het logboek opnieuw op 📋 Klembord.', 'fout');
        return;
      }
      return haalCode().then(function (code) {
        zetStatus(status, 'Bezig met invullen van ' + (d.name || d.orderNr || 'de order') + '… blijf even van het formulier af.', 'bezig');
        try { knop.option('disabled', true); } catch (e) {}
        var p;
        try { p = eval(code); }
        catch (e) { console.error('[DS Plakken userscript] paste-code faalt:', e); throw e; }
        return Promise.resolve(p).then(function () {
          zetStatus(status, '✓ Ingevuld: ' + (d.name || d.orderNr || '') + '. Controleer alle tabbladen voor je opslaat.', 'ok');
        });
      });
    }).catch(function (e) {
      var msg = /denied|permission|NotAllowed/i.test(String(e && (e.name + e.message)))
        ? 'Geen toegang tot het klembord. Sta klembordtoegang toe voor DireXtion en probeer opnieuw.'
        : 'Invullen mislukt: ' + (e && e.message || e);
      zetStatus(status, msg, 'fout');
    }).then(function () {
      try { knop.option('disabled', false); } catch (e) {}
    });
  }

  function injecteer(popup) {
    if (popup.querySelector('.' + MARKER)) return;
    var $ = window.jQuery;
    if (!$ || !$.fn.dxButton) return;

    // Het blok "Opties" (kop + inhoud) als voorbeeld nemen.
    var kop = leafMetTekst(popup, 'Opties');
    var groep = kop && kop.parentElement;
    if (!groep) return;
    var inhoudVoorbeeld = Array.prototype.find.call(groep.children, function (c) { return c !== kop; });

    var blok = document.createElement(groep.tagName);
    blok.className = groep.className + ' ' + MARKER;
    blok.style.marginTop = '24px';

    var nieuweKop = document.createElement(kop.tagName);
    nieuweKop.className = kop.className;
    nieuweKop.textContent = 'DS Logboek';
    blok.appendChild(nieuweKop);

    var inhoud = document.createElement('div');
    if (inhoudVoorbeeld) inhoud.className = inhoudVoorbeeld.className;
    blok.appendChild(inhoud);

    // Het enige teken dat dit een add-on is: de lijn onder de kop in DS Tools-oranje
    // (de toastkleur van DS Plakken). De lijn zit op de kop of bovenaan de inhoud,
    // afhankelijk van het thema; zet de kleur waar hij zit.
    var ORANJE = '#e67e22';
    var csKop = getComputedStyle(kop);
    var csInhoud = inhoudVoorbeeld ? getComputedStyle(inhoudVoorbeeld) : null;
    if (parseFloat(csKop.borderBottomWidth) > 0) {
      nieuweKop.style.borderBottomColor = ORANJE;
    } else if (csInhoud && parseFloat(csInhoud.borderTopWidth) > 0) {
      inhoud.style.borderTopColor = ORANJE;
    } else {
      nieuweKop.style.borderBottom = '1px solid ' + ORANJE;
    }

    // Eén formulierregel "Klembord: [knop]", gekloond van de regel "Order sjabloon"
    // zodat labelbreedte, uitlijning en marges van DireXtion zelf komen.
    var knopEl = document.createElement('div');
    var status = document.createElement('div');
    status.style.cssText = 'font-size:12px;margin-top:6px;line-height:1.4;';

    var sjabloon = popup.querySelector('input[id$="_orderTemplateId"]');
    var voorbeeldRij = sjabloon && sjabloon.closest('.dx-field-item');
    var rij = voorbeeldRij && voorbeeldRij.cloneNode(true);
    var labelTekst = rij && rij.querySelector('.dx-field-item-label-text');
    var veld = rij && rij.querySelector('.dx-field-item-content');
    if (rij && labelTekst && veld) {
      // Geen dubbele ids: paste-bookmarklet.js zoekt velden op het eind van hun id.
      rij.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); });
      rij.querySelectorAll('[for]').forEach(function (e) { e.removeAttribute('for'); });
      rij.querySelectorAll('.dx-field-item-required-mark').forEach(function (e) { e.remove(); });
      labelTekst.textContent = '🚀 Klembord:';   // 🚀 = icoon van DS Plakken in de launcher
      veld.innerHTML = '';
      veld.appendChild(knopEl);
      veld.appendChild(status);
      inhoud.appendChild(rij);
    } else {
      // Terugval als de opbouw anders is dan verwacht.
      inhoud.style.paddingTop = '12px';
      inhoud.appendChild(knopEl);
      inhoud.appendChild(status);
    }

    groep.parentNode.insertBefore(blok, groep.nextSibling);

    // Zelfde knop als "Volgende" en "Opslaan": wit, grijze rand, geen icoon.
    var knop = $(knopEl).dxButton({
      text: 'Plakken uit DS Logboek',
      type: 'normal',
      stylingMode: 'outlined',
      hint: 'Vult sjabloon, verlader, ontvanger, artikelen en service in vanuit het klembord van DS Logboek',
      onClick: function () { plakken(knop, status); }
    }).dxButton('instance');
  }

  // ── De wizard herkennen ───────────────────────────────────────
  // Het venster wordt bij elke opening (opnieuw) opgebouwd; daarom kijken we
  // naar elke DOM-wijziging, licht gedebounced.
  function zoek() {
    var sjablonen = document.querySelectorAll('input[id$="_orderTemplateId"]');
    for (var i = 0; i < sjablonen.length; i++) {
      // Het hele venster (met titel), niet .dx-popup-content: daar staat de titel buiten.
      var popup = sjablonen[i].closest('.dx-overlay-content') || sjablonen[i].closest('[role="dialog"], .modal');
      if (popup && popup.offsetParent !== null && /Order wizard/i.test(popup.textContent)) injecteer(popup);
    }
  }
  var timer = null;
  new MutationObserver(function () {
    if (timer) return;
    timer = setTimeout(function () { timer = null; zoek(); }, 200);
  }).observe(document.body, { childList: true, subtree: true });
  zoek();
})();
