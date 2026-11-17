// ==UserScript==
// @name         Coolblue Service Check
// @namespace    coolblue-delivery-support
// @version      2.3
// @description  Toont of services (zoals inbouwen) nu beschikbaar zijn. In DireXtion: haalt de Coolblue-pagina op de achtergrond op, zodat de bladwijzer het resultaat in DireXtion zelf toont. Op Coolblue: draait alleen als het adres #svc-auto bevat.
// @match        https://www.coolblue.nl/*
// @match        https://www.coolblue.be/*
// @match        https://www.coolblue.de/*
// @match        https://coolblue.dirextion.nl/*
// @grant        GM_xmlhttpRequest
// @connect      www.coolblue.nl
// @connect      www.coolblue.be
// @connect      www.coolblue.de
// @run-at       document-idle
// ==/UserScript==
// GENERATED from bookmarklet.js – edit that file, not this one.
(function () {
  'use strict';

  // ---- DireXtion: download helper for the bookmarklet --------------------
  // A normal web page may not read Coolblue pages (no CORS permission).
  // Tampermonkey may (GM_xmlhttpRequest + @connect). The bookmarklet asks via
  // window.postMessage({svcCheck:'request', id, url}); we answer with the HTML.
  if (/(^|\.)dirextion\.nl$/i.test(location.hostname)) {
    document.documentElement.setAttribute('data-svc-helper', '1');
    window.addEventListener('message', function (ev) {
      var m = ev.data;
      if (!m || m.svcCheck !== 'request' || ev.origin !== location.origin) return;
      // Only Coolblue product pages.
      if (!/^https:\/\/www\.coolblue\.(nl|be|de)\/(nl\/)?produ[ck]t\/\d{5,8}$/.test(String(m.url))) return;
      var reply = function (html, error) {
        window.postMessage({ svcCheck: 'response', id: m.id, html: html || '', error: error || '' }, location.origin);
      };
      GM_xmlhttpRequest({
        method: 'GET',
        url: m.url,
        timeout: 20000,
        onload: function (r) {
          if (r.status >= 200 && r.status < 300 && !/\/404\.html/.test(r.finalUrl || '')) reply(r.responseText, '');
          else reply('', 'HTTP ' + (/\/404\.html/.test(r.finalUrl || '') ? 404 : r.status));
        },
        onerror: function () { reply('', 'netwerkfout'); },
        ontimeout: function () { reply('', 'time-out'); }
      });
    });
    return;
  }

  // ---- Coolblue: run the check automatically when the address has #svc-auto
  if (!/svc-auto/.test(location.hash)) return;

  // The Service Check code (same as the bookmarklet).
  function runServiceCheck() {
    /**
     * Coolblue "Service Check" bookmarklet — readable version.
     *
     * Off Coolblue:  takes the selected text (or asks for it) and opens the
     *                Coolblue product page (if it is a product ID/URL) or a search.
     * On a search/listing page: jumps straight to the single non-combi product,
     *                or shows a list of candidates to choose from.
     * On a product page: finds the "Kies voor gemak" block, reads its options
     *                and shows whether extra services (installation, etc.) exist.
     */
    (function () {
      // Report errors instead of failing silently.
      try { main(); } catch (err) { alert('Service Check fout: ' + (err && err.message)); }

      function main() {
      // ---------------------------------------------------------------------------
      // Constants & helpers
      // ---------------------------------------------------------------------------
      // Coolblue addresses per country (same as the Service Check tool).
      // fragment = scroll-to-text on the product page ("Kies voor gemak").
      var COUNTRIES = {
        nl: { search: 'https://www.coolblue.nl/zoeken?query=',    product: 'https://www.coolblue.nl/product/',    fragment: '#:~:text=Kies voor gemak' },
        be: { search: 'https://www.coolblue.be/nl/zoeken?query=', product: 'https://www.coolblue.be/nl/product/', fragment: '#:~:text=Kies voor gemak' },
        de: { search: 'https://www.coolblue.de/suchen?query=',    product: 'https://www.coolblue.de/produkt/',    fragment: '#:~:text=Entscheide dich für Komfort' }
      };
      // AUTO_FRAGMENT = FRAGMENT plus the "#svc-auto" marker that starts the Tampermonkey script.
      var SEARCH_URL, PRODUCT_URL, FRAGMENT, AUTO_FRAGMENT;
      function setCountry(cc) {
        var c = COUNTRIES[cc] || COUNTRIES.nl;
        SEARCH_URL = c.search;
        PRODUCT_URL = c.product;
        FRAGMENT = c.fragment;
        AUTO_FRAGMENT = '#svc-auto' + c.fragment.replace(/^#/, '');
      }
      // On Coolblue itself: follow the site we're on. Elsewhere: NL until detected.
      setCountry(/\.be$/i.test(location.hostname) ? 'be' : /\.de$/i.test(location.hostname) ? 'de' : 'nl');

      function clean(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
      }

      // DireXtion: country from "Naam verlader" (e.g. "CoolblueBuilt-in DE"),
      // otherwise from the address in the order grid (e.g. "... - 65189 (DE)").
      // Returns 'nl', 'be', 'de' or null.
      function detectCountry(doc) {
        if (!doc) return null;
        var fields = doc.querySelectorAll('.details-field');
        for (var i = 0; i < fields.length; i++) {
          var label = fields[i].querySelector('.details-field-label');
          var value = fields[i].querySelector('.details-field-value');
          if (label && value && /naam\s+verlader/i.test(label.textContent)) {
            // The country is always the last 2 characters, e.g. "CoolblueBezorgt 2M NL".
            var m = clean(value.textContent).match(/(NL|BE|DE)$/);
            if (m) return m[1].toLowerCase();
          }
        }
        var grid = doc.querySelector('table[id^="OrdersGrid"][id$="_DXMainTable"]');
        var a = grid && clean(grid.textContent).match(/\((NL|BE|DE)\)/i);
        return a ? a[1].toLowerCase() : null;
      }

      // Extract a 5–8 digit product ID from a product URL or a bare number.
      function productId(text) {
        text = clean(text);
        var m = text.match(/\/produ[ck]t\/(\d{5,8})/i) || text.match(/^\s*(\d{5,8})\s*$/);
        return m ? m[1] : null;
      }

      function escapeHtml(text) {
        return text.replace(/[&<>]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
        });
      }

      // Text directly inside an element (excluding child elements).
      function ownText(el) {
        var t = '';
        for (var i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue;
        }
        return clean(t);
      }

      // DireXtion article grid(s) (DevExpress tables "..._DXMainTable" with an
      // "Omschrijving" column). Returns all real products as
      // [{ desc: 'Samsung WW11DB7B34GBU3', kind: 'Wasmachines', pid: '946999' }, ...].
      // Skips the Coolblue box ("Verzameldoos", PRD:0) and duplicates.
      function readDirextionArticles(doc) {
        var list = [];
        if (!doc) return list;
        var tables = doc.querySelectorAll('table[id$="_DXMainTable"]');

        for (var t = 0; t < tables.length; t++) {
          var headerRow = tables[t].querySelector('tr[id*="_DXHeadersRow"]');
          if (!headerRow) continue;

          // Find column positions by header text.
          var col = {};
          for (var c = 0; c < headerRow.cells.length; c++) {
            var ht = clean(headerRow.cells[c].innerText || headerRow.cells[c].textContent).toLowerCase();
            if (ht === 'omschrijving' || ht === 'code' || ht === 'artikelsoort') col[ht] = c;
          }
          if (col.omschrijving === undefined) continue;

          var rows = tables[t].querySelectorAll('tr[id*="_DXDataRow"]');
          for (var r = 0; r < rows.length; r++) {
            var cell = function (name) {
              var i = col[name];
              return i !== undefined && rows[r].cells[i] ? clean(rows[r].cells[i].textContent) : '';
            };
            var desc = cell('omschrijving');
            var kind = cell('artikelsoort');
            // "Code" PRD:903946 = Coolblue product number 903946 (in the order's country).
            var prd = cell('code').match(/^PRD\s*:\s*(\d+)$/i);
            var pid = prd && /^\d{5,8}$/.test(prd[1]) ? prd[1] : null;
            // Skip the Coolblue box (Verzameldoos / PRD:0).
            if (!desc || /verzameldoos/i.test(kind) || (prd && /^0+$/.test(prd[1]))) continue;
            var dupe = list.some(function (x) { return x.desc === desc; });
            if (!dupe) list.push({ desc: desc, kind: kind, pid: pid });
          }
        }
        return list;
      }

      // Small box on the DireXtion page to choose one of several products.
      function showPicker(items, onPick) {
        var old = document.getElementById('cb-svc-pick');
        if (old) old.remove();

        var box = document.createElement('div');
        box.id = 'cb-svc-pick';
        box.setAttribute('style',
          'position:fixed;top:16px;right:16px;z-index:2147483647;width:350px;max-height:80vh;overflow:auto;' +
          'background:#fff;color:#111;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.25);' +
          'font:14px/1.45 "Open Sans",Segoe UI,Arial,sans-serif');
        box.innerHTML =
          '<div style="background:#0090e3;color:#fff;padding:12px 14px;font-weight:800;font-size:16px;' +
            'display:flex;justify-content:space-between;align-items:center">' +
            '<span>SERVICE CHECK<span style="color:#ff6600">.</span></span>' +
            '<button type="button" data-x style="all:unset;cursor:pointer;font-size:20px;line-height:1;color:#fff;padding:0 4px">×</button>' +
          '</div>' +
          '<div style="padding:12px 14px"><p style="margin:0 0 8px"><b>Welk product wil je opzoeken?</b></p>' +
          '<ul style="margin:0;padding:0;list-style:none"></ul></div>';

        var ul = box.querySelector('ul');
        items.forEach(function (item) {
          var li = document.createElement('li');
          li.setAttribute('style', 'border-top:1px solid #ddd;padding:7px 0');
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('style', 'all:unset;cursor:pointer;color:#0090e3;font-weight:700;display:block');
          btn.textContent = item.desc + ' ›';
          li.appendChild(btn);
          if (item.kind) {
            var k = document.createElement('div');
            k.setAttribute('style', 'color:#555;font-size:13px');
            k.textContent = item.kind;
            li.appendChild(k);
          }
          btn.onclick = function () { box.remove(); onPick(item.desc, item.pid); };
          ul.appendChild(li);
        });

        box.querySelector('[data-x]').onclick = function () { box.remove(); };
        document.body.appendChild(box);
      }

      var host = location.hostname;

      // ---------------------------------------------------------------------------
      // Coolblue product page analysis
      // Works on the page itself (doc = document) and on a page downloaded by the
      // Tampermonkey helper (doc = parsed copy), so DireXtion can show the result.
      // ---------------------------------------------------------------------------
      // The product page is a Next.js page. Its data is embedded as
      // self.__next_f.push([1,"..."]) chunks. The services block is the component
      // "FormInstallationServices" with these lists:
      //   serviceData / individualMainServices  services offered
      //   disabledServices                      services switched off (seen empty so far)
      //   environmentalReturnServices           take away old appliance
      // Each service: { name, installServiceTypeId, enabled, active, isHidden, subServices }.
      // Checked on real pages in NL, BE and DE: installServiceTypeId 1 = built-in
      // installation, 19 = delivery over the doorstep (no service). A switched-off
      // built-in service is simply MISSING from the lists.
      var TYPE_BUILT_IN = 1;
      var TYPE_DOORSTEP = 19;
      // Type 14 = TV installation + wall mounting (NL "Tv installeren én ophangen",
      // DE "Fernseher installieren und aufhängen"). Its price excludes the wall bracket.
      var TYPE_TV_HANG = 14;
      var TV_HANG_NOTE = 'Prijs zonder muurbeugel. De beugel komt er nog bij.';

      // German pages: show Dutch service names (all tool users are Dutch).
      // Based on the service type (same in every country) plus the German name.
      // Dutch names as used on coolblue.nl. Unknown services stay German.
      function dutchServiceName(s) {
        var n = String(s.name || ''), type = s.installServiceTypeId;
        if (type === 19) return 'Drempellevering';
        if (type === 1 && /sp[üu]lmaschine|geschirrsp/i.test(n)) return 'Vaatwasser laten inbouwen';
        if (type === 1 && /k[üu]hlschrank/i.test(n) && !/gefrier/i.test(n)) return 'Koelkast laten inbouwen';
        if (type === 4 && /links/i.test(n)) return 'Draairichting deur aanpassen naar links';
        if (type === 12 && /mitnehm/i.test(n)) return 'Oude product meenemen';
        if (type === 13 && !/aufh[äa]ng/i.test(n)) return 'Tv installeren';
        if (type === 14) return 'Tv installeren én ophangen';
        return '';
      }
      var DUTCH_PLACEMENT = { einbau: 'Inbouw', freistehend: 'Vrijstaand' };
      var SERVICES_MARK = '"componentName":"FormInstallationServices"';
      // Words that mark a built-in appliance (NL / DE).
      var BUILT_IN_WORDS = /inbouw|einbau|integrier|ge[ïi]ntegreerd|integreerbaar|onderbouw|unterbau/i;

      function flightText(doc) {
        // 1) The <script> tags: they keep all data, also after the page has loaded.
        var parts = [];
        var scripts = doc.querySelectorAll('script');
        for (var i = 0; i < scripts.length; i++) {
          var m = (scripts[i].textContent || '').match(/^\s*self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?\s*$/);
          if (!m) continue;
          try { var arr = JSON.parse(m[1]); if (typeof arr[1] === 'string') parts.push(arr[1]); } catch (e) {}
        }
        var text = parts.join('');
        if (text.indexOf(SERVICES_MARK) >= 0 || doc !== document) return text;

        // 2) Fallback: self.__next_f (only complete before Coolblue's own JavaScript has started).
        parts = [];
        try {
          (window.__next_f || []).forEach(function (c) { if (c && typeof c[1] === 'string') parts.push(c[1]); });
        } catch (e) {}
        return parts.join('');
      }

      // Parse the JSON array that follows "key": at or after position `from`.
      function jsonArrayAfter(text, key, from) {
        var k = text.indexOf('"' + key + '":', from);
        if (k < 0) return null;
        var start = k + key.length + 3;
        if (text.charAt(start) !== '[') return null;
        var depth = 0, inStr = false;
        for (var i = start; i < text.length; i++) {
          var ch = text.charAt(i);
          if (inStr) {
            if (ch === '\\') i++;
            else if (ch === '"') inStr = false;
          } else if (ch === '"') inStr = true;
          else if (ch === '[' || ch === '{') depth++;
          else if (ch === ']' || ch === '}') {
            depth--;
            if (depth === 0) {
              try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; }
            }
          }
        }
        return null;
      }

      function readServiceData(doc) {
        var text = flightText(doc);
        var at = text.indexOf(SERVICES_MARK);
        if (at < 0) return null;
        var objects = function (list) {
          return (list || []).filter(function (s) { return s && typeof s === 'object' && s.name; });
        };
        var data = {
          offered: objects(jsonArrayAfter(text, 'serviceData', at)).concat(objects(jsonArrayAfter(text, 'individualMainServices', at))),
          disabled: objects(jsonArrayAfter(text, 'disabledServices', at)),
          takeBack: objects(jsonArrayAfter(text, 'environmentalReturnServices', at)),
          // Product property 8333 = placement: "Inbouw" / "Einbau" / "Vrijstaand" / ...
          // ("Plaatsing apparaat" in NL/BE, "Bauform" in DE). Same id in every country.
          placement: (text.match(/"propertyId":"8333","displayName":"[^"]*","value":"([^"]*)"/) || [])[1] || '',
          prices: readPrices(text)
        };
        return data.offered.length || data.disabled.length ? data : null;
      }

      // Prices per serviceId (incl. VAT). In serviceData the price is often only a
      // reference ("$1ce:...:salesPrice"); the real amounts are in the full
      // "services" list of the product component (also includes sub-services).
      function readPrices(text) {
        var prices = {};
        var collect = function (list) {
          (Array.isArray(list) ? list : []).forEach(function (s) {
            if (!s || typeof s !== 'object') return;
            if (s.serviceId != null && s.salesPrice && typeof s.salesPrice.includingVat === 'number') {
              prices[s.serviceId] = s.salesPrice.includingVat;
            }
            collect(s.subServices);
          });
        };
        var from = 0, k;
        while ((k = text.indexOf('"services":[{', from)) >= 0) {
          collect(jsonArrayAfter(text, 'services', k));
          from = k + 12;
        }
        return prices;
      }

      // 169 -> "€ 169,-" · 12.5 -> "€ 12,50" · 0 -> "gratis"
      function formatPrice(v) {
        if (typeof v !== 'number') return '';
        if (v === 0) return 'gratis';
        return '€ ' + (Math.round(v) === v ? v + ',-' : v.toFixed(2).replace('.', ','));
      }

      function isOn(s) { return s.enabled !== false && s.active !== false && s.isHidden !== true; }

      // Category path, e.g. ["Spülmaschinen", "Einbauspülmaschinen", ...].
      // Read from the page's structured data (BreadcrumbList), else from the breadcrumb bar.
      function readBreadcrumb(doc) {
        var names = [];
        var blocks = doc.querySelectorAll('script[type="application/ld+json"]');
        for (var i = 0; i < blocks.length && !names.length; i++) {
          try {
            var d = JSON.parse(blocks[i].textContent);
            (Array.isArray(d) ? d : [d]).forEach(function (x) {
              if (x && x['@type'] === 'BreadcrumbList') {
                (x.itemListElement || []).forEach(function (it) {
                  var n = it.name || (it.item && it.item.name);
                  if (n) names.push(String(n));
                });
              }
            });
          } catch (e) {}
        }
        if (!names.length) {
          var nav = doc.querySelector('nav[aria-label="Breadcrumbs"],nav[aria-label="Broodkruimels"],nav[aria-label*="readcrumb"]');
          if (nav) names = clean(nav.innerText || nav.textContent).split(/\s*[\n›>|]\s*/).filter(Boolean);
        }
        return names;
      }

      // Result box content for a product page: { html, status }, or null without service data.
      function serviceSummary(doc) {
        var serviceData = readServiceData(doc);
        if (!serviceData) return null;
        var h1 = doc.querySelector('h1');
        var productTitle = clean(h1 ? (h1.innerText || h1.textContent) : '');
        // Built-in appliance? Best signal: the placement property.
        // Fallback: product name + category path (the path alone is unreliable:
        // it sometimes shows a promotion like "Black Friday vaatwasser deals").
        var builtInProduct = serviceData.placement
          ? BUILT_IN_WORDS.test(serviceData.placement)
          : BUILT_IN_WORDS.test(productTitle + ' | ' + readBreadcrumb(doc).join(' | '));

        // German page? Then service names are translated to Dutch (see dutchServiceName).
        var german = /^de/i.test((doc.documentElement && doc.documentElement.lang) || '');
        var placementText = german && DUTCH_PLACEMENT[serviceData.placement.toLowerCase()] || serviceData.placement;

        var rows = [];      // { name, original, state: 'on' | 'off' | 'basic', level, price, note }
        var available = 0, builtInOn = false;
        // A service listed in disabledServices is off, even if it is also in the offered list.
        var disabledIds = {}, shown = {};
        serviceData.disabled.forEach(function (s) { if (s.serviceId != null) disabledIds[s.serviceId] = true; });
        var addRows = function (list, forcedOff, level) {
          list.forEach(function (s) {
            if (!s || typeof s !== 'object' || !s.name) return;
            if (s.serviceId != null) {
              if (shown[s.serviceId]) return;   // already listed
              shown[s.serviceId] = true;
            }
            var basic = s.installServiceTypeId === TYPE_DOORSTEP;
            var on = !forcedOff && !disabledIds[s.serviceId] && isOn(s);
            if (on && !basic) available++;
            if (on && s.installServiceTypeId === TYPE_BUILT_IN) builtInOn = true;
            var price = s.salesPrice && typeof s.salesPrice.includingVat === 'number'
              ? s.salesPrice.includingVat : serviceData.prices[s.serviceId];
            var tvHang = s.installServiceTypeId === TYPE_TV_HANG ||
              (/\b(tv|fernseh)/i.test(s.name) && /ophang|aufh[äa]ng/i.test(s.name));
            var dutch = german ? dutchServiceName(s) : '';
            rows.push({ name: dutch || s.name, original: dutch ? s.name : '',
                        state: basic ? 'basic' : (on ? 'on' : 'off'), level: level, price: price,
                        note: tvHang ? TV_HANG_NOTE : '' });
            addRows(Array.isArray(s.subServices) ? s.subServices : [], forcedOff || !on, level + 1);
          });
        };
        addRows(serviceData.offered, false, 0);
        addRows(serviceData.disabled, true, 0);
        addRows(serviceData.takeBack, false, 0);

        var banner = function (bg, text) {
          return '<div style="padding:8px 10px;border-radius:4px;margin-bottom:8px;font-weight:700;background:' + bg + '">' + text + '</div>';
        };
        var body = '';
        if (productTitle) body += '<div style="font-weight:700;color:#285dab;margin-bottom:4px">' + escapeHtml(productTitle.slice(0, 90)) + '</div>';
        if (placementText) body += '<div style="color:#555;font-size:13px;margin-bottom:8px">Plaatsing: ' + escapeHtml(placementText) + '</div>';
        if (builtInProduct && !builtInOn) {
          body += banner('#fde8e8', '✕ Inbouwen NIET beschikbaar') +
                  '<p style="margin:0 0 8px;color:#555">Dit is een inbouwapparaat, maar inbouwen wordt nu niet aangeboden. Mogelijk tijdelijk uitgezet.</p>';
        } else if (available) {
          body += banner('#e6f8e6', '✓ Service beschikbaar (' + available + ')' + (builtInOn ? ' · inclusief inbouwen' : ''));
        } else {
          body += banner('#fff0e6', '✕ Geen extra service, alleen bezorging');
        }
        if (serviceData.disabled.length) {
          body += banner('#fff0e6', '⚠ Uitgeschakeld: ' + escapeHtml(serviceData.disabled.map(function (s) { return s.name; }).join(', ')));
        }

        var ICON = { on: ['✓', '#00b900'], off: ['✕', '#e50000'], basic: ['•', '#999'] };
        body += '<ul style="margin:0;padding-left:0;list-style:none">';
        rows.forEach(function (r) {
          var ic = ICON[r.state];
          body += '<li style="padding:6px 0 6px ' + (r.level * 20) + 'px;border-top:1px solid #ddd;display:flex;gap:8px">' +
                    '<span style="flex:0 0 18px;font-weight:800;color:' + ic[1] + '">' + ic[0] + '</span>' +
                    '<span style="flex:1' + (r.state === 'off' ? ';color:#888;text-decoration:line-through' : '') + '">' +
                      escapeHtml(r.name) + (r.state === 'off' ? ' (uit)' : '') +
                      (r.original ? ' <span style="color:#999;font-size:12px;font-style:italic">· ' + escapeHtml(r.original) + '</span>' : '') +
                    '</span>' +
                    '<span style="flex:0 0 auto;color:#555;white-space:nowrap">' + escapeHtml(formatPrice(r.price)) + '</span></li>';
          if (r.note) {
            body += '<li style="padding:0 0 6px ' + (r.level * 20 + 26) + 'px;margin-top:-4px;color:#666;font-size:12px">' +
                      escapeHtml(r.note) + '</li>';
          }
        });
        body += '</ul><p style="margin:8px 0 0;color:#888;font-size:12px">Bron: productgegevens van Coolblue · prijzen incl. btw</p>';

        // Short status for the minimised box.
        var status = builtInProduct && !builtInOn ? '✕ Inbouwen niet beschikbaar'
          : available ? '✓ ' + available + ' service' + (available === 1 ? '' : 's') + (builtInOn ? ' · inbouwen' : '')
          : '✕ Alleen bezorging';
        return { html: body, status: status };
      }

      // Show the Service Check box (top right) with the given HTML as content.
      // status = short text shown in the header when the box is minimised.
      // The minimised state is remembered (per website, in this browser).
      function showPanel(bodyHtml, status) {
        var old = document.getElementById('cb-svc-box');
        if (old) old.remove();
        var panel = document.createElement('div');
        panel.id = 'cb-svc-box';
        panel.setAttribute('style',
          'position:fixed;top:16px;right:16px;z-index:2147483647;width:350px;max-height:80vh;overflow:auto;' +
          'background:#fff;color:#111;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.25);' +
          'font:14px/1.45 "Open Sans",Segoe UI,Arial,sans-serif');
        var btn = 'all:unset;cursor:pointer;font-size:20px;line-height:1;color:#fff;padding:0 6px';
        panel.innerHTML =
          '<div style="background:#0090e3;color:#fff;padding:12px 14px;font-weight:800;font-size:16px;' +
            'display:flex;justify-content:space-between;align-items:center;gap:8px">' +
            '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">SERVICE CHECK<span style="color:#ff6600">.</span>' +
              '<span data-status style="font-weight:600;font-size:14px;margin-left:8px"></span></span>' +
            '<button type="button" data-min title="Minimaliseren" style="' + btn + '">–</button>' +
            '<button type="button" data-x title="Sluiten" style="' + btn + '">×</button>' +
          '</div><div data-body style="padding:12px 14px">' + bodyHtml + '</div>';
        panel.querySelector('[data-status]').textContent = status || '';
        document.body.appendChild(panel);

        var setMin = function (min, remember) {
          panel.querySelector('[data-body]').style.display = min ? 'none' : '';
          panel.querySelector('[data-status]').style.display = min ? '' : 'none';
          panel.querySelector('[data-min]').textContent = min ? '+' : '–';
          panel.querySelector('[data-min]').title = min ? 'Openklappen' : 'Minimaliseren';
          // Only a click by the user changes the remembered choice.
          if (remember) { try { localStorage.setItem('svcCheckMin', min ? '1' : '0'); } catch (e) {} }
        };
        var startMin = false;
        try { startMin = localStorage.getItem('svcCheckMin') === '1'; } catch (e) {}
        setMin(startMin && !!status);
        panel.querySelector('[data-min]').onclick = function () {
          setMin(panel.querySelector('[data-body]').style.display !== 'none', true);
        };
        panel.querySelector('[data-x]').onclick = function () { panel.remove(); };
        return panel;
      }

      // ---------------------------------------------------------------------------
      // 1. Not on Coolblue: use the selection (or a prompt) to open Coolblue
      // ---------------------------------------------------------------------------
      if (!/coolblue\.(nl|be|de)$/i.test(host)) {
        var frames = document.querySelectorAll('iframe,frame');

        // Pick coolblue.nl / .be / .de based on the order (default: NL).
        var cc = detectCountry(document);
        for (var g = 0; g < frames.length && !cc; g++) {
          try { cc = detectCountry(frames[g].contentDocument); } catch (e) {}
        }
        setCountry(cc || 'nl');

        // Open the Coolblue product page (number/link) or search (text).
        // pid = Coolblue product number (from the PRD code); without it: search on text.
        // Tampermonkey helper (Service_Check_v2.user.js) installed? It marks the
        // page and can download Coolblue pages for us (a normal page can't: Coolblue
        // doesn't allow cross-site reading). Then the result is shown right here.
        var helperReady = document.documentElement.getAttribute('data-svc-helper') === '1';

        var checkInline = function (pid, label) {
          var pageUrl = PRODUCT_URL + pid;
          var openLink = '<p style="margin:10px 0 0"><a href="' + (pageUrl + AUTO_FRAGMENT).replace(/"/g, '&quot;') +
            '" target="_blank" style="color:#0090e3;font-weight:700;text-decoration:none">Open op Coolblue ›</a></p>';
          showPanel('<p style="margin:0">Services ophalen voor <b>' + escapeHtml(label || ('product ' + pid)) + '</b>…</p>');

          var id = 'svc' + Date.now() + Math.random().toString(36).slice(2);
          var finished = false;
          var onMessage = function (ev) {
            var m = ev.data;
            if (!m || m.svcCheck !== 'response' || m.id !== id) return;
            finished = true;
            window.removeEventListener('message', onMessage);
            if (m.error) {
              showPanel('<p style="margin:0 0 6px"><b>Ophalen mislukt</b> (' + escapeHtml(m.error) + ').</p>' +
                '<p style="margin:0;color:#555">' + (/404/.test(m.error)
                  ? 'Dit product bestaat niet op ' + escapeHtml(new URL(pageUrl).hostname) + '. Klopt het land?'
                  : 'Probeer het nog een keer of open de pagina zelf.') + '</p>' + openLink);
              return;
            }
            var doc = new DOMParser().parseFromString(m.html || '', 'text/html');
            var result = serviceSummary(doc);
            if (result) { showPanel(result.html + openLink, result.status); return; }
            showPanel('<p style="margin:0 0 6px"><b>Geen servicegegevens gevonden.</b></p>' +
              '<p style="margin:0;color:#555">Misschien is het product uitverkocht. Open de pagina om zelf te kijken.</p>' + openLink, 'Geen gegevens');
          };
          window.addEventListener('message', onMessage);
          window.postMessage({ svcCheck: 'request', id: id, url: pageUrl }, location.origin);
          setTimeout(function () {
            if (finished) return;
            window.removeEventListener('message', onMessage);
            showPanel('<p style="margin:0 0 6px"><b>Coolblue reageert niet.</b></p>' +
              '<p style="margin:0;color:#555">Is het Tampermonkey-script aan? Open de pagina zelf.</p>' + openLink);
          }, 25000);
        };

        var openCoolblue = function (text, pid) {
          text = clean(text).slice(0, 120);
          pid = pid || productId(text);
          if (!text && !pid) return;
          // With the helper and a product number: show the result here, no new tab.
          if (helperReady && pid) { checkInline(pid, text); return; }
          // "#svc-auto" starts the Tampermonkey script (Service_Check.user.js) if it
          // is installed: it then picks the product and shows the services by itself.
          // Without Tampermonkey the marker does nothing.
          var url = pid
            ? PRODUCT_URL + pid + AUTO_FRAGMENT
            : SEARCH_URL + encodeURIComponent(text) + '#svc-auto';
          var win = window.open(url, '_blank');
          if (!win) alert('Service Check: pop-up geblokkeerd. Sta pop-ups toe voor deze site.');
        };

        // DireXtion first: read all products from the article grid. This beats
        // any selected text, so an accidental header selection can't end up in
        // the search. One product: open it. Several: let the user choose.
        var articles = readDirextionArticles(document);
        for (var f = 0; f < frames.length && !articles.length; f++) {
          try { articles = readDirextionArticles(frames[f].contentDocument); } catch (e) {}
        }
        if (articles.length === 1) { openCoolblue(articles[0].desc, articles[0].pid); return; }
        if (articles.length > 1) { showPicker(articles, openCoolblue); return; }

        // Other pages: use the selected text (also inside same-origin iframes).
        var sel = '';
        try { sel = String(window.getSelection()); } catch (e) {}
        for (var i = 0; i < frames.length && !sel.trim(); i++) {
          try { sel = String(frames[i].contentWindow.getSelection()); } catch (e) {}
        }
        // Drop a column header that was selected along with the value.
        sel = clean(sel).replace(/^omschrijving\s*/i, '');

        if (!sel) sel = prompt('Typ een productomschrijving:') || '';
        openCoolblue(sel);
        return;
      }

      // ---------------------------------------------------------------------------
      // 2. On Coolblue
      // ---------------------------------------------------------------------------

      // Remove a previous result box.
      var oldBox = document.getElementById('cb-svc-box');
      if (oldBox) oldBox.remove();

      // Normalise odd product-ish URLs (subscription/abonnement/...) to /product/<id>.
      try {
        var productBase = new URL(PRODUCT_URL);
        if (location.hostname === productBase.hostname) {
          var lm = location.pathname.match(/\/(?:produ[ck]t|subscription|abonnement|abo)\/(\d{5,8})(?:\/|$)/i);
          if (lm && location.pathname.indexOf(productBase.pathname) !== 0) {
            // No #svc-auto here on purpose: a redirect must never restart the script (loop risk).
            location.href = PRODUCT_URL + lm[1] + FRAGMENT;
            return;
          }
        }
      } catch (e) {}

      // ---------------------------------------------------------------------------
      // 2a. Search / listing page: pick the right single product
      // ---------------------------------------------------------------------------
      var picks = null;
      var combiOnly = false;

      if (!/\/produ[ck]t\/\d+/i.test(location.pathname)) {
        var urls = {}, names = {}, display = {}, order = [];
        var links = document.querySelectorAll('a[href*="/product/"],a[href*="/produkt/"]');

        for (var a = 0; a < links.length; a++) {
          var link = links[a];
          var hm = String(link.getAttribute('href') || '').match(/\/produ[ck]t\/(\d{5,8})\//);
          if (!hm) continue;
          var id = hm[1];

          if (!urls[id]) {
            urls[id] = String(link.href || link.getAttribute('href')).split('#')[0];
            names[id] = '';
            display[id] = '';
            order.push(id);
          }

          // Longest sensible link text becomes the display name.
          var linkText = clean(link.innerText || link.getAttribute('title') || '');
          if (linkText && !/review|beoordeling|bewertung|^\d/i.test(linkText) && linkText.length > display[id].length) {
            display[id] = linkText;
          }

          // Collect all text for combi detection / matching.
          names[id] += ' ' + clean(link.innerText) +
                       ' ' + clean(link.getAttribute('title')) +
                       ' ' + clean(link.getAttribute('aria-label'));
        }

        // Bundles / combi deals (NL + DE wording).
        // NOTE: ".*" restored here — the .txt had "." (asterisks likely lost when pasted).
        var COMBI = /\s\+\s|\bcombi\b|combi-?deal|combinatieset|voordeelset|\bbundel|\bbundle|\bset\s(van|met)\b|kombi-?angebot|\bkombi\b|\bset\b.*\+|\+.*\bset\b/i;

        var single = order.filter(function (id) { return !COMBI.test(names[id]); });

        if (order.length && !single.length) {
          combiOnly = true;
        } else if (single.length === 1) {
          location.href = urls[single[0]] + AUTO_FRAGMENT;
          return;
        } else if (single.length > 1) {
          // Narrow down using type-number-like tokens from the search query.
          var query = '';
          try { query = new URLSearchParams(location.search || '').get('query') || ''; } catch (e) {}

          var norm = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]/g, ''); };
          var tokens = clean(query).split(' ')
            .filter(function (t) { return /\d/.test(t) && t.length >= 4; })
            .map(function (t) { return norm(t.split('/')[0]); });

          if (tokens.length) {
            var hits = single.filter(function (id) {
              var n = norm(names[id]);
              return tokens.every(function (t) { return n.indexOf(t) >= 0; });
            });
            if (hits.length === 1) {
              location.href = urls[hits[0]] + AUTO_FRAGMENT;
              return;
            }
            if (hits.length > 1) single = hits;
          }

          picks = single.slice(0, 8).map(function (id) {
            return {
              url: urls[id] + AUTO_FRAGMENT,
              name: (display[id] || clean(names[id])).slice(0, 90) || ('Product ' + id)
            };
          });
        }
      }

      // ---------------------------------------------------------------------------
      // 2b. Product page: read Coolblue's own service data (preferred method)
      // ---------------------------------------------------------------------------
      var summary = /\/produ[ck]t\/\d+/i.test(location.pathname) ? serviceSummary(document) : null;
      if (summary) {
        showPanel(summary.html, summary.status);
        // Scroll to the services block on the page.
        var block = document.querySelector('input[name="mainServices"]');
        if (block) { try { block.scrollIntoView({ block: 'center' }); } catch (e) {} }
        return;
      }

      // ---------------------------------------------------------------------------
      // 2c. Fallback: find the "Kies voor gemak" heading in the page text
      // ---------------------------------------------------------------------------
      var HEADING_RE = /kies\s+voor\s+gemak|choose\s+convenience|entscheide\s+dich\s+f(?:ü|ue)r\s+komfort/i;
      var heading = null;

      var candidates = document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,strong,b,span,p,div');
      for (var i = 0; i < candidates.length; i++) {
        var own = ownText(candidates[i]);
        if (HEADING_RE.test(own) && own.length < 40) {
          heading = candidates[i];
          break;
        }
      }

      // ---------------------------------------------------------------------------
      // 2c. Read the options that belong to that block
      // ---------------------------------------------------------------------------
      var options = [];
      var INPUT_SEL = 'input[type=radio],input[type=checkbox],[role=radio],[role=checkbox]';

      if (heading) {
        // Walk up until we find a container that holds radio/checkbox inputs.
        var box = heading, level = 0;
        while (box && level < 8 && box.querySelectorAll(INPUT_SEL).length === 0) {
          box = box.parentElement;
          level++;
        }

        if (box) {
          // Text that marks the start of the next (unrelated) section.
          var STOP = /^(type\s+bestelling|bestellart|art\s+der\s+bestellung|kies\s+je|w[äa]hle|adviesprijs|in\s+mijn\s+winkelwagen)/i;

          // NOTE: '*' restored here — the .txt had '' (which throws a SyntaxError).
          var all = Array.prototype.slice.call(box.querySelectorAll('*'));
          var headIdx = all.indexOf(heading);
          var stopIdx = all.length;

          for (var q = headIdx + 1; q < all.length; q++) {
            var el = all[q];
            if (heading.contains && heading.contains(el)) continue;
            var ot = ownText(el);
            if (ot && ot.length < 40 && STOP.test(ot)) {
              stopIdx = q;
              break;
            }
          }

          var inRange = function (el) {
            var x = all.indexOf(el);
            return x > headIdx && x < stopIdx;
          };

          // Preferred: read labels of the inputs between heading and stop marker.
          var inputs = box.querySelectorAll(INPUT_SEL);
          for (var k = 0; k < inputs.length; k++) {
            var input = inputs[k], label = null;
            if (!inRange(input)) continue;

            if (input.id) {
              try { label = box.querySelector('label[for="' + input.id + '"]'); } catch (e) {}
            }
            if (!label) label = input.closest('label');

            var txt = clean(label
              ? label.innerText
              : (input.getAttribute('aria-label') || (input.parentElement && input.parentElement.innerText)));

            if (txt && options.indexOf(txt) < 0) options.push(txt.slice(0, 160));
          }

          // Fallback: parse the box's visible text line by line.
          if (!options.length) {
            var stopped = false;
            String(box.innerText || '').split(/\n+/).forEach(function (line) {
              line = clean(line);
              if (!line || stopped) return;
              if (STOP.test(line)) { stopped = true; return; }
              if (HEADING_RE.test(line)) return;

              // Price/"gratis" lines get appended to the previous option.
              if (/^(gratis|kostenlos|vanaf|ab|\+?\s?€|[\d.,]+\s*,-|extra\s+opties)/i.test(line) && options.length) {
                options[options.length - 1] += ' — ' + line;
              } else if (options.indexOf(line) < 0) {
                options.push(line.slice(0, 160));
              }
            });
          }
        }
      }

      // ---------------------------------------------------------------------------
      // 2d. Classify options
      // ---------------------------------------------------------------------------
      // Real services (installation, connecting, mounting, door reversal, take-back...).
      var SERVICE_RE = /inbouw|einbau|installeer|installat|aansluit|anschlie|ophang|aufh|montage|monteer|deur\s*omdra|plaats|stapel|trekschakel|meenemen|mitnahme|retour/i;
      // Plain delivery variants that should NOT count as a service.
      var BASIC_RE = /drempel|bordsteinkante|haust[üu]r|zonder\s+service/i;

      function isService(o) { return SERVICE_RE.test(o) && !BASIC_RE.test(o); }

      var services = options.filter(isService);
      var hasBuiltIn = options.some(function (o) { return /inbouw|einbau/i.test(o); });

      // ---------------------------------------------------------------------------
      // 3. Render the result box
      // ---------------------------------------------------------------------------
      var panel = document.createElement('div');
      panel.id = 'cb-svc-box';
      panel.setAttribute('style',
        'position:fixed;top:16px;right:16px;z-index:2147483647;width:350px;max-height:80vh;overflow:auto;' +
        'background:#fff;color:#111;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.25);' +
        'font:14px/1.45 "Open Sans",Segoe UI,Arial,sans-serif');

      var html =
        '<div style="background:#0090e3;color:#fff;padding:12px 14px;font-weight:800;font-size:16px;' +
          'display:flex;justify-content:space-between;align-items:center">' +
          '<span>SERVICE CHECK<span style="color:#ff6600">.</span></span>' +
          '<button id="cb-svc-x" style="all:unset;cursor:pointer;font-size:20px;line-height:1;color:#fff;padding:0 4px">×</button>' +
        '</div>' +
        '<div style="padding:12px 14px">';

      var title = clean((document.querySelector('h1') || {}).innerText || '');
      if (title) {
        html += '<div style="font-weight:700;color:#285dab;margin-bottom:8px">' + escapeHtml(title.slice(0, 90)) + '</div>';
      }

      var onProductPage = /\/produ[ck]t\/\d+/i.test(location.pathname);

      if (!heading && picks) {
        // Several candidate products on a search page.
        html += '<p style="margin:0 0 8px"><b>Kies het losse product:</b></p>' +
                '<ul style="margin:0;padding:0;list-style:none">';
        picks.forEach(function (p) {
          html += '<li style="border-top:1px solid #ddd;padding:7px 0">' +
                    '<a href="' + p.url.replace(/"/g, '&quot;') + '" style="color:#0090e3;font-weight:700;text-decoration:none">' +
                      escapeHtml(p.name) + ' ›</a></li>';
        });
        html += '</ul><p style="margin:8px 0 0;color:#555;font-size:13px">' +
                'Combinaties zijn weggelaten. Klik daarna op de productpagina nog een keer op Service Check.</p>';

      } else if (!heading && combiOnly) {
        html += '<p style="margin:0 0 6px"><b>Alleen combinaties gevonden.</b></p>' +
                '<p style="margin:0;color:#555">Zoek op het typenummer van het losse product, bijvoorbeeld uit DireXtion.</p>';

      } else if (!heading && !onProductPage) {
        html += '<p style="margin:0 0 6px"><b>Geen producten gevonden.</b></p>' +
                '<p style="margin:0;color:#555">Controleer de zoekterm en probeer het opnieuw.</p>';

      } else if (!heading) {
        html += '<p style="margin:0 0 6px"><b>Geen blok "Kies voor gemak" gevonden.</b></p>' +
                '<p style="margin:0;color:#555">Sta je op een productpagina? Is het product uitverkocht, dan staan er geen services bij. ' +
                'Scroll anders even naar beneden en klik nog een keer.</p>';

      } else if (!options.length) {
        html += '<p style="margin:0"><b>Blok gevonden, maar geen opties kunnen lezen.</b> Kijk zelf even onder "Kies voor gemak".</p>';

      } else {
        if (services.length) {
          html += '<div style="padding:8px 10px;border-radius:4px;margin-bottom:10px;font-weight:700;background:#e6f8e6">' +
                  '✓ Service beschikbaar (' + services.length + ')' + (hasBuiltIn ? ' · inclusief inbouwen' : '') + '</div>';
        } else {
          html += '<div style="padding:8px 10px;border-radius:4px;margin-bottom:10px;font-weight:700;background:#fff0e6">' +
                  '✕ Geen extra service, alleen bezorging</div>';
        }

        html += '<div style="font-weight:700;margin-bottom:4px">Opties onder "Kies voor gemak":</div>' +
                '<ul style="margin:0;padding-left:0;list-style:none">';
        options.forEach(function (o) {
          var s = isService(o);
          html += '<li style="padding:6px 0;border-top:1px solid #ddd;display:flex;gap:8px">' +
                    '<span style="flex:0 0 18px;font-weight:800;color:' + (s ? '#00b900' : '#999') + '">' + (s ? '✓' : '•') + '</span>' +
                    '<span>' + escapeHtml(o) + '</span></li>';
        });
        html += '</ul>';
      }

      html += '</div>';
      panel.innerHTML = html;
      document.body.appendChild(panel);

      document.getElementById('cb-svc-x').onclick = function () { panel.remove(); };

      if (heading) {
        try { heading.scrollIntoView({ block: 'center' }); } catch (e) {}
      }
      }
    })();

  }

  var isProductPage = /\/(?:produ[ck]t|subscription|abonnement|abo)\/\d+/i.test(location.pathname);

  // Wait until the page has what the check needs (max ~10 s).
  function ready() {
    if (isProductPage) {
      if (document.querySelector('input[name="mainServices"]')) return true;
      var scripts = document.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
        if ((scripts[i].textContent || '').indexOf('FormInstallationServices') >= 0) return true;
      }
      // Fallback: the services heading is visible (NL / EN / DE).
      return /kies\s+voor\s+gemak|choose\s+convenience|entscheide\s+dich\s+f(?:ü|ue)r\s+komfort/i
        .test((document.body && document.body.innerText) || '');
    }
    return document.querySelectorAll('a[href*="/product/"],a[href*="/produkt/"]').length > 0;
  }

  var tries = 0;
  (function wait() {
    tries++;
    if (ready() || tries > 20) {
      // Remove the marker first, so a reload or redirect never starts the script again.
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      runServiceCheck();
    } else {
      setTimeout(wait, 500);
    }
  })();
})();
