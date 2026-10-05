/*
  Feeding – die Kreatur wird gefüttert (Phase 11). Verbindet Futter-Daten, Verhalten und Szene:
    1. feed(foodId): prüft, ob die Kreatur Hunger hat (FoodSystem.canFeed). Ist sie satt, lehnt sie freundlich
       ab (Reaktion „zufrieden", nichts wird verbraucht, keine Strafe).
    2. Das Futter erscheint in der Mitte des Futterplatzes (kleines leuchtendes Objekt, Form und Farbe nach Futterart).
    3. Die Kreatur geht hin (Zustand SEEK_FOOD), bleibt davor stehen und frisst (Zustand EAT): Kopf senkt sich
       und kaut (Idle-Geste `munch`), leise Knabbertöne, das Futter wird kleiner.
    4. Fertig gefressen: FoodSystem wendet die Wirkung an (Sättigung, Energie, Gesundheit, Glück, Geschmacksbonus),
       die Kreatur reagiert (Freude / zufrieden / neugieriges „hm?", je nach Vorliebe, Reaktion mit source 'feed').
  Beim Essen lässt sie sich nicht stören (BUSY_STATES: Antippen tut dann nichts). Wird die Aufgabe trotzdem
  von außen ersetzt oder abgebrochen, räumt Feeding das Futter weg und meldet 'cancelled'; es wird nichts verbraucht.

  „Reduzierte Bewegung": kein Schweben, kein Drehen, kein Kauen der Kopfgeste (Idle tut dann nichts), das Futter
  wird trotzdem kleiner.

  Phase 15: optionales `gate()` (liefert null oder einen Grund-String, z. B. 'asleep'): ist es gesetzt und liefert einen Grund,
  wird nicht gefüttert (Ereignis 'refused' mit diesem Grund, nichts wird verbraucht, keine Strafe). main.js übergibt:
  Reson schläft -> 'asleep'.

  createFeeding({ food, behavior, habitat, idle, interaction, sfx, scene, gate }) ->
    { feed(foodId) -> { ok, reason }, isBusy(), onEvent(fn), update(dt, elapsed), dispose() }
    reason: 'full' | 'busy' | 'unknown' | 'nozone' | 'asleep' (oder der Grund des Gates)
    Ereignisse: { type: 'start' | 'eating' | 'done' | 'refused' | 'cancelled', foodId, ... }
      done: { enjoyment, first, applied }, refused: { reason }
  Werte in js/data/foods.js (FOOD_RULES), NICHT im Browser getestet.
*/
import * as THREE from 'three';
import { FOODS, FOOD_RULES } from '../data/foods.js';
import { prefersReducedMotion } from '../core/env.js';
import { STATES } from './Behavior.js';

const TAU = Math.PI * 2;
const BITE_INTERVAL = 1.1;    // Sekunden zwischen den Knabbertönen
const ease = (u) => u * u * (3 - 2 * u);

function buildMesh(def) {
  const R = FOOD_RULES;
  let geo;
  switch (def.shape) {
    case 'crystal': geo = new THREE.OctahedronGeometry(1.1); break;
    case 'root':    geo = new THREE.CylinderGeometry(0.5, 0.8, 1.9, 10); break;
    case 'jelly':   geo = new THREE.DodecahedronGeometry(1); break;
    case 'orb':
    default:        geo = new THREE.SphereGeometry(1, 20, 14); break;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: def.color, emissive: def.color, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (def.shape === 'crystal') mesh.scale.y = 1.4;
  if (def.shape === 'root') mesh.rotation.z = 0.9;
  const holder = new THREE.Group();     // Gruppe bekommt Größe und Spin, Mesh behält seine Formskalierung
  holder.add(mesh);
  holder.scale.setScalar(0.0001);
  holder.userData.baseSize = R.foodSize;
  return { holder, mesh, geo, mat };
}

export function createFeeding({ food, behavior, habitat, idle, interaction, sfx, scene, gate = null }) {
  const R = FOOD_RULES;
  const calm = prefersReducedMotion();
  const listeners = new Set();
  let session = null;   // { foodId, item, phase: 'walk' | 'eat', t, eatT, biteT, lost }

  function emit(event) { for (const fn of listeners) fn(event); }

  function removeItem(item) {
    scene.remove(item.holder);
    item.geo.dispose();
    item.mat.dispose();
  }

  function cancelSession() {
    if (!session) return;
    const s = session;
    session = null;
    removeItem(s.item);
    emit({ type: 'cancelled', foodId: s.foodId });
  }

  // Wurde die Aufgabe von außen ersetzt/abgebrochen? Dann verlässt der Zustand SEEK_FOOD/EAT, ohne dass
  // onDone kommt (bei normalem Ende kommt onDone direkt nach dem Zustandswechsel, im selben Aufruf).
  const offState = behavior.onStateChange((next) => {
    if (session && next !== STATES.SEEK_FOOD && next !== STATES.EAT) session.lost = true;
  });

  function onArrive() {
    if (!session) return;
    session.phase = 'eat';
    session.eatT = 0;
    session.biteT = 0;
    idle.triggerGesture('munch', { dur: R.eatSec });   // tut bei „reduzierte Bewegung" nichts
    emit({ type: 'eating', foodId: session.foodId });
  }

  function onDone() {
    if (!session) return;
    const s = session;
    session = null;
    removeItem(s.item);
    const res = food.eat(s.foodId);
    if (!res.ok) {                       // z. B. inzwischen satt: nichts passiert
      emit({ type: 'refused', foodId: s.foodId, reason: res.reason });
      return;
    }
    interaction.react(res.reaction, { source: 'feed' });
    emit({ type: 'done', foodId: s.foodId, enjoyment: res.enjoyment, first: res.first, applied: res.applied });
  }

  /** Füttert die Kreatur. Gibt { ok, reason } zurück; bei ok geht sie zum Futterplatz. */
  function feed(foodId) {
    if (session) return { ok: false, reason: 'busy' };
    const def = FOODS[foodId];
    if (!def) return { ok: false, reason: 'unknown' };

    const blocked = gate ? gate() : null;   // Phase 15: z. B. schläft gerade
    if (blocked) {
      emit({ type: 'refused', foodId, reason: blocked });
      return { ok: false, reason: blocked };
    }

    const check = food.canFeed(foodId);
    if (!check.ok) {
      if (check.reason === 'full') interaction.react('content', { source: 'feed' });   // freundlich ablehnen
      emit({ type: 'refused', foodId, reason: check.reason });
      return { ok: false, reason: check.reason };
    }

    const zone = habitat.getZonePosition('food');
    if (!zone) return { ok: false, reason: 'nozone' };

    const item = buildMesh(def);
    item.holder.position.set(zone.x, R.foodY, zone.z);
    scene.add(item.holder);
    session = { foodId, item, phase: 'walk', t: 0, eatT: 0, biteT: 0, lost: false };

    const started = behavior.goToZone('food', {
      state: STATES.SEEK_FOOD, dwellState: STATES.EAT, dwell: R.eatSec, standOff: R.standOff,
      onArrive, onDone,
    });
    if (!started) {
      removeItem(item);
      session = null;
      return { ok: false, reason: 'nozone' };
    }
    emit({ type: 'start', foodId });
    return { ok: true, reason: null };
  }

  function update(dt, elapsed) {
    if (!session) return;
    if (session.lost) { cancelSession(); return; }
    const s = session;
    s.t += dt;

    let progress = 0;
    if (s.phase === 'eat') {
      s.eatT += dt;
      progress = Math.min(1, s.eatT / R.eatSec);
      s.biteT -= dt;
      if (s.biteT <= 0) { if (sfx) sfx.play('munch'); s.biteT = BITE_INTERVAL; }
    }

    const { holder, mat } = s.item;
    const appear = ease(Math.min(1, s.t / R.appearSec));
    let size = holder.userData.baseSize * appear * (1 - 0.9 * progress);
    if (s.phase === 'eat' && !calm) size *= 1 + 0.05 * Math.sin(s.eatT * TAU * 2.5);   // wackelt beim Anknabbern
    holder.scale.setScalar(Math.max(0.0001, size));

    if (!calm) {
      holder.position.y = R.foodY + 0.03 * Math.sin(elapsed * 2.2);
      holder.rotation.y += dt * 0.8;
      mat.emissiveIntensity = 0.9 * (1 + 0.15 * Math.sin(elapsed * 3));
    }
  }

  function isBusy() { return session !== null; }

  function onEvent(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function dispose() {
    offState();
    if (session) { const s = session; session = null; removeItem(s.item); }
    listeners.clear();
  }

  return { feed, isBusy, onEvent, update, dispose };
}
