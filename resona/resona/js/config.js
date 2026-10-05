/*
  RESONA – zentrale Konfiguration (Phase 03)
  Alle Startwerte für Szene, Kamera und Habitat liegen hier, damit spätere Phasen
  (und spätere Claude-Instanzen) nichts in den Modulen suchen müssen.
  Werte sind Startwerte und NICHT visuell getestet (keine Laufzeittests erlaubt).
*/
export const CONFIG = {
  colors: {
    bg: 0x07080f,
    skyTop: 0x0d1030,
    skyBottom: 0x07080f,
    floor: 0x10121c,
    gold: 0xd4af37,
    orange: 0xff6a2b,
    teal: 0x21c7b8,
    violet: 0x8a6bff,
    cyan: 0x4fd8ff,
    dust: 0xffd9a0,
    star: 0xcfd8ff,
  },

  render: {
    maxPixelRatio: 2,     // begrenzt die Last auf hochauflösenden Handys
    antialias: true,
    shadows: false,       // Schatten sind aus (Performance); Phase 46 kann das neu bewerten
    toneMappingExposure: 1.05,
    fogDensity: 0.016,
  },

  camera: {
    fov: 45,
    near: 0.1,
    far: 300,
    target: [0, 0.9, 0.4],     // Blickpunkt (Mitte des Spielbereichs)
    position: [0, 4.6, 9.2],   // Standardposition im Querformat
    fitHalfWidth: 3.6,         // halbe Breite des Habitats, die immer sichtbar sein soll
    maxDistance: 20,           // Hochformat: Standardabstand rückt nur bis hierhin zurück (nicht das Zoom-Limit)

    // Steuerung (Phase 04). Winkel in Grad; polar 0 = senkrecht von oben, 90 = waagerecht.
    controls: {
      minDistance: 4.5,        // nächster Zoom-Abstand zum Blickpunkt
      maxDistance: 28,         // weitester Zoom-Abstand (größer als der Standardabstand im Hochformat)
      minPolarDeg: 12,         // steilster Blick von oben
      maxPolarDeg: 82,         // flachster Blick, Kamera bleibt über dem Boden
      minAzimuthDeg: null,     // null = Kamera darf voll um das Habitat kreisen
      maxAzimuthDeg: null,
      rotateSpeed: 1,          // 1 = Ziehen über die Bildschirmhöhe dreht um 180°
      zoomSpeed: 1,
      damping: 10,             // Nachlauf der Kamera; höher = direkter
      keyRotateDeg: 6,         // Schrittweite der Pfeiltasten
      tapMaxMovePx: 8,         // darüber gilt eine Berührung als Ziehen, nicht als Tippen
      tapMaxMs: 400,           // länger gehaltene Berührung gilt nicht als Tippen
    },
  },

  habitat: {
    radius: 4.8,
    spawn: [0, 0, 0.8],        // Startpunkt der Kreatur (Phase 05)
    // angleDeg: 0 = +x, 90 = +z (zur Kamera hin), 270 = hinten
    zones: [
      { id: 'sleep',    label: 'Schlafplatz',        angleDeg: 225, dist: 3.1, color: 0x8a6bff },
      { id: 'deco',     label: 'Dekoration',         angleDeg: 270, dist: 3.3, color: 0xd4af37 },
      { id: 'research', label: 'Forschungsbereich',  angleDeg: 315, dist: 3.1, color: 0x4fd8ff },
      { id: 'food',     label: 'Futterplatz',        angleDeg: 150, dist: 3.0, color: 0xff6a2b },
      { id: 'play',     label: 'Spielbereich',       angleDeg: 30,  dist: 3.0, color: 0x21c7b8 },
    ],
  },

  // Kreatur (Phase 05). Aussehen als Daten, damit Farbentwicklung (Phase 29) und Evolutionen
  // (Phase 26/27) später nur ein anderes appearance-Objekt übergeben.
  creature: {
    scale: 1,                  // Gesamtgröße (Höhe ca. 1,2 Einheiten bei scale 1)
    blobShadowOpacity: 0.5,    // weicher Schattenfleck unter den Füßen (echte Schatten sind aus)
    appearance: {
      body: 0x1b1d2b,          // Grundkörper, fast schwarz mit Blaustich
      bodyLight: 0x2c3046,     // Füße, Flossen
      plate: 0x0a0b13,         // Gesichtsplatte
      eye: 0x4fd8ff,           // leuchtende Augen
      core: 0xff6a2b,          // Brustkern und Schwanzspitze (Neonorange)
      accent: 0xd4af37,        // Ringe und Flossenspitzen (Gold)
      crystal: 0x21c7b8,       // schwebender Kristall über dem Kopf
    },

    // Idle-Verhalten (Phase 06). Zeiten in Sekunden, Winkel in Radiant. Startwerte, nicht getestet.
    idle: {
      breathPeriod: 4.2,       // Dauer eines Atemzugs
      breathAmp: 0.018,        // Höhenänderung des Rumpfes (Anteil)
      swayAmp: 0.025,          // Wippen/Gewichtsverlagerung
      tailSwaySpeed: 1.1,
      blinkMin: 2.4, blinkMax: 6.0, blinkDur: 0.17, doubleBlinkChance: 0.2,
      gazeMin: 1.4, gazeMax: 4.2,        // Wartezeit bis zum nächsten Blickziel
      gazeYaw: 0.55, gazePitchUp: 0.25, gazePitchDown: 0.15,
      gestureMin: 7, gestureMax: 16,     // Pause zwischen kleinen Gesten
      calmFactor: 0.35,                  // „reduzierte Bewegung": Amplituden, keine Gesten/Hüpfer
    },

    // Bewegung (Phase 07). Strecken in Habitat-Einheiten (Habitat-Radius 4,8, Kreatur ca. 1,2 hoch),
    // Winkel in Radiant, Zeiten in Sekunden. Startwerte, nicht getestet.
    locomotion: {
      walkSpeed: 0.95,         // Laufgeschwindigkeit (Einheiten pro Sekunde)
      minSpeedFactor: 0.2,     // Mindesttempo beim Abbremsen kurz vor dem Ziel (Anteil von walkSpeed)
      accel: 2.4,              // Beschleunigung
      decel: 3.4,              // Abbremsen
      slowRadius: 0.9,         // ab dieser Entfernung zum Ziel wird gebremst
      arriveRadius: 0.05,      // so nah gilt das Ziel als erreicht
      turnSpeed: 3.0,          // maximale Drehgeschwindigkeit (rad/s)
      turnGain: 6,             // wie schnell die Kreatur auf die Zielrichtung einschwenkt
      turnThreshold: 0.8,      // ab diesem Winkel (rad) dreht sie erst auf der Stelle, dann läuft sie los
      faceTolerance: 0.05,     // „zugewandt" bei kleinerer Abweichung (rad)
      boundsMargin: 0.9,       // Abstand zum Habitat-Rand, den die Kreatur nicht betritt
      // Gehanimation
      strideLength: 0.7,       // Laufstrecke pro vollem Schrittzyklus
      footLift: 0.07,          // Fuß-Hubhöhe
      footStride: 0.1,         // Fuß vor/zurück
      bobAmp: 0.018,           // Auf und Ab des Rumpfes
      leanAmp: 0.07,           // Vorneigung beim Laufen (rad)
      rollAmp: 0.04,           // seitliches Wiegen (rad)
      tailTurnLag: 0.1,        // Schwanz folgt Drehungen verzögert
      turnStepFactor: 0.6,     // Schrittintensität beim Drehen auf der Stelle (Anteil)
      turnStepRate: 2.2,       // Schrittzyklus-Phase pro Radiant Drehung
      calmFactor: 0.35,        // „reduzierte Bewegung": Wippen, Neigen, Rollen, Schwanz
    },

    // Verhalten (Phase 07): wann und wohin die Kreatur selbstständig geht.
    behavior: {
      firstWaitMin: 2.5, firstWaitMax: 4.5,  // Wartezeit nach dem Start bis zur ersten Aktion
      idleMin: 3, idleMax: 8,                // Ruhephase zwischen zwei Aktionen
      calmWaitFactor: 1.5,                   // „reduzierte Bewegung": längere Ruhephasen
      weights: { explore: 3, investigate: 2, observe: 1.5 },  // Auswahlgewichte (später Bedürfnisse/Persönlichkeit)
      exploreMinDist: 1.5,                   // Mindestweg zu einem zufälligen Erkundungspunkt
      exploreDwellChance: 0.35,              // Chance, am Erkundungspunkt kurz zu verweilen
      zoneStandOff: 0.8,                     // so weit vor der Zonenmitte bleibt sie stehen
      dwellMin: 2.2, dwellMax: 4.5,          // Verweildauer bei einer Zone
      observeMin: 2.2, observeMax: 4.2,      // so lange schaut sie zur Kamera
    },
  },

  atmosphere: {
    dustCount: 70,
    starCount: 520,
  },

  saveKeyPrefix: 'resona_',   // reserviert für Phase 44 (Save-System)
};
