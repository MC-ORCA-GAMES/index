/*
  Training (Trainer) – Reson führt die trainierten Fähigkeiten vor (Phase 23). Verbindet TrainingSystem (Logik), Verhalten und Szene:
    1. Start: `start(skillId)` auf Wunsch des Spielers (TrainingPanel, Knopf „Üben“). Ist sie zu müde, lehnt sie freundlich ab (Reaktion
       „zufrieden“, nichts kostet etwas). Sie wendet sich der Kamera (= dem Spieler) zu und bleibt dort (Zustand TRAIN, Aufgabe
       `behavior.observe`, höchstens `maxSessionSec` lang als Sicherung, `quiet`: keine zufälligen Idle-Gesten).
    2. Jeder Versuch: das System meldet `act` (Ausgang `kind` great/good/tried und Zahlen `params`). Daraus baut dieses Modul ein kleines
       Drehbuch (SCRIPTS) und spielt es ab; am Ende ruft es `training.actDone()`. Schritte im Drehbuch: warten, schauen, drehen, gehen, Geste,
       Ton, Hilfsobjekt zeigen/verschieben/tragen/ablegen/verschwinden lassen, springen.
         follow  Lichtpunkt erscheint und wandert in Etappen, Reson geht hinterher (good: zögert erst, tried: bleibt nach einem Stück stehen)
         wait    Leckerli liegt vor ihr, sie wartet `hold` Sekunden (good: kleines Zappeln, tried: geht zu früh los), danach darf sie fressen
         jump    springt `hops`-mal um `lift` (die Höhe wächst mit dem Lernstand), tried: ein kleiner Wackler ohne Sprung
         fetch   Ball liegt weiter weg, sie holt ihn und bringt ihn zum Übergabepunkt (good: mit Zögern, tried: schubst ihn nur an, bringt ihn nicht)
         listen  Klangquelle (Lichtpunkt + Ton) an einer Stelle; great: schaut sofort hin, good: erst in die falsche Richtung, tried: sucht
    3. Ende: vom System (`done`). Kurzes Ausklingen, dann endet die Aufgabe, bei natürlichem Ende folgt die Reaktion nach Ergebnisstufe
       (freundlicher Blick zum Spieler). Erst danach ist sie wieder frei (`isResting()`).
  Beim Üben lässt sie sich nicht stören (BUSY_STATES: Antippen der Kreatur tut nichts), gefüttert, gewaschen und gespielt wird nicht (Gates
  in main.js), sie legt sich auch nicht hin (`isBusy` in Sleeping). Wirkung auf die Werte, Lernstand, Bindung und Emotionen hängen an den
  Ereignissen des TrainingSystems (siehe main.js), nicht an diesem Modul. Keine Bestrafung: Beenden kostet nichts, zu müde = freundlich ablehnen.

  Bewegung: Gehen und Drehen läuft über `locomotion.moveTo/turnTo` (wie `Playing.js` während des Verweilens), das Springen hebt die Gruppe
  (`group.position.y`, sonst fasst es niemand an) und hält den Schattenfleck am Boden. Das Drehbuch wartet am Anfang, bis sie sich zur Kamera
  gedreht hat (`free`), damit die Drehung von Behavior nicht von einem Wegstück überschrieben wird. Jedes Wegstück hat eine Sicherungszeit.
  „Reduzierte Bewegung“: keine Gesten (idle.triggerGesture tut dann nichts), Hilfsobjekte ohne Pulsieren, Sprünge nur klein und langsam;
  Gehen und Drehen bleiben (Funktion). Der Hinweis auf alles Wichtige steht zusätzlich als Text im TrainingPanel.

  REIHENFOLGE: `update` ruft `training.update(dt)` (Zeit der Übung, Abnutzung, einmal pro Frame) und das Drehbuch. Es schreibt nur
  `group.position.y` und die Schatten-Höhe, daher ist die Reihenfolge der Updater unkritisch; es steht in main.js bei den anderen
  Verhaltensmodulen.

  createTrainer({ training, creature, behavior, locomotion, idle, sfx, scene, camera, isBusy, isSleeping, isWashing, isToyPlaying, isGaming, canTrain, react }) ->
    {
      update(dt), start(skillId, { source }) -> { ok, reason }, requestStop() -> bool,
      isResting() (eine Übung läuft oder klingt aus), isTraining() (dasselbe, für die Stimmungszeile), onEvent(fn), dispose()
    }
    reason: 'unknown' | 'young' | 'busy' | 'tired' | 'asleep' | 'washing' | 'playing' | 'gaming'
  canTrain(): Phase 25, ob die Lebensstufe das Üben erlaubt (Baby: nein, Grund `young`, freundlicher Text); Standard immer ja.
  isBusy(): läuft gerade eine Fütterung; isSleeping(): geht sie schlafen oder schläft sie; isWashing(): geht sie zum Waschplatz oder wird sie
  gewaschen; isToyPlaying(): geht sie zum Spielbereich oder spielt; isGaming(): läuft ein Minispiel (alle spät gebunden, die Module entstehen vor
  oder nach diesem); react(type, { source }): Reaktion der Kreatur (spät gebunden an `interaction.react`, source 'train' zählt nicht als Tippen).
  Ereignis von onEvent: { type: 'finished' } sobald das Ausklingen vorbei ist und sie wieder frei ist (für „Nochmal“ im TrainingPanel).
  Werte in js/data/training.js (SKILLS, TRAINING_RULES), NICHT im Browser getestet.
*/
import * as THREE from 'three';
import { SKILLS, TRAINING_RULES } from '../data/training.js';
import { prefersReducedMotion } from '../core/env.js';
import { STATES } from './Behavior.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => u * u * (3 - 2 * u);

/** Richtung (x/z) zu einer Peilung (Radiant), passend zu atan2(dx, dz) und zur Blickrichtung +z des Modells. */
const dirOf = (b) => new THREE.Vector3(Math.sin(b), 0, Math.cos(b));

export function createTrainer({
  training, creature, behavior, locomotion, idle, sfx, scene, camera,
  isBusy = () => false, isSleeping = () => false, isWashing = () => false, isToyPlaying = () => false, isGaming = () => false,
  canTrain = () => true,
  react = () => false,
}) {
  const R = TRAINING_RULES;
  const calm = prefersReducedMotion();
  const { group, parts } = creature;
  const listeners = new Set();
  const shadowBaseY = parts.shadow ? parts.shadow.position.y : 0;

  let clock = 0;
  let finishing = null;        // { natural, t, dur, result }: Ausklingen nach dem Ende, die Verhaltensaufgabe läuft bis dahin weiter
  let internalChange = false;  // eigene Zustandswechsel (interrupt) dürfen den Fremdwechsel-Schutz nicht auslösen
  let script = null;           // { steps, i, cur, t, flag } oder null
  let jump = null;             // { hops, lift, hopSec, gap, n, phase, t, onDone } oder null
  let lift = 0;                // aktuelle Höhe der Gruppe über dem Boden (nur beim Springen)
  let liftApplied = 0;

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Hilfsobjekt (Lichtpunkt, Leckerli, Ball, Klangquelle) ----------
  const prop = (() => {
    const g = new THREE.Group();
    g.visible = false;
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const core = new THREE.Mesh(sphere, coreMat);
    const halo = new THREE.Mesh(sphere, haloMat);
    halo.scale.setScalar(1.9);
    g.add(halo, core);
    scene.add(g);

    const s = {
      alpha: 0, target: 0, size: 0.15, shrink: 0, shrinkSec: 0, mode: 'free',
      pos: new THREE.Vector3(), slide: null, bob: 0,
    };

    function show({ at, color, size }) {
      s.pos.copy(at);
      s.size = size;
      s.shrink = 0; s.shrinkSec = 0;
      s.mode = 'free'; s.slide = null;
      coreMat.color.setHex(color);
      haloMat.color.setHex(color);
      s.target = 1;
      g.visible = true;
    }
    function hide() { s.target = 0; s.slide = null; s.mode = s.mode === 'carried' ? 'free' : s.mode; }
    function slideTo(to, sec, onDone) {
      s.mode = 'free';
      s.slide = { from: s.pos.clone(), to: to.clone(), t: 0, dur: Math.max(0.05, sec), onDone };
    }
    function carry() { s.mode = 'carried'; s.slide = null; }
    function dropAt(at) { s.mode = 'free'; s.slide = null; s.pos.copy(at); }
    function eat(sec) { s.shrinkSec = Math.max(0.05, sec); }

    function update(dt) {
      const fade = R.propFadeSec;
      if (s.alpha < s.target) s.alpha = Math.min(s.target, s.alpha + dt / fade);
      else if (s.alpha > s.target) s.alpha = Math.max(s.target, s.alpha - dt / fade);
      if (s.alpha <= 0.001 && s.target === 0) { g.visible = false; s.shrink = 0; s.shrinkSec = 0; return; }
      if (!g.visible) return;

      if (s.shrinkSec > 0) s.shrink = Math.min(1, s.shrink + dt / s.shrinkSec);
      if (s.mode === 'carried') {
        const c = SKILLS.fetch.carry;
        const f = dirOf(group.rotation.y);
        s.pos.set(group.position.x + f.x * c.z, group.position.y + c.y, group.position.z + f.z * c.z);
      } else if (s.slide) {
        const sl = s.slide;
        sl.t += dt;
        const u = ease(clamp01(sl.t / sl.dur));
        s.pos.lerpVectors(sl.from, sl.to, u);
        if (sl.t >= sl.dur) { s.slide = null; if (sl.onDone) sl.onDone(); }
      }
      const bob = calm ? 0 : Math.sin(clock * 3) * 0.03;
      const pulse = calm ? 1 : 1 + 0.08 * Math.sin(clock * 5);
      g.position.set(s.pos.x, s.pos.y + bob, s.pos.z);
      g.scale.setScalar(Math.max(0.001, s.size * pulse * (1 - 0.92 * ease(s.shrink))));
      coreMat.opacity = s.alpha * 0.95;
      haloMat.opacity = s.alpha * 0.35;
    }

    function dispose() {
      scene.remove(g);
      sphere.dispose();
      coreMat.dispose();
      haloMat.dispose();
    }
    return { show, hide, slideTo, carry, dropAt, eat, update, dispose };
  })();

  // ---------- Hilfen fürs Drehbuch ----------
  const here = () => new THREE.Vector3(group.position.x, 0, group.position.z);
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const camPoint = () => camera.position.clone();

  /** Punkt `d` Einheiten von `from` in Richtung der Peilung `b`, auf den begehbaren Kreis begrenzt. */
  const rel = (from, b, d) => locomotion.clampToBounds(from.clone().addScaledVector(dirOf(b), d));

  /** Stehpunkt `off` vor einem Ziel (von `from` aus gesehen). */
  function standPoint(from, target, off) {
    const d = new THREE.Vector3(target.x - from.x, 0, target.z - from.z);
    if (d.lengthSq() < 1e-4) d.set(0, 0, 1);
    d.setLength(off);
    return locomotion.clampToBounds(new THREE.Vector3(target.x - d.x, 0, target.z - d.z));
  }

  /** Gemeinsamer Schluss jedes Versuchs: Hilfsobjekt weg, wieder zum Spieler schauen und drehen. */
  function tail(steps) {
    steps.push({ t: 'hide' }, { t: 'look', point: camPoint() }, { t: 'turn', point: camPoint() });
    return steps;
  }

  // ---------- Drehbücher je Fähigkeit ----------
  const SCRIPTS = {
    follow(e) {
      const p = e.params;
      const D = SKILLS.follow;
      const hy = R.hoverY;
      const P0 = here();
      const beacons = [];
      for (let i = 0; i < p.legs; i += 1) beacons.push(rel(i === 0 ? P0 : beacons[i - 1], p.bearings[i], p.legLen));

      const steps = [
        { t: 'free' },
        { t: 'show', at: v3(beacons[0].x, hy, beacons[0].z), color: D.prop.color, size: D.prop.size },
        { t: 'sound', name: 'tick' },
        { t: 'look', point: beacons[0] },
        { t: 'wait', sec: 0.5 },
      ];
      if (e.kind === 'good') steps.push({ t: 'wait', sec: 0.7 }, { t: 'gesture', name: 'headTilt' }, { t: 'wait', sec: 0.6 });

      let from = P0;
      let reached = true;
      for (let i = 0; i < beacons.length; i += 1) {
        const b = beacons[i];
        if (i > 0) steps.push({ t: 'slide', to: v3(b.x, hy, b.z), sec: 1.2 }, { t: 'look', point: b });
        const stand = standPoint(from, b, p.standOff);
        if (e.kind === 'tried') {
          steps.push({ t: 'move', point: from.clone().lerp(stand, 0.45) }, { t: 'gesture', name: 'headTilt' }, { t: 'wait', sec: 1.0 });
          reached = false;
          break;
        }
        steps.push({ t: 'move', point: stand });
        from = stand;
      }
      if (reached) steps.push({ t: 'gesture', name: 'tailWag' }, { t: 'sound', name: e.kind === 'great' ? 'chime' : 'pop' }, { t: 'wait', sec: 0.9 });
      return tail(steps);
    },

    wait(e) {
      const p = e.params;
      const D = SKILLS.wait;
      const P0 = here();
      const fwd = dirOf(group.rotation.y);
      const T = locomotion.clampToBounds(P0.clone().addScaledVector(fwd, p.treatDist));
      const steps = [
        { t: 'free' },
        { t: 'show', at: v3(T.x, 0.18, T.z), color: D.prop.color, size: D.prop.size },
        { t: 'sound', name: 'tick' },
        { t: 'look', point: T },
      ];
      if (e.kind === 'great') {
        steps.push({ t: 'wait', sec: p.hold });
      } else if (e.kind === 'good') {
        steps.push({ t: 'wait', sec: p.hold * 0.5 }, { t: 'gesture', name: 'finFlick' }, { t: 'wait', sec: p.hold * 0.5 });
      } else {
        steps.push(
          { t: 'wait', sec: p.hold * 0.3 },
          { t: 'move', point: locomotion.clampToBounds(P0.clone().addScaledVector(fwd, 0.45)) },
          { t: 'gesture', name: 'headTilt' },
          { t: 'wait', sec: 0.6 },
        );
      }
      // Erlaubnis: sie darf fressen (auch nach einem Versuch, der noch nicht klappte, kein Vorwurf)
      steps.push(
        { t: 'sound', name: 'pop' },
        { t: 'move', point: standPoint(P0, T, 0.4) },
        { t: 'eat', sec: 1.0 },
        { t: 'gesture', name: 'munch', dur: 1.1 },
        { t: 'wait', sec: 1.2 },
      );
      return tail(steps);
    },

    jump(e) {
      const p = e.params;
      const steps = [{ t: 'free' }, { t: 'look', point: camPoint() }, { t: 'sound', name: 'tick' }, { t: 'wait', sec: 0.4 }];
      if (p.hops > 0) {
        steps.push(
          { t: 'lift', hops: p.hops, lift: p.lift, hopSec: p.hopSec, gap: p.hopGapSec },
          { t: 'gesture', name: 'tailWag' },
          { t: 'sound', name: e.kind === 'great' ? 'chime' : 'pop' },
          { t: 'wait', sec: 0.8 },
        );
      } else {
        steps.push(
          { t: 'gesture', name: 'finFlick' }, { t: 'wait', sec: 0.7 },
          { t: 'lift', hops: 1, lift: 0.05, hopSec: 0.5, gap: 0 },
          { t: 'gesture', name: 'headTilt' }, { t: 'wait', sec: 1.2 },
        );
      }
      return tail(steps);
    },

    fetch(e) {
      const p = e.params;
      const D = SKILLS.fetch;
      const P0 = here();
      const ball = rel(P0, p.bearing, p.dist);
      const toBall = new THREE.Vector3(ball.x - P0.x, 0, ball.z - P0.z);
      if (toBall.lengthSq() < 1e-4) toBall.set(0, 0, 1);
      toBall.normalize();
      const stand = standPoint(P0, ball, p.standOff);
      const handover = locomotion.clampToBounds(v3(D.handover.x, 0, D.handover.z));

      const steps = [
        { t: 'free' },
        { t: 'show', at: v3(ball.x, 0.17, ball.z), color: D.prop.color, size: D.prop.size },
        { t: 'sound', name: 'pop' },
        { t: 'look', point: ball },
        { t: 'wait', sec: 0.4 },
        { t: 'move', point: stand },
      ];
      if (e.kind === 'tried') {
        // schubst den Ball nur an und kommt ohne ihn zurück
        const away = locomotion.clampToBounds(ball.clone().addScaledVector(toBall, 0.8));
        steps.push(
          { t: 'slide', to: v3(away.x, 0.17, away.z), sec: 0.6 },
          { t: 'gesture', name: 'headTilt' },
          { t: 'wait', sec: 0.8 },
          { t: 'hide' },
          { t: 'move', point: stand.clone().lerp(handover, 0.5) },
          { t: 'wait', sec: 0.3 },
        );
        return tail(steps);
      }
      steps.push({ t: 'carry' }, { t: 'sound', name: 'pop' }, { t: 'look', point: camPoint() });
      if (e.kind === 'good') {
        steps.push(
          { t: 'move', point: stand.clone().lerp(handover, 0.5) },
          { t: 'gesture', name: 'headTilt' },
          { t: 'wait', sec: 0.7 },
        );
      }
      steps.push(
        { t: 'move', point: handover },
        { t: 'turn', point: camPoint() },
        { t: 'dropAt' },
        { t: 'gesture', name: 'tailWag' },
        { t: 'sound', name: 'chime' },
        { t: 'wait', sec: 0.9 },
      );
      return tail(steps);
    },

    listen(e) {
      const p = e.params;
      const D = SKILLS.listen;
      const P0 = here();
      const src = rel(P0, p.bearing, p.dist);
      const w1 = rel(P0, p.wrong[0], p.dist);
      const w2 = rel(P0, p.wrong[1], p.dist);
      const steps = [
        { t: 'free' },
        { t: 'look', point: camPoint() },
        { t: 'wait', sec: 0.3 },
        { t: 'show', at: v3(src.x, R.hoverY, src.z), color: D.prop.color, size: D.prop.size },
        { t: 'sound', name: p.sound },
        { t: 'wait', sec: 0.6 },
      ];
      if (e.kind === 'great') {
        steps.push(
          { t: 'look', point: src }, { t: 'turn', point: src },
          { t: 'gesture', name: 'crystalPulse' }, { t: 'wait', sec: 0.5 },
          { t: 'move', point: rel(P0, p.bearing, 0.9) },
          { t: 'gesture', name: 'tailWag' }, { t: 'wait', sec: 0.6 },
        );
      } else if (e.kind === 'good') {
        steps.push(
          { t: 'look', point: w1 }, { t: 'wait', sec: 0.9 },
          { t: 'gesture', name: 'headTilt' },
          { t: 'look', point: src }, { t: 'turn', point: src },
          { t: 'wait', sec: 0.5 },
          { t: 'gesture', name: 'tailWag' }, { t: 'wait', sec: 0.6 },
        );
      } else {
        steps.push(
          { t: 'look', point: w1 }, { t: 'wait', sec: 0.7 },
          { t: 'look', point: w2 }, { t: 'wait', sec: 0.7 },
          { t: 'gesture', name: 'headTilt' },
          { t: 'look', point: camPoint() }, { t: 'wait', sec: 0.7 },
        );
      }
      return tail(steps);
    },
  };

  // ---------- Drehbuch abspielen ----------
  function abortScript() {
    if (script) locomotion.stop();
    script = null;
    jump = null;
    prop.hide();
    idle.lookAt(null);
  }

  /** Beginnt einen Schritt. Gibt true zurück, wenn er schon erledigt ist. */
  function enter(st) {
    const my = script;
    const done = () => { if (script === my && my.cur === st) my.flag = true; };
    switch (st.t) {
      case 'free': return !locomotion.isBusy();
      case 'wait': return !(st.sec > 0);
      case 'look': idle.lookAt(st.point || null); return true;
      case 'turn': locomotion.turnTo(st.point, done); return false;
      case 'move': locomotion.moveTo(st.point, done); return false;
      case 'gesture': idle.triggerGesture(st.name, st.dur ? { dur: st.dur } : undefined); return true;
      case 'sound': if (sfx) sfx.play(st.name); return true;
      case 'show': prop.show(st); return true;
      case 'hide': prop.hide(); return true;
      case 'slide': prop.slideTo(st.to, st.sec, done); return false;
      case 'carry': prop.carry(); return true;
      case 'dropAt': {
        const f = dirOf(group.rotation.y);
        prop.dropAt(v3(group.position.x + f.x * 0.6, 0.17, group.position.z + f.z * 0.6));
        return true;
      }
      case 'eat': prop.eat(st.sec); return true;
      case 'lift':
        jump = {
          hops: st.hops, lift: st.lift * (calm ? R.calmLiftFactor : 1), hopSec: calm ? R.calmHopSec : st.hopSec,
          gap: st.gap, n: 0, phase: 'air', t: 0, onDone: done,
        };
        if (sfx) sfx.play('tick');
        return false;
      default: return true;
    }
  }

  function stepDone() {
    const st = script.cur;
    switch (st.t) {
      case 'free':
        return !locomotion.isBusy() || script.t >= R.freeTimeoutSec;
      case 'wait':
        return script.t >= st.sec;
      case 'turn':
        if (script.flag) return true;
        if (script.t >= R.turnTimeoutSec) { locomotion.stop(); return true; }
        return false;
      case 'move':
        if (script.flag) return true;
        if (script.t >= R.moveTimeoutSec) { locomotion.stop(); return true; }
        return false;
      case 'slide':
      case 'lift':
        return script.flag || script.t >= R.moveTimeoutSec;
      default:
        return true;
    }
  }

  function advance() {
    while (script) {
      script.i += 1;
      if (script.i >= script.steps.length) {
        script = null;
        training.actDone();   // Versuch zu Ende -> Rückmeldung im System
        return;
      }
      script.cur = script.steps[script.i];
      script.t = 0;
      script.flag = false;
      if (!enter(script.cur)) return;
    }
  }

  function runScript(steps) {
    abortScript();
    script = { steps, i: -1, cur: null, t: 0, flag: false };
    advance();
  }

  // ---------- Springen ----------
  function updateLift(dt) {
    if (jump) {
      jump.t += dt;
      if (jump.phase === 'air') {
        const u = clamp01(jump.t / jump.hopSec);
        lift = jump.lift * 4 * u * (1 - u);
        if (u >= 1) {
          lift = 0;
          jump.n += 1;
          if (jump.n >= jump.hops) {
            const cb = jump.onDone;
            jump = null;
            if (cb) cb();
          } else {
            jump.phase = 'gap';
            jump.t = 0;
          }
        }
      } else if (jump.t >= jump.gap) {
        jump.phase = 'air';
        jump.t = 0;
        if (sfx) sfx.play('tick');
      }
    } else if (lift > 0) {
      lift *= Math.exp(-14 * dt);   // abgebrochener Sprung: schnell zurück auf den Boden
      if (lift < 0.002) lift = 0;
    }
    if (lift !== liftApplied) {
      liftApplied = lift;
      group.position.y = lift;
      if (parts.shadow) parts.shadow.position.y = shadowBaseY - lift / (group.scale.y || 1);   // der Schatten bleibt am Boden
    }
  }

  // ---------- Ablauf der Übung ----------
  function clearFinishing() {
    if (!finishing) return;
    finishing = null;
    emit({ type: 'finished' });
  }

  function finishDone() {
    const f = finishing;
    internalChange = true;
    behavior.interrupt();   // Aufgabe beenden -> IDLE (ohne onDone)
    internalChange = false;
    clearFinishing();
    if (f && f.natural && f.result.reaction) react(f.result.reaction, { source: 'train' });   // fertig geübt: freundlicher Blick zum Spieler
  }

  const offEvents = training.onEvent((e) => {
    switch (e.type) {
      case 'cue':
        abortScript();
        idle.lookAt(camera.position);   // sie schaut den Spieler an, das Kommando steht
        if (sfx) sfx.play('tick');
        break;
      case 'act': {
        const build = SCRIPTS[e.skillId];
        if (build) runScript(build(e));
        else training.actDone();   // unbekannte Fähigkeit: nicht hängen bleiben
        break;
      }
      case 'feedback':
        if (script) abortScript();   // Sicherung: der Versuch wurde vom System beendet (Zeitlimit)
        break;
      case 'praise':
        idle.triggerGesture('hop');
        if (sfx) sfx.play('pop');
        break;
      case 'done':
        abortScript();
        finishing = { natural: e.natural, t: 0, dur: e.natural ? R.endSec : R.stopEndSec, result: e };
        break;
      default:
        break;
    }
  });

  // Wird die Aufgabe von außen ersetzt oder beendet (auch durch die Sicherheitszeit), verlässt der Zustand TRAIN ohne unser Zutun.
  const offState = behavior.onStateChange((next) => {
    if (internalChange || next === STATES.TRAIN) return;
    if (training.isTraining()) training.stop({ natural: false });
    abortScript();
    clearFinishing();
  });

  /** Ende der Verhaltensaufgabe (nur eine Sicherung, falls sie ohne Zustandswechsel endet). */
  function onTaskDone() {
    if (training.isTraining()) training.stop({ natural: false });
    abortScript();
    clearFinishing();
  }

  // ---------- Von außen ----------
  /** Startet eine Übung. Ist sie zu müde oder beschäftigt, passiert nichts (freundlich, ohne Strafe). */
  function start(skillId, { source = 'player' } = {}) {
    if (!SKILLS[skillId]) return { ok: false, reason: 'unknown' };
    if (!canTrain()) return { ok: false, reason: 'young' };   // Phase 25: Babys sind zu klein zum Üben (nichts wird abgezogen)
    if (finishing || training.isTraining()) return { ok: false, reason: 'busy' };
    if (isSleeping()) return { ok: false, reason: 'asleep' };
    if (isWashing()) return { ok: false, reason: 'washing' };
    if (isToyPlaying()) return { ok: false, reason: 'playing' };
    if (isGaming()) return { ok: false, reason: 'gaming' };
    if (isBusy()) return { ok: false, reason: 'busy' };   // beim Füttern nicht dazwischenfunken (die Aufgabe würde die Fütterung ersetzen)
    const check = training.canRequest(skillId);
    if (!check.ok) {
      if (check.reason === 'tired' && source === 'player') react('content', { source: 'train' });
      return check;
    }
    if (!training.start(skillId, source)) return { ok: false, reason: 'busy' };
    // Zur Kamera drehen und dort bleiben; `quiet`: keine zufälligen Idle-Gesten, die Gesten kommen aus dem Drehbuch.
    behavior.observe(camera.position.clone(), { state: STATES.TRAIN, dwell: R.maxSessionSec, quiet: true, onDone: onTaskDone });
    return { ok: true, reason: null };
  }

  /** Beendet die Übung vorzeitig („Beenden“, kostet nichts). Gibt false zurück, wenn gerade nicht geübt wurde. */
  function requestStop() {
    if (!training.isTraining()) return false;
    training.stop({ natural: false });
    return true;
  }

  // ---------- Frame ----------
  function update(dt) {
    clock += dt;
    training.update(dt);
    if (script) {
      script.t += dt;
      if (stepDone()) advance();
    }
    updateLift(dt);
    prop.update(dt);
    if (finishing) {
      finishing.t += dt;
      if (finishing.t >= finishing.dur && lift <= 0.002) finishDone();
    }
  }

  const isResting = () => training.isTraining() || finishing !== null;

  function dispose() {
    offEvents();
    offState();
    abortScript();
    lift = 0;
    group.position.y = 0;
    if (parts.shadow) parts.shadow.position.y = shadowBaseY;
    prop.dispose();
    listeners.clear();
  }

  return {
    update, start, requestStop,
    isResting, isTraining: isResting,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose,
  };
}
