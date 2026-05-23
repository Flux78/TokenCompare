# TokenCompare

Vergleicht LLM-Tokenpreise von der [OpenRouter API](https://openrouter.ai/docs/api/models) in einer sortierbaren, durchsuchbaren Tabelle.

## Architektur

Single-Page-HTML-Anwendung (339 Zeilen) – **eine einzige Datei `index.html`** ohne Build-Tools, Bundler oder npm.

| Technologie | Verwendung |
|---|---|
| **Vue 3** (CDN: `unpkg.com/vue@3`) | Reaktivität, Templates, Computed Properties |
| **Reines CSS** | Dark-Theme-Styling, responsiv |
| **localStorage** | Favoriten-Persistenz (`tc_fav`) |
| **OpenRouter API** | Datenquelle (`GET /api/v1/models`) |

## Features

- **Live-Daten** von OpenRouter (358+ Modelle) mit Update-Button
- **Sortierbare Tabelle**: Name, Anbieter, Code-Rating, Input/Output/Cached-Preise, Kontext
- **Suche** über Modellname, ID oder Anbieter (eigene Zeile, keine Überlappung)
- **Favoriten**: Stern-Markierung persistent in localStorage, Favoriten immer oben
- **Favoriten-Filter**: Nur Favoriten anzeigen
- **Sortier-Chips**: Schnell zwischen Sortierungen wechseln
- **Code-Rating (0–5★)**: Heuristische Bewertung der Coding-Eignung aus Modellname und Beschreibung
- **Detail-Modal**: Klick auf Zeile zeigt Anbieter, Modus, Kontext, Max Output, Preise, Coding-Rating, Beschreibung
- **Compare-Modal**: Bis zu 5 Modelle vergleichen (Preise, Kontext, Architektur, etc.), günstigster Preis grün markiert
- **Responsive**: Auf schmalen Bildschirmen werden Anbieter-, Cached- und Kontext-Spalten ausgeblendet
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
