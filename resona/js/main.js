/*
  RESONA – Einstiegspunkt (Phase 03, Kamera-Steuerung Phase 04, Kreatur Phase 05, Idle Phase 06, Bewegung Phase 07, Interaktion Phase 08, Bedürfnisse Phase 09, Bedürfnis-Anzeige Phase 10, Füttern Phase 11, Persönlichkeit Phase 12, Emotionen Phase 13, Bindung Phase 14, Schlaf Phase 15, Hygiene Phase 16, Gesundheit Phase 17, Spielzeuge Phase 18, freies Spiel Phase 19, Reaktionsspiel Phase 20, Memory Phase 21, Lichtfunken Phase 22, Training Phase 23, Lernen Phase 24, Lebenszyklus Phase 25, Evolution Phase 26, Evolutionsverzweigungen Phase 27 Teil A).
  Baut Engine, Kamera (mit Steuerung, Phase 04), Licht, Hintergrund, Habitat und startet die Schleife.
  Bewegung und Verhalten (Phase 07): Locomotion + Behavior. Bedürfnisse (Phase 09): NeedSystem. Anzeige (Phase 10): NeedsPanel.
*/
import { CONFIG } from './config.js';
import { Engine } from './core/Engine.js';
import { CameraRig } from './world/CameraRig.js';
import { createLighting } from './world/Lighting.js';
import { createFurnishing } from './world/Furnishing.js';
import { createBackdrop } from './world/Backdrop.js';
import { createAtmosphere } from './world/Atmosphere.js';
import { Habitat } from './world/Habitat.js';
import { createCreatureModel } from './creature/CreatureModel.js';
import { createIdleBehavior } from './creature/IdleBehavior.js';
import { createLocomotion } from './creature/Locomotion.js';
import { createBehavior } from './creature/Behavior.js';
import { createInteraction } from './creature/Interaction.js';
import { createSfx } from './audio/Sfx.js';
import { createNeedSystem } from './systems/NeedSystem.js';
import { createNeedsPanel } from './ui/NeedsPanel.js';
import { createFoodSystem } from './systems/FoodSystem.js';
import { createFeeding } from './creature/Feeding.js';
import { createFeedPanel } from './ui/FeedPanel.js';
import { createPersonalitySystem } from './systems/PersonalitySystem.js';
import { createEmotionSystem } from './systems/EmotionSystem.js';
import { createEmotionExpression } from './creature/EmotionExpression.js';
import { createBondSystem } from './systems/BondSystem.js';
import { createSleepSystem } from './systems/SleepSystem.js';
import { createSleeping } from './creature/Sleeping.js';
import { createSleepPanel } from './ui/SleepPanel.js';
import { createHygieneSystem } from './systems/HygieneSystem.js';
import { createCleaning } from './creature/Cleaning.js';
import { createHygienePanel } from './ui/HygienePanel.js';
import { createHealthSystem } from './systems/HealthSystem.js';
import { createHealthNotice } from './ui/HealthNotice.js';
import { createRoomPicker } from './ui/RoomPicker.js';
import { createRoomFocus } from './world/RoomFocus.js';
import { prefersReducedMotion } from './core/env.js';
import { TOYS, TOY_RULES } from './data/toys.js';
import { createToySystem } from './systems/ToySystem.js';
import { createPlaying } from './creature/Playing.js';
import { createToyPanel } from './ui/ToyPanel.js';
import { createReactionGameSystem } from './systems/ReactionGameSystem.js';
import { createMemoryGameSystem } from './systems/MemoryGameSystem.js';
import { createSkillGameSystem } from './systems/SkillGameSystem.js';
import { createSparkField } from './world/SparkField.js';
import { createGaming } from './creature/Gaming.js';
import { createGamePanel } from './ui/GamePanel.js';
import { createTrainingSystem } from './systems/TrainingSystem.js';
import { createTrainer } from './creature/Training.js';
import { createTrainingPanel } from './ui/TrainingPanel.js';
import { createLearningSystem } from './systems/LearningSystem.js';
import { createLifecycleSystem } from './systems/LifecycleSystem.js';
import { createEvolutionSystem } from './systems/EvolutionSystem.js';
import { createHiddenTraitSystem } from './systems/HiddenTraitSystem.js';
import { EVO_DEV_PRESETS, EVOLUTIONS } from './data/evolution.js';
import { SKILL_IDS } from './data/training.js';
import { STATES } from './creature/Behavior.js';
import { createGrowth } from './creature/Growth.js';
import { createFormLook } from './creature/FormLook.js';
import { createColorSystem } from './systems/ColorSystem.js';
import { createColorLook } from './creature/ColorLook.js';
import { HABITAT_RULES, FLOORPLAN } from './data/habitat.js';
import { createFormParts } from './creature/FormParts.js';
import { createFormBehavior } from './creature/FormBehavior.js';
import { createLifecycleNotice } from './ui/LifecycleNotice.js';
import { LIFE_PATH } from './data/lifecycle.js';
import { FOODS } from './data/foods.js';

/**
 * Startstufe aus der Adresse (`?stage=baby`), nur für Entwicklung und Ansehen der Stufen, solange es kein Speichern (Phase 44) und kein
 * Debug-System (Phase 48) gibt. Unbekannt oder fehlend: undefined (dann gilt `LIFE_RULES.startStage`, das Ei).
 */
function readStartStage() {
  try {
    const q = new URLSearchParams(window.location.search).get('stage');
    return q && LIFE_PATH.includes(q) ? q : undefined;
  } catch (_) {
    return undefined;
  }
}

/**
 * Dev-Hilfe (bis Phase 48): `?evo=<Name>` (zusammen mit `?stage=adult`) setzt die Erfahrung so, dass Reson sofort zur Verwandlung bereit ist.
 * Namen: `ready` (irgendeine Form, je nach Faktoren) oder eine Form direkt: `explorer`, `companion`, `guardian`, `resonance`, `harmony`
 * (Zahlen in `EVO_DEV_PRESETS`, `js/data/evolution.js`). Unbekannt oder fehlend: null.
 */
function readEvoPreset() {
  try {
    const q = new URLSearchParams(window.location.search).get('evo');
    return q && Object.prototype.hasOwnProperty.call(EVO_DEV_PRESETS, q) ? EVO_DEV_PRESETS[q] : null;
  } catch (_) {
    return null;
  }
}

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
  const furnishing = createFurnishing({ nav: habitat.nav, zones: CONFIG.habitat.zones });   // Phase 30 Teil B: feste Einrichtung der Räume

  engine.scene.add(backdrop.group, lighting.group, habitat.group, furnishing.group, atmosphere.group);

  // Erste Kreatur (Phase 05): steht am Spawnpunkt, lebt per Idle-Verhalten (Phase 06) und läuft (Phase 07).
  const creature = createCreatureModel();
  creature.group.position.copy(habitat.spawn.position);
  engine.scene.add(creature.group);
  const idle = createIdleBehavior(creature);   // Atmung, Blinzeln, Blick, kleine Gesten (Phase 06)
  engine.addUpdater((dt, t) => idle.update(dt, t));

  // Bewegung (Phase 07). Reihenfolge wichtig: Idle setzt die Pivots absolut, Locomotion addiert danach
  // die Gehanimation. Behavior entscheidet vorher, wohin es geht.
  // Persönlichkeit (Phase 12): feste Zugmischung aus dem Seed (noch nicht gespeichert, Phase 44), verschiebt Verhalten und Reaktionen.
  const personality = createPersonalitySystem({ seed: 12012 });
  const locomotion = createLocomotion(creature, habitat.nav);   // Phase 30: Wege durch die Türen des Grundrisses
  const behavior = createBehavior({
    creature, idle, locomotion, habitat, personality,
    // Lernen (Phase 24): Orte mit positiven Erfahrungen etwas öfter; spät gebunden, `learning` entsteht weiter unten.
    // Phase 30: dazu die verborgene Lieblingsumgebung (`hidden`, Phase 28 Teil C): ihr Bereich etwas öfter (`HABITAT_RULES.favoriteAreaTilt`), nie sichtbar, nichts gesperrt.
    getZoneWeight: (id) => learning.getPlaceWeight(id) * (hidden.getFavoriteEnvironment().area === id ? HABITAT_RULES.favoriteAreaTilt : 1),
    getObserveTarget: () => engine.camera.position,   // „Spieler" = Kamera
  });
  engine.addUpdater((dt) => { behavior.update(dt); locomotion.update(dt); });

  // Bedürfnisse (Phase 09): Werte ändern sich langsam mit der Zeit. Hier früh angelegt, weil das EmotionSystem sie liest.
  const needs = createNeedSystem();
  // Lebenszyklus (Phase 25): LifecycleSystem (Logik: Stufen, Fortschritt, Pflegetempo, Ei wärmen). Im Ei ruhen die Bedürfnisse, die Emotionen und die
  // Gesundheit (es gibt noch keine Kreatur, die etwas braucht; sonst wäre Reson nach 5 Minuten im Ei schon „einsam“); danach laufen sie wie bisher.
  // Sichtbares (Ei, Größe, Schlüpfen) übernimmt `growth` weiter unten, Meldungen `lifecycleNotice` bei der Oberfläche.
  const lifecycle = createLifecycleSystem({ needs, startStage: readStartStage() });
  const hidden = createHiddenTraitSystem({ seed: 28028, needs, lifecycle, personality });   // verborgene Merkmale (Phase 28): Energiebedarf, Wachstum (A), leise Züge, Evolutionsneigung (B, `evolution` wird unten nachgereicht); nie angezeigt
  engine.addUpdater((dt) => lifecycle.update(dt));
  engine.addUpdater((dt) => { if (!lifecycle.isDormant()) needs.update(dt); });

  // Emotionen (Phase 13): aus Bedürfnissen, Ereignissen und Persönlichkeit abgeleitet; die Stimmungsschicht am Körper
  // läuft NACH idle/behavior/locomotion und VOR interaction (Idle setzt die Werte absolut, die Schicht moduliert sie).
  const emotion = createEmotionSystem({ needs, personality });
  engine.addUpdater((dt) => { if (!lifecycle.isDormant()) emotion.update(dt); });   // im Ei ruht auch die Stimmung (Phase 25)
  const expression = createEmotionExpression({ creature, idle, behavior, emotion });
  engine.addUpdater((dt) => expression.update(dt));

  // Schlaf (Phase 15): SleepSystem (Logik: wann, wie lange, Erholung) und Sleeping (Weg zum Schlafplatz, Liegepose, Zzz, Dämmerlicht).
  // Läuft NACH Idle/Behavior/Locomotion/Ausdruck und VOR der Interaktion (multipliziert auf deren absolute Werte). `feeding` und
  // `interaction` entstehen erst danach und werden deshalb spät gebunden (nur zur Laufzeit aufgerufen, nie beim Aufbau).
  const sfx = createSfx();
  const sleep = createSleepSystem({ needs });
  const sleeping = createSleeping({
    sleep, creature, behavior, locomotion, idle, habitat, sfx, lighting,
    camera: engine.camera,
    isBusy: () => lifecycle.isDormant() || feeding.isBusy() || cleaning.isResting() || playing.isResting() || gaming.isResting() || trainer.isResting(),   // im Ei, beim Füttern, Waschen, Spielen, Minispiel oder Üben legt sie sich nicht hin (Phase 16, 18, 20, 23, 25)
    react: (type, opts) => interaction.react(type, opts),
  });
  engine.addUpdater((dt) => sleeping.update(dt));

  // Hygiene (Phase 16): HygieneSystem (Logik: wann, wie lange, Wirkung auf `hygiene`) und Cleaning (Weg zum Waschplatz, Wasch-Animation,
  // Seifenblasen). Läuft wie Sleeping NACH Idle/Behavior/Locomotion/Ausdruck und VOR der Interaktion (addiert auf deren absolute Werte).
  // `feeding`, `sleeping` und `interaction` werden spät gebunden (nur zur Laufzeit aufgerufen, nie beim Aufbau).
  const hygiene = createHygieneSystem({ needs });
  const cleaning = createCleaning({
    hygiene, creature, behavior, locomotion, idle, habitat, sfx,
    camera: engine.camera,
    isBusy: () => lifecycle.isDormant() || feeding.isBusy() || playing.isResting() || gaming.isResting() || trainer.isResting(),   // im Ei, beim Füttern, Spielen, Minispiel oder Üben wird nicht gewaschen (Phase 18, 20, 23, 25)
    isSleeping: () => sleeping.isResting(),
    react: (type, opts) => interaction.react(type, opts),
  });
  engine.addUpdater((dt) => cleaning.update(dt));

  // Spielzeuge (Phase 18): ToySystem (Logik: ob, wie lange, Wirkung, Abnutzung) und Playing (Weg zum Spielbereich, Blick, Gesten, Spielzeug-Objekt).
  // Läuft wie Sleeping/Cleaning NACH Idle/Behavior/Locomotion/Ausdruck und VOR der Interaktion (addiert auf deren absolute Werte).
  // `feeding`, `sleeping`, `cleaning` und `interaction` werden spät gebunden (nur zur Laufzeit aufgerufen, nie beim Aufbau).
  // Bindung, Nachwirkung auf das Verhalten und Emotionen hängen unten an den Ereignissen des ToySystems.
  // Freies Spiel (Phase 19): Lieblingsspielzeug aus der Bindung (spät gebunden, `bond` entsteht weiter unten), längere Pausen bei „reduzierte Bewegung“.
  const toys = createToySystem({
    needs, personality,
    getFavoriteToy: () => bond.getFavorites().toy,
    getToyAffinity: (id) => learning.getObjectAffinity(id, 'toy'),   // Lernen (Phase 24), spät gebunden
    cooldownScale: prefersReducedMotion() ? 1.5 : 1,
  });
  const playing = createPlaying({
    toys, creature, behavior, locomotion, idle, habitat, sfx,
    scene: engine.scene,
    isBusy: () => lifecycle.isDormant() || feeding.isBusy() || gaming.isResting() || trainer.isResting(),   // im Ei, beim Füttern, Minispiel oder Üben wird nicht mit Spielzeug gespielt (Phase 20, 23, 25)
    isSleeping: () => sleeping.isResting(),
    isWashing: () => cleaning.isResting(),
    react: (type, opts) => interaction.react(type, opts),
  });
  engine.addUpdater((dt) => playing.update(dt));
  toys.onEvent((event) => emotion.onPlay(event));   // Zuwendung und Impulse nach Passung/Stimmung (Phase 18)

  // Minispiele (Phase 20 Reaktionsspiel, Phase 21 Memory, Phase 22 Lichtfunken): je ein System mit reiner Logik (Runden/Karten, Punkte, Belohnung, Abnutzung) und
  // Gaming (Reson sieht zu: Blick, kleine Gesten, Ausklingen; es läuft immer nur ein Spiel). Das Spiel selbst läuft auf der Oberfläche
  // (GamePanel mit den Ansichten, unten bei den anderen Panels). Gaming schreibt keine Körperwinkel, die Reihenfolge der Updater ist deshalb
  // unkritisch. `feeding`, `sleeping`, `cleaning` und `interaction` werden spät gebunden (nur zur Laufzeit aufgerufen, nie beim Aufbau).
  // Gesperrt sind Füttern, Schlafen, Waschen und Spielzeug, solange ein Spiel läuft.
  // Jedes Minispiel bekommt bei jedem Seitenaufruf einen frischen Seed (Uhrzeit + Zufall), sonst wäre z. B. die erste Kartenverteilung des Memory
  // nach jedem Neuladen dieselbe (Phase 21, Nachprüfung). Die Systeme nehmen weiter einen Seed entgegen (testbar).
  const freshSeed = () => ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  const game = createReactionGameSystem({ needs, seed: freshSeed() });
  const memoryGame = createMemoryGameSystem({ needs, seed: freshSeed() });
  const skillGame = createSkillGameSystem({ needs, seed: freshSeed(), isCalm: () => prefersReducedMotion() });   // Lichtfunken (Phase 22), 3D-Geschicklichkeit
  const minigames = { reaction: game, memory: memoryGame, skill: skillGame };   // Schlüssel = Spiel-Id (Gaming, GamePanel)
  const gaming = createGaming({
    games: minigames, behavior, idle, sfx,
    camera: engine.camera,
    isBusy: () => lifecycle.isDormant() || feeding.isBusy() || trainer.isResting(),   // im Ei, beim Füttern oder Üben läuft kein Minispiel (Phase 23, 25)
    isSleeping: () => sleeping.isResting(),
    isWashing: () => cleaning.isResting(),
    isToyPlaying: () => playing.isResting(),
    react: (type, opts) => interaction.react(type, opts),
  });
  engine.addUpdater((dt) => gaming.update(dt));
  // Szene der Lichtfunken (Phase 22): zeichnet den Funken und prüft Tipps im Bild (rig.onTap); nach `gaming`, damit sie den Stand dieses Frames sieht.
  const sparkField = createSparkField({ scene: engine.scene, camera: engine.camera, dom: engine.renderer.domElement, rig, game: skillGame });
  engine.addUpdater((dt, t) => sparkField.update(dt, t));
  for (const minigame of Object.values(minigames)) {
    minigame.onEvent((event) => emotion.onGame(event));   // Start = Zuwendung, Impulse nach Ergebnisstufe (Phase 20, 21)
    minigame.onEvent((event) => { if (event.type === 'done' && event.counted) bond.notePlay(); });   // gezähltes Spiel mit dem Spieler = gemeinsames Spiel (Bindung, `first_play`)
  }

  // Training (Phase 23): TrainingSystem (Logik: Versuche, Lernstand je Fähigkeit, Belohnung, Abnutzung) und Trainer (Training.js: Reson führt Folgen, Warten,
  // Springen, Bringen und Lauschen vor; das Drehbuch geht und dreht über Locomotion, springt über `group.position.y`). Es läuft immer nur eine Übung, sie
  // sperrt Füttern, Schlafen, Waschen, Spielzeug und Minispiele (Gates oben und unten, `trainer.isResting()`). Der Lernstand sinkt nie und steht über
  // `training.getLevel(id)` anderen Systemen zur Verfügung (Phase 24 Lernen). `feeding`, `sleeping`, `cleaning`, `playing` und `interaction` werden spät
  // gebunden (nur zur Laufzeit aufgerufen, nie beim Aufbau). Frischer Seed bei jedem Seitenaufruf wie bei den Minispielen.
  const training = createTrainingSystem({ needs, personality, seed: freshSeed() });
  const trainer = createTrainer({
    training, creature, behavior, locomotion, idle, sfx,
    scene: engine.scene,
    camera: engine.camera,
    isBusy: () => lifecycle.isDormant() || feeding.isBusy(),   // im Ei gibt es nichts zu üben (Phase 25)
    isSleeping: () => sleeping.isResting(),
    isWashing: () => cleaning.isResting(),
    isToyPlaying: () => playing.isResting(),
    isGaming: () => gaming.isResting(),
    canTrain: () => lifecycle.can('training'),   // Baby: noch zu klein zum Üben (Phase 25)
    react: (type, opts) => interaction.react(type, opts),
  });
  engine.addUpdater((dt) => trainer.update(dt));
  training.onEvent((event) => emotion.onGame(event));   // Start = Zuwendung, Impulse nach Ergebnisstufe great/good/ok (wie bei den Minispielen)
  training.onEvent((event) => { if (event.type === 'mastered') bond.noteSpecial('skill_' + event.skillId); });   // oberste Stufe erreicht: besonderer Moment (einmalig)

  // Gesundheit (Phase 17): HealthSystem (Zustand fit/schlapp, Hinweis, kleiner Pflege-Schub nach Füttern, Ausschlafen, Waschen). Setzt auf `needs`
  // auf, steuert kein Verhalten und bestraft nichts; sichtbar wird der Zustand über die Emotion `unwell` (EmotionSystem).
  const health = createHealthSystem({ needs });
  engine.addUpdater((dt) => { if (!lifecycle.isDormant()) health.update(dt); });   // im Ei ruht auch die Gesundheits-Rechnung (Phase 25)
  sleep.onEvent((e) => { if (e.type === 'wake') health.noteCare(e.natural ? 'sleep' : 'sleepEarly'); });
  hygiene.onEvent((e) => { if (e.type === 'done') health.noteCare(e.natural && e.gained >= 10 ? 'wash' : 'washEarly'); });

  // Interaktion (Phase 08): Antippen der Kreatur -> Blick, Geste, Laut, Ausdruck. Läuft NACH idle/locomotion,
  // weil sie auf deren Werte multipliziert (Augen, Leuchten).
  const interaction = createInteraction({
    creature, idle, behavior, rig, sfx, personality,
    camera: engine.camera, dom: engine.renderer.domElement,
    isEnabled: () => !lifecycle.isDormant(),   // im Ei löst Antippen nichts an Reson aus, das Ei bearbeitet `growth` (Phase 25)
  });
  engine.addUpdater((dt) => interaction.update(dt));

  // Wachstum (Phase 25): Growth setzt Größe und Kopfgröße, Tempo und Stimmlage je Lebensstufe, zeigt im Ei das Ei (EggModel) statt der Kreatur,
  // lässt es beim Antippen wärmen und beim Übergang schlüpfen. `isResting` und `react` werden spät gebunden (nur zur Laufzeit aufgerufen).
  // Gestalt je Evolutionsform (Phase 27 Teil B1): FormLook tönt die Leuchtteile, liefert Farbe/Pulsart des Scheins und leichte Faktoren auf Größe, Kopf,
  // Stimme und Tempo. Die Quelle der Form-Id wird weiter unten gesetzt (`evolution` entsteht nach `growth`); bis dahin gilt der Standardlook.
  const formLook = createFormLook({ creature, lifecycle });
  const formParts = createFormParts({ creature, form: formLook });   // Zusatzteile je Form (Phase 27 Teil B2): Sensorbögen, Kragen, Platten, Ringe, Halo
  const growth = createGrowth({
    form: formLook, formParts,
    lifecycle, creature, behavior, locomotion, sfx,
    scene: engine.scene, camera: engine.camera, dom: engine.renderer.domElement, rig,
    anchor: habitat.spawn.position,
    isResting: () => feeding.isBusy() || sleeping.isResting() || cleaning.isResting() || playing.isResting() || gaming.isResting() || trainer.isResting(),
    react: (type, opts) => interaction.react(type, opts),
  });
  engine.addUpdater((dt, t) => growth.update(dt, t));
  // Farbentwicklung (Phase 29): ColorSystem leitet aus Lebensstufe und verborgenen Pigmenten ab, wie weit welche Farbe entwickelt ist (nichts wird gespeichert),
  // ColorLook tönt damit nur Körper (führende Farbe) sowie Füße und Flossen (zweite Farbe); Leuchtteile bleiben bei FormLook.
  const colorSystem = createColorSystem({ lifecycle, getPigments: () => hidden.getPigments() });
  const colorLook = createColorLook({ creature, color: colorSystem });
  engine.addUpdater((dt) => colorLook.update(dt));
  // Verhaltensneigung je Evolutionsform (Phase 27 Teil B3): dauerhafte, leichte Neigung auf die selbstständige Wahl (`behavior.setTendency`), gleitend mit dem Anteil des Übergangs.
  // Läuft nach `growth` (dort läuft `form.update`, das den Anteil liefert); ohne Form oder im Ei keine Neigung.
  const formBehavior = createFormBehavior({ behavior, form: formLook, idle });   // Neigung (B3), eigene Geste und Fähigkeit (B4)
  engine.addUpdater((dt) => formBehavior.update(dt));
  rig.setResetGuard((x, y) => interaction.hitTest(x, y) || growth.hitEgg(x, y) || sparkField.isActive());   // Doppelklick auf Reson, auf das Ei oder auf einen Funken (beim Lichtfunken-Spiel) setzt die Kamera nicht zurück (Phase 22, 25)

  // Antippen wirkt leicht auf Glück, Bindung, Neugier (needs, Phase 09) und löst Impulse im EmotionSystem aus (Phase 13).
  interaction.onReaction((event) => { needs.applyInteraction(event); emotion.onReaction(event); });

  // Füttern (Phase 11): FoodSystem (Wirkung, Geschmack), Feeding (Kreatur geht zum Futterplatz und frisst).
  const food = createFoodSystem({ needs });
  const feeding = createFeeding({
    food, behavior, habitat, idle, interaction, sfx, scene: engine.scene,
    gate: () => {   // im Ei, schläft sie, wird sie gewaschen oder spielt sie, wird nicht gefüttert (Phase 15, 16, 18, 25)
      if (lifecycle.isDormant()) return 'egg';   // Phase 25: die Knöpfe sind im Ei ausgeblendet (CSS `.is-dormant`), das hier ist nur die Absicherung
      if (sleeping.isResting()) return 'asleep';
      if (cleaning.isResting()) return 'washing';
      if (gaming.isResting()) return 'gaming';   // Phase 20
      if (trainer.isResting()) return 'training';   // Phase 23
      return playing.isResting() ? 'playing' : null;
    },
  });
  engine.addUpdater((dt, t) => feeding.update(dt, t));
  feeding.onEvent((event) => emotion.onFeed(event));   // Füttern -> Emotionsimpulse (Phase 13)
  feeding.onEvent((event) => { if (event.type === 'done') health.noteCare('feed'); });   // Pflege-Schub (Phase 17)

  // Bindung (Phase 14): merkt sich häufige Zuwendung, Lieblingsfutter/-platz/-spielzeug und besondere Momente (Erinnerungen).
  // Sammelt nur, steuert noch kein Verhalten. Zonenmitten kommen als einfache Daten (das System kennt kein Three.js).
  const bondZones = habitat.getZoneIds().map((id) => {
    const p = habitat.getZonePosition(id);
    const def = CONFIG.habitat.zones.find((z) => z.id === id);
    return { id, label: def ? def.label : id, x: p.x, z: p.z };
  });
  const bond = createBondSystem({
    needs, food, zones: bondZones,
    getPosition: () => creature.group.position,
    isStill: () => !lifecycle.isDormant() && !locomotion.isMoving() && !sleeping.isResting() && !cleaning.isResting() && !trainer.isResting(),   // Schlaf, Waschen und Üben zählen nicht als Aufenthalt (Phase 15, 16, 23)
    getToyLabel: (id) => (TOYS[id] ? TOYS[id].label : id),   // Lieblingsspielzeug mit Namen (Phase 18)
    getFormLabel: (id) => (EVOLUTIONS[id] ? EVOLUTIONS[id].label : null),   // Name der Form in den Erinnerungen (Phase 27 Teil B4)
    getEvolutionId: () => evolution.getEvolutionId(),   // spät gebunden: `evolution` entsteht nach `bond`, gelesen wird erst bei der Anzeige
  });
  engine.addUpdater((dt) => bond.update(dt));

  // Lernen (Phase 24): LearningSystem verbindet positive Erlebnisse (Fressen, Spielen, Waschen, Ausschlafen) mit dem Ort (Zone) und dem Objekt (Futter,
  // Spielzeug). Die Zuneigung wächst, sinkt nie und wirkt nur leicht auf die Wahl (Behavior: Zonenwahl, ToySystem: freies Spiel); nichts wird gemieden.
  // Der erste gelernte Moment wird eine Erinnerung (Bindung, einmalig). Es sammelt nur Erlebnisse, es greift in nichts ein.
  const learning = createLearningSystem({
    zones: bondZones,
    getObjectLabel: (kind, id) => (kind === 'food' ? (FOODS[id] ? FOODS[id].label : id) : (TOYS[id] ? TOYS[id].label : id)),
  });
  engine.addUpdater((dt) => learning.update(dt));
  learning.onLearn((e) => { if (e.type === 'first') bond.noteSpecial('learned_first'); });
  lifecycle.onEvent((e) => { if (e.type === 'stage') bond.noteSpecial(e.hatched ? 'hatched' : 'stage_' + e.to); });   // Lebenszyklus (Phase 25): jede neue Stufe einmalig als besonderer Moment

  // Evolution (Phase 26): EvolutionSystem sammelt acht Faktoren (Neugier, Pflege, Bindung, Training, Erkundung, Zuwendung, Kreativität, Ausgewogenheit)
  // aus den Ereignissen der anderen Systeme (nur lesen, nichts steuern) und ruft in der Endstufe `lifecycle.promote('special')`, wenn die Voraussetzungen
  // der Evolution erfüllt sind. Bindung und Training kommen direkt aus NeedSystem und TrainingSystem (keine zweite Zahl). Im Ei ruht es.
  const trainingMean = () => SKILL_IDS.reduce((sum, id) => sum + training.getLevel(id), 0) / (SKILL_IDS.length || 1);
  const evolution = createEvolutionSystem({
    needs, lifecycle, personality, zones: bondZones,
    getPosition: () => creature.group.position,
    isStill: () => !lifecycle.isDormant() && !locomotion.isMoving() && !sleeping.isResting() && !cleaning.isResting() && !trainer.isResting(),
    getTrainingMean: trainingMean,
  });
  hidden.attach({ evolution });   // verborgene Evolutionsneigung (Phase 28 Teil B): `evolution` entsteht erst hier
  engine.addUpdater((dt) => { if (!lifecycle.isDormant()) evolution.update(dt); });
  interaction.onReaction((e) => { if (!e.source || e.source === 'tap') evolution.note('tap', { emotion: e.emotion }); });
  feeding.onEvent((e) => { if (e.type === 'done') evolution.note('feed', { foodId: e.foodId }); });
  toys.onEvent((e) => { if (e.type === 'done' && e.counted) evolution.note('play', { toyId: e.toyId, auto: e.source === 'auto' }); });
  for (const [gameId, mg] of Object.entries(minigames)) mg.onEvent((e) => { if (e.type === 'done' && e.counted) evolution.note('game', { id: gameId }); });
  training.onEvent((e) => { if (e.type === 'done' && e.counted) evolution.note('train', { skillId: e.skillId }); });
  hygiene.onEvent((e) => { if (e.type === 'done' && e.natural && e.gained >= 10) evolution.note('wash'); });
  sleep.onEvent((e) => { if (e.type === 'wake' && e.natural) evolution.note('sleep'); });
  behavior.onStateChange((next) => { if (next === STATES.EXPLORE || next === STATES.INVESTIGATE) evolution.note('explore'); });
  formLook.setSource(() => evolution.getEvolutionId() || evolution.getPendingId());   // Gestalt je Form: die erreichte, im Übergang die gewählte Form (Phase 27 Teil B1)
  evolution.onEvent((e) => { if (e.type === 'evolved') bond.remember('first_evolution', { id: e.id }); });   // erste Verwandlung als Erinnerung (Phase 14 vorbereitet)
  const evoPreset = readEvoPreset();
  if (evoPreset) {
    evolution.setPoints({ ...evoPreset.points, adultSec: 9999 });
    if (Number.isFinite(evoPreset.bond)) needs.set('bond', evoPreset.bond);   // Bindung und Training liegen in ihren Systemen (keine zweite Zahl)
    if (Number.isFinite(evoPreset.training)) {
      training.restore({ version: 1, skills: Object.fromEntries(SKILL_IDS.map((id) => [id, { level: evoPreset.training, sessions: 5, successes: 3 }])) });
    }
  }
  feeding.onEvent((e) => { if (e.type === 'done') learning.note({ kind: 'feed', level: e.enjoyment, objectId: e.foodId }); });
  toys.onEvent((e) => { if (e.type === 'done' && e.counted) learning.note({ kind: 'play', level: e.enjoyment, objectId: e.toyId }); });
  hygiene.onEvent((e) => { if (e.type === 'done' && e.natural && e.gained >= 10) learning.note({ kind: 'wash' }); });
  sleep.onEvent((e) => { if (e.type === 'wake' && e.natural) learning.note({ kind: 'sleep' }); });
  interaction.onReaction((event) => bond.onReaction(event));
  feeding.onEvent((event) => bond.onFeed(event));

  // Gezähltes Spiel (Phase 18): Bindung merkt sich Spielen und Spielzeug (`first_play`, Lieblingsspielzeug) und das Spielzeug wirkt
  // eine Weile auf die selbstständige Wahl der Kreatur nach (z. B. nach dem Leuchtball eher erkunden, nach dem Würfel eher untersuchen).
  toys.onEvent((event) => {
    if (event.type !== 'done' || !event.counted) return;
    bond.notePlay({ toyId: event.toyId, solo: event.source === 'auto' });   // von selbst gespielt = kein „gemeinsames“ Spiel (Phase 19)
    behavior.setBias(TOYS[event.toyId].after, TOY_RULES.afterglowSec);
  });

  // Bedürfnis-Anzeige (Phase 10): kleine Leiste oben, liegt als DOM über dem Canvas (#ui in game.html).
  const uiRoot = document.getElementById('ui');
  if (uiRoot) {
    const needsPanel = createNeedsPanel({ needs, container: uiRoot, personality, emotion, bond, sleeping, cleaning, playing, gaming, trainer, learning, lifecycle, evolution });
    engine.addUpdater((dt) => needsPanel.update(dt));
    const feedPanel = createFeedPanel({ container: uiRoot, feeding });   // Futterwahl unten (Phase 11)
    engine.addUpdater((dt) => feedPanel.update(dt));
    createSleepPanel({ sleeping, sleep, dock: feedPanel });   // Knopf „Schlafen“/„Wecken“ neben „Füttern“ (Phase 15)
    createHygienePanel({ cleaning, hygiene, dock: feedPanel });   // Knopf „Waschen“/„Fertig“ in derselben Zeile (Phase 16)
    createHealthNotice({ health, dock: feedPanel });   // freundliche Meldung bei schlapp/wieder fit (Phase 17)
    const lifecycleNotice = createLifecycleNotice({ lifecycle, dock: feedPanel, container: uiRoot, evolution });   // Meldungen zu Ei, Schlüpfen, Wachsen; blendet im Ei die Knopfzeile aus (Phase 25)
    engine.addUpdater((dt) => lifecycleNotice.update(dt));
    const toyPanel = createToyPanel({ playing, toys, dock: feedPanel });   // Knopf „Spielen“ mit Spielzeug-Auswahl (Phase 18)
    let roomPickerRef = null;   // Teil C: spät gebunden, die Raumwahl schließt sich mit den anderen Auswahlfeldern
    let trainingPanel = null;   // spät gebunden: entsteht nach dem Minispiel-Panel, die Panels schließen sich gegenseitig (Phase 23)
    const gamePanel = createGamePanel({   // Knopf „Minispiel“ mit Auswahl Reaktion/Memory/Funken (Phase 20, 21, 22); beim Öffnen und Start schließen sich Futter-, Spielzeug- und Übungswahl
      gaming, games: minigames, dock: feedPanel,
      closeOthers: () => { feedPanel.setOpen(false); toyPanel.setOpen(false); if (trainingPanel) trainingPanel.closeIdle(); if (roomPickerRef) roomPickerRef.setOpen(false); },
    });
    trainingPanel = createTrainingPanel({   // Knopf „Üben“ mit Auswahl Folgen/Warten/Springen/Bringen/Lauschen (Phase 23); beim Öffnen und Start schließen sich die anderen Auswahlfelder
      trainer, training, dock: feedPanel,
      closeOthers: () => { feedPanel.setOpen(false); toyPanel.setOpen(false); gamePanel.closeIdle(); if (roomPickerRef) roomPickerRef.setOpen(false); },
    });
    toyPanel.onOpenChange((toyOpen) => { if (toyOpen) { gamePanel.closeIdle(); trainingPanel.closeIdle(); } });
    // Raumwahl (Phase 30 Teil C): Knopf „Räume“ in der Knopfzeile; die Auswahl schließt sich, wenn eine andere aufgeht, und umgekehrt
    const roomPicker = createRoomPicker({
      rooms: FLOORPLAN.rooms.map((r) => {
        const zone = CONFIG.habitat.zones.find((z) => z.room === r.id);
        return { id: r.id, label: r.label, color: zone ? zone.color : CONFIG.colors.gold };
      }),
      dock: feedPanel,
      onView: (id) => cameraRooms.view(id),
      onFollow: () => cameraRooms.follow(),
      getHere: () => cameraRooms.getHere(),
      closeOthers: () => { feedPanel.setOpen(false); toyPanel.setOpen(false); gamePanel.closeIdle(); trainingPanel.closeIdle(); },
    });
    engine.addUpdater(() => roomPicker.update());
    feedPanel.onOpenChange((feedOpen) => { if (feedOpen) roomPicker.setOpen(false); });
    toyPanel.onOpenChange((toyOpen) => { if (toyOpen) roomPicker.setOpen(false); });
    roomPickerRef = roomPicker;   // geht die Spielzeug-Auswahl auf, machen Minispiel- und Übungswahl Platz (Phase 21, 23)
  } else {
    console.warn('[RESONA] Element #ui fehlt in game.html, keine Bedürfnis-Anzeige.');
  }

  engine.addUpdater(lighting.update);
  engine.addUpdater(backdrop.update);
  engine.addUpdater(atmosphere.update);
  habitat.setViewer(engine.camera.position);   // Phase 30: Außenwände zur Kamera hin fahren herunter
  engine.addUpdater((dt, t) => habitat.update(dt, t));
  furnishing.setViewer(engine.camera.position);   // Phase 30 Teil B: Wandstücke der Einrichtung fahren wie die Außenwände herunter
  engine.addUpdater((dt, t) => furnishing.update(dt, t));

  // Phase 30: die Kamera folgt dem Raum der Kreatur (sanft, RoomFocus). Teil C: `cameraRooms.view(id)` hält die Kamera in einem gewählten Raum
  // (Raumwahl), `cameraRooms.follow()` lässt sie Reson wieder folgen.
  const cameraRooms = createRoomFocus({
    getHereId: () => habitat.getRoomAt(creature.group.position),
    hasRoom: (id) => !!habitat.getRoomCenter(id),
    apply: (id) => {
      const c = habitat.getRoomCenter(id);
      if (!c) return;
      rig.setFocus(c.x, c.z);
      lighting.setFocus(c.x, c.z, furnishing.getRoomLight(id));   // Phase 30 Teil B: das Licht folgt dem Raum (Farbe des Bereichs)
    },
  });
  engine.addUpdater((dt) => cameraRooms.update(dt));

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
