# TokenCompare

Vergleicht LLM-Tokenpreise von der [OpenRouter API](https://openrouter.ai/docs/api/models) in einer sortierbaren, durchsuchbaren Tabelle.

## Architektur

Single-Page-HTML-Anwendung – **3 Dateien** ohne Build-Tools, Bundler oder npm:

| Datei | Zeilen | Aufgabe |
|---|---|---|
| `index.html` | 242 | Vue-Template, Komponenten-Markup |
| `style.css` | 595 | Dark-Theme-Styling, Layout-Klassen, responsiv |
| `app.js` | 290 | Vue 3 Logik (Composition API) |

| Technologie | Verwendung |
|---|---|
| **Vue 3** (CDN: `unpkg.com/vue@3`) | Reaktivität, Templates, Computed Properties |
| **Reines CSS** (`style.css`) | Dark-Theme-Styling, Komponenten-Klassen |
| **localStorage** | Favoriten-Persistenz (`tc_fav`) |
| **OpenRouter API** | Datenquelle (`GET /api/v1/models`) |

## Features

- **Live-Daten** von OpenRouter (350+ Modelle) mit Update-Button
- **Sortierbare Tabelle**: Name, Anbieter, Code-Rating, Input/Output/Cached/Effektiv-Preise, Kontext
- **Suche** über Modellname, ID oder Anbieter (eigene Zeile, keine Überlappung)
- **Favoriten**: Stern-Markierung persistent in localStorage, Favoriten immer oben
- **Favoriten-Filter**: Nur Favoriten anzeigen
- **Sortier-Chips**: Schnell zwischen Sortierungen wechseln
- **Code-Rating (0–5★)**: Heuristische Bewertung der Coding-Eignung aus Modellname und Beschreibung
- **Detail-Modal**: Klick auf Zeile zeigt Anbieter, Modus, Kontext, Max Output, Preise, Coding-Rating, Beschreibung
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
- `input_cache_read` / `input_cache_write` → Cached-Preis
- Alle Werte via `parseFloat` + `* 1e6`

## Code-Rating Heuristik

Die `cd(m)`-Funktion analysiert `m.description` und `m.id`:

| Stufe | Kriterium |
|---|---|
| **5★** | ID enthält `codestral`, `cursor`, `wizardcoder`, `deepseek-coder`, `codegemma`, `starcoder`, `codeqwen` |
| **+2** | Beschreibung enthält "coding", "code generation", "programming", "software engineer" |
| **+1** | Beschreibung enthält "reasoning", "agentic", "developer", "instruction", "technical" |
| **+1** | ID enthält Claude, GPT-4, Gemini Pro/Ultra/Flash, Qwen Max/Plus/72B, Command R+, DeepSeek V2/V3/R1 |
| **0★** | Keine Coding-Hinweise gefunden |
| *Gedeckelt auf 5* | |

## Datenmodell (OpenRouter API)

Relevante Felder aus der API-Antwort:

| Feld | Typ | Verwendung |
|---|---|---|
| `id` | string | Eindeutige ID, z. B. `openai/gpt-4o` |
| `name` | string | Anzeigename, Format: `"Anbieter: Modellname"` |
| `description` | string | Beschreibung (für Coding-Rating und Detail-Modal) |
| `pricing.prompt` | string | Input-Preis pro Token |
| `pricing.completion` | string | Output-Preis pro Token |
| `pricing.input_cache_read` | string | Gecachter Input-Preis pro Token (optional) |
| `pricing.input_cache_write` | string | Alternativer Cache-Preis (optional) |
| `context_length` | number | Kontextfenster in Tokens |
| `architecture.modality` | string | z. B. `"text+image"` |
| `architecture.input_modalities` | string[] | `["text"]`, `["text","image"]`, etc. |
| `top_provider.max_completion_tokens` | number | Maximale Output-Tokens |

## Wichtige Implementierungsdetails

- **Provider-Extraktion**: `m.name` bei erstem Doppelpunkt splitten → "Anbieter: Modellname"
- **Kein `fetch`-Shadowing**: Die globale `fetch`-Funktion wird nicht überschrieben; der API-Call nutzt `window.fetch()`
- **Tabelle in 68vh-Container**: Haupttabelle in einem Bereich mit `height:68vh` und `overflow-y:auto`, Header sticky, Footer-Leiste fest am unteren Rand
- **Favoriten immer oben**: Zweistufige Sortierung (Favoriten zuerst, dann gewählte Sortierung)
- **Compare-Modal**: Nur bei `>=2` ausgewählten Modellen sichtbar, max. 5 Modelle
- **Preisformatierung**: `fm()` nutzt `toFixed(4)` mit Abschneiden überflüssiger Nullen, z. B. `$0.1500` → `$0.15`
- **Datei-Aufteilung**: `index.html` enthält nur das Template, `style.css` alle Styles, `app.js` die Vue-Logik – geladen über `<link>` bzw. `<script src="...">`
- **Effektiv-Preis**: `eff(m)` berechnet gewichteten Mischpreis nach Modus (70% Input + 30% Output oder 60% Input + 25% Output + 15% Cached), umschaltbar per Knopf im Header

## Sicherheit

- **CSP** (Content Security Policy): Restriktives Meta-Tag mit `default-src 'none'` und gezielt erlaubten Quellen:
  - `script-src`: `'self'`, `https://unpkg.com`, `'unsafe-eval'` (erforderlich für Vue 3 Template-Compiler)
  - `style-src`: `'self'`, `'unsafe-inline'`
  - `img-src`: `'self'`, `https://www.google.com`, `https://*.gstatic.com` (Google Favicons redirecten auf `t2.gstatic.com`)
  - `connect-src`: `https://openrouter.ai`, `https://open.er-api.com`
  - `frame-ancestors 'none'` verhindert Clickjacking
- **Kein `v-html`**: Alle API-Daten werden durch Vue's Text-Interpolation (`{{ }}`) sicher escaped
- **`rel="noopener noreferrer"`**: Alle externen Links mit `target="_blank"` geschützt
