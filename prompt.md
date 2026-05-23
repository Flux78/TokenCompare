# Prompt: TokenCompare – LLM Token-Preis-Vergleich

> **Hinweis:** Dies ist der ursprüngliche Entwicklungs-Prompt, der zur Generierung der Anwendung verwendet wurde.
> Die aktuelle Dokumentation findest du in [`README.md`](README.md) und [`documentation.md`](documentation.md).

Erstelle eine Single-Page-HTML-Anwendung (3 Dateien: `index.html`, `style.css`, `app.js`) mit Vue 3 (CDN) und reinem CSS (kein Tailwind), die Live-Tokenpreise von der OpenRouter API anzeigt, sortiert, favorisiert, im Detail anzeigt und vergleicht.

## Datenquelle

- **API**: `GET https://openrouter.ai/api/v1/models`
- Filtere Modelle, bei denen `pricing.prompt != null`
- Preise kommen als **Per-Token-Strings** (z. B. `"0.0000025"`) → mit `parseFloat` + Multiplikation mit **1e6** in `/1M Tokens` umrechnen
- Cached-Preis: `input_cache_read` oder falls fehlend `input_cache_write` (`null` wenn keines vorhanden)
- Provider-Name aus `m.name` extrahieren: Split bei erstem Doppelpunkt, `"Anbieter: Modellname"`

## Layout & Struktur

1. **Header**: Logo "TokenCompare" mit Gradient, Update-Button, grüner Status mit Zeitstempel
2. **Suche** in eigener Zeile (Input mit Lupe), darunter **Sortier-Chips** und **Favoriten-Filter** in separater Reihe (keine Überlappung mit Suche)
3. **Haupttabelle** in einem Container mit `height:68vh`, darin `overflow-y:auto` (Tabelle scrollt), Footer-Leiste mit Modell-Zählern und "N vergleichen →" Link
4. **Detail-Modal** (Teleport to body): Maximale Breite 380px, Klick auf Hintergrund schließt
5. **Compare-Modal** (Teleport to body): Maximale Breite 800px, tabellarischer Vergleich, günstigster Preis grün markiert

## Tabelle

Spalten (sortierbar per Klick auf Header):

| Spalte | class | responsive |
|---|---|---|
| # (Stern) | — | immer |
| Modell | — | immer |
| Anbieter | `.hm` | hide ≤640px |
| Code | `.tc` | immer |
| Input /1M | `.tr` | immer |
| Output /1M | `.tr` | immer |
| Cached /1M | `.tr .hm` | hide ≤640px |
| Kontext | `.tr .hm` | hide ≤640px |
| Compare-Button | — | immer |

- Sortier-Pfeile (↑/↓) neben aktivem Spaltentitel anzeigen
- Preis-Farbklassen: `.p1` (<$0.50) grün, `.p2` (<$2) gelb, `.p3` (<$10) orange, `.p4` (≥$10) rot
- Favoriten (★/☆) immer durchsetzen: Favoriten am Anfang der Liste, danach restliche sortiert
- Klick auf Tabellenzeile → Detail-Modal
- Klick auf Compare-Button → Modell zur Vergleichsliste hinzufügen/entfernen

## Features

### Favoriten
- localStorage Key: `tc_fav`, speichert Array von Modell-IDs
- Stern in jeder Zeile, ★ = aktiv (gold), ☆ = inaktiv
- Gefavoritete Modelle erscheinen immer zuerst in der Tabelle
- watch auf `favs` mit `{ deep: true }` schreibt bei jeder Änderung in localStorage

### Code-Rating
Heuristische Funktion `cd(m)` analysiert `m.description` und `m.id`:

```
function cd(m):
  d = lower(description), id = lower(id)
  if id matches codestral|cursor|wizardcoder|codeqwen|starcoder|deepseek-coder|codegemma → return 5
  s = 0
  if d matches "coding", "code generation", "programming", "software engineer" → s += 2
  if d matches "reasoning", "agentic", "developer", "instruction", "technical" → s += 1
  if id matches claude|gpt-4|gemini.*(pro|ultra|flash)|qwen.*(max|plus|72)|command.*plus|deepseek.*(v[23]|r1) → s += 1
  if id matches coder|code[-_]?gen → s += 2
  return min(s, 5)
```

Anzeige: ★×n + ☆×(5−n), Farbverlauf: `['#475569','#a78bfa','#818cf8','#f59e0b','#f97316']`

### Detail-Modal
- 2×2 Grid: Anbieter, Modus (erster Tag), Kontext, Max Output
- Coding-Rating (volle/leere Sterne)
- Preis-Kachel: Input / Output / Cached nebeneinander
- Beschreibung (falls vorhanden)
- Buttons: Favorit umschalten, Vergleichen umschalten

### Compare-Modal
- Maximal 5 Modelle vergleichbar
- Tabellarisch: Eigenschaften als Zeilen, Modelle als Spalten
- Reihen: Anbieter → Coding → Input → Output → Cached → Kontext → Max Output → Architektur → Tokenizer (optional) → Beschreibung
- Günstigster Preis pro Kategorie (input/output/cached) grün markiert mit "Günstigster"-Label

## CSS & Styling

- **Dark Theme**: `background:#0f1319`, Text `#e2e8f0`, Tabellen-Hintergrund `#131821`
- **Kein Tailwind**: Alle Styles in externer `style.css` und dynamischen `:style`-Bindings
- **Responsive**: `@media(max-width:640px){ .hm { display:none!important; } }`
- **Sticky Header**: `position:sticky;top:0;background:#131821;z-index:2` für `<th>`
- **Klassen**:
  - `.tr` = text-align:right
  - `.tc` = text-align:center
  - `.hm` = hide on mobile
  - `.star-on` (gold), `.star-off` (grey)
  - `.chip` / `.chip-a` (aktiv) / `.chip-f` (favoriten-filter aktiv)
  - `.badge` / `.badge-t` / `.badge-m` / `.badge-f`
  - `.p1`–`.p4` für Preis-Farben
  - `.btn` für generische Buttons
  - `.dot` für farbigen Provider-Dot
  - `.srch` für Suchcontainer mit Icon
  - `.mo` für Modal-Overlay (backdrop-filter), `.mb` für Modal-Box
  - `.header`, `.table-wrap`, `.footer-bar` – Layout-Komponenten
  - `.th-sticky`, `.th-sticky-center`, `.th-sticky-right` – Tabellenkopf
  - `.modal-header`, `.modal-header-slim`, `.modal-center` – Modalköpfe
  - `.detail-item`, `.detail-item-wide`, `.detail-grid` – Detail-Modal-Grid
  - `.error-banner`, `.skeleton`, `.empty-state` – Statusanzeigen

## JavaScript (Vue 3 Composition API, `app.js`)

Verwende `createApp` mit `setup()`:

**Refs**: `items`, `busy`, `err`, `q` (search), `sk` (sort key), `up` (sort direction), `favf` (favorites filter), `det` (detail model), `cl` (compare list), `sc` (show compare), `favs`, `updated`

**Computed**:
- `cs`: Set der Compare-IDs
- `show`: gefiltert nach Suche + Favoriten-Filter
- `rows`: `show` + Sortierung (Favoriten first, dann nach `sk`/`up`)
- `cr`: Compare-Table-Rows (Array von Objekten mit `k`, `i`, `l`, `c`)

**Functions**:
- `prov(m)`: Provider aus `m.name` extrahieren
- `pr(m, type)`: Preis holen (prompt/completion/cached), parseFloat + 1e6
- `icn(m)`: Emoji je nach Input-Modalität
- `tags(m)`: Array mit Modalität-Tags (Text/Vision/Multimodal/Audio/Video)
- `pc(p)`: Deterministische Farbe für Provider-String (Hash → Farb-Array)
- `cls(v)`: Preis-Farbklasse
- `fm(v)`: Preis formatieren (`$0.xxxx`)
- `n(nn)`: Zahl lokalisieren (de-DE)
- `has(m)`: Ist Modell favorisiert?
- `fav(m)`: Favorit togglen
- `srt(k)`: Sortierung umschalten
- `cd(m)`: Code-Rating (0–5)
- `best(rk, ci)`: Ist Modell ci günstigster in Kategorie rk?
- `cmp(m)`: Modell zur Compare-Liste hinzufügen/entfernen
- `rc(m)`: Modell aus Compare-Liste entfernen
- `load()`: API aufrufen mit `window.fetch()`, Fehlerbehandlung

## Wichtige Fallstricke

1. **Niemals `fetch` als Funktionsname verwenden** – die globale `fetch`-Funktion darf nicht überschattet werden. API-Call: `window.fetch()`
2. **Alle Template-Funktionen 1:1 im `return`** – kein Aliasing wie `foo:bar`, der Name im Template muss dem Namen in `setup()` entsprechen
3. **Preise sind Strings** – erst `parseFloat`, dann mit 1e6 multiplizieren
4. **Kein Tailwind** – reines CSS in `style.css`, dynamische Styles via `:style`-Bindings
5. **Suche in eigener Zeile** – nicht in derselben Zeile wie Chips/Buttons
6. **Tabellen-Höhe** – 68vh Container mit overflow-y:auto, Header sticky
7. **Datei-Aufteilung** – `index.html` (Template), `style.css` (Styles), `app.js` (Logik)
