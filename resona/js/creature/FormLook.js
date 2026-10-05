/*
  FormLook – Aussehen je Evolutionsform (Phase 27 Teil B1).
  Bisher sahen alle Formen gleich aus (Größe 1,1, Kopf 0,98, tiefere Stimme, goldener Schein). FormLook gibt jeder Form leichte, eigene Züge,
  nur über Zahlen und Farben, ohne neue Geometrie (Zusatzteile sind Teil B2):
    1. Look: Faktoren auf Größe, Kopfgröße, Stimmlage und Lauftempo der Spezialstufe (`EVOLUTIONS[id].look`), begrenzt durch `FORM_RULES.limits`.
    2. Farbton der Leuchtteile: Augen, Brustkern, Kristall, Flossenspitzen und Ringe wandern zur Farbe der Form (`EVOLUTIONS[id].material`,
       Anteil `FORM_RULES.tintMix`). Der Körper selbst bleibt unberührt (die große Farbentwicklung ist Phase 29).
    3. Schein: Farbe und Pulsart des weichen Hofs um den Körper, den `Growth` zeichnet (`getAura()`); die Grunddeckkraft ist für alle Formen gleich.
  Alles gleitet mit dem Übergang in die Spezialstufe (`share` 0..1: 0 = Erwachsene, 1 = Spezialform), nichts springt.
  Keine Form ist besser oder schlechter: nur Farbe, Pulsart und kleine Unterschiede in Proportion, Stimme und Tempo (alle eng begrenzt).

  Schreibt nur `color` und `emissive` der fünf Leuchtmaterialien der Kreatur. Alle anderen Schichten (Idle, Stimmung, Schlaf, Interaktion) schreiben dort
  nur `emissiveIntensity`, die beiden Dinge stören sich also nicht. Größe, Kopf, Stimme und Tempo setzt weiter `Growth` (mit `applyLook`).

  createFormLook({ creature, lifecycle, getFormId }) -> {
    setSource(fn)      Quelle der Form-Id nachträglich setzen (spät gebunden: `evolution` entsteht nach `Growth`); danach `sync()`
    sync()             Übergang überspringen und sofort den richtigen Stand zeigen (erster Bildaufbau, später Laden in Phase 44)
    update(dt)         pro Frame (von `Growth` gerufen, nur außerhalb des Eis)
    applyLook(look)    -> { size, head, pitch, speed } = Look der Stufe mal Faktoren der Form (neues Objekt)
    getAura()          -> { color: THREE.Color, base, depth, rate, wobble } (gemeinsames Objekt, nur lesen)
    getFormId()        Id der Form, die gerade gezeigt wird, oder null
    getShare()         Anteil des Übergangs in die Spezialform 0..1 (für FormParts, Phase 27 Teil B2)
    dispose()          Grundfarben zurücksetzen
  }
  getFormId() liefert die erreichte Form oder, während der Verwandlung, die gewählte (`evolution.getEvolutionId() || evolution.getPendingId()`).
  NICHT im Browser getestet, nicht ausgeführt. Alle Werte sind Startwerte.
*/
import * as THREE from 'three';
import { EVOLUTIONS, FORM_RULES } from '../data/evolution.js';

const SLOTS = ['eye', 'core', 'accent', 'crystal', 'ring'];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (u) => u * u * (3 - 2 * u);

export function createFormLook({ creature, lifecycle, getFormId = () => null }) {
  const { parts } = creature;
  let source = getFormId;

  // Die fünf Leuchtmaterialien (gleiche Objekte, die Idle, Stimmung, Schlaf und Interaktion für `emissiveIntensity` benutzen).
  const finTip = parts.fins && parts.fins.left ? parts.fins.left.getObjectByName('finTip') : null;
  const eyeBall = parts.eyes && parts.eyes.left ? parts.eyes.left.getObjectByName('eyeball') : null;
  const mats = {
    eye: eyeBall ? eyeBall.material : null,
    core: parts.core ? parts.core.material : null,
    accent: finTip ? finTip.material : null,
    crystal: parts.crystal ? parts.crystal.material : null,
    ring: parts.belt ? parts.belt.material : null,
  };

  // Grundfarben merken (Zustand vor jeder Tönung).
  const base = {};
  for (const slot of SLOTS) {
    const m = mats[slot];
    base[slot] = m ? { color: m.color.clone(), emissive: m.emissive.clone() } : null;
  }

  const target = new THREE.Color();
  const auraBase = base.accent ? base.accent.color.clone() : new THREE.Color(0xd4af37);
  const auraTarget = new THREE.Color();
  const aura = { color: auraBase.clone(), base: FORM_RULES.aura.base, depth: FORM_RULES.aura.depth, rate: FORM_RULES.aura.rate, wobble: FORM_RULES.aura.wobble };

  let share = 0;          // 0..1: wie weit der Übergang in die Spezialform ist
  let shownId = null;     // Form, deren Farben gerade angewandt sind
  let appliedKey = '';    // Id + Anteil (gerundet) des zuletzt angewandten Stands, um unnötiges Schreiben zu sparen

  function currentDef() {
    const id = source();
    return id && EVOLUTIONS[id] ? { id, def: EVOLUTIONS[id] } : null;
  }

  /** Wie weit Reson in der Spezialform ist: in der Stufe 1, im Übergang dorthin der weiche Anteil, sonst 0. */
  function targetShare() {
    if (lifecycle.getStageId() === 'special') return 1;
    const tr = lifecycle.getTransition();
    return tr && tr.to === 'special' ? ease(tr.u) : 0;
  }

  function writeColors(found, k) {
    const mat = found && found.def.material;
    const amount = mat ? FORM_RULES.tintMix * k : 0;
    for (const slot of SLOTS) {
      const m = mats[slot];
      const b = base[slot];
      if (!m || !b) continue;
      const hex = mat ? mat[slot] : null;
      if (hex === null || hex === undefined || amount <= 0) {
        m.color.copy(b.color);
        m.emissive.copy(b.emissive);
      } else {
        target.setHex(hex);
        m.color.copy(b.color).lerp(target, amount);
        m.emissive.copy(b.emissive).lerp(target, amount);
      }
    }
    // Schein: Farbe und Pulsart der Form, gleitend vom Grundschein (Gold) zur Farbe der Form; Grunddeckkraft immer gleich.
    const pulse = mat && mat.pulse ? mat.pulse : null;
    aura.color.copy(auraBase);
    if (mat && mat.aura !== null && mat.aura !== undefined) {
      auraTarget.setHex(mat.aura);
      aura.color.lerp(auraTarget, k);
    }
    aura.depth = FORM_RULES.aura.depth + ((pulse && pulse.depth !== undefined ? pulse.depth : FORM_RULES.aura.depth) - FORM_RULES.aura.depth) * k;
    aura.rate = FORM_RULES.aura.rate + ((pulse && pulse.rate !== undefined ? pulse.rate : FORM_RULES.aura.rate) - FORM_RULES.aura.rate) * k;
    aura.wobble = FORM_RULES.aura.wobble + ((pulse && pulse.wobble !== undefined ? pulse.wobble : FORM_RULES.aura.wobble) - FORM_RULES.aura.wobble) * k;
  }

  function refresh(snap, dt) {
    const found = currentDef();
    const want = targetShare();
    if (snap) share = want;
    else share += (want - share) * Math.min(1, dt * 3);
    if (Math.abs(want - share) < 0.002) share = want;

    const id = found ? found.id : null;
    const key = (id || '-') + ':' + share.toFixed(3);
    if (key !== appliedKey) {
      appliedKey = key;
      shownId = id;
      writeColors(found, share);
    }
  }

  function sync() { refresh(true, 0); }

  function update(dt) {
    refresh(false, dt > 0 ? Math.min(dt, 0.25) : 0);
  }

  function applyLook(look) {
    const found = currentDef();
    const f = found ? found.def.look : null;
    const L = FORM_RULES.limits;
    const factor = (k, lim) => (Number.isFinite(k) ? clamp(k, lim[0], lim[1]) : 1);
    const mix = (v, k, lim) => v * (1 + (factor(k, lim) - 1) * share);
    return {
      size: mix(look.size, f ? f.size : 1, L.size),
      head: mix(look.head, f ? f.head : 1, L.head),
      pitch: mix(look.pitch, f ? f.pitch : 1, L.pitch),
      speed: mix(look.speed, f ? f.speed : 1, L.speed),
    };
  }

  function dispose() {
    for (const slot of SLOTS) {
      const m = mats[slot];
      const b = base[slot];
      if (m && b) { m.color.copy(b.color); m.emissive.copy(b.emissive); }
    }
    appliedKey = '';
  }

  sync();

  return {
    setSource(fn) { source = typeof fn === 'function' ? fn : getFormId; sync(); },
    sync, update, applyLook,
    getAura: () => aura,
    getFormId: () => shownId,
    getShare: () => share,
    dispose,
  };
}
