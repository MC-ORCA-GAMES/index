/*
  Playing – die Kreatur spielt mit einem Spielzeug (Phase 18). Verbindet ToySystem (Logik), Verhalten und Szene:
    1. Auslöser: `play(toyId)` auf Wunsch des Spielers (Knopf „Spielen“). Optional `source: 'auto'` für das freie Spiel (Phase 19,
       dort entscheidet die Kreatur selbst; die Schnittstelle ist schon da). Ist sie zu müde, lehnt sie freundlich ab.
    2. Das Spielzeug erscheint im Spielbereich (Zone `play`, Objekt aus js/world/ToyModels.js), sie geht hin (Zustand SEEK_PLAY),
       bleibt in Abstand `standOff` stehen und spielt (Zustand PLAY).
    3. Spielen: Blick folgt dem Spielzeug, sie dreht sich auf der Stelle nach, wenn es sich weit wegbewegt, zeigt abwechselnd die
       Gesten des Spielzeugs, bewegt Rumpf, Kopf, Flossen und Schwanz je nach Spielstil (TOY_POSE), das Spielzeug macht seinen Laut.
    4. Ende: von selbst nach TOYS[id].playSec (kurzes Ausklingen, Reaktion nach Passung, Spielzeug verschwindet) oder gestoppt
       (`requestStop()`: kurzes Ausklingen, keine Reaktion). Erst danach endet die Aufgabe, sie ist wieder frei.
  Beim Spielen lässt sie sich nicht stören (BUSY_STATES: Antippen tut nichts), gefüttert und gewaschen wird nicht (Gates in Feeding und
  Cleaning), sie legt sich auch nicht hin (`isBusy` in Sleeping). Wirkung auf die Werte, Bindung und die Nachwirkung auf das Verhalten
  (`behavior.setBias`) hängen an den Ereignissen des ToySystems (siehe main.js), nicht an diesem Modul.
  Keine Bestrafung: Stoppen und Abbrechen kosten nichts, zu müde = freundlich ablehnen.

  Nicht nur Bewegung/Farbe: Form und Name der Spielzeuge im Auswahlfeld, Knopfbeschriftung „Fertig“, Statuszeile und die Zeile
  „Stimmung: spielt“ tragen die Information. „Reduzierte Bewegung“: das Spielzeug steht ruhig (keine Bahn, kein Drehen), keine Gesten,
  nur eine ruhige Kopfneigung, sie dreht sich nur einmal beim Ankommen zum Spielzeug.

  REIHENFOLGE (wichtig): `update` läuft NACH idle/behavior/locomotion/expression/sleeping/cleaning und VOR interaction (wie Cleaning).
  Idle setzt Rumpf-, Kopf-, Flossen- und Schwanzwinkel jeden Frame absolut, hier wird nur addiert (nichts summiert sich über Frames).
  Berührt NICHT: Position/Drehung der Gruppe (Locomotion), Augen, Leuchten, Füße, Rumpfhöhe. Das Blickziel setzt `idle.lookAt`.

  Freies Spiel (Phase 19): ist sie frei (Zustand IDLE, nicht beim Essen/Schlafen/Waschen/Spielen) und fragt `toys.pollAuto()` nach einem Spielzeug,
  beginnt sie von selbst (`source: 'auto'`, Meldung „Reson möchte spielen ...“). Ab dort läuft alles wie beim Knopf, auch „Fertig“ stoppt es.
  Läuft die Entscheidung nur im Takt von `pollAuto` (Pause, Würfeln), nie pro Frame. Ein-/Ausschalten: `toys.setFreePlay(bool)`.

  createPlaying({ toys, creature, behavior, locomotion, idle, habitat, sfx, scene, isBusy, isSleeping, isWashing, react, seed }) ->
    {
      update(dt), play(toyId, { source }) -> { ok, reason }, requestStop() -> bool,
      isResting() (geht hin, spielt oder klingt aus), isPlaying() (spielt oder klingt aus), dispose()
    }
    reason: 'busy' | 'tired' | 'asleep' | 'washing' | 'unknown' | 'nozone'
  isBusy(): läuft gerade eine Fütterung; isSleeping(): geht sie schlafen oder schläft sie; isWashing(): geht sie zum Waschplatz oder wird
  sie gewaschen (alle spät gebunden, die Module entstehen vor oder nach diesem); react(type, { source }): Reaktion der Kreatur (spät gebunden an
  `interaction.react`, source 'play' zählt nicht als Tippen).
  Werte in js/data/toys.js (TOYS, TOY_RULES, TOY_POSE), NICHT im Browser getestet.
*/
import * as THREE from 'three';
import { TOYS, TOY_RULES, TOY_POSE } from '../data/toys.js';
import { createToyModel } from '../world/ToyModels.js';
import { createRng } from '../core/rng.js';
import { prefersReducedMotion } from '../core/env.js';
import { STATES } from './Behavior.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => u * u * (3 - 2 * u);
const noop = () => {};
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createPlaying({
  toys, creature, behavior, locomotion, idle, habitat, sfx, scene,
  isBusy = () => false, isSleeping = () => false, isWashing = () => false, react = () => false, seed = 9009,
}) {
  const R = TOY_RULES;
  const P = TOY_POSE;
  const calm = prefersReducedMotion();
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const { group, parts } = creature;

  let item = null;            // { toyId, def, model, t, anchors } oder null (auch während des Ausblendens)
  let shown = 0;              // 0 weg .. 1 voll da (linear, per ease() überblendet)
  let depth = 0;              // 0 aus .. 1 voll dabei (Körperbewegung)
  let poseStyle = null;       // Eintrag aus TOY_POSE.styles (bleibt, bis die Bewegung ausgeblendet ist)
  let finishing = null;       // { natural, t, dur, result }: Ausklingen nach dem Ende; die Verhaltensaufgabe läuft bis dahin weiter
  let internalChange = false; // eigene Zustandswechsel (interrupt) dürfen den Fremdwechsel-Schutz nicht auslösen
  let clock = 0;
  let gestureTimer = 0;
  let soundTimer = 0;
  let turnTimer = 0;

  // ---------- Spielzeug-Objekt ----------
  function removeItem() {
    if (!item) return;
    scene.remove(item.model.group);
    item.model.dispose();
    item = null;
    shown = 0;
  }

  function createItem(toyId, zone) {
    removeItem();
    const def = TOYS[toyId];
    const model = createToyModel(def, { calm });
    scene.add(model.group);
    item = { toyId, def, model, t: 0, anchors: { center: zone.clone(), creature: group.position } };
    shown = 0;
    poseStyle = P.styles[def.style] || null;
  }

  // ---------- Ablauf ----------
  function onArrive() {
    if (!toys.arrived() || !item) return;
    turnTimer = R.turnEverySec;
    gestureTimer = rand(1, 2);
    soundTimer = 0.5;
    locomotion.turnTo(item.model.group.position, noop);   // sie wendet sich dem Spielzeug zu
  }

  /** Normales Ende der Verhaltensaufgabe. Nur eine Sicherung: das ToySystem beendet schon vorher (TOY_RULES.dwellSlackSec). */
  function onDone() { finishing = null; }

  function begin(toyId, source) {
    const zone = habitat.getZonePosition('play');
    if (!zone) return { ok: false, reason: 'nozone' };
    if (!toys.start(toyId, source)) return { ok: false, reason: 'busy' };

    const def = TOYS[toyId];
    createItem(toyId, zone);
    const lookAt = new THREE.Vector3(zone.x, 0.5, zone.z);
    const started = behavior.goToZone('play', {
      state: STATES.SEEK_PLAY, dwellState: STATES.PLAY,
      dwell: def.playSec + R.dwellSlackSec,
      standOff: R.standOff, quiet: true, lookAt, onArrive, onDone,
    });
    if (!started) {
      toys.cancel();
      removeItem();
      return { ok: false, reason: 'nozone' };
    }
    if (sfx) sfx.play('pop');
    return { ok: true, reason: null };
  }

  /** Beendet das Spielen und lässt die Bewegung ausklingen; die Aufgabe endet erst in finishDone(). */
  function beginFinish(natural) {
    const result = toys.stop({ natural });
    if (!result) return false;
    let dur = R.stopEndSec;
    if (natural) dur = calm ? R.calmEndSec : R.endSec;
    finishing = { natural, t: 0, dur, result };
    if (natural && sfx) sfx.play('pop');
    return true;
  }

  function finishDone() {
    const f = finishing;
    finishing = null;
    internalChange = true;
    behavior.interrupt();              // Aufgabe beenden -> IDLE (ohne onDone)
    internalChange = false;
    if (f && f.natural) react(f.result.reaction, { source: 'play' });   // fertig gespielt: freundlicher Blick zum Spieler
  }

  // Wird die Aufgabe von außen ersetzt oder abgebrochen, verlässt der Zustand SEEK_PLAY/PLAY ohne unser Zutun.
  const offState = behavior.onStateChange((next) => {
    if (internalChange) return;
    if (next === STATES.SEEK_PLAY || next === STATES.PLAY) return;
    const phase = toys.getPhase();
    if (phase === 'going') toys.cancel();
    else if (phase === 'playing') toys.stop({ natural: false });
    finishing = null;
  });

  // ---------- Von außen ----------
  /** Spielt mit einem Spielzeug. Ist sie zu müde oder beschäftigt, passiert nichts (freundlich, ohne Strafe). */
  function play(toyId, { source = 'player' } = {}) {
    if (!TOYS[toyId]) return { ok: false, reason: 'unknown' };
    if (finishing) return { ok: false, reason: 'busy' };
    if (isSleeping()) return { ok: false, reason: 'asleep' };
    if (isWashing()) return { ok: false, reason: 'washing' };
    if (isBusy()) return { ok: false, reason: 'busy' };   // beim Füttern nicht dazwischenfunken (react/Aufgabe würde die Fütterung ersetzen)
    const check = toys.canRequest(toyId);
    if (!check.ok) {
      if (check.reason === 'tired' && source === 'player') react('content', { source: 'play' });
      return check;
    }
    return begin(toyId, source);
  }

  /** Beendet das Spielen oder bricht den Weg zum Spielbereich ab. Gibt false zurück, wenn es nichts zu tun gab. */
  function requestStop() {
    const phase = toys.getPhase();
    if (phase === 'going') {
      internalChange = true;
      behavior.interrupt();
      internalChange = false;
      toys.cancel();
      return true;
    }
    if (phase === 'playing') return beginFinish(false);
    return false;
  }

  // ---------- Körper ----------
  function applyPose(d) {
    if (!poseStyle) return;
    if (calm) {
      parts.head.rotation.z += P.calmHeadTilt * d;   // nur eine ruhige Kopfneigung
      return;
    }
    const st = poseStyle;
    if (st.bodyHz > 0) parts.body.rotation.z += st.bodyRoll * d * Math.sin(clock * TAU * st.bodyHz);
    parts.head.rotation.z += st.headTilt * d * Math.sin(clock * TAU * st.headHz);
    const flap = st.finFlap * d * Math.sin(clock * TAU * st.finHz + 0.8);
    parts.fins.left.rotation.z += flap;
    parts.fins.right.rotation.z -= flap;
    parts.tail[0].rotation.y += st.tailWag * d * Math.sin(clock * TAU * st.tailHz);
  }

  /** Blick, Nachdrehen, Gesten und Laut, solange sie spielt. */
  function playBehaviors(dt) {
    const pos = item.model.group.position;
    idle.lookAt(pos);

    if (!calm) {
      turnTimer -= dt;
      if (turnTimer <= 0) {
        turnTimer = R.turnEverySec;
        const bearing = Math.atan2(pos.x - group.position.x, pos.z - group.position.z);
        if (Math.abs(wrapAngle(bearing - group.rotation.y)) > R.turnMinAngle) locomotion.turnTo(pos, noop);
      }
      gestureTimer -= dt;
      if (gestureTimer <= 0) {
        gestureTimer = rand(R.gestureMin, R.gestureMax);
        const list = item.def.gestures;
        idle.triggerGesture(list[Math.floor(rng() * list.length)]);
      }
    }

    soundTimer -= dt;
    if (soundTimer <= 0) {
      soundTimer = item.def.soundEverySec;
      if (sfx) sfx.play(item.def.sound);
    }
  }

  function update(dt) {
    clock += dt;
    toys.update(dt);

    // 1. Spielzeit um?
    if (!finishing && toys.shouldFinish()) beginFinish(true);

    // 1b. Von selbst Lust zu spielen (Phase 19)? Nur im freien Zustand IDLE, wie bei Schlaf und Waschen. Sleeping und Cleaning laufen
    //     im Updater vorher und haben den Zustand dann schon verlassen.
    if (!finishing && toys.getPhase() === 'idle' && behavior.getState() === STATES.IDLE && behavior.isAutonomous()
        && !isBusy() && !isSleeping() && !isWashing()) {
      const wanted = toys.pollAuto();
      if (wanted) begin(wanted, 'auto');
    }

    // 2. Tiefe der Körperbewegung: ein beim Spielen, aus sonst
    const target = toys.getPhase() === 'playing' ? 1 : 0;
    const dur = target > depth ? P.blendInSec : P.blendOutSec;
    if (target > depth) depth = Math.min(target, depth + dt / dur);
    else if (target < depth) depth = Math.max(target, depth - dt / dur);

    // 3. Ausklingen: erst wenn die Bewegung ausgeblendet und die Zeit um ist, endet die Aufgabe (sie ist wieder frei)
    if (finishing) {
      finishing.t += dt;
      if (finishing.t >= finishing.dur && depth <= 0.02) finishDone();
    }

    // 4. Spielzeug: einblenden solange sie hingeht oder spielt, sonst ausblenden und entfernen
    if (item) {
      const wanted = toys.getPhase() !== 'idle' && !finishing;
      const sec = wanted ? R.appearSec : R.disappearSec;
      shown = clamp01(shown + (wanted ? dt : -dt) / sec);
      item.t += dt;
      item.model.update(item.t, dt, shown, item.anchors);
      if (!wanted && shown <= 0.001) removeItem();
      else if (toys.getPhase() === 'playing') playBehaviors(dt);
    }

    // 5. Körper
    const d = ease(clamp01(depth));
    if (d > 0.0005) applyPose(d);
    if (d <= 0.0005 && !item) poseStyle = null;
  }

  const isResting = () => toys.getPhase() !== 'idle' || finishing !== null;
  const isPlaying = () => toys.getPhase() === 'playing' || finishing !== null;

  function dispose() {
    offState();
    removeItem();
  }

  return { update, play, requestStop, isResting, isPlaying, dispose };
}
