/*
  RESONA – Einstiegspunkt (Phase 03, Kamera-Steuerung Phase 04, Kreatur Phase 05, Idle Phase 06, Bewegung Phase 07).
  Baut Engine, Kamera (mit Steuerung, Phase 04), Licht, Hintergrund, Habitat und startet die Schleife.
  Bewegung und Verhalten (Phase 07): Locomotion + Behavior. Bedürfnisse und UI folgen in späteren Phasen.
*/
import { Engine } from './core/Engine.js';
import { CameraRig } from './world/CameraRig.js';
import { createLighting } from './world/Lighting.js';
import { createBackdrop } from './world/Backdrop.js';
import { createAtmosphere } from './world/Atmosphere.js';
import { Habitat } from './world/Habitat.js';
import { createCreatureModel } from './creature/CreatureModel.js';
import { createIdleBehavior } from './creature/IdleBehavior.js';
import { createLocomotion } from './creature/Locomotion.js';
import { createBehavior } from './creature/Behavior.js';

function showFatal(message) {
  if (typeof window.__resonaFatal === 'function') window.__resonaFatal(message);
}

function boot() {
  const stage = document.getElementById('stage');
  if (!stage) throw new Error('Element #stage fehlt in game.html.');

  const engine = new Engine(stage);

  const rig = new CameraRig(engine.camera, engine.renderer.domElement);
  engine.onResize(({ aspect }) => rig.fit(aspect));
  rig.fit(engine.aspect);
  engine.addUpdater((dt) => rig.update(dt));

  const lighting = createLighting();
  const backdrop = createBackdrop();
  const atmosphere = createAtmosphere();
  const habitat = new Habitat();

  engine.scene.add(backdrop.group, lighting.group, habitat.group, atmosphere.group);

  // Erste Kreatur (Phase 05): steht am Spawnpunkt, lebt per Idle-Verhalten (Phase 06) und läuft (Phase 07).
  const creature = createCreatureModel();
  creature.group.position.copy(habitat.spawn.position);
  engine.scene.add(creature.group);
  const idle = createIdleBehavior(creature);   // Atmung, Blinzeln, Blick, kleine Gesten (Phase 06)
  engine.addUpdater((dt, t) => idle.update(dt, t));

  // Bewegung (Phase 07). Reihenfolge wichtig: Idle setzt die Pivots absolut, Locomotion addiert danach
  // die Gehanimation. Behavior entscheidet vorher, wohin es geht.
  const locomotion = createLocomotion(creature);
  const behavior = createBehavior({
    creature, idle, locomotion, habitat,
    getObserveTarget: () => engine.camera.position,   // „Spieler" = Kamera
  });
  engine.addUpdater((dt) => { behavior.update(dt); locomotion.update(dt); });
  engine.addUpdater(lighting.update);
  engine.addUpdater(backdrop.update);
  engine.addUpdater(atmosphere.update);
  engine.addUpdater((dt, t) => habitat.update(dt, t));

  engine.start();

  window.__resonaBooted = true;
  document.getElementById('boot')?.classList.add('done');
}

try {
  boot();
} catch (err) {
  console.error('[RESONA] Start fehlgeschlagen:', err);
  showFatal(err && err.message ? err.message : 'Unbekannter Fehler beim Start.');
}
