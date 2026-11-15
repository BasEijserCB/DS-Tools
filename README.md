# DS Tools

Browsertools voor het Coolblue Delivery Support team: bookmarklets die bovenop DireXtion, Sophia en AppStream draaien. Eén bladwijzer (**DS Tools**) opent een balk met de tools die bij de huidige pagina horen.

- **Installeren (team):** https://baseijsercb.github.io/DS_callscript_app/
- **Dev-bladwijzer:** https://baseijsercb.github.io/DS_callscript_app/launcher/install-dev.html
- **Beheer (productie/test per tool):** https://baseijsercb.github.io/DS_callscript_app/launcher/beheer.html
- **Technische documentatie:** [CLAUDE.md](CLAUDE.md)

Dit is de index: welke tool waar woont, en welke code buiten deze repo staat. De status (productie/test) wordt bijgehouden in [launcher/status.json](launcher/status.json) en via de beheerpagina gewijzigd.

---

## Tools in deze repo

| Tool | Pagina | Code | Loader / installatie | Versie in |
|---|---|---|---|---|
| **DS Tools** (launcher) | overal | [launcher/launcher.js](launcher/launcher.js) | [loader](launcher/loader-launcher-bookmarklet.js) · [dev-loader](launcher/loader-launcher-dev-bookmarklet.js) · [index.html](index.html) · [install-dev.html](launcher/install-dev.html) | `LAUNCHER_VERSION` |
| **DS Logboek** (widget) | consumer portal, DireXtion Basic | [ds-logboek.js](ds-logboek.js) | [loader-bookmarklet.js](loader-bookmarklet.js) · [install.html](install.html) | `VERSION` |
| **DS Plakken** | Import-formulier | [paste-bookmarklet.js](paste-bookmarklet.js) | [paste-loader-bookmarklet.js](paste-loader-bookmarklet.js) · [install.html](install.html) | `PASTE_VERSION` (= logboek, via `build.py`) |
| **Planning-combi** | Planningsmodule | [laadvermogen/planning-instellingen.js](laadvermogen/planning-instellingen.js) + [laadvermogen/laadvermogen.js](laadvermogen/laadvermogen.js) | [loader-planning-combi](laadvermogen/loader-planning-combi-bookmarklet.js) · [install-laadvermogen.html](laadvermogen/install-laadvermogen.html) | `PLANNING_VERSION` · `LAADVERMOGEN_VERSION` |
| **Laadvermogen** (los) | Planningsmodule | [laadvermogen/laadvermogen.js](laadvermogen/laadvermogen.js) | [loader-laadvermogen](laadvermogen/loader-laadvermogen-bookmarklet.js) | `LAADVERMOGEN_VERSION` |
| **Schuifritten alias** | Planningsmodule | [schuifalias/schuifalias.js](schuifalias/schuifalias.js) | [loader](schuifalias/loader-schuifalias-bookmarklet.js) · [install-schuifalias.html](schuifalias/install-schuifalias.html) | `SCHUIFALIAS_VERSION` |
| **Extra rijtijd** | Ritmonitor | [tourtool/extra-rijtijd.js](tourtool/extra-rijtijd.js) | [loader](tourtool/loader-rijtijd-bookmarklet.js) · [install-rijtijd.html](tourtool/install-rijtijd.html) | `RIJTIJD_VERSION` |
| **Same day text / Next day text** | DireXtion Basic orders | inline in [launcher/launcher.js](launcher/launcher.js) (`opmerkingTekst`) | alleen via DS Tools | `LAUNCHER_VERSION` |

## Kopieën van tools uit andere projecten

Deze staan in [extern/](extern/) zodat de launcher ze kan laden. **Niet hier bewerken**: wijzig het origineel, hoog de versie op en kopieer opnieuw.

| Tool | Kopie | Origineel |
|---|---|---|
| **Service Check** | [extern/service-check.js](extern/service-check.js) | `~/Documents/Tool David/Service Check bladwijzer.txt` |
| **Vanessa orders** | [extern/vanessa-order.js](extern/vanessa-order.js) | `~/Documents/Vanessa/vanessa-order.js` |
| **Vanessa Refurbished** | [extern/vanessa-refurbished.js](extern/vanessa-refurbished.js) | `~/Documents/Vanessa-Refurbished/vanessa-refurbished.js` |
| **Vanessa Deck** | [extern/vanessa-deck.js](extern/vanessa-deck.js) | `~/Documents/Vanessa-Refurbished/vanessa-deck.js` |

**SFT 🤚 / SFT 🤖** staan als inline loader in [launcher/launcher.js](launcher/launcher.js). Ze halen hun code uit hun eigen GAS-projecten. Het origineel staat in `~/Documents/Sophia tool/Working Files/` (`install.html`, `install_autopilot.html`).

## Backends (Google Apps Script)

GAS-code staat hier alleen als naslag. **Een commit verandert niets in productie**: plak de code in de GAS-editor en implementeer een nieuwe versie.

| Bestand hier | GAS-project | Waarvoor |
|---|---|---|
| [gas-backend.js](gas-backend.js) | DS Logboek-sheet | logging van de widget (`doGet` → tabblad Database) |
| [gas-dagmail.js](gas-dagmail.js) | zelfde project | dagmail "Same day stops nalopen" |
| [laadvermogen/gas-laadvermogen.js](laadvermogen/gas-laadvermogen.js) | sheet "Unplanneds tool Delivery Support" | `route_id → kg` voor de Laadvermogen-tool |
| *(niet hier)* | Schuifritten-web-app, bron `~/Documents/Schuifritten/Alias.gs` | data voor Schuifritten alias (`?format=alias`) |
| *(niet hier)* | SFT-projecten, bron `~/Documents/Sophia tool/` | code van SFT 🤚 / 🤖 |

## Gekoppelde mappen op deze Mac

| Map | Relatie |
|---|---|
| `~/Documents/Schuifritten` | GAS-project dat de data voor de schuifalias-tool levert (`Alias.gs`, `Rapport.gs`). Eigen CLAUDE.md. |
| `~/Documents/Vanessa` | origineel van Vanessa orders. Eigen CLAUDE.md. |
| `~/Documents/Vanessa-Refurbished` | origineel van Vanessa Refurbished en Deck. Eigen CLAUDE.md. |
| `~/Documents/Tool David` | origineel van Service Check (van David). |
| `~/Documents/Sophia tool` | SFT. Eigen GAS-projecten, eigen CLAUDE.md in `Working Files/`. |
| `~/Documents/Work/DS Logboek` | oudere overdrachts- en projectdocumenten van het logboek. |

## Overig in deze repo

| Bestand | Wat |
|---|---|
| [build.py](build.py) | syntax-check van alle tools, synchroniseert `PASTE_VERSION`, bewaakt het gedeelde stijlblok `DS_UI`. Draaien vóór elke push. |
| [launcher/status.json](launcher/status.json) · [launcher/beheer.html](launcher/beheer.html) | productie/test per tool; de beheerpagina commit status.json. Daarom eerst `git pull` vóór je zelf pusht. |
| [tourtool/probe-ritmonitor.js](tourtool/probe-ritmonitor.js) · [tourtool/probe-depotfilter.js](tourtool/probe-depotfilter.js) | recon-scripts, alleen naslag |
| [mapping-kolom-J.tsv](mapping-kolom-J.tsv) | mapping van oude kolom J-labels naar het vocabulaire (migratie aug. 2026) |

**Lokaal, niet in git** (gitignored): `*.xlsx` (sheet-exports), `*.har` (bevat sessietokens), `*.local.js` (ORS-sleutel), `dagmail-voorbeelden/`.

## Updates

Bookmarklets laden de code van `raw.githubusercontent.com` via stale-while-revalidate. Na een push is een update **binnen ongeveer 5 minuten** overal (CDN-cache). Een nieuwe tool toevoegen: zie *Een nieuwe tool toevoegen* in [CLAUDE.md](CLAUDE.md).
