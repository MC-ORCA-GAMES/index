/*
  LearningSystem – Lernen durch positive Erfahrung (Phase 24). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Merkt sich, welche ORTE (Zonen des Habitats) und welche OBJEKTE (Futter, Spielzeug) Reson mit etwas Schönem verbindet.
    Zuneigung 0..1 je Ort und je Objekt: wächst mit jedem positiven Erlebnis (`note`), je vertrauter, desto langsamer; sinkt NIE
    (nicht durch Zeit, Pause, Abnutzung oder Abwesenheit); es gibt keine negative Zuneigung und kein Meiden (unbekannt = neutral).
  Wirkung (nur über Abfragen, das System steuert nichts selbst):
    getPlaceWeight(zoneId)    Gewicht für die Zonenwahl in Behavior (1 = neutral, bis placeBoost): sie besucht Lieblingsorte etwas öfter
    getObjectAffinity(id)     0..1 für die Wahl des Spielzeugs beim freien Spiel (ToySystem)
    getTop(n) / getSummary()  Einträge für die Oberfläche (nur ab Stufe „vertraut“), mit Wortstufe
  Anti-Grinden: ein Erlebnis zählt je Art und Ort/Objekt höchstens alle `minGapSec` (nur Laufzeit), außerdem bremst die Zuneigung selbst.
  Das Training (Phase 23) liefert den Lernstand der Fähigkeiten getrennt (`training.getLevel`); dieses System kennt nur Orte und Objekte.

  createLearningSystem({ zones, getObjectLabel, now }) ->
    {
      update(dt), note({ kind, place, objectId, level }) -> { ok, placeGain, objectGain } , getPlaceAffinity(id), getObjectAffinity(id), getPlaceWeight(id),
      getTier(value), getTop(n), getSummary(), getRevision(), onLearn(fn), serialize(), restore(data), reset()
    }
    zones: [{ id, label }] (Namen der Orte), getObjectLabel(kind, id) -> Text, now: nicht nötig (Laufzeit über update)
    note: kind = Schlüssel aus LEARN_EXPERIENCES, level = 'loves'|'likes'|'okay'|'meh' (nur für Arten mit `levels`), objectId = Futter-/Spielzeug-Id
  Ereignis onLearn(fn({ type: 'tier'|'first', scope: 'place'|'object', id, tier, label })): Stufenwechsel (nach oben) bzw. erster gelernter Moment.
  Format von serialize(): { version: 1, places: { <zoneId>: Zahl }, objects: { '<kind>:<id>': Zahl } } (für Phase 44; die Mindestabstände nicht).
  NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { LEARN_RULES, LEARN_EXPERIENCES, LEARN_TIERS, LEARN_UI } from '../data/learning.js';

export const LEARN_SAVE_VERSION = 1;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createLearningSystem({ zones = [], getObjectLabel = (kind, id) => id }) {
  const R = LEARN_RULES;
  const places = {};        // zoneId -> 0..1
  const objects = {};       // 'kind:id' -> 0..1
  const lastNote = {};      // Schlüssel -> Laufzeit-Sekunde des letzten zählenden Erlebnisses
  const listeners = new Set();
  let clock = 0;
  let revision = 0;
  let firstDone = false;

  function emit(e) { for (const fn of listeners) fn(e); }

  function tierFor(value) {
    let tier = LEARN_TIERS[0];
    for (const t of LEARN_TIERS) if (value >= t.min) tier = t;
    return tier;
  }

  function zoneLabel(id) {
    const z = zones.find((x) => x.id === id);
    return z ? z.label : id;
  }

  function gap(key) {
    return lastNote[key] === undefined || clock - lastNote[key] >= R.minGapSec;
  }

  /** Erhöht einen Wert; gibt den Zuwachs zurück (0, wenn nichts passierte). Meldet Stufenwechsel nach oben. */
  function raise(map, key, strength, scope, id, label) {
    const cur = map[key] || 0;
    const gain = strength * (1 - R.slowdown * cur);
    if (!(gain > 0)) return 0;
    const next = clamp01(cur + gain);
    map[key] = next;
    revision += 1;
    const before = tierFor(cur);
    const after = tierFor(next);
    if (after.id !== before.id && after.label) emit({ type: 'tier', scope, id, tier: after.id, label: after.label, name: label });
    if (!firstDone && next >= R.firstMemoryAt) { firstDone = true; emit({ type: 'first', scope, id, tier: after.id, label: after.label, name: label }); }
    return gain;
  }

  /** Ein positives Erlebnis. Gibt { ok, placeGain, objectGain } zurück; ok ist falsch, wenn es nicht zählt (unbekannt, zu schnell, nicht positiv genug). */
  function note({ kind, level = null, objectId = null } = {}) {
    const def = LEARN_EXPERIENCES[kind];
    if (!def) return { ok: false, placeGain: 0, objectGain: 0 };
    const strength = def.levels ? (def.levels[level] || 0) : (def.flat || 0);
    if (!(strength > 0)) return { ok: false, placeGain: 0, objectGain: 0 };

    let placeGain = 0;
    let objectGain = 0;
    if (def.place) {
      const k = 'p:' + kind + ':' + def.place;
      if (gap(k)) {
        placeGain = raise(places, def.place, strength, 'place', def.place, zoneLabel(def.place));
        if (placeGain > 0) lastNote[k] = clock;
      }
    }
    if (def.object && objectId) {
      const k = 'o:' + kind + ':' + objectId;
      if (gap(k)) {
        const key = def.object + ':' + objectId;
        objectGain = raise(objects, key, strength, 'object', key, getObjectLabel(def.object, objectId));
        if (objectGain > 0) lastNote[k] = clock;
      }
    }
    return { ok: placeGain > 0 || objectGain > 0, placeGain, objectGain };
  }

  // ---------- Abfragen ----------
  const getPlaceAffinity = (id) => places[id] || 0;
  /** Zuneigung zu einem Objekt (Futter 'food' oder Spielzeug 'toy'; ohne Art: Spielzeug). */
  const getObjectAffinity = (id, kind = 'toy') => objects[kind + ':' + id] || 0;
  const getPlaceWeight = (id) => 1 + getPlaceAffinity(id) * (R.placeBoost - 1);

  function entries() {
    const out = [];
    for (const id of Object.keys(places)) {
      const t = tierFor(places[id]);
      if (t.label) out.push({ scope: 'place', id, name: zoneLabel(id), value: places[id], tier: t.id, tierLabel: t.label });
    }
    for (const key of Object.keys(objects)) {
      const t = tierFor(objects[key]);
      if (!t.label) continue;
      const [kind, id] = key.split(':');
      out.push({ scope: 'object', id: key, name: getObjectLabel(kind, id), value: objects[key], tier: t.id, tierLabel: t.label });
    }
    out.sort((a, b) => b.value - a.value);
    return out;
  }

  const getTop = (n = R.showMax) => entries().slice(0, n);

  function getSummary() {
    const top = getTop();
    return { entries: top, text: top.map((e) => LEARN_UI.entry(e.name, e.tierLabel)).join(LEARN_UI.separator) };
  }

  function update(dt) { if (dt > 0) clock += dt; }

  function serialize() {
    const round = (m) => { const o = {}; for (const k of Object.keys(m)) o[k] = Math.round(m[k] * 10000) / 10000; return o; };
    return { version: LEARN_SAVE_VERSION, places: round(places), objects: round(objects) };
  }

  /** Stellt die Zuneigungen wieder her. Gibt false zurück, wenn das Format nicht passt. Unbekannte Orte/Schlüssel werden übernommen, solange es Zahlen sind. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== LEARN_SAVE_VERSION) return false;
    reset();
    const load = (src, dst) => {
      if (!src || typeof src !== 'object') return;
      for (const k of Object.keys(src)) if (Number.isFinite(src[k]) && src[k] > 0) dst[k] = clamp01(src[k]);
    };
    load(data.places, places);
    load(data.objects, objects);
    firstDone = Object.keys(places).length + Object.keys(objects).length > 0;   // schon Gelerntes: der erste Moment war schon
    revision += 1;
    return true;
  }

  function reset() {
    for (const k of Object.keys(places)) delete places[k];
    for (const k of Object.keys(objects)) delete objects[k];
    for (const k of Object.keys(lastNote)) delete lastNote[k];
    clock = 0;
    firstDone = false;
    revision += 1;
  }

  return {
    update, note, getPlaceAffinity, getObjectAffinity, getPlaceWeight, getTier: tierFor, getTop, getSummary,
    getRevision: () => revision,
    onLearn(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    serialize, restore, reset,
  };
}
