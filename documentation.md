# TokenCompare

Vergleicht LLM-Tokenpreise von der [OpenRouter API](https://openrouter.ai/docs/api/models) in einer sortierbaren, durchsuchbaren Tabelle.

## Architektur

Single-Page-HTML-Anwendung – **3 Dateien** ohne Build-Tools, Bundler oder npm:

| Datei | Zeilen | Aufgabe |
|---|---|---|
| `index.html` | – | Vue-Template, Komponenten-Markup, lokales Favicon eingebunden |
| `style.css` | – | Dark-Theme-Styling, Layout-Klassen, responsiv |
| `app.js` | – | Vue 3 Logik (Composition API) |
| `favicon.svg` | – | Lokales Browser-/Tab-Icon |

| Technologie | Verwendung |
|---|---|
| **Vue 3** (CDN: `unpkg.com/vue@3`) | Reaktivität, Templates, Computed Properties |
| **Reines CSS** (`style.css`) | Dark-Theme-Styling, Komponenten-Klassen |
| **localStorage** | Favoriten-Persistenz (`tc_fav`) |
| **OpenRouter API** | Datenquelle (`GET /api/v1/models`) |

## Features

- **Live-Daten** aus dem vollständigen OpenRouter-Modellkatalog; Modelle ohne Preis bleiben sichtbar
- **Sortierbare Tabelle**: Name, Anbieter, Coding-Einschätzung, Input/Output/Cached/Effektiv-Preise, Kontext
- **Suche** über Modellname, ID, Beschreibung oder Anbieter (eigene Zeile, keine Überlappung)
- **Favoriten**: Stern-Markierung persistent in localStorage, Favoriten immer oben
- **Favoriten-Filter**: Nur Favoriten anzeigen; bei Namenssortierung stehen Favoriten oben
- **Sortier-Chips**: Schnell zwischen Sortierungen wechseln
- **Coding-Einschätzung**: Artificial Analysis Coding Index, sonst grobe Metadaten-Schätzung oder „Keine Daten“ mit sichtbarer Einordnung
- **Preisfilter**: Modelle ohne Input-Preis optional ausblenden
- **Detail-Modal**: Klick auf Zeile zeigt Anbieter, Modus, Kontext, Max Output, Preise, Coding-Einschätzung, Beschreibung und optional die vollständigen API-Daten des Modells
- **Compare-Modal**: Bis zu 5 Modelle vergleichen (Preise, Kontext, Architektur, etc.), günstigster Preis grün markiert
- **Responsive**: Auf schmalen Bildschirmen werden Anbieter-, Cached- und Kontext-Spalten ausgeblendet
- **Effektiv-Preis**: Gewichteter Mischpreis aus Input/Output/Cached (umstellbar 70/30 Chat oder 60/25/15 Cache) als zusätzliche Tabellenspalte und im Detail-Modal
- **Währungsumschaltung** USD/EUR: Wechselkurs via `open.er-api.com`, alle Preise werden umgerechnet
- **Lade-Skeleton, Empty-State, Error-Banner**

## Pricing-Konvertierung

Die OpenRouter API liefert Preise als **Per-Token-Werte** (z. B. `"0.0000025"`).  
TokenCompare multipliziert alle Werte mit **1.000.000** → Anzeige als **$ / 1M Tokens**.

- `prompt` → Input-Preis
- `completion` → Output-Preis
- `input_cache_read` → Cache-Read-Preis
- `input_cache_write` → Cache-Write-Preis (separat angezeigt, nicht als Read-Preis ausgegeben)
- Alle vorhandenen Werte werden numerisch validiert und mit `* 1e6` umgerechnet

## Coding-Einschätzung

`coding(m)` liefert Anzeigewert, Typ und Erklärung:

| Anzeige | Grundlage | Aussagekraft |
|---|---|---|
| `AA <Wert>` | `benchmarks.artificial_analysis.coding_index` aus den OpenRouter-Modellmetadaten | Externer Coding-Index, unverändert angezeigt und nicht in Sterne umgerechnet |
| Coding-Hinweis | Explizite Coding-Hinweise im Modellnamen oder in der Beschreibung | Metadaten-Signal, ausdrücklich keine Leistungsnote oder Leistungsprognose |
| `Keine Daten` | Kein Coding-Index und keine konkreten Coding-Hinweise | Unbekannt, ausdrücklich nicht als 0 bewertet |

Kontextlänge und allgemeine Intelligence-Indizes fließen nicht in die Coding-Einschätzung ein. Bei der Sortierung stehen Benchmarkwerte vor Metadaten-Hinweisen; unbekannte Werte bleiben am Ende. Es wird bewusst keine nicht belegte 0–5-Note erzeugt.

## Datenmodell (OpenRouter API)

Relevante Felder aus der API-Antwort:

| Feld | Typ | Verwendung |
|---|---|---|
| `id` | string | Eindeutige ID, z. B. `openai/gpt-4o` |
| `name` | string | Anzeigename, Format: `"Anbieter: Modellname"` |
| `description` | string | Beschreibung (für Coding-Rating und Detail-Modal) |
| `pricing.prompt` | string | Input-Preis pro Token (optional) |
| `pricing.completion` | string | Output-Preis pro Token |
| `pricing.input_cache_read` | string | Cache-Read-Preis pro Token (optional) |
| `pricing.input_cache_write` | string | Cache-Write-Preis pro Token (optional) |
| `context_length` | number | Kontextfenster in Tokens |
| `architecture.modality` | string | z. B. `"text+image"` |
| `architecture.input_modalities` | string[] | `["text"]`, `["text","image"]`, etc. |
| `top_provider.max_completion_tokens` | number | Maximale Output-Tokens |

## Wichtige Implementierungsdetails

- **Provider-Extraktion**: `m.name` bei erstem Doppelpunkt splitten → "Anbieter: Modellname"
- **Kein `fetch`-Shadowing**: Die globale `fetch`-Funktion wird nicht überschrieben; der API-Call nutzt `window.fetch()`
- **Tabelle in 68vh-Container**: Haupttabelle in einem Bereich mit `height:68vh` und `overflow-y:auto`, Header sticky, Footer-Leiste fest am unteren Rand
- **Favoriten oben**: Bei Namenssortierung werden Favoriten zuerst angezeigt
- **Compare-Modal**: Nur bei `>=2` ausgewählten Modellen sichtbar, max. 5 Modelle
- **Preisformatierung**: Deutsche Zahlendarstellung mit bis zu 8 Nachkommastellen; gültige Nullpreise bleiben sichtbar
- **Datei-Aufteilung**: `index.html` enthält nur das Template, `style.css` alle Styles, `app.js` die Vue-Logik – geladen über `<link>` bzw. `<script src="...">`
- **Vollständiger Katalog**: Alle API-Modelle mit gültiger ID bleiben erhalten. Ein optionaler Filter blendet Modelle ohne Input-Preis aus.
- **Effektiv-Preis**: 70/30 nur mit Input- und Output-Preis; 60/25/15 nur, wenn zusätzlich ein Cache-Read-Preis vorhanden ist. Fehlende Angaben werden nicht als 0 angesetzt.
- **Aktualisierung**: API-Daten werden ohne Browser-Cache geladen; Anfrage mit 15-Sekunden-Timeout und Validierung der Antwort.
- **Icon**: `favicon.svg` wird lokal ausgeliefert.

## Sicherheit

- **CSP** (Content Security Policy): Restriktives Meta-Tag mit `default-src 'none'` und gezielt erlaubten Quellen:
  - `script-src`: `'self'`, `https://unpkg.com`, `'unsafe-eval'` (erforderlich für Vue 3 Template-Compiler)
  - `style-src`: `'self'`, `'unsafe-inline'`
  - `img-src`: `'self'`, `https://www.google.com`, `https://*.gstatic.com` (Google Favicons redirecten auf `t2.gstatic.com`)
  - `connect-src`: `https://openrouter.ai`, `https://open.er-api.com`
  - `frame-ancestors 'none'` verhindert Clickjacking
- **Kein `v-html`**: Alle API-Daten werden durch Vue's Text-Interpolation (`{{ }}`) sicher escaped
- **`rel="noopener noreferrer"`**: Alle externen Links mit `target="_blank"` geschützt
