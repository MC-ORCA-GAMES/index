/*
  Growth – Resons Körper und das Ei folgen dem Lebenszyklus (Phase 25).
  Verbindet LifecycleSystem (Logik) mit der Szene. Zuständig für:
    1. Aussehen je Stufe: Gesamtgröße (`group.scale`) und Kopfgröße (`parts.head.scale`, Kindchenschema) aus `lifecycle.getLook()`,
       Lauftempo (`locomotion.setSpeedScale`) und Stimmlage (`sfx.setPitch`). Das Aussehen gleitet, es gibt keine Sprünge.
    2. Das Ei: solange `lifecycle.isDormant()` (Eistufe) ist die Kreatur unsichtbar und das Ei (EggModel) steht an ihrer Stelle. Das Verhalten
       ruht (`behavior.setAutonomous(false)`). Antippen des Eis wärmt es (`lifecycle.warm()`, kleiner Schub, Wackeln, leises Summen).
    3. Schlüpfen: beim Übergang bebt das Ei und leuchtet auf; bei `stage` platzt es (Blitz, Welle, Ton), Reson wächst aus der Schale heraus
       (`emergeSec`), schaut zur Kamera (Reaktion `curious`, Quelle `grow`) und das Verhalten läuft wieder.
    5. Spezialform (Phase 26): weicher Schein um den Körper (`aura`) ab dem Übergang in die Spezialform. Phase 27 Teil B1: mit der optionalen
       Abhängigkeit `form` (FormLook) bekommt jede Evolutionsform eigene Farbe und Pulsart des Scheins, leichte Unterschiede in Größe, Kopf,
       Stimme und Tempo (`form.applyLook`) und getönte Leuchtteile (`form.update`). Ohne `form` verhält sich alles wie in Phase 26.
       Phase 27 Teil B2: mit der optionalen Abhängigkeit `formParts` (FormParts) bekommt jede Form drei kleine Zusatzteile (`formParts.update`, nach `form.update`).
    4. Stufenwechsel danach: kleiner Glockenton und eine Reaktion `happy` (Quelle `grow`), aber nur, wenn Reson gerade frei ist (`isResting`).
  Reaktionen mit Quelle `grow` zählen nicht als Tippen (NeedSystem, EmotionSystem und BondSystem ignorieren Quellen ungleich `tap`).

  Schreibt nur Dinge, die sonst niemand setzt: `group.scale` (Interaction und Training lesen es bereits), `parts.head.scale` (Idle schreibt dort
  nur Drehungen), Sichtbarkeit der Kreatur und des Eis. Läuft an beliebiger Stelle der Updater-Reihenfolge.

  createGrowth({ lifecycle, creature, behavior, locomotion, sfx, scene, camera, dom, rig, anchor, isResting, react, form, formParts }) ->
    { update(dt, t), hitEgg(clientX, clientY), isEggShown(), dispose() }
    anchor: Punkt (x, z) des Eis (Spawnpunkt). isResting(): ob Reson gerade beschäftigt ist (spät gebunden). react(type, { source }): Reaktion der
    Kreatur (spät gebunden an `interaction.react`). form: optional, FormLook (Phase 27 Teil B1), formParts: optional, FormParts (Teil B2, braucht `form`); beide gehören `main.js`, `dispose()` rührt sie nicht an.
  NICHT im Browser getestet, nicht ausgeführt. Alle Werte sind Startwerte.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';
import { createEggModel } from '../world/EggModel.js';
import { LIFE_RULES } from '../data/lifecycle.js';

const ease = (u) => u * u * (3 - 2 * u);

export function createGrowth({
  lifecycle, creature, behavior, locomotion, sfx = null, scene, camera, dom, rig, anchor,
  isResting = () => false, react = () => false, form = null, formParts = null,
}) {
  const calm = prefersReducedMotion();
  const { group, parts } = creature;
  const baseScale = CONFIG.creature.scale;

  const egg = createEggModel(creature.appearance);
  egg.group.position.set(anchor.x, 0, anchor.z);
  scene.add(egg.group);

  // Schein der Spezialform (Phase 26): ein weicher, additiver Hof um den Körper, blendet beim Übergang in die Spezialform ein.
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 20, 14),
    new THREE.MeshBasicMaterial({ color: creature.appearance.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  aura.position.y = 0.62;
  aura.visible = false;
  group.add(aura);
  let auraLevel = 0;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const sphere = new THREE.Sphere();

  let wasDormant = null;     // null = noch nicht synchronisiert
  let liveHatch = false;     // das Ei ist gerade live geschlüpft (Ereignis `stage` mit `hatched`)
  let eggBursting = false;   // das Ei zeigt noch seinen Platz-Effekt
  let emerge = null;         // { t, dur }: das frisch geschlüpfte Baby wächst aus der Schale
  let clock = 0;

  // ---------- Ei <-> Kreatur ----------
  function enterDormant() {
    group.visible = false;
    egg.reset();
    egg.group.visible = true;
    eggBursting = false;
    emerge = null;
    behavior.setAutonomous(false);
    if (sfx) sfx.setPitch(1);
  }

  function leaveDormant(burst) {
    group.visible = true;
    behavior.setAutonomous(true);
    if (burst) {
      egg.startBurst();
      eggBursting = true;
      emerge = { t: 0, dur: LIFE_RULES.emergeSec };
    } else {
      egg.group.visible = false;
      eggBursting = false;
    }
  }

  function sync(dormant, burst) {
    if (dormant) enterDormant();
    else leaveDormant(burst);
    wasDormant = dormant;
  }

  // ---------- Ereignisse der Logik ----------
  const offEvent = lifecycle.onEvent((e) => {
    if (e.type === 'growing' && e.from === 'germ') {
      if (sfx) sfx.play('hum');                       // das Ei beginnt zu beben
    } else if (e.type === 'stage') {
      if (e.hatched) {
        liveHatch = true;                             // der Rest passiert in `update` (dort wechselt die Sichtbarkeit)
      } else {
        if (sfx) sfx.play('chime');                   // kleiner Glockenton beim Wachsen
        if (!isResting()) react('happy', { source: 'grow' });
      }
    }
  });

  // ---------- Antippen des Eis ----------
  /** true, wenn der Bildschirmpunkt (Client-Koordinaten) das sichtbare Ei trifft. */
  function hitEgg(clientX, clientY) {
    if (!egg.group.visible || !lifecycle.isDormant()) return false;
    const rect = dom.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const h = egg.getHit();
    sphere.center.set(egg.group.position.x, egg.group.position.y + h.centerY, egg.group.position.z);
    sphere.radius = h.radius;
    return raycaster.ray.intersectsSphere(sphere);
  }

  const offTap = rig.onTap(({ x, y }) => {
    if (!lifecycle.isDormant() || lifecycle.getTransition()) return;   // beim Schlüpfen nur zuschauen
    if (!hitEgg(x, y)) return;
    egg.poke();
    lifecycle.warm();
    if (sfx) sfx.play('hum');
  });

  // ---------- Frame ----------
  function update(dt, t) {
    clock = typeof t === 'number' ? t : clock + dt;

    // Sichtbarkeit nachführen (auch wenn die Stufe von außen gesetzt wird, z. B. beim Laden in Phase 44)
    const dormant = lifecycle.isDormant();
    if (dormant !== wasDormant) {
      sync(dormant, liveHatch);
      if (!dormant && liveHatch) {
        liveHatch = false;
        if (sfx) { sfx.setPitch(lifecycle.getLook().pitch); sfx.play('hatch'); }
        react('curious', { source: 'grow' });         // das Baby schaut zum Spieler
      }
    }

    if (egg.group.visible) {
      const tr = lifecycle.getTransition();
      egg.update(dt, clock, {
        progress: lifecycle.getProgress(),
        hatch: tr && tr.from === 'germ' ? tr.u : 0,
        calm,
      });
      if (eggBursting && !egg.isBursting()) {
        egg.group.visible = false;
        eggBursting = false;
      }
    }

    if (dormant) return;

    // Schein der Spezialform (Phase 26): im Übergang einblenden, danach ruhig pulsieren
    const trNow = lifecycle.getTransition();
    const auraTarget = lifecycle.getStageId() === 'special' ? 1 : (trNow && trNow.to === 'special' ? trNow.u : 0);
    auraLevel += (auraTarget - auraLevel) * Math.min(1, dt * 3);
    aura.visible = auraLevel > 0.01;
    if (form) form.update(dt);                       // Farbton der Leuchtteile und Scheinfarbe je Form (Phase 27 Teil B1)
    if (formParts) formParts.update(dt);             // Zusatzteile je Form, nach `form.update` (Phase 27 Teil B2)
    if (aura.visible) {
      // Ohne `form` gelten die Werte der Phase 26 (Grunddeckkraft 0,07, Tiefe 0,03, Rate 1,7); mit `form` Farbe und Pulsart der Form, gleiche Grunddeckkraft.
      const A = form ? form.getAura() : null;
      if (A) aura.material.color.copy(A.color);
      const baseOp = A ? A.base : 0.07;
      const depth = A ? A.depth : 0.03;
      const rate = A ? A.rate : 1.7;
      const wobble = A ? A.wobble : 0;
      const wave = Math.sin(clock * rate) + (wobble > 0 ? wobble * Math.sin(clock * rate * 1.7 + 1.3) : 0);
      aura.material.opacity = auraLevel * (baseOp + (calm ? 0 : depth * wave / (1 + wobble)));
    }

    // Aussehen der Stufe (mit den leichten Zügen der Form)
    const look = form ? form.applyLook(lifecycle.getLook()) : lifecycle.getLook();
    let k = look.size;
    if (emerge) {
      emerge.t += dt;
      const u = Math.min(1, emerge.t / emerge.dur);
      k *= 0.35 + 0.65 * ease(u);
      if (u >= 1) emerge = null;
    }
    group.scale.setScalar(baseScale * k);
    parts.head.scale.setScalar(look.head);
    locomotion.setSpeedScale(look.speed);
    if (sfx) sfx.setPitch(look.pitch);
  }

  // Erster Abgleich schon beim Aufbau, damit im ersten Bild nicht die falsche Gestalt sichtbar ist.
  sync(lifecycle.isDormant(), false);
  if (!lifecycle.isDormant()) {
    const look = form ? form.applyLook(lifecycle.getLook()) : lifecycle.getLook();
    group.scale.setScalar(baseScale * look.size);
    parts.head.scale.setScalar(look.head);
    locomotion.setSpeedScale(look.speed);
    if (sfx) sfx.setPitch(look.pitch);
  }

  function dispose() {
    offEvent();
    offTap();
    scene.remove(egg.group);
    egg.dispose();
    group.remove(aura);
    aura.geometry.dispose();
    aura.material.dispose();
    group.visible = true;
    group.scale.setScalar(baseScale);
    parts.head.scale.setScalar(1);
    locomotion.setSpeedScale(1);
    if (sfx) sfx.setPitch(1);
  }

  return { update, hitEgg, isEggShown: () => egg.group.visible, dispose };
}
