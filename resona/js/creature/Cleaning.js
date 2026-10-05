/*
  Cleaning – die Kreatur wird gewaschen (Phase 16, Teil B). Verbindet HygieneSystem (Logik), Verhalten und Szene:
    1. Auslöser: von selbst (Hygiene unter HYGIENE_RULES.autoBelow, nur wenn sie gerade frei ist: Zustand IDLE, nicht beim
       Füttern, nicht im Schlaf) oder auf Wunsch des Spielers (`requestWash()`; ist sie noch sauber, lehnt sie freundlich ab).
    2. Sie geht zum Waschplatz (Zone `wash`, Zustand SEEK_WASH), dreht sich zum Spieler und wird gewaschen (Zustand WASH).
    3. Wasch-Animation (sanft überblendet, „Tiefe“ 0..1): Rumpf wippt leicht, Kopf wiegt mit, Flossen planschen, dazu
       aufsteigende Seifenblasen und ein weicher Blubberlaut.
    4. Ende: von selbst (sauber, kurzes „Abschütteln“, Reaktion „glücklich“ zum Spieler, heller Laut) oder gestoppt
       (`requestStop()`: kurzes Ausklingen, keine Reaktion). Erst danach endet die Aufgabe, sie ist wieder frei.
  Beim Waschen lässt sie sich nicht stören (BUSY_STATES: Antippen tut nichts), gefüttert wird nicht (Gate in Feeding).
  Keine Bestrafung: Stoppen und Abbrechen kosten nichts (HygieneSystem setzt nur eine kurze Pause für das Selbst-Putzen).

  Nicht nur Bewegung/Farbe: Blasen (auch still), Knopfbeschriftung „Fertig“, Statuszeile und die Zeile „Stimmung: wird
  gewaschen“ tragen die Information. „Reduzierte Bewegung“: wenige stille Blasen, kein Wippen, kein Planschen, kein Schütteln
  (nur eine kurze Pause am Ende, die Kopfneigung bleibt).

  REIHENFOLGE (wichtig): `update` läuft NACH idle/behavior/locomotion/expression und VOR interaction (wie Sleeping). Idle setzt
  Rumpf-, Kopf- und Flossenwinkel jeden Frame absolut, hier wird nur addiert (nichts summiert sich über Frames). Berührt NICHT:
  Position/Drehung der Gruppe (Locomotion), Augen, Leuchten, Füße, Rumpfhöhe (Sleeping).

  createCleaning({ hygiene, creature, behavior, locomotion, idle, habitat, sfx, camera, isBusy, isSleeping, react }) ->
    {
      update(dt), requestWash() -> { ok, reason }, requestStop() -> bool,
      isResting() (geht hin, wird gewaschen oder klingt aus), isWashing() (wird gewaschen oder klingt aus), dispose()
    }
    reason: 'busy' | 'clean' | 'asleep' | 'nozone'
  isBusy(): läuft gerade eine Fütterung; isSleeping(): geht sie schlafen oder schläft sie (beide spät gebunden, `feeding` und
  `sleeping` entstehen vor bzw. nach diesem Modul); react(type, { source }): Reaktion der Kreatur (spät gebunden an
  `interaction.react`, source 'wash' zählt nicht als Tippen).
  Werte in js/data/hygiene.js (HYGIENE_RULES, HYGIENE_POSE, HYGIENE_BUBBLES), NICHT im Browser getestet.
*/
import * as THREE from 'three';
import { HYGIENE_RULES, HYGIENE_POSE, HYGIENE_BUBBLES } from '../data/hygiene.js';
import { prefersReducedMotion } from '../core/env.js';
import { STATES } from './Behavior.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => u * u * (3 - 2 * u);
const noop = () => {};

/** Seifenblase als Textur (Canvas): heller Rand, fast durchsichtige Mitte, kleiner Glanzpunkt. */
function createBubbleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, size * 0.18, c, c, size * 0.48);
  g.addColorStop(0, 'rgba(255,255,255,0.08)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.48, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(c - size * 0.15, c - size * 0.15, size * 0.07, 0, TAU);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

export function createCleaning({
  hygiene, creature, behavior, locomotion, idle, habitat, sfx, camera,
  isBusy = () => false, isSleeping = () => false, react = () => false,
}) {
  const P = HYGIENE_POSE;
  const B = HYGIENE_BUBBLES;
  const calm = prefersReducedMotion();
  const { group, parts } = creature;

  let depth = 0;              // 0 aus .. 1 voll dabei (linear, die Bewegung wird per ease() überblendet)
  let finishing = null;       // { natural, t, dur }: Ausklingen nach dem Ende; die Verhaltensaufgabe läuft bis dahin weiter
  let internalChange = false; // eigene Zustandswechsel (interrupt) dürfen den Fremdwechsel-Schutz nicht auslösen
  let clock = 0;

  // ---------- Seifenblasen ----------
  const bubbleTexture = createBubbleTexture();
  const bubbles = [];
  const bRoot = new THREE.Group();
  bRoot.name = 'bubbles';
  group.add(bRoot);
  const bubbleCount = calm ? B.calmCount : B.count;
  for (let i = 0; i < bubbleCount; i++) {
    const mat = new THREE.SpriteMaterial({
      map: bubbleTexture, color: B.color, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.scale.setScalar(B.size);
    bRoot.add(sprite);
    bubbles.push(sprite);
  }

  function updateBubbles(d) {
    if (d <= 0.01) {
      for (const s of bubbles) s.visible = false;
      return;
    }
    bubbles.forEach((s, i) => {
      const a = (i / bubbles.length) * TAU + i * 0.9;
      const x = Math.cos(a) * B.radius;
      const z = Math.sin(a) * B.radius;
      s.visible = true;
      if (calm) {
        // Wenige stille Blasen auf unterschiedlicher Höhe
        s.position.set(x, B.startY + B.height * (0.25 + 0.5 * ((i * 0.37) % 1)), z);
        s.scale.setScalar(B.size * 1.1);
        s.material.opacity = B.opacity * 0.7 * d;
        return;
      }
      const u = ((clock / B.riseSec) + i / bubbles.length) % 1;
      const env = Math.sin(Math.PI * u);
      s.position.set(
        x + B.sway * Math.sin(u * TAU + i * 1.3),
        B.startY + B.height * u,
        z + B.sway * Math.cos(u * TAU + i * 1.9),
      );
      s.scale.setScalar(B.size * (0.55 + 0.9 * u) * (0.8 + 0.4 * ((i * 0.61) % 1)));
      s.material.opacity = B.opacity * env * d;
    });
  }

  // ---------- Ablauf ----------
  function onArrive() {
    if (!hygiene.arrived()) return;
    locomotion.turnTo(camera.position, noop);   // sie lässt sich mit Blick zum Spieler waschen
    if (sfx) sfx.play('splash');
  }

  /** Normales Ende der Verhaltensaufgabe. Nur eine Sicherung: das HygieneSystem beendet schon vorher (HYGIENE_RULES.dwellSlackSec). */
  function onDone() { finishing = null; }

  function begin(reason) {
    const zone = habitat.getZonePosition('wash');
    if (!zone) return { ok: false, reason: 'nozone' };
    if (!hygiene.start(reason)) return { ok: false, reason: 'busy' };

    // Blick beim Waschen: auf einen Bodenpunkt etwas vor ihr in Richtung Spieler
    const toCam = new THREE.Vector3(camera.position.x - zone.x, 0, camera.position.z - zone.z);
    if (toCam.lengthSq() < 1e-4) toCam.set(0, 0, 1);
    toCam.normalize();
    const lookAt = new THREE.Vector3(zone.x + toCam.x * 0.6, 0.05, zone.z + toCam.z * 0.6);

    const started = behavior.goToZone('wash', {
      state: STATES.SEEK_WASH, dwellState: STATES.WASH,
      dwell: HYGIENE_RULES.maxWashSec + HYGIENE_RULES.dwellSlackSec,
      standOff: HYGIENE_RULES.standOff, quiet: true, lookAt, onArrive, onDone,
    });
    if (!started) {
      hygiene.cancel();
      return { ok: false, reason: 'nozone' };
    }
    return { ok: true, reason: null };
  }

  /** Beendet das Waschen und lässt die Bewegung ausklingen; die Aufgabe endet erst in finishDone(). */
  function beginFinish(natural) {
    if (!hygiene.stop({ natural })) return false;
    let dur = P.stopEndSec;
    if (natural) dur = calm ? P.calmEndSec : P.shakeSec;
    finishing = { natural, t: 0, dur };
    if (natural && sfx) sfx.play('fresh');
    if (natural && !calm) idle.triggerGesture('finFlick');   // kleines Flossenzucken zum Schütteln
    return true;
  }

  function finishDone() {
    const natural = finishing ? finishing.natural : false;
    finishing = null;
    internalChange = true;
    behavior.interrupt();              // Aufgabe beenden -> IDLE (ohne onDone)
    internalChange = false;
    if (natural) react('happy', { source: 'wash' });   // frisch gewaschen: freundlicher Blick zum Spieler
  }

  // Wird die Aufgabe von außen ersetzt oder abgebrochen, verlässt der Zustand SEEK_WASH/WASH ohne unser Zutun.
  const offState = behavior.onStateChange((next) => {
    if (internalChange) return;
    if (next === STATES.SEEK_WASH || next === STATES.WASH) return;
    const phase = hygiene.getPhase();
    if (phase === 'going') hygiene.cancel();
    else if (phase === 'washing') hygiene.stop({ natural: false });
    finishing = null;
  });

  // ---------- Von außen ----------
  /** Der Spieler wäscht Reson. Ist sie noch sauber oder beschäftigt, passiert nichts (freundlich, ohne Strafe). */
  function requestWash() {
    if (finishing) return { ok: false, reason: 'busy' };
    if (isSleeping()) return { ok: false, reason: 'asleep' };
    if (isBusy()) return { ok: false, reason: 'busy' };   // beim Füttern nicht dazwischenfunken (react würde die Fütterung ersetzen)
    const check = hygiene.canRequest();
    if (!check.ok) {
      if (check.reason === 'clean') react('content', { source: 'wash' });
      return check;
    }
    return begin('player');
  }

  /** Beendet das Waschen oder bricht den Weg zum Waschplatz ab. Gibt false zurück, wenn es nichts zu tun gab. */
  function requestStop() {
    const phase = hygiene.getPhase();
    if (phase === 'going') {
      internalChange = true;
      behavior.interrupt();
      internalChange = false;
      hygiene.cancel();
      return true;
    }
    if (phase === 'washing') return beginFinish(false);
    return false;
  }

  // ---------- Animation ----------
  function applyPose(d, shake) {
    // Waschen: Rumpf wippt, Kopf wiegt gegenläufig, Flossen planschen. Reduzierte Bewegung: nur eine ruhige Kopfneigung.
    if (calm) {
      parts.head.rotation.z += P.headTilt * 0.5 * d;
      return;
    }
    const s = Math.sin(clock * TAU * P.scrubHz);
    parts.body.rotation.z += P.bodyRoll * d * s;
    parts.head.rotation.z -= P.headTilt * d * s;
    const flap = P.finFlap * d * Math.sin(clock * TAU * P.scrubHz * 1.3 + 0.8);
    parts.fins.left.rotation.z += flap;
    parts.fins.right.rotation.z -= flap;

    // Abschütteln nach dem natürlichen Ende: kurzes, schnelles Zittern, das zum Ende hin abklingt
    if (shake > 0) {
      const w = Math.sin(clock * TAU * P.shakeHz);
      parts.body.rotation.z += P.shakeRoll * shake * w;
      parts.head.rotation.z -= P.shakeHead * shake * w;
    }
  }

  function update(dt) {
    clock += dt;
    hygiene.update(dt);

    // 1. Von selbst Lust auf Waschen? Nur im freien Zustand IDLE, nicht beim Füttern, nicht im Schlaf.
    if (!finishing && hygiene.shouldAutoClean() && behavior.getState() === STATES.IDLE && !isBusy() && !isSleeping()) begin('auto');

    // 2. Sauber?
    if (!finishing && hygiene.shouldFinish()) beginFinish(true);

    // 3. Tiefe: ein beim Waschen, aus beim Ausklingen
    const target = hygiene.getPhase() === 'washing' ? 1 : 0;
    const dur = target > depth ? P.blendInSec : P.blendOutSec;
    if (target > depth) depth = Math.min(target, depth + dt / dur);
    else if (target < depth) depth = Math.max(target, depth - dt / dur);

    // 4. Ausklingen: erst wenn die Bewegung ausgeblendet und die Zeit um ist, endet die Aufgabe (sie ist wieder frei)
    let shake = 0;
    if (finishing) {
      finishing.t += dt;
      if (finishing.natural && !calm) shake = Math.sin(Math.PI * clamp01(finishing.t / finishing.dur));
      if (finishing.t >= finishing.dur && depth <= 0.02) finishDone();
    }

    const d = ease(clamp01(depth));
    if (d > 0.0005 || shake > 0) applyPose(d, shake);
    updateBubbles(d);
  }

  const isResting = () => hygiene.getPhase() !== 'idle' || finishing !== null;
  const isWashing = () => hygiene.getPhase() === 'washing' || finishing !== null;

  function dispose() {
    offState();
    group.remove(bRoot);
    for (const s of bubbles) s.material.dispose();
    bubbleTexture.dispose();
  }

  return { update, requestWash, requestStop, isResting, isWashing, dispose };
}
