/*
  ColorLook – Körperfarbe der Kreatur (Phase 29, Farbentwicklung). Wendet an, was `ColorSystem` aus Lebensstufe und Pigmenten ableitet.
  Schreibt nur `color` der beiden Körpermaterialien:
    body       Rumpf, Kopf, Schwanz (gleiches Material wie `parts.torso`)  <- führende Farbe
    bodyLight  Füße und Flossen (gleiches Material wie `parts.feet[0]`)    <- zweite Farbe
  Alle Leuchtteile (`FormLook`) und die dunkle Gesichtsplatte bleiben unberührt; Idle, Stimmung, Schlaf und Interaktion schreiben an den
  Körpermaterialien nichts (nur `emissiveIntensity` der Leuchtteile), die Schichten stören sich also nicht.
  Die Farbe gleitet (kein Springen beim Stufenwechsel): der gezeigte Anteil nähert sich dem Ziel mit `FOLLOW` pro Sekunde, `sync()` setzt ihn sofort.

  createColorLook({ creature, color }) -> {
    sync()       sofort den richtigen Stand zeigen (erster Bildaufbau, später Laden in Phase 44)
    update(dt)   pro Frame (nach dem Anlegen in `main.js` als eigener Updater; Wachstum und Entwicklung laufen von selbst)
    getShown()   -> { body: Anteil 0..1, light: Anteil 0..1 } (nur lesen)
    dispose()    Grundfarben zurücksetzen
  }
  `color` ist das ColorSystem. NICHT im Browser getestet, nicht ausgeführt. Alle Werte sind Startwerte.
*/
import * as THREE from 'three';

const FOLLOW = 1.5;   // Anteil des Restwegs pro Sekunde (weich, aber nicht träge)

export function createColorLook({ creature, color }) {
  const { parts } = creature;
  const mats = {
    body: parts.torso ? parts.torso.material : null,
    light: parts.feet && parts.feet[0] ? parts.feet[0].material : null,
  };
  const base = {};
  for (const slot of ['body', 'light']) base[slot] = mats[slot] ? mats[slot].color.clone() : null;

  const target = new THREE.Color();
  const shown = { body: 0, light: 0 };
  const hexOf = { body: null, light: null };
  let appliedKey = '';

  function write(slot) {
    const m = mats[slot];
    const b = base[slot];
    if (!m || !b) return;
    if (hexOf[slot] === null || shown[slot] <= 0) m.color.copy(b);
    else { target.setHex(hexOf[slot]); m.color.copy(b).lerp(target, shown[slot]); }
  }

  function refresh(snap, dt) {
    const t = color.getTint();
    const step = snap ? 1 : Math.min(1, dt * FOLLOW);
    for (const slot of ['body', 'light']) {
      const want = t[slot].amount;
      if (hexOf[slot] !== t[slot].hex) {
        // Andere Farbe (z. B. nach dem Laden eines anderen Stands): erst von der Grundfarbe aus weiter, nicht durch die alte Farbe.
        hexOf[slot] = t[slot].hex;
        if (!snap) shown[slot] = 0;
      }
      shown[slot] += (want - shown[slot]) * step;
      if (Math.abs(want - shown[slot]) < 0.001) shown[slot] = want;
    }
    const key = (hexOf.body || '-') + ':' + shown.body.toFixed(3) + '|' + (hexOf.light || '-') + ':' + shown.light.toFixed(3);
    if (key !== appliedKey) {
      appliedKey = key;
      write('body');
      write('light');
    }
  }

  function sync() { refresh(true, 0); }
  function update(dt) { refresh(false, dt > 0 ? Math.min(dt, 0.25) : 0); }

  function dispose() {
    for (const slot of ['body', 'light']) if (mats[slot] && base[slot]) mats[slot].color.copy(base[slot]);
    appliedKey = '';
  }

  sync();
  return { sync, update, getShown: () => shown, dispose };
}
