/*
  Sleeping – die Kreatur schläft (Phase 15). Verbindet SleepSystem (Logik), Verhalten und Szene:
    1. Auslöser: von selbst (Energie unter SLEEP_RULES.autoBelow, nur wenn sie gerade frei ist: Zustand IDLE, nicht
       beim Füttern) oder auf Wunsch des Spielers (`requestSleep()`; ist sie noch ausgeruht, lehnt sie freundlich ab).
    2. Sie geht zum Schlafplatz (Zustand SEEK_REST), dreht sich zum Spieler und legt sich hin (Zustand SLEEP).
    3. Liegepose (sanft überblendet, „Tiefe“ 0..1): Rumpf sinkt und wird flacher, Füße eingezogen, Kopf gesenkt,
       Flossen angelegt, Schwanz eingerollt, Augen zu, Leuchten gedimmt, langsamer Schlafatem. Dazu kleine „z“ über dem
       Kopf, ein leiser Atemlaut und ein dunkleres Habitat-Licht (Dämmerlicht; die echte Tageszeit folgt in Phase 32).
    4. Aufwachen: von selbst (ausgeschlafen, Reaktion „zufrieden“ zum Spieler) oder sanft geweckt (`requestWake()`):
       sie streckt sich (Flossenzucken, Gähnen), die Pose blendet aus, erst dann endet die Aufgabe.
  Beim Schlafen lässt sie sich nicht stören (BUSY_STATES: Antippen tut nichts), gefüttert wird nicht (Gate in Feeding).
  Keine Bestrafung: Wecken kostet nichts (SleepSystem setzt nur eine kurze Pause für das Selbst-Hinlegen).

  Nicht nur Bewegung/Farbe: Pose, geschlossene Augen, Zzz (auch still), Dämmerlicht, Knopfbeschriftung „Wecken“ und die
  Textzeile „Stimmung: schläft“ tragen die Information. „Reduzierte Bewegung“: einzelnes stilles z, kein zusätzlicher
  Atem, keine Gesten (triggerGesture tut dann ohnehin nichts); die Pose selbst bleibt (sie ist Ruhe, keine Bewegung).

  REIHENFOLGE (wichtig): `update` läuft NACH idle/behavior/locomotion/expression und VOR interaction. Idle setzt Augenhöhe,
  Kopf-Pitch, Flossen, Schwanz, Füße und die Leuchtwerte jeden Frame absolut, die Stimmungsschicht multipliziert darauf;
  hier wird nochmals multipliziert bzw. addiert (nichts summiert sich über Frames). Ausnahme: `feet[].scale` setzt nur
  diese Schicht (absolut, solange die Tiefe > 0, einmal zurück auf 1 am Ende). Berührt NICHT: Position/Drehung der Gruppe
  (Locomotion), Augen x/z-Skalierung (Interaction).

  createSleeping({ sleep, creature, behavior, locomotion, idle, habitat, sfx, camera, lighting, isBusy, react }) ->
    {
      update(dt), requestSleep() -> { ok, reason }, requestWake() -> bool,
      isResting() (going/asleep/waking), isAsleep() (asleep/waking), dispose()
    }
    reason: 'asleep' | 'rested' | 'busy' | 'nozone'
  isBusy(): läuft gerade eine Fütterung (spät gebunden, `feeding` entsteht nach diesem Modul);
  react(type, { source }): Reaktion der Kreatur (spät gebunden an `interaction.react`, source 'sleep' zählt nicht als Tippen).
  Werte in js/data/sleep.js und CONFIG.creature.sleep, NICHT im Browser getestet.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { SLEEP_RULES, SLEEP_POSE, SLEEP_LIGHT, SLEEP_ZZZ } from '../data/sleep.js';
import { prefersReducedMotion } from '../core/env.js';
import { STATES } from './Behavior.js';
import { TORSO_BOTTOM } from './CreatureModel.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => u * u * (3 - 2 * u);
const noop = () => {};

/** Kleines „z“ als Textur (Canvas), ein gemeinsames Material pro Sprite. */
function createZTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('z', size / 2, size / 2 + 3);
  return new THREE.CanvasTexture(canvas);
}

export function createSleeping({
  sleep, creature, behavior, locomotion, idle, habitat, sfx, camera, lighting,
  isBusy = () => false, react = () => false,
}) {
  const cfg = CONFIG.creature.sleep;
  const P = SLEEP_POSE;
  const Z = SLEEP_ZZZ;
  const calm = prefersReducedMotion();
  const { group, parts } = creature;

  const eyes = [parts.eyes.left, parts.eyes.right];
  const eyeMat = parts.eyes.left.getObjectByName('eyeball').material;   // gleiches Material für beide Augen

  let depth = 0;              // 0 wach .. 1 tief eingeschlafen (linear, die Pose wird per ease() überblendet)
  let waking = false;         // Aufstehen läuft: Zustand SLEEP bleibt, bis die Pose ausgeblendet ist
  let wakeNatural = false;
  let internalChange = false; // eigene Zustandswechsel (interrupt) dürfen den Fremdwechsel-Schutz nicht auslösen
  let feetDirty = false;
  let sighT = P.sighEverySec * 0.5;
  let clock = 0;
  let lastDim = -1;

  // ---------- Zzz ----------
  const zTexture = createZTexture();
  const zSprites = [];
  const zRoot = new THREE.Group();
  zRoot.name = 'zzz';
  group.add(zRoot);
  for (let i = 0; i < Z.count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: zTexture, color: Z.color, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.scale.setScalar(Z.size);
    zRoot.add(sprite);
    zSprites.push(sprite);
  }

  function updateZzz(d) {
    if (d <= 0.01) {
      for (const s of zSprites) s.visible = false;
      return;
    }
    if (calm) {
      // Einzelnes stilles z, bleibt stehen (die Information „schläft“ hängt nicht an Bewegung)
      zSprites.forEach((s, i) => {
        s.visible = i === 0;
        if (i !== 0) return;
        s.position.set(Z.startX, Z.startY + Z.height * 0.35, 0);
        s.scale.setScalar(Z.size * 1.15);
        s.material.opacity = Z.opacity * 0.8 * d;
      });
      return;
    }
    zSprites.forEach((s, i) => {
      const u = ((clock / Z.riseSec) + i / Z.count) % 1;
      const env = Math.sin(Math.PI * u);
      s.visible = true;
      s.position.set(
        Z.startX + Z.sway * Math.sin(u * TAU + i * 1.7),
        Z.startY + Z.height * u,
        0,
      );
      s.scale.setScalar(Z.size * (0.6 + 0.8 * u));
      s.material.opacity = Z.opacity * env * d;
    });
  }

  // ---------- Dämmerlicht ----------
  function updateLight(d) {
    if (!lighting || !lighting.setDim) return;
    if (Math.abs(d - lastDim) < 0.002) return;
    lastDim = d;
    lighting.setDim(d, SLEEP_LIGHT);
  }

  // ---------- Ablauf ----------
  function onArrive() {
    if (!sleep.arrived()) return;
    locomotion.turnTo(camera.position, noop);   // sie legt sich mit Blick zum Spieler hin
    if (sfx) sfx.play('yawn');
    sighT = P.sighEverySec * 0.6;
  }

  /**
   * Normales Ende der Verhaltensaufgabe. Nur eine Sicherung: das SleepSystem weckt schon vorher (SLEEP_RULES.dwellSlackSec),
   * und der Zustandswechsel nach IDLE wird vom Fremdwechsel-Schutz unten abgefangen (er läuft vor onDone).
   */
  function onDone() { waking = false; }

  function begin(reason) {
    const zone = habitat.getZonePosition('sleep');
    if (!zone) return { ok: false, reason: 'nozone' };
    if (!sleep.start(reason)) return { ok: false, reason: 'asleep' };

    // Blick beim Liegen: auf einen Bodenpunkt etwas vor ihr in Richtung Spieler (der Kopf sinkt, die Augen sind zu)
    const toCam = new THREE.Vector3(camera.position.x - zone.x, 0, camera.position.z - zone.z);
    if (toCam.lengthSq() < 1e-4) toCam.set(0, 0, 1);
    toCam.normalize();
    const lookAt = new THREE.Vector3(zone.x + toCam.x * 0.6, 0.05, zone.z + toCam.z * 0.6);

    const started = behavior.goToZone('sleep', {
      state: STATES.SEEK_REST, dwellState: STATES.SLEEP,
      dwell: SLEEP_RULES.maxSleepSec + SLEEP_RULES.dwellSlackSec,
      standOff: SLEEP_RULES.standOff, quiet: true, lookAt, onArrive, onDone,
    });
    if (!started) {
      sleep.cancel();
      return { ok: false, reason: 'nozone' };
    }
    return { ok: true, reason: null };
  }

  function startWake(natural) {
    if (!sleep.wake({ natural })) return false;
    waking = true;
    wakeNatural = natural;
    idle.triggerGesture('finFlick');   // Strecken (bei „reduzierte Bewegung“ tut das nichts)
    if (sfx) sfx.play('yawn');
    return true;
  }

  function finishWake() {
    waking = false;
    internalChange = true;
    behavior.interrupt();              // Aufgabe beenden -> IDLE (ohne onDone)
    internalChange = false;
    if (wakeNatural) react('content', { source: 'sleep' });   // ausgeschlafen: freundlicher Blick zum Spieler
    wakeNatural = false;
  }

  // Wird die Aufgabe von außen ersetzt oder abgebrochen, verlässt der Zustand SEEK_REST/SLEEP ohne unser Zutun.
  const offState = behavior.onStateChange((next) => {
    if (internalChange) return;
    if (next === STATES.SEEK_REST || next === STATES.SLEEP) return;
    const phase = sleep.getPhase();
    if (phase === 'going') sleep.cancel();
    else if (phase === 'asleep') sleep.wake({ natural: false });
    waking = false;
  });

  // ---------- Von außen ----------
  /** Der Spieler legt Reson schlafen. Ist sie noch ausgeruht oder beschäftigt, passiert nichts (freundlich, ohne Strafe). */
  function requestSleep() {
    if (waking) return { ok: false, reason: 'asleep' };
    if (isBusy()) return { ok: false, reason: 'busy' };   // beim Füttern nicht dazwischenfunken (react würde die Fütterung ersetzen)
    const check = sleep.canRequest();
    if (!check.ok) {
      if (check.reason === 'rested') react('content', { source: 'sleep' });
      return check;
    }
    return begin('player');
  }

  /** Weckt Reson sanft oder bricht den Weg zum Schlafplatz ab. Gibt false zurück, wenn es nichts zu tun gab. */
  function requestWake() {
    const phase = sleep.getPhase();
    if (phase === 'going') {
      internalChange = true;
      behavior.interrupt();
      internalChange = false;
      sleep.cancel();
      return true;
    }
    if (phase === 'asleep') return startWake(false);
    return false;
  }

  // ---------- Pose ----------
  function applyPose(d) {
    // Augen zu, Leuchten gedimmt (Idle/Ausdruck setzen die Werte jeden Frame neu, hier wird nur multipliziert)
    const eyeK = 1 + (P.eyeOpen - 1) * d;
    for (const eye of eyes) eye.scale.y *= eyeK;
    eyeMat.emissiveIntensity *= 1 + (P.eyeGlow - 1) * d;
    parts.core.material.emissiveIntensity *= 1 + (P.core - 1) * d;
    parts.crystal.material.emissiveIntensity *= 1 + (P.crystal - 1) * d;

    // Rumpf: flacher, breiter, Unterkante bleibt (wie Idle), dazu sinkt er auf den Boden; langsamer Schlafatem
    const breath = calm ? 0 : P.breathAmp * d * Math.sin((clock * TAU) / P.breathPeriod);
    const f = (1 + (P.squashY - 1) * d) * (1 + breath);
    const w = 1 + (P.widenXZ - 1) * d;
    const s0 = parts.body.scale.y;
    parts.body.scale.x *= w;
    parts.body.scale.z *= w;
    parts.body.scale.y = s0 * f;
    parts.body.position.y += TORSO_BOTTOM * s0 * (f - 1) - P.lower * d;

    // Füße einziehen (nur diese Schicht schreibt feet[].scale), Kopf senken, Flossen anlegen, Schwanz einrollen
    const feetK = 1 + (P.feetScale - 1) * d;
    for (const foot of parts.feet) foot.scale.setScalar(feetK);
    feetDirty = true;
    parts.head.rotation.x += P.headPitch * d;
    parts.fins.left.rotation.z += P.finSpread * d;
    parts.fins.right.rotation.z -= P.finSpread * d;
    for (let i = 0; i < parts.tail.length; i++) parts.tail[i].rotation.y += P.tailCurl * d * (1 + 0.5 * i);
  }

  function update(dt) {
    clock += dt;
    sleep.update(dt);

    // 1. Von selbst müde? Nur im freien Zustand IDLE und nicht beim Füttern.
    if (!waking && sleep.shouldAutoSleep() && behavior.getState() === STATES.IDLE && !isBusy()) begin('auto');

    // 2. Ausgeschlafen?
    if (!waking && sleep.shouldWake()) startWake(true);

    // 3. Tiefe: ein beim Schlafen, aus beim Aufwachen
    const target = sleep.getPhase() === 'asleep' ? 1 : 0;
    const dur = target > depth ? cfg.blendInSec : cfg.blendOutSec;
    if (target > depth) depth = Math.min(target, depth + dt / dur);
    else if (target < depth) depth = Math.max(target, depth - dt / dur);

    // 4. Erst wenn die Pose ausgeblendet ist, endet die Aufgabe (sie steht auf und ist wieder frei)
    if (waking && depth <= 0.02) finishWake();

    // 5. Atemlaut im Schlaf
    if (sleep.getPhase() === 'asleep' && depth >= 0.9 && sfx) {
      sighT -= dt;
      if (sighT <= 0) { sfx.play('sigh'); sighT = P.sighEverySec; }
    }

    const d = ease(clamp01(depth));
    if (d > 0.0005) applyPose(d);
    else if (feetDirty) {
      for (const foot of parts.feet) foot.scale.setScalar(1);
      feetDirty = false;
    }
    updateZzz(d);
    updateLight(d);
  }

  const isResting = () => sleep.getPhase() !== 'awake' || waking;
  const isAsleep = () => sleep.getPhase() === 'asleep' || waking;

  function dispose() {
    offState();
    group.remove(zRoot);
    for (const s of zSprites) s.material.dispose();
    zTexture.dispose();
    for (const foot of parts.feet) foot.scale.setScalar(1);
    if (lighting && lighting.setDim) lighting.setDim(0, SLEEP_LIGHT);
  }

  return { update, requestSleep, requestWake, isResting, isAsleep, dispose };
}
