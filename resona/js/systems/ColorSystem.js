/*
  ColorSystem – Farbentwicklung der Kreatur (Phase 29). Reine Logik, kein Three.js, kein DOM, KEIN eigener Speicherstand.
  Alles wird aus zwei vorhandenen Quellen abgeleitet, es gibt also keine zweite Wahrheit und nichts zu speichern (Phase 44 speichert
  `lifecycle` und `hidden`, die Farbe folgt danach von selbst):
    Entwicklung  aus der Lebensstufe: `COLOR_RULES.development` am Anfang jeder Stufe, innerhalb der Stufe gleitend zur nächsten
                 (gleiche Rechnung wie `LifecycleSystem.getLook`: im Übergang gilt schon der Wert der nächsten Stufe). Wächst nur, geht nie zurück.
    Farben       aus den Pigmenten (`hidden.getPigments()`): führende Farbe -> Körper, zweite Farbe -> Füße und Flossen.

  createColorSystem({ lifecycle, getPigments }) -> {
    getDevelopment()   Zahl 0..1 (0 = Grundfarben, 1 = Endfarbe)
    getTint()          -> { development, body: { id, hex|null, amount }, light: { id, hex|null, amount } } (gemeinsames Objekt, nur lesen);
                          `hex` null = Grundfarbe (Schwarz), `amount` = Anteil der Endfarbe 0..1 (Entwicklung mal `maxMix`)
    getPrimaryId()     führende Farbe (oder null ohne Pigmente)
    getSecondaryId()   zweite Farbe (oder null)
  }
  Ohne `getPigments` oder bei unbekannten Ids bleibt alles in Grundfarben. NICHT im Browser getestet, Zahlen sind Startwerte.
*/
import { COLOR_WORLDS, COLOR_RULES } from '../data/colors.js';
import { LIFE_PATH } from '../data/lifecycle.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => u * u * (3 - 2 * u);

export function createColorSystem({ lifecycle, getPigments = null }) {
  const tint = {
    development: 0,
    body: { id: null, hex: null, amount: 0 },
    light: { id: null, hex: null, amount: 0 },
  };
  const devOf = (stageId) => {
    const v = COLOR_RULES.development[stageId];
    return Number.isFinite(v) ? v : 0;
  };

  function pigmentIds() {
    const p = typeof getPigments === 'function' ? getPigments() : null;
    const ok = (id) => (typeof id === 'string' && COLOR_WORLDS[id] ? id : null);
    return p ? { primary: ok(p.primary), secondary: ok(p.secondary) } : { primary: null, secondary: null };
  }

  /** Wie `LifecycleSystem.getLook`: vom Anfang der Stufe zum Anfang der nächsten; im Übergang schon die nächste. */
  function getDevelopment() {
    const stageId = lifecycle.getStageId();
    const a = devOf(stageId);
    const tr = lifecycle.getTransition();
    const p = clamp(lifecycle.getProgress(), 0, 1);
    const i = LIFE_PATH.indexOf(stageId);   // die nächste Stufe wie `nextOf` im LifecycleSystem (nach Erwachsen gibt es keine mehr)
    const to = tr ? tr.to : (i >= 0 && i + 1 < LIFE_PATH.length ? LIFE_PATH[i + 1] : null);
    const b = to ? devOf(to) : a;
    const u = tr ? Math.max(ease(p), ease(clamp(tr.u, 0, 1))) : (to ? ease(p) : 0);
    return clamp(lerp(a, b, u), 0, 1);
  }

  function getTint() {
    const dev = getDevelopment();
    const { primary, secondary } = pigmentIds();
    tint.development = dev;
    const fill = (slot, id, key, mix) => {
      const world = id ? COLOR_WORLDS[id] : null;
      const hex = world ? world[key] : null;
      slot.id = id;
      slot.hex = hex === undefined ? null : hex;
      slot.amount = slot.hex === null ? 0 : clamp(dev * mix, 0, 1);
    };
    fill(tint.body, primary, 'body', COLOR_RULES.maxMix.body);
    fill(tint.light, secondary, 'light', COLOR_RULES.maxMix.light);
    return tint;
  }

  return {
    getDevelopment, getTint,
    getPrimaryId: () => pigmentIds().primary,
    getSecondaryId: () => pigmentIds().secondary,
  };
}
