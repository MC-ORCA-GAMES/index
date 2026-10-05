/*
  Behavior – einfaches Verhaltenssystem der Kreatur (Phase 07).
  Entscheidet, was die Kreatur als Nächstes tut, und steuert dafür Locomotion (Körper) und
  IdleBehavior (Blick, Gesten). Die Kreatur bleibt auch ohne Eingabe interessant.

  Zustände (Namen aus dem Master-Prompt, Abschnitt 18). Umgesetzt in Phase 07:
    IDLE         steht und lebt (Idle-Animation), wartet auf die nächste Aufgabe
    EXPLORE      geht zu einem zufälligen Punkt im Habitat
    INVESTIGATE  geht zu einer Zone, bleibt davor stehen und betrachtet den Zonenboden
    OBSERVE      dreht sich zur Kamera (= Spieler) und schaut dorthin
    INTERACT     wie OBSERVE, aber als Reaktion auf Antippen (Phase 08, von Interaction.js gesetzt)
    SEEK_FOOD    geht zum Futterplatz (Phase 11, von Feeding.js gesetzt)
    EAT          frisst am Futterplatz (Phase 11, Verweilzustand derselben Aufgabe)
    SEEK_REST    geht zum Schlafplatz (Phase 15, von Sleeping.js gesetzt)
    SLEEP        schläft am Schlafplatz (Phase 15, Verweilzustand derselben Aufgabe)
    SEEK_WASH    geht zum Waschplatz (Phase 16, von Cleaning.js gesetzt)
    WASH         wird am Waschplatz gewaschen (Phase 16, Verweilzustand derselben Aufgabe)
    SEEK_PLAY    geht zum Spielbereich (Phase 18, von Playing.js gesetzt)
    PLAY         spielt mit einem Spielzeug (Phase 18, Verweilzustand derselben Aufgabe)
    GAME         sieht beim Minispiel zu (Phase 20, von Gaming.js gesetzt: dreht sich zur Kamera, bleibt stehen und schaut hin)
    TRAIN        übt eine Fähigkeit (Phase 23, von Training.js gesetzt: dreht sich zur Kamera und bleibt dort; das Drehbuch der Übung geht und dreht über Locomotion)
  Reserviert für spätere Phasen (noch nicht verwendet): FOLLOW, SEEK_PLAYER. Ab Phase 09/12 sollen Bedürfnisse und Persönlichkeit die
  Gewichte in `chooseNext()` verschieben (CONFIG.creature.behavior.weights).

  Ablauf einer Aufgabe: Gehen/Drehen -> optional Verweilen (Blick auf einen Punkt) -> zurück zu IDLE.
  Während des Gehens startet Idle keine neuen Gesten, der Blick geht zum Ziel.

  Von außen steuerbar (z. B. Phase 08 Interaktion, Phase 11 Füttern):
    goTo(point, opts), goToZone(id, opts), observe(point, opts), interrupt(), setAutonomous(bool)
    opts: { state, dwell (Sekunden), lookAt (Vector3 für das Verweilen), onDone,
            dwellState (Phase 11: Zustand während des Verweilens), onArrive (Phase 11: beim Ankommen, vor dem Verweilen),
            standOff (Phase 11, nur goToZone: Abstand zur Zonenmitte statt cfg.zoneStandOff),
            quiet (Phase 15, goToZone und observe (Phase 20): beim Verweilen keine zufälligen Idle-Gesten, z. B. im Schlaf oder beim Minispiel) }
  Werte in CONFIG.creature.behavior, NICHT im Browser getestet.

  Nachwirkung (Phase 18): `setBias(factors, seconds)` verschiebt für eine Weile die Auswahl der selbstständigen Aufgaben
  (Faktoren `explore`/`investigate`/`observe` auf die Gewichte, `wait` auf die Ruhephase; je 0.3..3 begrenzt). Spielzeuge nutzen das
  (z. B. nach dem Leuchtball wird eher erkundet, nach dem Würfel eher untersucht). `setBias(null)` löscht, `getBias()` liefert die
  laufende Nachwirkung oder null. Die Zeit läuft nur als Laufzeit; ohne Nachwirkung ist jeder Faktor 1.

  Neigung (Phase 27 Teil B3): `setTendency(obj)` setzt eine DAUERHAFTE, leichte Neigung (z. B. je Evolutionsform, gesetzt von FormBehavior): Faktoren
  `explore`/`investigate`/`observe` (Gewichte), `wait` (Ruhephase), `dwell` (Verweilen vor Zonen), `look` (Blick zur Kamera), `repeatZone` und `zones`
  ({ zoneId: Faktor } auf die Zonenwahl beim Untersuchen). Eigene Schicht NEBEN `setBias` (zeitlich begrenzt, Spielzeug-Nachklang), beide multiplizieren
  und überschreiben sich nicht. `setTendency(null)` löscht, `getTendency()` liefert eine Kopie oder null. Fehlende oder ungültige Faktoren zählen 1;
  jeder Faktor wird auf 0,5..2 begrenzt (Schutz vor Ausreißern, die Formen selbst liegen enger). Sie sperrt nichts und läuft auch in „reduzierte Bewegung“ mit.

  Lernen (Phase 24): optionales `getZoneWeight(zoneId)` (>0, 1 = neutral) gewichtet die Zonenwahl in chooseNext; ohne es ist die Wahl gleichverteilt.

  Persönlichkeit (Phase 12): optionales `personality` (PersonalitySystem) verschiebt in chooseNext die Gewichte,
  die Ruhephasen, Verweil-/Blickdauer und die Neigung, dieselbe Zone nochmal anzulaufen (`getModifier('behavior', ...)`).
  Ohne `personality` ist jeder Faktor 1.

  createBehavior({ creature, idle, locomotion, habitat, getObserveTarget, seed, personality }) ->
    { update(dt), getState(), onStateChange(fn), goTo, goToZone, observe, interrupt, setAutonomous, setBias, getBias, setTendency, getTendency, isAutonomous }
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRng } from '../core/rng.js';
import { prefersReducedMotion } from '../core/env.js';
import { EYE_HEIGHT } from './CreatureModel.js';

export const STATES = Object.freeze({
  IDLE: 'IDLE',
  EXPLORE: 'EXPLORE',
  INVESTIGATE: 'INVESTIGATE',
  OBSERVE: 'OBSERVE',
  INTERACT: 'INTERACT',   // Phase 08: Reaktion aufs Antippen (gesetzt von Interaction über observe(..., { state }))
  SEEK_FOOD: 'SEEK_FOOD', // Phase 11: geht zum Futterplatz
  EAT: 'EAT',             // Phase 11: frisst
  SEEK_REST: 'SEEK_REST', // Phase 15: geht zum Schlafplatz
  SLEEP: 'SLEEP',         // Phase 15: schläft
  SEEK_WASH: 'SEEK_WASH', // Phase 16: geht zum Waschplatz
  WASH: 'WASH',           // Phase 16: wird gewaschen
  SEEK_PLAY: 'SEEK_PLAY', // Phase 18: geht zum Spielbereich
  PLAY: 'PLAY',           // Phase 18: spielt mit einem Spielzeug
  GAME: 'GAME',           // Phase 20: sieht beim Minispiel zu (Reaktionsspiel)
  TRAIN: 'TRAIN',         // Phase 23: übt eine Fähigkeit (Folgen, Warten, Springen, Bringen, Lauschen)
});

/** Zustände, in denen die Kreatur nicht gestört wird (Antippen löst dann keine Reaktion aus, Phase 11; Schlaf Phase 15). */
export const BUSY_STATES = Object.freeze(new Set([STATES.SEEK_FOOD, STATES.EAT, STATES.SEEK_REST, STATES.SLEEP, STATES.SEEK_WASH, STATES.WASH, STATES.SEEK_PLAY, STATES.PLAY, STATES.GAME, STATES.TRAIN]));

export function createBehavior({
  creature, idle, locomotion, habitat, getObserveTarget = null, seed = 7007, personality = null, getZoneWeight = null,
}) {
  const cfg = CONFIG.creature.behavior;
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const calmWait = prefersReducedMotion() ? cfg.calmWaitFactor : 1;
  const { group } = creature;
  const mod = (key) => (personality ? personality.getModifier('behavior', key) : 1);

  let state = STATES.IDLE;
  let current = null;            // laufende Aufgabe oder null
  let autonomous = true;
  let waitTimer = rand(cfg.firstWaitMin, cfg.firstWaitMax);
  let lastZone = null;
  let bias = null;              // Phase 18: Nachwirkung (z. B. nach dem Spielen), Faktoren je Schlüssel
  let biasLeft = 0;             // verbleibende Sekunden der Nachwirkung
  const bm = (key) => {         // Faktor der Nachwirkung (1 ohne Nachwirkung), begrenzt gegen Extreme
    if (!bias || biasLeft <= 0 || !(bias[key] > 0)) return 1;
    return Math.max(0.3, Math.min(3, bias[key]));
  };
  let tendency = null;          // Phase 27 Teil B3: dauerhafte Neigung (z. B. je Evolutionsform), Faktoren je Schlüssel plus `zones`
  const tm = (key) => {         // Faktor der Neigung (1 ohne Neigung), begrenzt gegen Extreme
    if (!tendency || !(tendency[key] > 0)) return 1;
    return Math.max(0.5, Math.min(2, tendency[key]));
  };
  const tz = (id) => {          // Zonenfaktor der Neigung (1 ohne Neigung)
    const w = tendency && tendency.zones ? tendency.zones[id] : undefined;
    return w > 0 ? Math.max(0.5, Math.min(2, w)) : 1;
  };
  const listeners = new Set();

  function setState(next) {
    if (next === state) return;
    const prev = state;
    state = next;
    for (const fn of listeners) fn(next, prev);
  }

  /** Punkt in Augenhöhe-Nähe über dem Boden, damit der Blick zum Ziel leicht nach unten geht. */
  function gazePoint(p, heightFactor = 0.7) {
    return new THREE.Vector3(p.x, EYE_HEIGHT * heightFactor, p.z);
  }

  function endTask() {
    const task = current;
    current = null;
    idle.lookAt(null);
    idle.setGesturesEnabled(true);
    setState(STATES.IDLE);
    waitTimer = rand(cfg.idleMin, cfg.idleMax) * calmWait * mod('wait') * bm('wait') * tm('wait');
    if (task && task.onDone) task.onDone();
  }

  function startDwell() {
    if (!current) return;
    if (current.onArrive) { const cb = current.onArrive; current.onArrive = null; cb(); }
    if (!current) return;   // onArrive darf die Aufgabe ersetzt oder beendet haben
    if (!(current.dwell > 0)) { endTask(); return; }
    if (current.dwellState) setState(current.dwellState);
    current.phase = 'dwell';
    current.timer = current.dwell;
    idle.setGesturesEnabled(!current.quiet);   // Phase 15: im Schlaf keine zufälligen Gesten
    idle.lookAt(current.lookAt || null);
  }

  /** Startet eine Aufgabe und ersetzt eine laufende. task: { kind:'walk'|'turn', point, state, dwell, lookAt, onDone } */
  function begin(task) {
    if (current) { locomotion.stop(); }
    current = { ...task, phase: 'move', timer: 0 };
    setState(task.state);
    if (task.kind === 'turn') {
      idle.setGesturesEnabled(true);
      idle.lookAt(task.lookAt || null);
      locomotion.turnTo(task.point, startDwell);
    } else {
      idle.setGesturesEnabled(false);
      const reached = locomotion.moveTo(task.point, startDwell);
      idle.lookAt(gazePoint(reached));
    }
  }

  // ---------- Aufgaben von außen ----------
  function goTo(point, { state: st = STATES.EXPLORE, dwell = 0, lookAt = null, onDone = null, dwellState = null, onArrive = null } = {}) {
    begin({ kind: 'walk', point, state: st, dwell, lookAt, onDone, dwellState, onArrive });
  }

  function goToZone(id, {
    state: st = STATES.INVESTIGATE, dwell = 0, lookAt = null, onDone = null,
    dwellState = null, onArrive = null, standOff = cfg.zoneStandOff, quiet = false,
  } = {}) {
    const zone = habitat.getZonePosition(id);
    if (!zone) return false;
    // Nicht auf die Zonenmitte, sondern kurz davor stehen bleiben (aus Richtung der Kreatur)
    const from = group.position;
    const away = new THREE.Vector3(from.x - zone.x, 0, from.z - zone.z);
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    away.setLength(standOff);
    const stand = zone.clone().add(away);
    lastZone = id;
    begin({
      kind: 'walk', point: stand, state: st, dwell,
      lookAt: lookAt || new THREE.Vector3(zone.x, 0.05, zone.z), onDone, dwellState, onArrive, quiet,
    });
    return true;
  }

  function observe(point, { state: st = STATES.OBSERVE, dwell = cfg.observeMin, onDone = null, quiet = false } = {}) {
    begin({ kind: 'turn', point, state: st, dwell, lookAt: point, onDone, quiet });
  }

  /** Bricht die aktuelle Aufgabe ab und geht zurück nach IDLE (ohne onDone). */
  function interrupt() {
    if (!current) return;
    locomotion.stop();
    current.onDone = null;
    endTask();
  }

  function setAutonomous(on) { autonomous = !!on; }

  /** Phase 18: Nachwirkung setzen (factors: { explore, investigate, observe, wait } oder null zum Löschen, seconds: Laufzeit). */
  function setBias(factors, seconds = 0) {
    if (!factors || !(seconds > 0)) { bias = null; biasLeft = 0; return; }
    bias = { ...factors };
    biasLeft = seconds;
  }

  /** Phase 27 Teil B3: dauerhafte Neigung setzen (obj: { explore, investigate, observe, wait, dwell, look, repeatZone, zones: { id: Faktor } } oder null zum Löschen). */
  function setTendency(obj) {
    if (!obj || typeof obj !== 'object') { tendency = null; return; }
    const t = {};
    for (const k of ['explore', 'investigate', 'observe', 'wait', 'dwell', 'look', 'repeatZone']) if (obj[k] > 0) t[k] = obj[k];
    t.zones = {};
    if (obj.zones && typeof obj.zones === 'object') for (const id of Object.keys(obj.zones)) if (obj.zones[id] > 0) t.zones[id] = obj.zones[id];
    tendency = t;
  }

  // ---------- Selbstständige Wahl ----------
  function pickExplorePoint() {
    const p = new THREE.Vector3();
    const nav = habitat.nav;
    if (nav) {
      // Phase 30: meist im aktuellen Raum bleiben (ca. 70 %), manchmal in einen anderen Raum gehen (der Weg führt dann durch die Türen)
      const here = nav.regionAt({ x: group.position.x, z: group.position.z });
      const ids = nav.getRegionIds();
      const others = ids.filter((id) => id !== here);
      for (let i = 0; i < 8; i++) {
        const room = (here && (others.length === 0 || rng() < 0.7)) ? here : others[Math.floor(rng() * others.length)];
        const q = nav.randomPoint(room, rng);
        p.set(q.x, 0, q.z);
        if (p.distanceTo(group.position) >= cfg.exploreMinDist) break;
      }
      return p;
    }
    const R = locomotion.getBoundsRadius();
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rng()) * R;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (p.distanceTo(group.position) >= cfg.exploreMinDist) break;
    }
    return p;
  }

  /** Phase 24: Zone aus `ids` wählen; mit `getZoneWeight` (Lernen) werden Orte mit positiven Erfahrungen etwas öfter gewählt, alle anderen behalten Gewicht 1. */
  function pickZone(ids) {
    const hasTendency = !!(tendency && tendency.zones && Object.keys(tendency.zones).length > 0);   // Phase 27 Teil B3: Zonenneigung der Form
    if (!getZoneWeight && !hasTendency) return ids[Math.floor(rng() * ids.length)];
    const ws = ids.map((id) => {
      let w = 1;
      if (getZoneWeight) { const g = getZoneWeight(id); if (Number.isFinite(g) && g > 0) w = g; }
      return w * tz(id);
    });
    let r = rng() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ids.length; i++) { r -= ws[i]; if (r <= 0) return ids[i]; }
    return ids[ids.length - 1];
  }

  function chooseNext() {
    const options = [];
    options.push({ name: 'explore', w: cfg.weights.explore * mod('explore') * bm('explore') * tm('explore') });
    if (habitat.getZoneIds().length > 0) options.push({ name: 'investigate', w: cfg.weights.investigate * mod('investigate') * bm('investigate') * tm('investigate') });
    const camPos = getObserveTarget ? getObserveTarget() : null;
    if (camPos) options.push({ name: 'observe', w: cfg.weights.observe * mod('observe') * bm('observe') * tm('observe') });

    let total = 0;
    for (const o of options) total += o.w;
    let r = rng() * total;
    let pick = options[options.length - 1];
    for (const o of options) {
      r -= o.w;
      if (r <= 0) { pick = o; break; }
    }

    if (pick.name === 'investigate') {
      const all = habitat.getZoneIds();
      const ids = all.filter((id) => id !== lastZone);
      // Stur: kehrt gern zur selben Zone zurück (Basis cfg.repeatZoneChance, Faktor aus der Persönlichkeit)
      const repeat = lastZone !== null && all.includes(lastZone) && rng() < cfg.repeatZoneChance * mod('repeatZone') * tm('repeatZone');
      const id = repeat ? lastZone : (ids.length ? pickZone(ids) : all[0]);
      goToZone(id, { dwell: rand(cfg.dwellMin, cfg.dwellMax) * mod('dwell') * tm('dwell') });
    } else if (pick.name === 'observe') {
      observe(camPos, { dwell: rand(cfg.observeMin, cfg.observeMax) * mod('look') * tm('look') });
    } else {
      const p = pickExplorePoint();
      goTo(p, { state: STATES.EXPLORE, dwell: rng() < cfg.exploreDwellChance ? rand(0.8, 1.8) : 0 });
    }
  }

  function update(dt) {
    if (biasLeft > 0) {
      biasLeft -= dt;
      if (biasLeft <= 0) { bias = null; biasLeft = 0; }
    }
    if (current) {
      if (current.phase === 'dwell') {
        current.timer -= dt;
        if (current.timer <= 0) endTask();
      }
      return;
    }
    if (!autonomous) return;
    waitTimer -= dt;
    if (waitTimer <= 0) chooseNext();
  }

  return {
    update,
    getState: () => state,
    onStateChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    goTo, goToZone, observe, interrupt, setAutonomous, setBias, setTendency,
    isAutonomous: () => autonomous,   // Phase 19: aus (z. B. Minispiele) = auch kein freies Spiel
    getBias: () => (bias && biasLeft > 0 ? { ...bias } : null),
    getTendency: () => (tendency ? { ...tendency, zones: { ...tendency.zones } } : null),   // Phase 27 Teil B3
  };
}
