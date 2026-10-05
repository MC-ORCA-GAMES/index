/*
  Habitat-Daten (Phase 30). Nur Daten; Szene: js/world/Habitat.js, Zonen-Positionen und Farben: `CONFIG.habitat.zones` (config.js).
  Der Lebensraum („Kuppel“) hat laut Master-Prompt fünf Bereiche: Schlafplatz, Futterplatz, Spielbereich, Forschungsbereich, Dekoration
  (Ids `sleep`, `food`, `play`, `research`, `deco`); dazu kommt seit Phase 16 der Waschplatz (`wash`). Die Bereiche gibt es seit Phase 03/07/16 als Zonen;
  Phase 30 macht sie unterscheidbar und persönlich:
    1. Bodenzeichen: jeder Bereich trägt ein kleines, flaches Zeichen in seiner Farbe (Form statt nur Farbe, auch für Farbenblinde lesbar).
       Flach (nur Boden, keine Höhe), damit nichts mit Futterobjekt, Spielzeugbahnen, Liegepose oder Wegen der Kreatur kollidiert.
    2. Lieblingsbereich: die verborgene Neigung der Kreatur (`hidden.getFavoriteEnvironment().area`, Phase 28 Teil C) zieht die selbstständige Wahl
       der Zone beim Untersuchen um `favoriteAreaTilt` etwas öfter dorthin. Nie sichtbar (kein Hinweis, keine Anzeige), nichts wird gesperrt oder
       bevorzugt behandelt, alle Bereiche bleiben gleich gut. Wirkt wie das Lernen (Phase 24) über `getZoneWeight` in `Behavior`, beides multipliziert sich.
  Dekoration (Pflanzen, Möbel, Kristalle, Lampen, Maschinen, Hologramme) ist Phase 31, die Tageszeit Phase 32; hier kommen weder Möbel noch Licht dazu.
  Alle Zahlen sind Startwerte (Vorschlag), NICHT im Browser gesehen.

  Phase 30 Teil A (Wohnräume): Der Lebensraum ist kein einzelner runder Raum mehr, sondern ein Grundriss aus echten Räumen (`FLOORPLAN`):
  eine Halle in der Mitte (Spawnpunkt) und die sechs Bereiche als eigene Räume mit Wänden und Türen. Die Zonen (`CONFIG.habitat.zones`)
  sind jetzt die Anker in diesen Räumen (Feld `room`); Futter, Schlaf, Waschen, Spielen und das Untersuchen funktionieren unverändert über
  `habitat.getZonePosition(id)`. Wegfindung durch die Türen: js/world/Navigation.js. Wände und Türen: js/world/Habitat.js.
  Koordinaten: x nach rechts, z zur Kamera hin (+z), Maße in Weltmaß (Kreatur ca. 1,2 hoch).
*/
const freeze = (o) => Object.freeze(o);

/** Die Bereiche in der Reihenfolge des Master-Prompts, dann der Waschplatz. */
export const AREA_IDS = freeze(['sleep', 'food', 'play', 'research', 'deco', 'wash']);

/** Bodenzeichen je Bereich (Form, nicht nur Farbe): crescent = Mond, hexagon = Schale, triangle = Spielmarke, cross = Fadenkreuz, diamond = Raute, drop = Tropfen. */
export const AREA_GLYPHS = freeze({
  sleep: 'crescent', food: 'hexagon', play: 'triangle', research: 'cross', deco: 'diamond', wash: 'drop',
});

export const HABITAT_RULES = freeze({
  // Bodenzeichen: Radius (Weltmaß; das Feld der Zone hat 0,62), Deckkraft und Höhe über dem Boden (Scheibe 0,015, Ring 0,02).
  glyph: freeze({ size: 0.3, opacity: 0.5, y: 0.025 }),
  // Lieblingsbereich (verborgen): Faktor auf das Gewicht dieser Zone bei der selbstständigen Wahl (1 = keine Neigung). Wie die leisen Züge bewusst klein.
  favoriteAreaTilt: 1.15,
});

/**
 * Grundriss (Phase 30 Teil A). Raster mit Mittenabstand `pitch`; jeder Raum ist eine Zelle. Räume stoßen mit einer gemeinsamen Wand aneinander.
 * `col`/`row`: Zelle (col nach rechts, row nach vorn zur Kamera). Türen verbinden zwei benachbarte Räume (`a`, `b`).
 *
 *            col -1        col 0        col 1
 *   row -1   research      deco         sleep
 *   row  0   food          halle        play
 *   row +1   (frei)        wash         (frei)
 *
 * Die freien Zellen bleiben leer (Platz für spätere Anbauten, Welterweiterung des Master-Prompts).
 */
export const FLOORPLAN = freeze({
  pitch: 5.6,            // Abstand der Raummitten
  wallThickness: 0.3,    // Dicke der Wände (liegen auf den Zellgrenzen)
  wallHeight: 2.4,       // volle Höhe der Außenwände (Rückseite aus Sicht der Kamera)
  wallLowHeight: 0.35,   // niedrige Höhe: Außenwände zur Kamera hin
  innerWallHeight: 0.55, // Innenwände (zwischen Räumen) bleiben immer niedrig, damit nichts verdeckt wird
  wallFadeSpeed: 6,      // wie schnell Wände auf- und abfahren (1/s)
  doorWidth: 1.5,        // lichte Breite der Türöffnungen
  walkMargin: 0.55,      // Abstand zu den Wänden, den die Kreatur nicht betritt (Körperbreite)
  doorStep: 0.85,        // Wegpunkte vor/hinter der Tür (Abstand von der Wandmitte)
  // `reserve` (Teil B): zusätzlicher Abstand je Wandseite (n = hinten, s = vorn, w = links, e = rechts), den die Kreatur nicht betritt, weil dort
  // Einrichtung an der Wand steht (siehe FURNISHING). Nie an einer Wand mit Tür.
  rooms: freeze([
    { id: 'halle',    label: 'Halle',             col: 0,  row: 0,  zone: null },
    { id: 'deco',     label: 'Dekoration',        col: 0,  row: -1, zone: 'deco',     reserve: freeze({ n: 0.46 }) },
    { id: 'research', label: 'Forschungsbereich', col: -1, row: -1, zone: 'research', reserve: freeze({ n: 0.45, w: 0.45 }) },
    { id: 'sleep',    label: 'Schlafplatz',       col: 1,  row: -1, zone: 'sleep',    reserve: freeze({ n: 0.38 }) },
    { id: 'food',     label: 'Futterplatz',       col: -1, row: 0,  zone: 'food',     reserve: freeze({ w: 0.45 }) },
    { id: 'play',     label: 'Spielbereich',      col: 1,  row: 0,  zone: 'play',     reserve: freeze({ e: 0.45 }) },
    { id: 'wash',     label: 'Waschplatz',        col: 0,  row: 1,  zone: 'wash',     reserve: freeze({ w: 0.45, e: 0.3 }) },
  ]),
  doors: freeze([
    { a: 'halle', b: 'deco' }, { a: 'halle', b: 'food' }, { a: 'halle', b: 'play' }, { a: 'halle', b: 'wash' },
    { a: 'deco', b: 'research' }, { a: 'deco', b: 'sleep' }, { a: 'food', b: 'research' }, { a: 'play', b: 'sleep' },
  ]),
});

/**
 * Einrichtung der Räume (Phase 30 Teil B). Nur Daten; gebaut von js/world/Furnishing.js aus Mesh-Primitiven, keine Dateien.
 * Jedes Stück (`items`) steht in einem Raum (`room`), `at` = [x, z] relativ zur Raummitte (x nach rechts, z zur Kamera), `rot` = Drehung um y.
 * `wall` = an welcher Außenwand es steht (`n` hinten, `s` vorn, `w` links, `e` rechts) oder null (steht frei bzw. flach am Boden).
 * Stücke an der Wand fahren wie die Außenwände herunter (auf `lowScale` der Höhe), wenn die Kamera auf dieser Seite steht: so verdecken sie Reson nie.
 * Teile (`parts`), alle relativ zum Stück, Ursprung am Boden:
 *   shape  box [b, h, t] | cyl [rOben, rUnten, h, Segmente] | torus [R, Röhre, Ringsegm., Rundsegm.] (liegt aufrecht, `rot` [PI/2,0,0] legt ihn flach)
 *          | sphere [r] | cone [r, h, Segmente] (Spitze oben) | octa [r]
 *   pos [x,y,z], rot [rx,ry,rz], color (Zahl, Name aus FURNITURE_COLORS oder 'zone' = Farbe des Bereichs), glow 0..1 (leuchtet in seiner Farbe),
 *   opacity (durchscheinend), overhead (schwebt hoch über dem Boden: zählt nicht als Standfläche).
 * Regeln für die Platzierung (in Node geprüft, nicht gesehen):
 *   - Stücke an der Wand stehen innerhalb des Wandstreifens, den die Kreatur nicht betritt (`reserve` des Raums), und nie vor einer Tür.
 *   - Alles in der Mitte eines Raums (Zonenanker) ist flach (höchstens 0,2 hoch) oder schwebt, damit Futter, Spielzeug, Liegepose, Waschen und
 *     die Standpunkte der Kreatur frei bleiben.
 *   - Die Sockel im Dekorationsraum sind bewusst leer: sie warten auf die Dekoration (Phase 31).
 */
export const FURNITURE_COLORS = freeze({
  metal: 0x2b2f4a, metalLight: 0x3a3f60, dark: 0x14162a, soft: 0x2e2a52, softRim: 0x453c80,
  gold: 0xd4af37, orange: 0xff6a2b, teal: 0x21c7b8, cyan: 0x4fd8ff, violet: 0x8a6bff, green: 0x8fe36b,
});

const part = (o) => freeze(o);
const item = (o) => freeze({ rot: 0, wall: null, ...o, parts: freeze(o.parts) });

export const FURNISHING = freeze({
  lowScale: 0.4,          // Höhenanteil eines Wandstücks, wenn die Kamera auf seiner Seite steht (Außenwände: 0,35 von 2,4)
  glowPulse: 0.1,         // leises Pulsieren der Leuchtteile (aus bei „reduzierte Bewegung“)
  items: freeze([
    // ---------- Halle: vier Leuchtpfosten in den Ecken (Treffpunkt, Mitte bleibt frei) ----------
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => item({
      id: 'hall_post_' + i, room: 'halle', at: [sx * 2.5, sz * 2.5],
      parts: [
        part({ shape: 'cyl', args: [0.07, 0.09, 0.5, 10], pos: [0, 0.25, 0], color: 'metal' }),
        part({ shape: 'sphere', args: [0.1], pos: [0, 0.57, 0], color: 'gold', glow: 1 }),
      ],
    })),

    // ---------- Forschungsbereich: Konsole an der Rückwand, Datenrack links ----------
    item({
      id: 'research_console', room: 'research', at: [0, -2.4], wall: 'n',
      parts: [
        part({ shape: 'box', args: [1.6, 0.5, 0.5], pos: [0, 0.25, 0], color: 'metal' }),
        part({ shape: 'box', args: [1.4, 0.06, 0.45], pos: [0, 0.66, 0], rot: [0.45, 0, 0], color: 'dark' }),
        part({ shape: 'box', args: [1.25, 0.02, 0.34], pos: [0, 0.69, 0.015], rot: [0.45, 0, 0], color: 'zone', glow: 0.9 }),
      ],
    }),
    item({
      id: 'research_rack', room: 'research', at: [-2.42, 0.2], wall: 'w',
      parts: [
        part({ shape: 'box', args: [0.45, 0.9, 0.9], pos: [0, 0.45, 0], color: 'metal' }),
        part({ shape: 'box', args: [0.02, 0.06, 0.7], pos: [0.23, 0.3, 0], color: 'zone', glow: 0.9 }),
        part({ shape: 'box', args: [0.02, 0.06, 0.7], pos: [0.23, 0.5, 0], color: 'zone', glow: 0.9 }),
        part({ shape: 'box', args: [0.02, 0.06, 0.7], pos: [0.23, 0.7, 0], color: 'zone', glow: 0.9 }),
      ],
    }),

    // ---------- Dekoration: drei leere Sockel (Galerie) an der Rückwand ----------
    ...[-1.5, 0, 1.5].map((x, i) => item({
      id: 'deco_plinth_' + i, room: 'deco', at: [x, -2.37], wall: 'n',
      parts: [
        part({ shape: 'cyl', args: [0.24, 0.26, 0.5, 20], pos: [0, 0.25, 0], color: 'metal' }),
        part({ shape: 'torus', args: [0.2, 0.016, 8, 28], pos: [0, 0.51, 0], rot: [Math.PI / 2, 0, 0], color: 'zone', glow: 0.9 }),
      ],
    })),

    // ---------- Schlafplatz: flaches Schlafnest in der Mitte, Nachtlicht an der Rückwand ----------
    item({
      id: 'sleep_nest', room: 'sleep', at: [0, 0],
      parts: [
        part({ shape: 'cyl', args: [0.78, 0.78, 0.01, 40], pos: [0, 0.006, 0], color: 'soft' }),
        part({ shape: 'torus', args: [0.8, 0.075, 10, 40], pos: [0, 0.075, 0], rot: [Math.PI / 2, 0, 0], color: 'softRim', glow: 0.2 }),
      ],
    }),
    item({
      id: 'sleep_lamp', room: 'sleep', at: [1.9, -2.35], wall: 'n',
      parts: [
        part({ shape: 'cyl', args: [0.05, 0.07, 0.55, 10], pos: [0, 0.275, 0], color: 'metal' }),
        part({ shape: 'sphere', args: [0.14], pos: [0, 0.68, 0], color: 'zone', glow: 1 }),
      ],
    }),

    // ---------- Futterplatz: flache Futterschale in der Mitte (Futter schwebt darüber), Spender an der linken Wand ----------
    item({
      id: 'food_dish', room: 'food', at: [0, 0],
      parts: [
        part({ shape: 'torus', args: [0.36, 0.05, 10, 36], pos: [0, 0.06, 0], rot: [Math.PI / 2, 0, 0], color: 'metalLight' }),
        part({ shape: 'torus', args: [0.3, 0.012, 6, 32], pos: [0, 0.04, 0], rot: [Math.PI / 2, 0, 0], color: 'zone', glow: 1 }),
      ],
    }),
    item({
      id: 'food_dispenser', room: 'food', at: [-2.4, 0], wall: 'w',
      parts: [
        part({ shape: 'box', args: [0.5, 0.35, 0.9], pos: [0, 0.175, 0], color: 'metal' }),
        part({ shape: 'cyl', args: [0.2, 0.2, 0.55, 24], pos: [0, 0.625, 0], color: 'zone', glow: 0.2, opacity: 0.3 }),
        part({ shape: 'sphere', args: [0.085], pos: [0.07, 0.47, 0.07], color: 'orange', glow: 0.8 }),
        part({ shape: 'sphere', args: [0.085], pos: [-0.07, 0.56, 0.07], color: 'teal', glow: 0.8 }),
        part({ shape: 'sphere', args: [0.085], pos: [0.07, 0.65, -0.07], color: 'gold', glow: 0.8 }),
        part({ shape: 'sphere', args: [0.085], pos: [-0.07, 0.74, -0.07], color: 'violet', glow: 0.8 }),
        part({ shape: 'cyl', args: [0.22, 0.22, 0.05, 24], pos: [0, 0.925, 0], color: 'metal' }),
      ],
    }),

    // ---------- Spielbereich: flache Spielmatte in der Mitte, Spielzeugkiste an der rechten Wand ----------
    item({
      id: 'play_mat', room: 'play', at: [0, 0],
      parts: [
        part({ shape: 'cyl', args: [1.35, 1.35, 0.01, 48], pos: [0, 0.006, 0], color: 'zone', glow: 0.1, opacity: 0.4 }),
        part({ shape: 'torus', args: [1.35, 0.02, 6, 48], pos: [0, 0.012, 0], rot: [Math.PI / 2, 0, 0], color: 'zone', glow: 0.6 }),
      ],
    }),
    item({
      id: 'play_crate', room: 'play', at: [2.4, 0.1], wall: 'e',
      parts: [
        part({ shape: 'box', args: [0.5, 0.4, 1.1], pos: [0, 0.2, 0], color: 'metal' }),
        part({ shape: 'sphere', args: [0.1], pos: [0, 0.5, -0.4], color: 'orange', glow: 0.5 }),
        part({ shape: 'box', args: [0.16, 0.16, 0.16], pos: [0, 0.48, -0.2], rot: [0.4, 0.5, 0.2], color: 'violet', glow: 0.5 }),
        part({ shape: 'box', args: [0.2, 0.05, 0.2], pos: [0, 0.43, 0], color: 'cyan', glow: 0.5 }),
        part({ shape: 'octa', args: [0.1], pos: [0, 0.5, 0.2], color: 'teal', glow: 0.5 }),
        part({ shape: 'torus', args: [0.09, 0.025, 6, 16], pos: [0, 0.5, 0.4], rot: [0, Math.PI / 2, 0], color: 'gold', glow: 0.5 }),
      ],
    }),

    // ---------- Waschplatz: Waschbecken links, Seifensäule rechts, schwebender Duschring über der Mitte ----------
    item({
      id: 'wash_basin', room: 'wash', at: [-2.4, 0], wall: 'w',
      parts: [
        part({ shape: 'box', args: [0.5, 0.42, 1.3], pos: [0, 0.21, 0], color: 'metal' }),
        part({ shape: 'box', args: [0.4, 0.02, 1.15], pos: [0, 0.43, 0], color: 'green', glow: 0.5, opacity: 0.7 }),
        part({ shape: 'cyl', args: [0.03, 0.03, 0.4, 10], pos: [-0.17, 0.62, 0], color: 'metalLight' }),
        part({ shape: 'cyl', args: [0.025, 0.025, 0.25, 10], pos: [-0.06, 0.8, 0], rot: [0, 0, Math.PI / 2], color: 'metalLight' }),
      ],
    }),
    item({
      id: 'wash_soap', room: 'wash', at: [2.49, -0.2], wall: 'e',
      parts: [
        part({ shape: 'cyl', args: [0.14, 0.16, 0.7, 16], pos: [0, 0.35, 0], color: 'metal' }),
        part({ shape: 'torus', args: [0.15, 0.015, 6, 20], pos: [0, 0.55, 0], rot: [Math.PI / 2, 0, 0], color: 'zone', glow: 0.9 }),
      ],
    }),
    item({
      id: 'wash_shower', room: 'wash', at: [0, 0],
      parts: [
        part({ shape: 'torus', args: [0.55, 0.035, 8, 40], pos: [0, 2.0, 0], rot: [Math.PI / 2, 0, 0], color: 'zone', glow: 0.9, overhead: true }),
        part({ shape: 'cone', args: [0.5, 1.9, 24], pos: [0, 0.95, 0], color: 'zone', glow: 0.3, opacity: 0.05, overhead: true }),
      ],
    }),
  ]),
});

/**
 * Licht je Raum (Phase 30 Teil B): ein einziges bewegliches Punktlicht (das Kernlicht aus Lighting.js) gleitet zum Raum, auf den die Kamera schaut,
 * und färbt sich dort zur Farbe des Bereichs (`mix` 0 = Gold, 1 = ganz Bereichsfarbe); jeder Raum hat außerdem seine eigenen Leuchtteile (FURNISHING).
 * Bewusst KEIN eigenes Licht je Raum (sieben Punktlichter wären auf Handys teuer und nicht prüfbar). `strength` = Faktor auf die Helligkeit je Raum.
 */
export const ROOM_LIGHT = freeze({
  mix: 0.55,
  glideSpeed: 2.2,        // wie schnell das Licht zum neuen Raum gleitet (1/s, wie die Kamera)
  height: 2.4,            // Höhe des Lichts über dem Boden (wie bisher)
  offsetZ: 0.5,           // Versatz zur Kamera hin (wie bisher beim Kernlicht)
  strength: freeze({ halle: 1, deco: 1, research: 1, sleep: 0.85, food: 1, play: 1, wash: 1 }),
});

/**
 * Raumwahl (Phase 30 Teil C): Texte der Oberfläche. Knopf „Räume“ in der Knopfzeile unten, die Auswahl zeigt alle Räume plus „Reson folgen“.
 * `here` = Zusatz am Raum, in dem Reson gerade ist (Zustand hängt nicht nur an Farbe). Meldungen laufen über die Statuszeile (`dock.say`).
 * Ton: nüchtern, nie ein Vorwurf. Texte nur Deutsch.
 */
export const ROOM_UI = freeze({
  openLabel: 'Räume',
  closeLabel: 'Schließen',
  trayLabel: 'Raum ansehen',
  openAria: 'Räume ansehen: Kamera zu einem anderen Raum schicken',
  closeAria: 'Raumauswahl schließen',
  followLabel: 'Reson folgen',
  followAria: 'Kamera folgt Reson wieder',
  here: 'Reson ist hier',
  viewing: (label) => 'Du siehst: ' + label + '.',
  viewingHere: (label) => 'Du siehst: ' + label + ' (hier ist Reson).',
  following: 'Die Kamera folgt Reson wieder.',
  lostFollow: 'Die Kamera bleibt im gewählten Raum. „Reson folgen“ holt sie zurück.',
});
