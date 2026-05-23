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
    const det = ref(null);       // Detail-Modal: aktuell ausgewähltes Modell-Objekt
    const cl = ref([]);          // Compare-Liste (maximal 5 Modelle)
    const sc = ref(false);       // Compare-Modal sichtbar
    const favs = ref(JSON.parse(localStorage.getItem('tc_fav') || '[]')); // Favoriten-IDs aus localStorage
    const updated = ref('');     // Zeitstempel der letzten API-Aktualisierung

    // =========================================================================
    // Zustand: Einstellungen
    // =========================================================================
    const cur = ref('USD');           // Aktive Währung (USD oder EUR)
    const rate = ref(null);           // EUR/USD-Wechselkurs (von open.er-api.com bezogen)
    watch(favs, v => localStorage.setItem('tc_fav', JSON.stringify(v)), { deep: true }); // automatisches Persistieren der Favoriten
    const mix = ref('chat');          // Mischungsmodus für effektiven Preis ('chat' = 70/30, 'cached' = 60/25/15)
    const mixLabel = computed(() => mix.value === 'chat' ? '70/30' : '60/25/15'); // Anzeigelabel der Mischungsverhältnisse
    const mixName = computed(() => mix.value === 'chat' ? 'Chat 70/30' : 'Cache 60/25/15'); // Ausgeschriebener Name des Modus

    // =========================================================================
    // Abgeleitete Werte
    // =========================================================================
    const cs = computed(() => new Set(cl.value.map(m => m.id))); // Set der Compare-IDs für schnelle O(1)-Prüfung
    const sorts = [{ k: 'name', l: 'Name' }, { k: 'input', l: 'Input' }, { k: 'output', l: 'Output' }, { k: 'cached', l: 'Cached' }, { k: 'eff', l: 'Effektiv' }, { k: 'ctx', l: 'Kontext' }, { k: 'prov', l: 'Anbieter' }];

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
    function prov(m) { const n = m.name || m.id || '', i = n.indexOf(':'); return i > 0 ? n.slice(0, i).trim() : m.id?.split('/')[0] || '—'; }

    // Generiert Favicon-URL für den Provider (Google Favicons) oder null, falls kein Mapping existiert
    function provIcon(m) { const slug = (m.id||'').split('/')[0], d = domMap[slug]; return d ? 'https://www.google.com/s2/favicons?domain='+d+'&sz=16' : null; }

    // Liest Preis aus API-Rohdaten, führt parseFloat aus und rechnet auf /1M Tokens um
    // t: 'prompt' | 'completion' | 'cached' (bei cached wird input_cache_read bevorzugt)
    function pr(m, t) {
      if (!m.pricing) return null;
      if (t === 'cached') { let r = parseFloat(m.pricing.input_cache_read); if (!isNaN(r)) return r * 1e6; r = parseFloat(m.pricing.input_cache_write); if (!isNaN(r)) return r * 1e6; return null; }
      const r = parseFloat(m.pricing[t]); return isNaN(r) ? null : r * 1e6;
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
    function conv(v) { return cur.value === 'EUR' && rate.value != null && v != null ? v * rate.value : v; }

    // Ermittelt CSS-Preis-Farbklasse anhand des Werts (p1 = günstig, p4 = teuer)
    function cls(v) { if (v == null) return ''; const val = conv(v); if (val < 0.5) return 'p1'; if (val < 2) return 'p2'; if (val < 10) return 'p3'; return 'p4'; }

    // Formatiert Preis mit Währungszeichen, auf 4 Dezimalstellen, ohne überflüssige Nullen
    function fm(v) { if (v == null) return '—'; const sym = cur.value === 'EUR' ? '€' : '$'; if (v === 0) return sym + '0'; let s = conv(v).toFixed(4).replace(/0+$/, ''); if (s.endsWith('.')) s = s.slice(0, -1); return sym + s; }

    // Formatiert Zahlen im deutschen Locale (Punkt als Tausendertrennzeichen)
    function n(nn) { if (!nn && nn !== 0) return '—'; return nn.toLocaleString('de-DE'); }

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
        // Chat-Modus: 70% Input + 30% Output (typisches Chat-Nutzungsverhältnis)
        if (inp == null && out == null) return null;
        return (inp ?? 0) * 0.7 + (out ?? 0) * 0.3;
      } else {
        // Cache-Modus: 60% Input + 25% Output + 15% Cached (bei vielen Cache-Treffern)
        if (inp == null && out == null && cached == null) return null;
        return (inp ?? 0) * 0.6 + (out ?? 0) * 0.25 + (cached ?? inp ?? 0) * 0.15;
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
    async function fetchRate() { try { const r = await window.fetch('https://open.er-api.com/v6/latest/USD'); const d = await r.json(); rate.value = d.rates?.EUR || null; } catch (_) {} }

    // Ändert Sortierschlüssel oder kippt die Sortierrichtung bei erneutem Klick
    function srt(k) { if (sk.value === k) up.value = !up.value; else { sk.value = k; up.value = k === 'name'; } }

    // =========================================================================
    // Gefilterte & sortierte Liste
    // =========================================================================

    // Wendet Suchtext-Filter und optionalen Favoriten-Filter auf die Rohdaten an
    const show = computed(() => {
      let l = items.value;
      // Textsuche über Name, ID und Provider-Name
      if (q.value) { const s = q.value.toLowerCase(); l = l.filter(m => (m.name || '').toLowerCase().includes(s) || (m.id || '').toLowerCase().includes(s) || prov(m).toLowerCase().includes(s)); }
      // Favoriten-Filter: nur Modelle in der Favoritenliste
      if (favf.value) l = l.filter(m => favs.value.includes(m.id));
      return l;
    });

    // Sortiert die gefilterte Liste (Favoriten werden immer oben angezeigt)
    const rows = computed(() => {
      const l = [...show.value], f = new Set(favs.value);
      l.sort((a, b) => {
        // Favoriten zuerst (0 = Favorit, 1 = kein Favorit)
        const af = f.has(a.id) ? 0 : 1, bf = f.has(b.id) ? 0 : 1;
        if (af !== bf) return af - bf;
        let c = 0;
        switch (sk.value) {
          case 'name': c = (a.name || '').localeCompare(b.name || ''); break;
          case 'prov': c = prov(a).localeCompare(prov(b)); break;
          case 'input': c = (pr(a, 'prompt') ?? Infinity) - (pr(b, 'prompt') ?? Infinity); break;
          case 'output': c = (pr(a, 'completion') ?? Infinity) - (pr(b, 'completion') ?? Infinity); break;
          case 'cached': c = (pr(a, 'cached') ?? Infinity) - (pr(b, 'cached') ?? Infinity); break;
          case 'eff': c = (eff(a) ?? Infinity) - (eff(b) ?? Infinity); break;
          case 'code': c = cd(a) - cd(b); break;
          case 'ctx': c = (a.context_length ?? -1) - (b.context_length ?? -1); break;
        }
        return up.value ? c : -c;
      });
      return l;
    });

    // =========================================================================
    // Compare-Modal: Tabellenzeilen generieren
    // =========================================================================
    const cr = computed(() => {
      if (!cl.value.length) return [];
      // Jede Zeile repräsentiert eine Eigenschaft, die für alle verglichenen Modelle angezeigt wird
      const r = [
        { k: 'prov', i: '🏢', l: 'Anbieter', c: cl.value.map(m => prov(m)) },
        { k: 'code', i: '💻', l: 'Coding', c: cl.value.map(m => '★'.repeat(cd(m)) + '☆'.repeat(5 - cd(m))) },
        { k: 'input', i: '📥', l: 'Input / 1M', c: cl.value.map(m => fm(pr(m, 'prompt'))) },
        { k: 'output', i: '📤', l: 'Output / 1M', c: cl.value.map(m => fm(pr(m, 'completion'))) },
      ];
      // Cached-Zeile nur anzeigen, wenn mindestens ein Modell Cache-Preise hat
      if (cl.value.some(m => pr(m, 'cached'))) r.push({ k: 'cached', i: '💾', l: 'Cached / 1M', c: cl.value.map(m => pr(m, 'cached') ? fm(pr(m, 'cached')) : '—') });
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
    // Coding-Rating (Heuristik basierend auf Modell-ID und Beschreibung)
    // =========================================================================
    function cd(m) {
      const d = (m.description || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      // Bekannte Code-spezifische Modelle erhalten sofort 5/5
      if (/codestral|cursor|wizardcoder|codeqwen|starcoder|deepseek-coder|codegemma/i.test(id)) return 5;
      let s = 0;
      // Beschreibungs-Matches (+2 für explizite Coding-Keywords)
      if (/\bcoding\b|\bcode generation\b|\bprogramming\b|\bsoftware engineer\b/i.test(d)) s += 2;
      // Schwächere Indikatoren (+1 für Reasoning, Developer, etc.)
      if (/reasoning|agentic|developer|instruction|technical/i.test(d)) s += 1;
      // Hochwertige Modelle, die gut coden können (+1)
      if (/claude|gpt-4|gemini.*(?:pro|ultra|flash)|qwen.*(?:max|plus|72)|command.*plus|deepseek.*(?:v[23]|r1)/i.test(id)) s += 1;
      // Spezifische Coder-Keywords in der ID (+2)
      if (/coder|code[-_]?gen/i.test(id)) s += 2;
      return Math.min(s, 5);
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

    // Lädt alle Modelle von der OpenRouter API und filtert Modelle ohne Preisangabe
    async function load() {
      busy.value = true;
      err.value = null;
      try {
        const r = await window.fetch('https://openrouter.ai/api/v1/models');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        // Nur Modelle mit gültigem Input-Preis behalten
        items.value = (d.data || []).filter(m => m.pricing?.prompt != null);
        updated.value = new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
      } catch (e) {
        err.value = 'Fehler: ' + e.message;
      } finally {
        busy.value = false;
      }
    }

    // Initiale Datenladung beim Start
    onMounted(() => { load(); fetchRate(); });

    // =========================================================================
    // Template-Binding: Alle reaktiven Werte und Funktionen für das Vue-Template
    // =========================================================================
    return { items, busy, err, q, sk, up, favf, det, cl, sc, favs, updated, cur, mixLabel, mixName, cs, sorts, prov, provIcon, pr, icn, tags, pc, cls, fm, n, has, fav, srt, show, rows, cr, best, cd, cmp, rc, load, eff, toggleMix, toggleCur };
  }
}).mount('#app');
