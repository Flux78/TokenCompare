// =============================================================================
// TokenCompare – Vue 3 Composition API (Einseitige Anwendung)
// Datenquelle: OpenRouter API (GET /api/v1/models)
// =============================================================================
const { createApp, ref, computed, watch, onMounted } = Vue;
createApp({
  setup() {
    // =========================================================================
    // Zustand: Daten & UI
    // =========================================================================
    const items = ref([]);       // Rohdaten (alle Modelle von der API)
    const busy = ref(false);     // Ladezustand (während API-Aufruf)
    const err = ref(null);       // Fehlermeldung bei API-Fehler
    const q = ref('');           // Suchtext für Filterung
    const sk = ref('name');      // Sortierschlüssel (Standardsortierung nach Name)
    const up = ref(true);        // Sortierrichtung: true = aufsteigend, false = absteigend
    const favf = ref(false);     // Favoriten-Filter aktiv (nur ★ anzeigen)
    const pricedf = ref(false); // Optional nur Modelle mit Input-Preis anzeigen
    const det = ref(null);       // Detail-Modal: aktuell ausgewähltes Modell-Objekt
    const cl = ref([]);          // Compare-Liste (maximal 5 Modelle)
    const sc = ref(false);       // Compare-Modal sichtbar
    const favs = ref(readFavs()); // Favoriten-IDs aus localStorage
    const updated = ref('');     // Zeitstempel der letzten API-Aktualisierung

    // =========================================================================
    // Zustand: Einstellungen
    // =========================================================================
    const cur = ref('USD');           // Aktive Währung (USD oder EUR)
    const rate = ref(null);           // EUR/USD-Wechselkurs (von open.er-api.com bezogen)
    watch(favs, v => { try { localStorage.setItem('tc_fav', JSON.stringify(v)); } catch (_) {} }, { deep: true }); // automatisches Persistieren der Favoriten
    const mix = ref('chat');          // Mischungsmodus für effektiven Preis ('chat' = 70/30, 'cached' = 60/25/15)
    const mixLabel = computed(() => mix.value === 'chat' ? '70/30' : '60/25/15'); // Anzeigelabel der Mischungsverhältnisse
    const mixName = computed(() => mix.value === 'chat' ? 'Chat 70/30' : 'Cache-Read 60/25/15'); // Ausgeschriebener Name des Modus

    // =========================================================================
    // Abgeleitete Werte
    // =========================================================================
    const cs = computed(() => new Set(cl.value.map(m => m.id))); // Set der Compare-IDs für schnelle O(1)-Prüfung
    const sorts = [{ k: 'name', l: 'Name' }, { k: 'code', l: 'Coding' }, { k: 'input', l: 'Input' }, { k: 'output', l: 'Output' }, { k: 'cached', l: 'Cache Read' }, { k: 'eff', l: 'Effektiv' }, { k: 'ctx', l: 'Kontext' }, { k: 'prov', l: 'Anbieter' }];

    // localStorage kann deaktiviert oder beschädigt sein; die App soll trotzdem starten.
    function readFavs() {
      try {
        const value = JSON.parse(localStorage.getItem('tc_fav') || '[]');
        return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
      } catch (_) { return []; }
    }

    // Domain-Mapping: API-Slug → Domain für Google Favicon Service
    // Wird verwendet, um Provider-Favicons in der Tabelle anzuzeigen
    const domMap = {
      openai:'openai.com',anthropic:'anthropic.com',google:'ai.google.dev',meta:'llama.meta.com',
      mistralai:'mistral.ai',microsoft:'microsoft.com',cohere:'cohere.com',deepseek:'deepseek.com',
      perplexity:'perplexity.ai',together:'together.ai',nvidia:'nvidia.com',
      '01-ai':'01.ai',huggingface:'huggingface.co',databricks:'databricks.com',
      writer:'writer.com',stabilityai:'stability.ai',ai21:'ai21.com',
      xai:'x.ai',inflection:'inflection.ai',liquid:'liquid.ai',
      amazon:'amazon.com',qwen:'qwen.alibaba.com',alibaba:'alibaba.com',
      deepinfra:'deepinfra.com',fireworks:'fireworks.ai',modal:'modal.com',
      lepton:'lepton.ai',replicate:'replicate.com',
    };

    // =========================================================================
    // Daten-Transformation
    // =========================================================================

    // Extrahiert den Provider-Namen aus dem Format "Anbieter: Modellname"
    // Fallback: erstes Segment der ID vor dem Schrägstrich
    function prov(m) { const n = String(m?.name || m?.id || ''), i = n.indexOf(':'); return i > 0 ? n.slice(0, i).trim() : m?.id?.split('/')[0] || '—'; }

    // Generiert Favicon-URL für den Provider (Google Favicons) oder null, falls kein Mapping existiert
    function provIcon(m) { const slug = (m.id||'').split('/')[0], d = domMap[slug]; return d ? 'https://www.google.com/s2/favicons?domain='+d+'&sz=16' : null; }

    // Liest einen numerisch gültigen Preis aus API-Rohdaten und rechnet auf /1M Tokens um
    // t: 'prompt' | 'completion' | 'cached' (Cache-Read) | 'cacheWrite' (Cache-Write)
    function pr(m, t) {
      if (!m?.pricing) return null;
      const field = t === 'cached' ? 'input_cache_read' : t === 'cacheWrite' ? 'input_cache_write' : t;
      const raw = m.pricing[field];
      if (raw == null || raw === '') return null;
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value * 1e6 : null;
    }

    // Liefert ein Emoji-Icon basierend auf den unterstützten Eingabe-Modalitäten
    // Reihenfolge: Audio > Video > Image > Text
    function icn(m) { const i = m.architecture?.input_modalities || []; if (i.includes('audio')) return '🎤'; if (i.includes('video')) return '🎬'; if (i.includes('image')) return '🖼️'; return '📝'; }

    // Erzeugt Modalitäts-Tags aus den Architektur-Daten (Multimodal, Vision, Audio, Video, Text)
    function tags(m) {
      const i = m.architecture?.input_modalities || [], mod = m.architecture?.modality || '', t = [];
      if (i.length > 1 || mod.includes('+')) t.push('Multimodal'); else if (i.includes('image') || mod.includes('image')) t.push('Vision'); else if (i.includes('audio')) t.push('Audio'); else if (i.includes('video')) t.push('Video'); else t.push('Text');
      return t;
    }

    // Deterministische Farbe für Provider-Dot per Hash-Verfahren
    // Gleicher Provider-String → immer gleiche Farbe (stabil für Rendering)
    function pc(p) { const c = ['#818cf8', '#34d399', '#fb7185', '#fbbf24', '#22d3ee', '#a78bfa', '#f472b6', '#a3e635']; let h = 0; for (let i = 0; i < p.length; i++) h = ((h << 5) - h) + p.charCodeAt(i); return c[Math.abs(h) % c.length]; }

    // =========================================================================
    // UI-Formatierung
    // =========================================================================

    // Wandelt USD in EUR um, falls EUR-Modus aktiv ist und Wechselkurs bekannt
    function conv(v) {
      if (v == null) return null;
      if (cur.value !== 'EUR') return v;
      return rate.value != null ? v * rate.value : null;
    }

    // Ermittelt CSS-Preis-Farbklasse anhand des Werts (p1 = günstig, p4 = teuer)
    function cls(v) { if (v == null) return ''; const val = conv(v); if (val == null) return ''; if (val < 0.5) return 'p1'; if (val < 2) return 'p2'; if (val < 10) return 'p3'; return 'p4'; }

    // Formatiert Preise mit ausreichender Genauigkeit, damit kleine Werte nicht zu 0 gerundet werden.
    function fm(v) {
      if (v == null || !Number.isFinite(v)) return '—';
      const amount = conv(v);
      if (amount == null) return '—';
      const formatted = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 8 }).format(amount);
      return (cur.value === 'EUR' ? '€' : '$') + formatted;
    }

    // Formatiert Zahlen im deutschen Locale (Punkt als Tausendertrennzeichen)
    function n(nn) { if (!nn && nn !== 0) return '—'; return nn.toLocaleString('de-DE'); }

    // Vollständige API-Antwort je Modell aufklappbar anzeigen; Vue-Interpolation escaped den Text.
    function raw(m) { try { return JSON.stringify(m, null, 2) || 'Keine API-Daten'; } catch (_) { return 'API-Daten konnten nicht dargestellt werden.'; } }

    // =========================================================================
    // Favoriten-Logik
    // =========================================================================

    // Prüft, ob ein Modell in der Favoritenliste enthalten ist
    function has(m) { return favs.value.includes(m.id); }

    // Fügt Modell zu Favoriten hinzu oder entfernt es (Toggle)
    function fav(m) { const i = favs.value.indexOf(m.id); i >= 0 ? favs.value.splice(i, 1) : favs.value.push(m.id); }

    // =========================================================================
    // Effektiver Mischpreis (Chat: 70/30 Input/Output, Cache: 60/25/15 Input/Output/Cached)
    // =========================================================================
    function eff(m) {
      const inp = pr(m, 'prompt');
      const out = pr(m, 'completion');
      const cached = pr(m, 'cached');
      if (mix.value === 'chat') {
        // Fehlende Preise nicht als 0 ansetzen: Das würde einen irreführenden Mischpreis ergeben.
        if (inp == null || out == null) return null;
        return inp * 0.7 + out * 0.3;
      } else {
        // Der Cache-Mix ist nur berechenbar, wenn alle drei Preise vorliegen.
        if (inp == null || out == null || cached == null) return null;
        return inp * 0.6 + out * 0.25 + cached * 0.15;
      }
    }

    // =========================================================================
    // Event-Handler
    // =========================================================================

    // Schaltet zwischen Chat- und Cache-Mischungsmodus um
    function toggleMix() { mix.value = mix.value === 'chat' ? 'cached' : 'chat'; }

    // Schaltet zwischen USD und EUR um
    function toggleCur() { cur.value = cur.value === 'USD' ? 'EUR' : 'USD'; }

    // Holt den aktuellen EUR/USD-Wechselkurs von der kostenlosen open.er-api.com
    async function fetchRate() {
      try {
        const r = await window.fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        const eur = Number(d.rates?.EUR);
        if (d.result === 'success' && Number.isFinite(eur) && eur > 0) rate.value = eur;
      } catch (_) { /* USD bleibt nutzbar, falls der Wechselkursdienst ausfällt. */ }
    }

    // Ändert Sortierschlüssel oder kippt die Sortierrichtung bei erneutem Klick
    function srt(k) { if (sk.value === k) up.value = !up.value; else { sk.value = k; up.value = k === 'name'; } }

    // =========================================================================
    // Gefilterte & sortierte Liste
    // =========================================================================

    // Wendet Suchtext-Filter und optionalen Favoriten-Filter auf die Rohdaten an
    const show = computed(() => {
      let l = items.value;
      // Textsuche über Name, ID und Provider-Name
      if (q.value) { const s = q.value.toLowerCase(); l = l.filter(m => String(m.name || '').toLowerCase().includes(s) || m.id.toLowerCase().includes(s) || String(m.description || '').toLowerCase().includes(s) || prov(m).toLowerCase().includes(s)); }
      // Favoriten-Filter: nur Modelle in der Favoritenliste
      if (favf.value) l = l.filter(m => favs.value.includes(m.id));
      // Preisfilter ist optional; standardmäßig bleiben auch nicht bepreiste Modelle sichtbar.
      if (pricedf.value) l = l.filter(m => pr(m, 'prompt') != null);
      return l;
    });

    // Sortiert die gefilterte Liste (Favoriten nur bei Name-Sortierung bevorzugt)
    const rows = computed(() => {
      const l = [...show.value], f = new Set(favs.value);
      l.sort((a, b) => {
        // Favoriten nur bei Standardsortierung nach Name an den Anfang
        if (sk.value === 'name') {
          const af = f.has(a.id) ? 0 : 1, bf = f.has(b.id) ? 0 : 1;
          if (af !== bf) return af - bf;
        }
        let c = 0;
        switch (sk.value) {
          case 'name': c = (a.name || '').localeCompare(b.name || ''); break;
          case 'prov': c = prov(a).localeCompare(prov(b)); break;
          case 'input': return compareNullable(pr(a, 'prompt'), pr(b, 'prompt'), up.value);
          case 'output': return compareNullable(pr(a, 'completion'), pr(b, 'completion'), up.value);
          case 'cached': return compareNullable(pr(a, 'cached'), pr(b, 'cached'), up.value);
          case 'eff': return compareNullable(eff(a), eff(b), up.value);
          case 'code': return compareCoding(a, b, up.value);
          case 'ctx': return compareNullable(a.context_length, b.context_length, up.value);
        }
        return up.value ? c : -c;
      });
      return l;
    });

    // Fehlende Werte bleiben unabhängig von der Sortierrichtung am Ende.
    function compareNullable(a, b, ascending = true) {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return ascending ? a - b : b - a;
    }

    // Benchmarkwerte und Heuristiken sind nicht direkt vergleichbar: Benchmarkdaten zuerst.
    function compareCoding(a, b, ascending = true) {
      const ra = coding(a), rb = coding(b);
      const rank = { unknown: 0, estimate: 1, benchmark: 2 };
      if (ra.kind === 'unknown' || rb.kind === 'unknown') {
        if (ra.kind === rb.kind) return 0;
        return ra.kind === 'unknown' ? 1 : -1;
      }
      if (ra.kind !== rb.kind) return rank[rb.kind] - rank[ra.kind];
      return compareNullable(ra.score, rb.score, ascending);
    }

    // =========================================================================
    // Compare-Modal: Tabellenzeilen generieren
    // =========================================================================
    const cr = computed(() => {
      if (!cl.value.length) return [];
      // Jede Zeile repräsentiert eine Eigenschaft, die für alle verglichenen Modelle angezeigt wird
      const r = [
        { k: 'prov', i: '🏢', l: 'Anbieter', c: cl.value.map(m => prov(m)) },
        { k: 'code', i: '💻', l: 'Coding-Einschätzung', c: cl.value.map(m => coding(m).label) },
        { k: 'input', i: '📥', l: 'Input / 1M', c: cl.value.map(m => fm(pr(m, 'prompt'))) },
        { k: 'output', i: '📤', l: 'Output / 1M', c: cl.value.map(m => fm(pr(m, 'completion'))) },
      ];
      // Cached-Zeile nur anzeigen, wenn mindestens ein Modell Cache-Preise hat
      if (cl.value.some(m => pr(m, 'cached') != null)) r.push({ k: 'cached', i: '💾', l: 'Cache Read / 1M', c: cl.value.map(m => pr(m, 'cached') != null ? fm(pr(m, 'cached')) : '—') });
      if (cl.value.some(m => pr(m, 'cacheWrite') != null)) r.push({ k: 'cacheWrite', i: '📝', l: 'Cache Write / 1M', c: cl.value.map(m => pr(m, 'cacheWrite') != null ? fm(pr(m, 'cacheWrite')) : '—') });
      r.push({ k: 'eff', i: '💰', l: 'Effektiv / 1M', c: cl.value.map(m => fm(eff(m))) });
      r.push({ k: 'ctx', i: '📐', l: 'Kontext', c: cl.value.map(m => m.context_length ? n(m.context_length) + ' T' : '—') });
      r.push({ k: 'out', i: '📏', l: 'Max Output', c: cl.value.map(m => m.top_provider?.max_completion_tokens ? n(m.top_provider.max_completion_tokens) + ' T' : '—') });
      r.push({ k: 'arch', i: '🏗️', l: 'Architektur', c: cl.value.map(m => m.architecture?.modality || m.architecture?.model_type || '—') });
      // Tokenizer-Zeile nur anzeigen, wenn mindestens ein Modell diese Info bereitstellt
      if (cl.value.some(m => m.architecture?.tokenizer)) r.push({ k: 'tok', i: '🔤', l: 'Tokenizer', c: cl.value.map(m => m.architecture?.tokenizer || '—') });
      return r;
    });

    // Ermittelt für eine Preiskategorie das günstigste Modell in der Compare-Liste
    // Wird verwendet, um die beste Option grün zu markieren
    function best(rk, ci) {
      if (!['input', 'output', 'cached', 'eff'].includes(rk)) return false;
      let v;
      if (rk === 'eff') {
        v = cl.value.map(m => eff(m));
      } else {
        v = cl.value.map(m => pr(m, rk === 'input' ? 'prompt' : rk === 'output' ? 'completion' : 'cached'));
      }
      const vl = v.map((x, i) => x != null ? { v: x, i } : null).filter(x => x);
      if (!vl.length) return false;
      const m = vl.reduce((a, b) => a.v < b.v ? a : b);
      return m.i === ci;
    }

    // =========================================================================
    // Coding-Einschätzung: Benchmarkwerte klar von nicht kalibrierten Schätzungen trennen.
    // =========================================================================
    function coding(m) {
      const raw = m?.benchmarks?.artificial_analysis?.coding_index;
      const index = raw == null || raw === '' ? NaN : Number(raw);
      if (Number.isFinite(index) && index >= 0) {
        const score = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(index);
        return {
          kind: 'benchmark', score: index, label: 'AA ' + score,
          title: 'OpenRouter-Metadaten: Artificial Analysis Coding Index ' + score + ' (unveränderter Indexwert, kein 5-Sterne-Rating)'
        };
      }

      const text = ((m?.name || '') + ' ' + (m?.id || '') + ' ' + (m?.description || '')).toLowerCase();
      const dedicated = /codestral|wizardcoder|codeqwen|starcoder|deepseek[- ]coder|codegemma|devstral|qwen\w*[- ]coder/i.test(text);
      const coderName = /\bcoder\b|code[-_ ]?gen/i.test(text);
      const codingDescription = /\bcoding\b|code generation|\bprogramming\b|software engineer|software development|coding assistant/i.test(text);
      if (!dedicated && !coderName && !codingDescription) {
        return { kind: 'unknown', score: null, label: 'Keine Daten', title: 'Keine Coding-Benchmarkdaten oder eindeutigen Coding-Hinweise gefunden' };
      }

      // Nur das Vorhandensein/Stärke eines Coding-Hinweises bewerten, nicht die Modellleistung.
      const estimate = dedicated ? 3 : (coderName ? 2 : 1);
      const reason = dedicated ? 'spezialisierter Coding-Modellname' : (coderName ? 'Coding-Hinweis im Modellnamen' : 'Coding-Angabe in der Beschreibung');
      return {
        kind: 'estimate', score: estimate,
        label: dedicated ? 'Coding-Fokus' : (coderName ? 'Name-Hinweis' : 'Text-Hinweis'),
        title: 'Metadaten-Hinweis (' + reason + '); keine benchmark-basierte Aussage über die tatsächliche Coding-Leistung'
      };
    }

    // =========================================================================
    // Compare-Liste verwalten (maximal 5 Modelle)
    // =========================================================================

    // Fügt ein Modell zur Compare-Liste hinzu oder entfernt es (Toggle)
    // Öffnet Compare-Modal automatisch ab 2 Modellen
    function cmp(m) {
      if (cs.value.has(m.id)) { cl.value = cl.value.filter(x => x.id !== m.id); return; }
      if (cl.value.length >= 5) return;
      cl.value.push(m);
      if (cl.value.length >= 2) sc.value = true;
    }

    // Entfernt ein Modell aus der Compare-Liste; schließt Modal unter 2 Modellen
    function rc(m) { cl.value = cl.value.filter(x => x.id !== m.id); if (cl.value.length < 2) sc.value = false; }

    // =========================================================================
    // API-Aufrufe
    // =========================================================================

    // Lädt alle Modelle von der OpenRouter API; Modelle ohne Preisangaben bleiben enthalten.
    async function load() {
      busy.value = true;
      err.value = null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let r;
        try {
          r = await window.fetch('https://openrouter.ai/api/v1/models', { cache: 'no-cache', signal: controller.signal });
        } finally { clearTimeout(timeout); }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        if (!Array.isArray(d.data)) throw new Error('Unerwartetes API-Antwortformat');
        // Alle von OpenRouter gelieferten Modelle behalten; fehlende Preise werden als „—“ gezeigt.
        const refreshed = d.data.filter(m => m && typeof m === 'object' && typeof m.id === 'string');
        const byId = new Map(refreshed.map(m => [m.id, m]));
        items.value = refreshed;
        cl.value = cl.value.map(m => byId.get(m.id)).filter(Boolean);
        if (det.value) det.value = byId.get(det.value.id) || null;
        if (cl.value.length < 2) sc.value = false;
        updated.value = new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
      } catch (e) {
        err.value = e.name === 'AbortError' ? 'Zeitüberschreitung beim Laden der Modelle.' : 'Fehler: ' + e.message;
      } finally {
        busy.value = false;
      }
    }

    // Initiale Datenladung beim Start
    onMounted(() => { load(); fetchRate(); });

    // =========================================================================
    // Template-Binding: Alle reaktiven Werte und Funktionen für das Vue-Template
    // =========================================================================
    return { items, busy, err, q, sk, up, favf, pricedf, det, cl, sc, favs, updated, cur, rate, mixLabel, mixName, cs, sorts, prov, provIcon, pr, icn, tags, pc, cls, fm, n, raw, has, fav, srt, show, rows, cr, best, coding, cmp, rc, load, eff, toggleMix, toggleCur };
  }
}).mount('#app');
