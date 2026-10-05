/*
  Evolutions-Daten (Phase 26, Verzweigungen Phase 27). Nur Daten, keine Logik (Logik: js/systems/EvolutionSystem.js).
  Neue Evolution = neuer Eintrag in `EVOLUTIONS` (Inhalts-Pipeline, Master-Prompt Abschnitt 26/27).

  Evolution ist NICHT „XP = 100“: acht Faktoren (Master-Prompt Abschnitt 20) wachsen langsam aus dem, was Reson und der Spieler tun.
    curiosity    Neugier: Neues ausprobiert (neues Futter, neues Spielzeug, neues Minispiel, neugierige Momente)
    care         Pflege: gute Werte über längere Zeit, Futter, Waschen, Ausschlafen
    bond         Bindung: der Bindungswert selbst (kommt aus dem NeedSystem, sinkt nie)
    training     Training: der mittlere Lernstand der Fähigkeiten (kommt aus dem TrainingSystem, sinkt nie)
    exploration  Erkundung: Wege, Orte besucht, selbstständiges Umsehen
    social       Zuwendung: Antippen, gemeinsames Spielen, Minispiele, Üben, Füttern mit dem Spieler
    creativity   Kreativität: Vielfalt beim Spielen (verschiedene Spielzeuge, Minispiele)
    balance      Ausgewogenheit: wie gleichmäßig die anderen sieben Faktoren entwickelt sind (Höchststand wird gemerkt)
  Alle Faktoren sind 0..1, wachsen nur und gehen nie zurück. Punkte -> Faktor: 1 - exp(-Punkte / scale) (sättigt, kein Grinden bis ins
  Unendliche). Anti-Grinden zusätzlich über Mindestabstände je Ereignisart (`gapSec`).
  Die Persönlichkeit färbt das Wachstum der Faktoren leicht (`TRAIT_BIAS`, Faktoren, nie ein Verbot). „Umgebung“ (Master-Prompt) kommt mit
  Habitat, Tageszeit und Entdeckung (Phase 30–34).

  Pro Evolution (`EVOLUTIONS[id]`), Felder laut Master-Prompt Abschnitt 27:
    label, description, requires, weight, stage (Ziel-Lebensstufe, immer `special`), look (Phase 27 Teil B1: Größe/Kopf/Stimme/Tempo als Faktoren
    auf den Look der Spezialstufe), material (Teil B1: Farbton der Leuchtteile und Schein, null = Grundfarben), model (null =
    Standardkörper, Teil B2), animationSet (Teil B4: eigene kleine Geste, `formGesture`), abilities (Teil B4: Gelegenheit für die Geste, `formAbility`),
    behavior (Teil B3), rare (bewusst null, siehe `form`). `model` (Teil B2) = Liste kleiner Zusatzteile
    aus Primitiven (`modelPart`), null = keine; Logik: js/creature/FormParts.js.

  Voraussetzungen (`requires`, Phase 27):
    minScore / minFactors / minFactorValue   Grundbedingung für ALLE Formen: Gesamtstand, wie viele Faktoren mindestens `minFactorValue` haben
    focus { main, support }                  Schwerpunkt-Formen: Nähe zur Form („Affinität“) = (Faktor `main` + supportWeight * Faktor `support`)
                                             / (1 + supportWeight); gilt ab `EVO_RULES.branch.minAffinity`
    balanced { minBalance, maxSpread }       ausgewogene Form: Ausgewogenheit mindestens `minBalance` UND Abstand zwischen stärkstem und
                                             schwächstem der sieben Faktoren höchstens `maxSpread`
    weder focus noch balanced                Grundform („Erwachte Form“), nur Rückfall
  Auswahl (`weight` = Rang): unter allen erfüllten Formen gewinnt das höchste `weight` (ausgewogen 3 > Schwerpunkt 2 > Grundform 1); bei
  gleichem `weight` die mit der größeren Affinität. Es gibt kein Scheitern: erfüllt der Stand die Grundbedingung, wird IMMER irgendeine
  Form gewählt, wer anders spielt bekommt eine andere Form, nie eine schlechtere.

  Alle Zahlen und Texte sind Startwerte (Vorschlag), NICHT getestet und NICHT balanciert. Nichts hier bestraft: nichts sinkt, nichts geht verloren.
*/
const freeze = (o) => Object.freeze(o);

export const FACTOR_IDS = freeze(['curiosity', 'care', 'bond', 'training', 'exploration', 'social', 'creativity', 'balance']);

export const FACTORS = freeze({
  curiosity:   freeze({ label: 'Neugier',       scale: 6,  weight: 1 }),
  care:        freeze({ label: 'Pflege',        scale: 8,  weight: 1.2 }),
  bond:        freeze({ label: 'Bindung',       scale: 0,  weight: 1.2, full: 80 }),     // aus needs `bond` (0..100): Faktor = Wert / full
  training:    freeze({ label: 'Training',      scale: 0,  weight: 1 }),                  // aus dem mittleren Lernstand (0..1)
  exploration: freeze({ label: 'Erkundung',     scale: 20, weight: 0.9 }),
  social:      freeze({ label: 'Zuwendung',     scale: 15, weight: 1 }),
  creativity:  freeze({ label: 'Kreativität',   scale: 8,  weight: 0.9 }),
  balance:     freeze({ label: 'Ausgewogenheit', scale: 0, weight: 0.8 }),                // abgeleitet
});

/** Die Faktoren aus Punkten (nur diese werden gezählt und gespeichert). */
export const POINT_FACTORS = freeze(['curiosity', 'care', 'exploration', 'social', 'creativity']);

export const EVO_RULES = freeze({
  checkEverySec: 5,          // so oft wird geprüft, ob eine Evolution bereit ist
  minStageSec: 600,          // so lange (Laufzeit) muss Reson schon in der Endstufe „Erwachsen“ sein: Evolution kommt nicht sofort nach dem Wachsen
  maxDt: 0.25,               // größere Frame-Sprünge zählen nur so viel

  // Punkte je Ereignis. `gapSec` = Mindestabstand je Ereignisart (Anti-Grinden). Neu = erstes Mal (je Futter, Spielzeug, Minispiel, Ort).
  points: freeze({
    careTimePerSec: 1 / 600,         // Pflege: bei durchweg guten Werten 1 Punkt je 10 Minuten (mal Pflegestand 0..1)
    careFeed: 0.5, careWash: 1, careSleep: 1,
    curiosityNewFood: 1, curiosityNewToy: 1, curiosityNewGame: 1, curiosityTap: 0.25,   // `curiosityTap`: nur bei der Reaktion „neugierig“
    explore: 0.4, exploreNewZone: 1,
    socialTap: 0.3, socialFeed: 0.5, socialPlay: 1, socialGame: 1, socialTrain: 1,
    creativityNewToy: 1.5, creativityPlay: 0.4, creativityGame: 0.6,
  }),
  gapSec: freeze({ tap: 5, feed: 20, play: 30, game: 30, train: 30, explore: 10, wash: 20, sleep: 20 }),

  // Orte: Aufenthalt in der Nähe einer Zonenmitte im Stehen (wie bei der Bindung), zählt beim ersten Mal.
  placeRadius: 1.15,
  placeMinSec: 6,            // so lange muss sie dort stehen

  // Ausgewogenheit: Mittel der anderen Faktoren mal (1 - Streuung); Streuung = (größter - kleinster) der sieben, begrenzt auf 0..1.
  balanceMinMean: 0.05,

  // Verzweigungen (Phase 27): Gewicht des Nebenfaktors in der Affinität, kleinste Affinität einer Schwerpunkt-Form.
  branch: freeze({ supportWeight: 0.4, minAffinity: 0.2 }),

  // Persönlichkeit färbt das Wachstum (Faktor auf die Punkte je Faktor), begrenzt auf 0,7 bis 1,5.
  biasRange: freeze([0.7, 1.5]),
});

/** Persönlichkeit -> Faktoren auf das Wachstum der Faktoren (nur leichte Neigung, `weight` des Zuges 0..1 skaliert die Stärke). */
export const TRAIT_BIAS = freeze({
  curious:   freeze({ curiosity: 1.35, exploration: 1.15 }),
  calm:      freeze({ care: 1.15, social: 0.9 }),
  playful:   freeze({ creativity: 1.3, social: 1.1 }),
  shy:       freeze({ exploration: 0.85, care: 1.1 }),
  brave:     freeze({ exploration: 1.3, curiosity: 1.1 }),
  energetic: freeze({ exploration: 1.2, creativity: 1.1 }),
  cautious:  freeze({ care: 1.15, curiosity: 0.9 }),
  social:    freeze({ social: 1.35, creativity: 1.05 }),
  stubborn:  freeze({ exploration: 0.9 }),
});

/**
 * Gestalt der Formen (Phase 27 Teil B1, Logik: js/creature/FormLook.js). Alles nur leichte Unterschiede, keine Form ist besser oder schlechter:
 *   tintMix   Wie weit die Leuchtteile (Augen, Kern, Kristall, Flossenspitzen, Ringe) zur Farbe der Form wandern (0 = Grundfarbe, 1 = ganz).
 *             Der Körper selbst bleibt unberührt (die große Farbentwicklung ist Phase 29).
 *   limits    Grenzen für `look` je Form (Faktoren auf den Look der Spezialstufe); schützt vor Ausreißern in den Daten.
 *   aura      Schein der Spezialform (Growth): Grunddeckkraft `base`, Pulstiefe `depth`, Pulsrate `rate` (rad/s), Zweitschwingung `wobble` (0 = keine).
 *             Die Grunddeckkraft ist für alle Formen gleich (keine leuchtet „stärker“), nur Farbe und Pulsart unterscheiden sich.
 * Alle Zahlen sind Startwerte (Vorschlag), NICHT im Browser gesehen, NICHT balanciert.
 */
export const FORM_RULES = freeze({
  tintMix: 0.8,
  limits: freeze({ size: freeze([0.94, 1.08]), head: freeze([0.94, 1.08]), pitch: freeze([0.9, 1.1]), speed: freeze([0.92, 1.08]) }),
  aura: freeze({ base: 0.07, depth: 0.03, rate: 1.7, wobble: 0 }),
  // Verhaltensneigung (Teil B3, Logik: js/creature/FormBehavior.js + `Behavior.setTendency`): Grenzen für die Faktoren je Form. Eng, damit keine Form
  // spürbar mehr oder weniger „tut“ als eine andere (die Persönlichkeit darf 0,4–2,5, die Nachwirkung des Spielzeugs 0,3–3, die Form nur 0,8–1,25).
  tendency: freeze({ factor: freeze([0.8, 1.25]), zone: freeze([0.85, 1.25]) }),
  // Geste und Fähigkeit (Teil B4, Logik: js/creature/IdleBehavior.js `setFormGesture` + js/creature/FormBehavior.js): für ALLE Formen gleich.
  // Geste: gleiche Dauer und gleiches Gewicht im Zufallstopf der kleinen Gesten (Flossenzucken usw.), gleiche Stärke.
  // Fähigkeit: eine Gelegenheit je Form, bei der die eigene Geste mit `chance` gespielt wird, höchstens alle `cooldownSec`, nach `delaySec`
  // (kein Wert, keine Aufgabe, kein Gewinn hängt daran). Erst ab `minShare` des Übergangs.
  gesture: freeze({ dur: freeze([1.8, 2.4]), weight: 1 }),
  ability: freeze({ chance: 0.5, cooldownSec: 90, delaySec: 0.7, minShare: 0.95 }),
});

/** Faktoren auf Größe, Kopf, Stimmlage und Tempo der Spezialstufe (1 = unverändert). */
const formLook = (size, head, pitch, speed) => freeze({ size, head, pitch, speed });
const NEUTRAL_LOOK = formLook(1, 1, 1, 1);

/** Farben der Leuchtteile (Hex, null = Grundfarbe bleibt) und Schein der Form. `pulse` überschreibt Teile von `FORM_RULES.aura` (`base` nie). */
const formMaterial = ({ eye = null, core = null, accent = null, crystal = null, ring = null, aura = null, pulse = null }) => freeze({
  eye, core, accent, crystal, ring, aura, pulse: pulse ? freeze({ ...pulse }) : null,
});

/**
 * Zusatzteil einer Form (Phase 27 Teil B2, Logik: js/creature/FormParts.js). Alles aus Primitiven, Maße in Einheiten des Körpers (Gruppe, scale 1).
 *   shape    'sphere' [Radius] | 'torus' [Radius, Röhre, Bogen (rad, optional)] | 'octahedron' [Radius] | 'capsule' [Radius, Länge]
 *   anchor   'head' (Kopf-Pivot, Hals), 'body' (Körper-Pivot) oder 'crystal' (Punkt über dem Kopf an der Stelle des Kristalls, bewegt sich nicht mit seinem Schweben)
 *   pos / rot / scale   Lage im Anker (Radiant); bei `mirror` entsteht zusätzlich die gespiegelte Seite (x und die Drehungen um y und z kehren um)
 *   color    Farbe als Name: eye | core | accent | crystal | ring | aura (aus `material` der Form, sonst Grundfarbe) oder body | bodyLight | plate (Grundfarben)
 *   glow     Leuchtstärke (0 = matt, ohne Leuchten)
 *   motion   null | { type: 'sway', amp, rate, phase } (Wippen um z) | { type: 'pulse', amp, rate, phase } (Atmen der Größe)
 *            | { type: 'orbit', radius, rate, phase, y } (kreist in der Ebene des Ankers; bei „reduzierte Bewegung“ steht es still)
 * Fairness: jede Form mit Zusatzteilen hat dieselbe Anzahl (drei Körper), alle klein (größte Ausdehnung höchstens ca. 0,55, das ist der Kragen am Hals; Kopfbreite ca. 0,83), nichts davon ändert Wege, Treffer,
 * Werte oder Aufgaben. Alle Maße sind Startwerte (Vorschlag), NICHT im Browser gesehen.
 */
const modelPart = (o) => freeze({
  shape: 'sphere', args: freeze([0.05]), anchor: 'head', pos: freeze([0, 0, 0]), rot: freeze([0, 0, 0]), scale: freeze([1, 1, 1]),
  color: 'accent', glow: 0.8, mirror: false, motion: null,
  ...o,
  args: freeze([...(o.args || [0.05])]),
  pos: freeze([...(o.pos || [0, 0, 0])]),
  rot: freeze([...(o.rot || [0, 0, 0])]),
  scale: freeze([...(o.scale || [1, 1, 1])]),
  motion: o.motion ? freeze({ ...o.motion }) : null,
});
const modelOf = (...parts) => freeze(parts.map(modelPart));

/**
 * Verhaltensneigung einer Form (Phase 27 Teil B3, Logik: js/creature/FormBehavior.js, Wirkung: `Behavior.setTendency`). Faktoren auf die selbstständige Wahl, 1 = unverändert:
 *   explore / investigate / observe   Gewicht von Erkunden, Zone untersuchen, zum Spieler schauen (nur im Verhältnis zueinander wirksam)
 *   wait        Länge der Ruhephase zwischen zwei Aufgaben (kleiner = regsamer, größer = ruhiger)
 *   dwell       Verweildauer vor einer Zone;  look   Dauer des Blicks zum Spieler;  repeatZone   Neigung, dieselbe Zone nochmal anzulaufen
 *   zones       Zonenneigung { zoneId: Faktor } auf die Wahl der Zone beim Untersuchen (nicht auf Futter, Schlaf, Waschen oder Spielen auf Knopfdruck)
 * Die Neigung ist DAUERHAFT und eine eigene Schicht neben `Behavior.setBias` (zeitlich begrenzt, Spielzeug-Nachklang): beide multiplizieren, keine überschreibt die andere.
 * Fairness: jede Form (außer der Grundform) hat genau drei Faktoren; alle liegen in `FORM_RULES.tendency`. Nichts davon sperrt eine Aufgabe, ändert Werte, Wirkungen oder Gewinn.
 * Alle Zahlen sind Startwerte (Vorschlag), NICHT im Browser gesehen, NICHT balanciert.
 */
const TENDENCY_KEYS = freeze(['explore', 'investigate', 'observe', 'wait', 'dwell', 'look', 'repeatZone']);
const formTendency = (o) => {
  const out = {};
  for (const k of TENDENCY_KEYS) if (Number.isFinite(o[k])) out[k] = o[k];
  out.zones = freeze({ ...(o.zones || {}) });
  return freeze(out);
};

/**
 * Eigene kleine Geste einer Form (Phase 27 Teil B4, `animationSet`). Nur die Art; Dauer und Gewicht kommen für alle Formen gleich aus `FORM_RULES.gesture`.
 *   scan     Kopf wandert langsam nach links und rechts, die Flossen heben sich leicht      (Entdecker)
 *   nuzzle   Kopf neigt sich und senkt sich etwas, der Schwanz wedelt leise                  (Begleiter)
 *   stand    richtet sich einen Moment auf, Kopf hebt sich, Flossen öffnen sich              (Wächter)
 *   sway     wiegt sich zweimal im Takt, der Kristall pulsiert dazu                          (Resonanz)
 *   breathe  ein langsamer, tiefer Atemzug mit leisem Kristallschimmer                       (harmonisch)
 */
const GESTURE_TYPES = freeze(['scan', 'nuzzle', 'stand', 'sway', 'breathe']);
const formGesture = (type) => {
  if (!GESTURE_TYPES.includes(type)) throw new Error('Unbekannte Geste: ' + type);
  return freeze({ type, dur: FORM_RULES.gesture.dur, weight: FORM_RULES.gesture.weight });
};

/**
 * Fähigkeit einer Form (Phase 27 Teil B4): eine Gelegenheit (`on`: Zustand von `Behavior`, in den sie wechselt, optional aus welchen), bei der die Form
 * ihre eigene Geste zeigt. Das ist die ganze Wirkung: sie sieht etwas, sie bekommt nichts (keine Werte, keine Aufgaben, kein Gewinn, keine Sperre).
 * Genau eine Fähigkeit je Form (außer der Grundform), gleiche Wahrscheinlichkeit und Pause (`FORM_RULES.ability`).
 */
const formAbility = (id, label, text, on) => freeze({
  id, label, text, on: freeze({ to: on.to, from: on.from ? freeze([...on.from]) : null }),
});

const BASE_REQUIRES = freeze({ minScore: 0.5, minFactors: 4, minFactorValue: 0.3 });
const requires = (extra) => freeze({ ...BASE_REQUIRES, focus: null, balanced: null, ...extra });
const focus = (main, support) => freeze({ main, support });

/**
 * Gemeinsame Felder aller Formen. Teil B füllt `look`/`material` (B1), `model` (B2), `behavior` (B3, siehe `formTendency`), `animationSet`/`abilities` (B4).
 * `rare` (seltene Variante) bleibt BEWUSST bei allen Formen `null`: eine seltene Variante braucht eine eigene Farbwelt (Phase 29 Farbentwicklung) und einen
 * seltenen Auslöser (Phase 33 ff. seltene Ereignisse). Ein Zufallswurf jetzt wäre eine Form, die manche Spieler nie sehen, ohne dass sie etwas dafür tun können.
 */
const form = (o) => freeze({
  stage: 'special', look: NEUTRAL_LOOK, model: null, material: null, animationSet: null, abilities: freeze([]), behavior: null, rare: null, ...o,
});

/**
 * Evolutionen. Phase 26: die Grundform „Erwachte Form“ (Rückfall). Phase 27: fünf Verzweigungen laut Master-Prompt
 * (Neugier -> Entdeckerform, Bindung -> Begleiterform, Training -> Wächterform, Kreativität -> Resonanzform, Balance -> harmonische Form).
 */
export const EVOLUTIONS = freeze({
  awakened: form({
    label: 'Erwachte Form',
    description: 'Reson hat viel erlebt. Ihre Zeichen leuchten tiefer, etwas in ihr ist aufgewacht.',
    requires: requires({}),
    weight: 1,
    // Grundform: unverändert gegenüber Phase 26 (goldener Schein, Grundfarben).
  }),
  explorer: form({
    label: 'Entdeckerform',
    description: 'Reson hat die Welt mit offenen Sinnen erkundet. Sie schaut sich gern um.',
    requires: requires({ focus: focus('curiosity', 'exploration') }),
    weight: 2,
    look: formLook(0.97, 1.02, 1.04, 1.06),   // etwas leichter, wach, einen Hauch schneller
    material: formMaterial({ eye: 0x7be7ff, accent: 0x21c7b8, crystal: 0x7df3e1, ring: 0x21c7b8, aura: 0x21c7b8, pulse: { rate: 2.2, depth: 0.035 } }),   // Cyan/Türkis, munteres Flimmern
    model: modelOf(   // zwei feine Sensorbögen über den Flossen, ein kleiner Stirnstein
      { shape: 'torus', args: [0.15, 0.011, 2.3], anchor: 'head', pos: [0.19, 0.5, -0.02], rot: [0, 0, 0.2], color: 'ring', glow: 0.9, mirror: true, motion: { type: 'sway', amp: 0.07, rate: 1.6, phase: 0 } },
      { shape: 'sphere', args: [0.028], anchor: 'head', pos: [0, 0.47, 0.3], color: 'eye', glow: 1.2, motion: { type: 'pulse', amp: 0.15, rate: 2.2, phase: 0 } },
    ),
    behavior: formTendency({ explore: 1.2, investigate: 1.1, wait: 0.9, zones: { research: 1.25 } }),   // geht öfter los und schaut sich um, kürzere Ruhephasen, besucht den Forschungsbereich etwas öfter
    animationSet: formGesture('scan'),
    abilities: freeze([formAbility('scan', 'Umschau', 'Wenn sie sich einen Ort ansieht, schaut sie manchmal erst langsam nach links und rechts.', { to: 'INVESTIGATE' })]),
  }),
  companion: form({
    label: 'Begleiterform',
    description: 'Reson hat gelernt, bei dir zu sein. Sie schaut gern zu dir und freut sich über deine Gesellschaft.',
    requires: requires({ focus: focus('bond', 'social') }),
    weight: 2,
    look: formLook(1, 1.05, 1.02, 0.98),   // rundlicherer, freundlicher Kopf, einen Hauch gemächlicher
    material: formMaterial({ eye: 0xffc27a, core: 0xff8a4b, accent: 0xffb347, crystal: 0xff9f6b, ring: 0xffb347, aura: 0xff9a5b, pulse: { rate: 1.2, depth: 0.035 } }),   // warmes Orange/Gold, langsames Atmen
    model: modelOf(   // ein weicher Kragenring am Hals, zwei warme Wangenpunkte
      { shape: 'torus', args: [0.23, 0.04], anchor: 'head', pos: [0, -0.04, 0], rot: [Math.PI / 2, 0, 0], color: 'accent', glow: 0.35, motion: { type: 'pulse', amp: 0.02, rate: 1.2, phase: 0 } },
      { shape: 'sphere', args: [0.04], anchor: 'head', pos: [0.3, 0.14, 0.2], color: 'core', glow: 0.8, mirror: true, motion: { type: 'pulse', amp: 0.1, rate: 1.2, phase: 0.6 } },
    ),
    behavior: formTendency({ observe: 1.25, look: 1.2, explore: 0.9 }),   // schaut öfter und länger zum Spieler, zieht etwas seltener allein los
    animationSet: formGesture('nuzzle'),
    abilities: freeze([formAbility('nuzzle', 'Zuwendung', 'Wenn sie zu dir schaut, neigt sie manchmal den Kopf und wedelt leise.', { to: 'OBSERVE' })]),
  }),
  guardian: form({
    label: 'Wächterform',
    description: 'Reson hat geübt und ist daran gewachsen. Sie steht ruhig und aufmerksam da, als würde sie über das Habitat wachen.',
    requires: requires({ focus: focus('training', 'care') }),
    weight: 2,
    look: formLook(1.05, 0.97, 0.94, 0.94),   // etwas breiter und ruhiger, tiefere Stimme
    material: formMaterial({ eye: 0x6aa8ff, accent: 0xa8c4ff, crystal: 0x4f7bff, ring: 0xa8c4ff, aura: 0x4f7bff, pulse: { rate: 1.0, depth: 0.015 } }),   // Blau, gleichmäßiger Schein
    model: modelOf(   // eine Stirnplatte, zwei Schulterplatten (matt)
      { shape: 'sphere', args: [0.07], anchor: 'head', pos: [0, 0.47, 0.29], rot: [-0.5, 0, 0], scale: [1.6, 0.7, 0.5], color: 'accent', glow: 0.4 },
      { shape: 'sphere', args: [0.1], anchor: 'body', pos: [0.43, 0.12, -0.02], rot: [0, 0, -0.2], scale: [0.5, 1, 1.3], color: 'bodyLight', glow: 0, mirror: true },
    ),
    behavior: formTendency({ wait: 1.15, dwell: 1.15, repeatZone: 1.25 }),   // ruhiger, steht länger an einer Stelle, kehrt gern zu derselben Zone zurück
    animationSet: formGesture('stand'),
    abilities: freeze([formAbility('stand', 'Wache', 'Wenn sie nach einem Weg stehen bleibt, richtet sie sich manchmal einen Moment auf.', { to: 'IDLE', from: ['EXPLORE', 'INVESTIGATE'] })]),
  }),
  resonance: form({
    label: 'Resonanzform',
    description: 'Reson hat gespielt, ausprobiert und Neues erfunden. Sie probiert gern aus und schwingt gern mit.',
    requires: requires({ focus: focus('creativity', 'social') }),
    weight: 2,
    look: formLook(1, 1, 1.06, 1),   // etwas hellere Stimme, sonst Standard
    material: formMaterial({ eye: 0xc9a2ff, core: 0xb45cff, accent: 0xd4a8ff, crystal: 0x9b6bff, ring: 0xd4a8ff, aura: 0x9b6bff, pulse: { rate: 1.7, depth: 0.03, wobble: 0.5 } }),   // Violett, schwingender Schein mit Zweitwelle
    model: modelOf(   // ein Ring um den Kristall, zwei kleine Funken, die auf dem Ring kreisen
      { shape: 'torus', args: [0.2, 0.007], anchor: 'crystal', pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], color: 'ring', glow: 0.9, motion: { type: 'pulse', amp: 0.08, rate: 1.7, phase: 0 } },
      { shape: 'sphere', args: [0.024], anchor: 'crystal', pos: [0, 0, 0], color: 'crystal', glow: 1.4, motion: { type: 'orbit', radius: 0.2, rate: 1.3, phase: 0, y: 0 } },
      { shape: 'sphere', args: [0.024], anchor: 'crystal', pos: [0, 0, 0], color: 'crystal', glow: 1.4, motion: { type: 'orbit', radius: 0.2, rate: 1.3, phase: Math.PI, y: 0 } },
    ),
    behavior: formTendency({ investigate: 1.15, dwell: 1.1, explore: 1.05, zones: { play: 1.25 } }),   // probiert gern aus, verweilt etwas länger, besucht den Spielbereich etwas öfter
    animationSet: formGesture('sway'),
    abilities: freeze([formAbility('sway', 'Mitschwingen', 'Beim Spielen wiegt sie sich manchmal im Takt.', { to: 'PLAY' })]),
  }),
  harmony: form({
    label: 'Harmonische Form',
    description: 'In Reson ist alles im Gleichgewicht. Ihre Zeichen leuchten ruhig und gleichmäßig.',
    requires: requires({ balanced: freeze({ minBalance: 0.35, maxSpread: 0.4 }) }),
    weight: 3,
    look: formLook(1.02, 1, 1, 1),   // fast unverändert, nur ein Hauch größer
    material: formMaterial({ eye: 0xfff1c9, core: 0xffd37a, accent: 0xf3e2a0, crystal: 0xfff1c9, ring: 0xf3e2a0, aura: 0xf3e2a0, pulse: { rate: 0.9, depth: 0.012 } }),   // Weißgold, sehr gleichmäßiger Schein
    model: modelOf(   // ein ruhiger Halo über dem Kristall mit innerem Ring und einer kleinen Perle, die ihn langsam umrundet
      { shape: 'torus', args: [0.22, 0.008], anchor: 'crystal', pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], color: 'aura', glow: 0.8, motion: { type: 'pulse', amp: 0.04, rate: 0.9, phase: 0 } },
      { shape: 'torus', args: [0.13, 0.006], anchor: 'crystal', pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], color: 'accent', glow: 0.8, motion: { type: 'pulse', amp: 0.04, rate: 0.9, phase: Math.PI } },
      { shape: 'sphere', args: [0.02], anchor: 'crystal', pos: [0, 0, 0], color: 'eye', glow: 1.2, motion: { type: 'orbit', radius: 0.22, rate: 0.5, phase: 0, y: 0.2 } },
    ),
    behavior: formTendency({ wait: 1.05, dwell: 1.1, look: 1.1 }),   // gleichmäßig und gelassen: etwas längere Ruhe, Verweilen und Blicke, sonst Standard
    animationSet: formGesture('breathe'),
    abilities: freeze([formAbility('breathe', 'Durchatmen', 'Nach dem Fressen, Waschen oder Schlafen atmet sie manchmal einmal tief durch.', { to: 'IDLE', from: ['EAT', 'WASH', 'SLEEP'] })]),
  }),
});

export const EVOLUTION_IDS = freeze(Object.keys(EVOLUTIONS));

/** Wörter für den Entwicklungsstand (aufsteigend nach Anteil an der Bereitschaft 0..1). Keine Zahlen in der Oberfläche. */
export const EVO_WORDS = freeze([[0, 'sammelt erste Erfahrungen'], [0.25, 'kommt voran'], [0.6, 'entwickelt sich'], [0.85, 'ist fast so weit'], [1, 'bereit für etwas Neues']]);

export const EVO_UI = freeze({
  title: 'Entwicklung',
  separator: ' \u00b7 ',
  leaning: 'stärkste Neigung',
  done: 'hat sich verwandelt',
  // Meldung beim Eintritt der Form (Statuszeile). Kein Wort über das Aussehen (Farbe, Schein und Zusatzteile sind noch nicht im Browser gesehen).
  evolved: freeze({
    awakened: 'Reson hat eine ganz besondere Form angenommen.',
    explorer: 'Reson ist zur Entdeckerform geworden. Sie schaut sich gern um.',
    companion: 'Reson ist zur Begleiterform geworden. Sie schaut gern zu dir.',
    guardian: 'Reson ist zur Wächterform geworden. Sie steht ruhig und aufmerksam da.',
    resonance: 'Reson ist zur Resonanzform geworden. Sie probiert gern aus.',
    harmony: 'Reson ist zur harmonischen Form geworden. Alles in ihr ist im Gleichgewicht.',
  }),
});

/**
 * Dev-Hilfe (bis Phase 48): Adresse `?stage=adult&evo=<Name>` setzt die Erfahrung so, dass Reson sofort zur gewählten Form bereit ist.
 * `ready` = Stand der Phase 26 (irgendeine Form, je nach Faktoren); die Namen der Formen zielen auf genau diese Form.
 * `points`: Punkte der fünf Punkt-Faktoren; `bond`: Bindungswert 0..100 (NeedSystem); `training`: Lernstand 0..1 aller Fähigkeiten.
 * Von Hand gegengerechnet, NICHT ausgeführt: Wer mit anderen Zahlen in `FACTORS`/`EVO_RULES` spielt, muss die Presets neu prüfen.
 */
export const EVO_DEV_PRESETS = freeze({
  ready:     freeze({ points: freeze({ curiosity: 20, care: 20, exploration: 60, social: 40, creativity: 30 }) }),
  explorer:  freeze({ points: freeze({ curiosity: 24, care: 12, exploration: 70, social: 12, creativity: 12 }) }),
  companion: freeze({ points: freeze({ curiosity: 4, care: 14, exploration: 12, social: 40, creativity: 6 }), bond: 85 }),
  guardian:  freeze({ points: freeze({ curiosity: 6, care: 24, exploration: 14, social: 14, creativity: 8 }), training: 0.9 }),
  resonance: freeze({ points: freeze({ curiosity: 8, care: 20, exploration: 20, social: 15, creativity: 28 }) }),
  harmony:   freeze({ points: freeze({ curiosity: 8, care: 12, exploration: 18, social: 14, creativity: 10 }), bond: 56, training: 0.6 }),
});
