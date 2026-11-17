// ==UserScript==
// @name         DS Tools — Same day / Next day in Opmerkingen
// @namespace    https://baseijsercb.github.io/DS-Tools/
// @version      1.1.0
// @description  Knoppen "Same day" en "Next day" in de balk Opmerkingen van een order in DireXtion Basic: één klik voegt de vaste opmerking toe en slaat op.
// @match        https://coolblue.dirextion.nl/Basic/*
// @match        https://coolblue.dirextion.nl/basic/*
// @match        https://coolblue.dirextion.nl/BASIC/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/opmerking/opmerking-knoppen.user.js
// @updateURL    https://raw.githubusercontent.com/BasEijserCB/DS-Tools/main/opmerking/opmerking-knoppen.user.js
// ==/UserScript==

/* Same day text / Next day text als knoppen in de balk "Opmerkingen" van een
   geopende order, naast de titel. Een klik doet precies wat de chips in de
   DS Tools-balk doen: op de + van de opmerkingen klikken, het veld Remark
   vullen en op Opslaan drukken.

   De invullogica (opmerkingTekst) is een LETTERLIJKE KOPIE van de functie in
   launcher/launcher.js. Er is geen apart bestand om allebei te laten laden:
   de launcher heeft hem inline. Wijzigt hij daar, dan hier ook (en @version
   ophogen).

   Eigen toevoegingen:
   - Staat precies die tekst al bij de opmerkingen, dan eerst een bevestiging:
     een knop in de balk is sneller per ongeluk geklikt dan een chip in DS Tools.
   - De knoppen staan ~4 s uit na een klik (geen dubbele opmerking bij dubbelklik).
   - Klikken op een knop klapt de sectie niet in: muis-/aanwijzerevents stoppen
     bij de knoppen.

   Basic wisselt van order zonder nieuwe pagina en tekent de secties dan
   opnieuw; een MutationObserver zet de knoppen terug zodra de balk er weer is.
   @grant none: de invullogica heeft ASPx van de pagina nodig. */
(function () {
  'use strict';

  var VERSIE = '1.1.0';
  var ID = 'ds-opmerking-knoppen';
  var TEKSTEN = [
    { naam: 'Same day', tekst: 'Wordt al opgelost, via nieuw bezoek van bezorger(s) op dezelfde dag' },
    { naam: 'Next day', tekst: 'Vervolg stop al ingepland door Delivery Support' }
  ];

  console.info('[DS Opmerking userscript] v' + VERSIE + ' actief op ' + location.pathname);
  var vorigeToestand = '';
  function toestand(t) { if (t === vorigeToestand) return; vorigeToestand = t; console.info('[DS Opmerking userscript] ' + t); }

  // ── Invullogica: kopie van opmerkingTekst() uit launcher/launcher.js ──────
  // Klikt op +, vult Remark en drukt op Opslaan. Niet hier verbeteren.
  function opmerkingTekst(TXT) {function C(n){try{return ASPx.GetControlCollection().Get(n);}catch(e){return null;}}function memo(){var t=document.getElementById('Remark_I');return(t&&t.offsetParent!==null)?t:null;}function vis(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;}function waitFor(fn,ms,cb){var t0=Date.now();(function l(){var r=fn();if(r)return cb(r);if(Date.now()-t0>ms)return cb(0);setTimeout(l,100);})();}function ensureBox(cb){if(memo())return cb(1);var p=[].slice.call(document.querySelectorAll('svg[data-icon="plus"]')).filter(vis)[0];if(!p){alert('Geen + gevonden op de pagina.');return cb(0);}(p.closest('a,button,[onclick],[role=button],td,div[id]')||p).click();waitFor(memo,6000,function(ok){if(!ok)alert('Remark-veld verscheen niet op tijd.');cb(ok);});}function fire(ev,s,a){try{if(ev&&ev.FireEvent){ev.FireEvent(s,a||{});}}catch(e){}}function fill(t){var ta=memo();if(!ta)return 0;var c=C('Remark');ta.focus();ta.select();var ty=false;try{ty=document.execCommand('insertText',false,t);}catch(e){}if(!ty||ta.value!==t){var s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;s.call(ta,t);ta.dispatchEvent(new InputEvent('input',{bubbles:true,data:t,inputType:'insertText'}));}ta.dispatchEvent(new KeyboardEvent('keyup',{key:'a',keyCode:65,which:65,bubbles:true}));if(c){try{if(c.SetText)c.SetText(t);}catch(e){}fire(c.KeyUp,c,{htmlEvent:{keyCode:65}});fire(c.TextChanged,c,{});fire(c.ValueChanged,c,{});}try{ASPx.EKeyUp('Remark',{keyCode:65});}catch(e){}try{ASPx.EValueChanged('Remark');}catch(e){}ta.dispatchEvent(new Event('change',{bubbles:true}));return 1;}function btnRoot(){var cd=document.getElementById('btnUpdate_CD');if(cd)return document.getElementById('btnUpdate')||cd.parentElement||cd;var s=[].slice.call(document.querySelectorAll('span.dx-vam')).filter(function(x){return x.textContent.trim().toLowerCase()=='opslaan'&&vis(x);})[0];return s?(s.closest('div[id]')||s):null;}function isDis(r){var i=document.getElementById('btnUpdate_I');if(i&&i.disabled)return true;for(var e=r;e&&e!==document.body;e=e.parentElement){if(e.disabled===true)return true;if(e.getAttribute&&e.getAttribute('aria-disabled')==='true')return true;if(typeof e.className=='string'&&/disabled/i.test(e.className))return true;}return false;}function doClick(r){var b=C('btnUpdate');if(b&&b.DoClick){try{b.DoClick();return;}catch(e){}}var i=document.getElementById('btnUpdate_I');if(i){i.click();return;}r.click();}function save(t){var r=btnRoot();if(!r){alert('Opslaan-knop niet gevonden');return;}waitFor(function(){return isDis(r)?0:1;},2000,function(ok){if(ok)return doClick(r);var c=C('Remark');var sy=c&&c.GetText?(c.GetText()===t):(memo()&&memo().value===t);if(!sy){alert('Tekst niet goed doorgekomen — controleer het veld en sla zelf op.');return;}var b=C('btnUpdate');if(b&&b.SetEnabled){try{b.SetEnabled(true);}catch(e){}}var i=document.getElementById('btnUpdate_I');if(i)i.disabled=false;for(var e=r;e&&e!==document.body;e=e.parentElement){if(typeof e.className=='string'&&/disabled/i.test(e.className))e.className=e.className.replace(/\S*[Dd]isabled\S*/g,'').trim();}doClick(r);});}ensureBox(function(ok){if(ok&&fill(TXT))setTimeout(function(){save(TXT);},300);});}

  // ── De balk "Opmerkingen" vinden ─────────────────────────────
  function zichtbaar(el) { return !!el && el.getClientRects().length > 0; }
  function vet(el) { var w = getComputedStyle(el).fontWeight; return w === 'bold' || (parseInt(w, 10) || 400) >= 600; }

  // De titel is een tekstknoop "Opmerkingen". Datzelfde woord staat ook als
  // veldlabel in de middelste kolom (Order eigenschappen → Opmerkingen: -);
  // dat is een .details-field, en grijs in plaats van vet. Voorkeur: binnen
  // .details-content-header (zoals de andere sectiekoppen van Basic), dan vet,
  // en bij gelijkspel de laatste vóór de + van de opmerkingentabel.
  function opmerkingenTitel() {
    var kandidaten = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeValue.trim() === 'Opmerkingen' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
    });
    while (w.nextNode()) {
      var el = w.currentNode.parentElement;
      if (!el || el.closest('#' + ID)) continue;
      if (el.closest('.details-field, [role="dialog"], .dx-overlay-content, .dxpcLite, .dxpc-mainDiv')) continue;
      if (!zichtbaar(el)) continue;
      kandidaten.push({ knoop: w.currentNode, el: el, score: (el.closest('.details-content-header') ? 2 : 0) + (vet(el) ? 1 : 0) });
    }
    if (!kandidaten.length) return null;
    var max = Math.max.apply(null, kandidaten.map(function (k) { return k.score; }));
    kandidaten = kandidaten.filter(function (k) { return k.score === max; });
    var plus = [].slice.call(document.querySelectorAll('svg[data-icon="plus"]')).filter(zichtbaar)[0];
    if (plus && kandidaten.length > 1) {
      var voor = kandidaten.filter(function (k) { return k.el.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING; });
      if (voor.length) return voor[voor.length - 1];
    }
    return kandidaten[0];
  }

  // ── Knoppen ──────────────────────────────────────────────────
  // Zelfde accent als de knoppen van logboek-basic.user.js: licht oranje vlak,
  // dun fel oranje randje. Klein, zodat de balk niet hoger wordt.
  function stijl() {
    if (document.getElementById(ID + '-stijl')) return;
    var s = document.createElement('style');
    s.id = ID + '-stijl';
    s.textContent =
      '#' + ID + '{display:inline-flex;align-items:center;gap:6px;vertical-align:middle;' +
        'font-weight:normal;text-transform:none;letter-spacing:normal;white-space:nowrap;line-height:normal;}' +
      '#' + ID + ' button{font-family:inherit;font-size:11px;font-weight:400;line-height:16px;height:20px;' +
        'margin:0;padding:0 8px;border:1px solid #ff8c1a;border-radius:2px;background:#fdf0e4;color:#333;' +
        'cursor:pointer;box-shadow:none;text-transform:none;}' +
      '#' + ID + ' button:hover{background:#fbe1c8;}' +
      '#' + ID + ' button:disabled{opacity:.55;cursor:default;}';
    (document.head || document.documentElement).appendChild(s);
  }

  // Staat deze tekst al als opmerking op de pagina? (Ons eigen element en
  // invulvelden tellen niet.)
  function staatErAl(tekst) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeValue.indexOf(tekst) !== -1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
    });
    while (w.nextNode()) {
      var el = w.currentNode.parentElement;
      if (!el || el.closest('#' + ID + ', textarea, input, script, style')) continue;
      if (zichtbaar(el)) return true;
    }
    return false;
  }

  var bezig = false;
  function klik(item, groep) {
    if (bezig) return;
    if (staatErAl(item.tekst) &&
        !confirm('Deze opmerking staat al bij de order:\n\n"' + item.tekst + '"\n\nNog een keer toevoegen?')) return;
    bezig = true;
    var knoppen = groep.querySelectorAll('button');
    for (var i = 0; i < knoppen.length; i++) knoppen[i].disabled = true;
    try { opmerkingTekst(item.tekst); }
    catch (e) { console.error('[DS Opmerking userscript] invullen gaf een fout:', e); }
    setTimeout(function () {
      bezig = false;
      for (var i = 0; i < knoppen.length; i++) knoppen[i].disabled = false;
    }, 4000);
  }

  function maakGroep() {
    var groep = document.createElement('span');
    groep.id = ID;
    // De balk klapt (waarschijnlijk) in bij een klik: niets laten doorlopen.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend'].forEach(function (t) {
      groep.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    TEKSTEN.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.naam;
      b.title = 'Opmerking toevoegen en opslaan:\n"' + item.tekst + '"';
      b.addEventListener('click', function (e) { e.preventDefault(); klik(item, groep); });
      groep.appendChild(b);
    });
    return groep;
  }

  // ── Plaatsen: rechts in de balk, links van het pijltje (v1.1.0) ──────────
  // De opbouw van de balk is niet vastgelegd, dus alles op meting.
  function rect(el) { return el.getBoundingClientRect(); }
  // De tekst "Opmerkingen" zelf, niet zijn element: een <p> in een blokbalk is
  // even breed als de hele balk.
  function tekstRect(titel) {
    try {
      var r = document.createRange();
      r.selectNodeContents(titel.knoop);
      var x = r.getBoundingClientRect();
      if (x.width) return x;
    } catch (e) {}
    return rect(titel.el);
  }
  function beschrijf(el) { return el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''); }

  // De balk: van de titel (of .details-content-header, de sectiekop van Basic)
  // omhoog zolang de ouder nog één balk hoog is. De sectie zelf is hoger, want
  // daar hoort de tabel bij.
  function balkVan(titelEl) {
    var max = Math.max(48, rect(titelEl).height * 2.2);
    var balk = titelEl.closest('.details-content-header') || titelEl;
    while (balk.parentElement && balk.parentElement !== document.body && rect(balk.parentElement).height <= max) balk = balk.parentElement;
    return balk;
  }

  // Het pijltje (inklappen): het meest rechtse lege, kleine element in de balk,
  // rechts van de titel en op dezelfde hoogte. Van daar omhoog zolang de ouder
  // ook leeg is (bijv. <a><svg>), zodat we naast het hele knopje komen.
  function pijltjeIn(balk, titel) {
    var titelEl = titel.el, t = tekstRect(titel), midden = (t.top + t.bottom) / 2, beste = null, besteRechts = -Infinity;
    var els = balk.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest('#' + ID) || el.contains(titelEl) || el.textContent.trim()) continue;
      var r = rect(el);
      if (r.width < 4 || r.width > 48 || r.left < t.right || r.top > midden || r.bottom < midden) continue;
      if (r.right > besteRechts) { besteRechts = r.right; beste = el; }
    }
    while (beste && beste.parentElement && beste.parentElement !== balk &&
           !beste.parentElement.textContent.trim() && !beste.parentElement.contains(titelEl)) beste = beste.parentElement;
    return beste;
  }

  function plaats(titel) {
    stijl();
    var groep = maakGroep();
    var balk = balkVan(titel.el);
    var pijl = pijltjeIn(balk, titel);
    var bak = pijl ? pijl.parentElement : balk;
    var flex = /flex/.test(getComputedStyle(bak).display);
    if (flex) {
      // Flex: margin-left:auto duwt de knoppen (en het pijltje erachter) naar rechts.
      bak.insertBefore(groep, pijl);
      groep.style.marginLeft = 'auto';
      groep.style.alignSelf = 'center';
    } else {
      // Blok: rechts laten zweven. Zweeft het pijltje zelf ook rechts, dan
      // erachter in de DOM (komt dan links ervan); anders vooraan in de bak.
      groep.style.cssFloat = 'right';
      if (pijl && getComputedStyle(pijl).cssFloat === 'right') bak.insertBefore(groep, pijl.nextSibling);
      else bak.insertBefore(groep, bak.firstChild);
    }
    if (pijl) groep.style.marginRight = '8px';

    // Nameten. Overlapt het pijltje (bijv. absoluut gepositioneerd), dan opzij.
    var g = rect(groep);
    if (pijl) {
      var p = rect(pijl);
      if (g.right > p.left - 4 && g.left < p.right) {
        groep.style.marginRight = (8 + g.right - p.left + 8) + 'px';
        g = rect(groep);
      }
    }
    // Op één lijn met de titel (relatief: verschuift niets anders).
    var t = tekstRect(titel), dy = Math.round((t.top + t.bottom) / 2 - (g.top + g.bottom) / 2);
    if (Math.abs(dy) > 1 && Math.abs(dy) < 30) { groep.style.position = 'relative'; groep.style.top = dy + 'px'; }

    // Valt hij buiten de balk (naar een volgende regel), dan terug naast de titel.
    var b = rect(balk);
    g = rect(groep);
    if (g.width === 0 || g.top + g.height / 2 > b.bottom || g.left < t.right) {
      groep.removeAttribute('style');
      groep.style.marginLeft = '14px';
      titel.el.insertBefore(groep, titel.knoop.nextSibling);
      toestand('knoppen naast de titel Opmerkingen (rechts in de balk paste niet; balk ' + beschrijf(balk) + ')');
      return;
    }
    toestand('knoppen rechts in de balk Opmerkingen (balk ' + beschrijf(balk) + ', ' + (flex ? 'flex' : 'blok') +
      ', pijltje: ' + (pijl ? beschrijf(pijl) : 'geen') + ')');
  }

  function zoek() {
    var bestaand = document.getElementById(ID);
    if (bestaand && zichtbaar(bestaand)) return;
    if (bestaand) bestaand.remove();
    var titel = opmerkingenTitel();
    if (!titel) { toestand('geen balk Opmerkingen in beeld (geen order open?)'); return; }
    plaats(titel);
  }

  var timer = null;
  new MutationObserver(function () {
    if (timer) return;
    timer = setTimeout(function () { timer = null; zoek(); }, 250);
  }).observe(document.body, { childList: true, subtree: true });
  zoek();
})();
