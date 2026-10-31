# ⚡ TokenCompare

**Live LLM-Tokenpreise vergleichen** – Eine blitzschnelle Single-Page-Anwendung, die Modelle und Preise von der [OpenRouter API](https://openrouter.ai/) in einer sortierbaren, durchsuchbaren Tabelle darstellt.

<p align="center">
  <img src="screenshot.png" alt="TokenCompare Screenshot" width="700">
</p>

## Features

- **Live-Daten** aus dem vollständigen OpenRouter-Modellkatalog; Modelle ohne Preis bleiben sichtbar
- **Sortierbare Tabelle** nach Name, Anbieter, Coding-Einschätzung, Input/Output/Cached/Effektiv-Preis und Kontext
- **Suche** über Modellname, ID, Beschreibung oder Anbieter
- **Preisfilter** zum optionalen Ausblenden von Modellen ohne Input-Preis
- **Favoriten** – Sterne-Markierung, persistent in `localStorage`, bei Namenssortierung oben
- **Favoriten-Filter** – nur Favoriten anzeigen
- **Coding-Einschätzung** – Artificial Analysis Coding Index, wenn verfügbar; sonst Coding-Metadaten-Hinweis oder „Keine Daten“ (ohne erfundene Leistungsnote)
- **Detail-Modal** – zeigt Anbieter, Preise, Kontext, Coding-Einschätzung und aufklappbar die vollständigen geladenen API-Daten
- **Compare-Modal** – Bis zu 5 Modelle side-by-side vergleichen; günstigster Preis grün markiert
- **Effektiv-Preis** – Gewichteter Mischpreis (Chat 70/30 oder Cache 60/25/15), umschaltbar
- **Währungsumschaltung** USD/EUR mit Live-Wechselkurs
- **Responsive Design** – Mobilansicht blendet Anbieter-, Cached- und Kontext-Spalten aus
- **Dark Theme** – Augenschonendes Farbschema

## Quick Start

```bash
git clone https://github.com/Flux78/TokenCompare.git
cd TokenCompare
./start.sh
# → http://localhost:8080
```

Oder mit einem beliebigen Static-Server:

```bash
python3 -m http.server 8080
```

Keine Build-Tools, kein `npm install` – öffnen und loslegen.

## Technologie-Stack

| Technologie | Zweck | Lizenz |
|---|---|---|
| [Vue 3](https://vuejs.org/) (via CDN) | Reaktivität, Templates, Composition API | MIT |
| [Feather Icons](https://feathericons.com/) | Such-Symbol | MIT |
| [OpenRouter API](https://openrouter.ai/) | Modell- und Preisdaten | – |
| [open.er-api.com](https://open.er-api.com/) | EUR/USD-Wechselkurs | – |
| [Google Favicons](https://www.google.com/s2/favicons) | Provider-Favicons | – |
| `favicon.svg` | Lokales App-Icon | – |

## Projektstruktur

```
TokenCompare/
├── index.html      # Vue 3 Template + HTML-Struktur
├── style.css       # Dark-Theme-Styling, responsiv
├── app.js          # Vue Composition API – Anwendungslogik
├── favicon.svg     # Lokales Browser-/Tab-Icon
├── start.sh        # Lokaler Entwicklungsserver
├── README.md       # Diese Datei
└── documentation.md# Detaillierte Architekturdokumentation
```

## Datenmodell (OpenRouter API)

Relevante API-Felder:

| Feld | Beschreibung |
|---|---|
| `id` | Eindeutige ID, z. B. `openai/gpt-4o` |
| `name` | Anzeigename (`"Anbieter: Modellname"`) |
| `pricing` | Objekt mit `prompt`, `completion`, `input_cache_read` und `input_cache_write` (per Token, optional) |
| `context_length` | Kontextfenster in Tokens |
| `architecture.modality` | Modalität (z. B. `"text+image"`) |
| `top_provider.max_completion_tokens` | Maximale Output-Tokens |

Alle Preise werden von Per-Token-Werten auf **/1M Tokens** umgerechnet. Cache-Read und Cache-Write werden getrennt dargestellt. Fehlende Preise bleiben leer und gehen nicht als 0 in Mischpreise ein.

## Coding-Einschätzung

- Ein verfügbarer `benchmarks.artificial_analysis.coding_index` wird als **unveränderter Indexwert** angezeigt, nicht in Sterne umgerechnet oder mit Kontextlänge bzw. allgemeiner Intelligenz vermischt.
- Fehlt der Benchmark, werden konkrete Coding-Hinweise aus Modellname oder Beschreibung angezeigt – ausdrücklich **ohne erfundene Leistungsnote**.
- Fehlen auch solche Hinweise, steht **„Keine Daten“**. Das ist bewusst keine Nullbewertung.
- Ein Tooltip und die Modelldetails kennzeichnen Quelle und Aussagekraft. Die Metadaten-Schätzung ist keine belastbare Leistungsprognose.

## Lizenz

Dieses Projekt ist unter der [MIT-Lizenz](LICENSE) lizenziert.

## Danksagungen

- [OpenRouter](https://openrouter.ai/) für die kostenlose API
- Dem Vue 3-Team für das großartige Framework
- [Feather](https://feathericons.com/) für die schlanken Icons
