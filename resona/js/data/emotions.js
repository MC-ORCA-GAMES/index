/*
  Emotions-Daten (Phase 13). Nur Daten, keine Logik (Logik: js/systems/EmotionSystem.js,
  Darstellung am Körper: js/creature/EmotionExpression.js). Neue Emotion = neuer Eintrag in EMOTIONS.

  Felder pro Emotion:
    label     deutscher Name (Oberfläche; Emotionen sind auch ohne Farbe lesbar: Haltung, Augen, Leuchten, Wort)
    pose      Körperausdruck bei voller Stärke, wird mit der Stärke (0..1) überblendet:
                eyeOpen    Faktor auf die Augenhöhe (< 1 = halb geschlossen, > 1 = weit)
                eyeGlow    Faktor auf das Augenleuchten
                core       Faktor auf das Leuchten des Brustkerns
                crystal    Faktor auf das Leuchten des Kristalls
                headPitch  Kopfneigung in rad, positiv = nach vorn/unten (Annahme, nicht getestet)
                finSpread  Flossen öffnen (+) oder anlegen (-) in rad
    gesture   kleine Geste beim Wechsel zu dieser Emotion (oder null)
    halfLife  Sekunden, in denen ein Ereignis-Impuls auf die Hälfte abklingt
  Alle Zahlen sind Startwerte (Vorschlag), nicht balanciert, nicht getestet.
*/

export const EMOTIONS = Object.freeze({
  happy: {
    label: 'glücklich', gesture: 'tailWag', halfLife: 14,
    pose: { eyeOpen: 1.05, eyeGlow: 1.25, core: 1.35, crystal: 1.2, headPitch: -0.04, finSpread: 0.08 },
  },
  curious: {
    label: 'neugierig', gesture: 'headTilt', halfLife: 14,
    pose: { eyeOpen: 1.1, eyeGlow: 1.3, core: 1.05, crystal: 1.25, headPitch: -0.05, finSpread: 0.06 },
  },
  tired: {
    label: 'müde', gesture: null, halfLife: 14,
    pose: { eyeOpen: 0.7, eyeGlow: 0.7, core: 0.75, crystal: 0.7, headPitch: 0.18, finSpread: -0.1 },
  },
  hungry: {
    label: 'hungrig', gesture: null, halfLife: 14,
    pose: { eyeOpen: 1.0, eyeGlow: 0.9, core: 0.8, crystal: 0.9, headPitch: 0.1, finSpread: -0.05 },
  },
  lonely: {
    label: 'einsam', gesture: null, halfLife: 14,
    pose: { eyeOpen: 0.92, eyeGlow: 0.85, core: 0.85, crystal: 0.75, headPitch: 0.12, finSpread: -0.08 },
  },
  excited: {
    label: 'aufgeregt', gesture: 'hop', halfLife: 9,
    pose: { eyeOpen: 1.15, eyeGlow: 1.5, core: 1.5, crystal: 1.45, headPitch: -0.06, finSpread: 0.14 },
  },
  content: {
    label: 'zufrieden', gesture: null, halfLife: 14,
    pose: { eyeOpen: 0.88, eyeGlow: 0.95, core: 1.15, crystal: 1.05, headPitch: 0.02, finSpread: 0.0 },
  },
  cautious: {
    label: 'vorsichtig', gesture: 'finFlick', halfLife: 12,
    pose: { eyeOpen: 1.05, eyeGlow: 1.05, core: 0.9, crystal: 0.95, headPitch: 0.06, finSpread: -0.14 },
  },
  surprised: {
    label: 'überrascht', gesture: 'crystalPulse', halfLife: 4,
    pose: { eyeOpen: 1.2, eyeGlow: 1.6, core: 1.2, crystal: 1.5, headPitch: -0.08, finSpread: 0.12 },
  },
  // Phase 17: aus dem Wert `health` abgeleitet (leise, ohne Schrecken: etwas gedämpft, Kopf leicht gesenkt, Flossen locker)
  unwell: {
    label: 'angeschlagen', gesture: null, halfLife: 14,
    pose: { eyeOpen: 0.78, eyeGlow: 0.65, core: 0.7, crystal: 0.65, headPitch: 0.16, finSpread: -0.12 },
  },
});

export const EMOTION_IDS = Object.freeze(Object.keys(EMOTIONS));

export const EMOTION_RULES = Object.freeze({
  // Aus den Bedürfnissen abgeleitete Grundstimmung (langsam). Alle Werte als Bedürfniswerte 0..100.
  // from/to: Bereich, in dem das Ziel von 0 auf 1 steigt; max: Obergrenze des Ziels.
  fromNeeds: Object.freeze({
    hungry:  Object.freeze({ need: 'hunger',    from: 45, to: 15, max: 1 }),
    tired:   Object.freeze({ need: 'energy',    from: 45, to: 15, max: 1 }),
    happy:   Object.freeze({ need: 'happiness', from: 60, to: 95, max: 0.8 }),
    curious: Object.freeze({ need: 'curiosity', from: 50, to: 20, max: 0.6 }),   // wenig Neugier-Wert = Lust auf Neues
    unwell:  Object.freeze({ need: 'health',    from: 60, to: 40, max: 0.85 }),  // Phase 17: schwache Gesundheit = angeschlagen (Komfortboden 35, also nie darüber hinaus)
  }),
  // zufrieden: kleinster Wert aus Sättigung/Energie/Hygiene ab `from` (wächst bis `to`), höchstens `max`
  content: Object.freeze({ needs: Object.freeze(['hunger', 'energy', 'hygiene']), from: 55, to: 85, max: 0.55 }),
  // einsam: nur aus der Zeit ohne Zuwendung während das Spiel läuft (nie aus Offline-Zeit, keine Schuldmechanik), sanft begrenzt
  lonely: Object.freeze({ startSec: 180, rampSec: 420, max: 0.55 }),
  // Impulse durch Ereignisse (0..1), jeweils pro Reaktion aus Interaction.js ('tap')
  onReaction: Object.freeze({
    curious:   Object.freeze({ curious: 0.7 }),
    happy:     Object.freeze({ happy: 0.8 }),
    surprised: Object.freeze({ surprised: 0.9, cautious: 0.45 }),
    content:   Object.freeze({ content: 0.6 }),
  }),
  // Serie schneller Taps: ab dieser Länge aufgeregt (Stärke steigt pro Tap, bis max)
  excitedStreak: Object.freeze({ from: 3, perTap: 0.3, max: 0.9 }),
  // Impulse beim Füttern (Geschmacksstufe aus FOOD_RULES) und beim freundlichen Ablehnen
  onFeed: Object.freeze({
    loves:   Object.freeze({ happy: 0.85, excited: 0.55 }),
    likes:   Object.freeze({ happy: 0.65 }),
    okay:    Object.freeze({ content: 0.5 }),
    meh:     Object.freeze({ curious: 0.5 }),
    refused: Object.freeze({ content: 0.5 }),
  }),
  // Impulse nach dem Spielen (Phase 18), nach Passungsstufe des Spielzeugs (TOY_RULES.tiers). Dazu kommt `mood` des Spielzeugs (toys.js).
  onPlay: Object.freeze({
    loves: Object.freeze({ happy: 0.8, excited: 0.5 }),
    likes: Object.freeze({ happy: 0.6 }),
    okay:  Object.freeze({ content: 0.5 }),
  }),
  smoothPerSec: 0.5,      // so schnell zieht die Grundstimmung nach (1/s)
  minShow: 0.15,          // darunter gilt keine Emotion als vorhanden
  switchMargin: 0.12,     // eine andere Emotion muss um so viel stärker sein, bevor gewechselt wird (gegen Flackern)
  gestureMinGap: 25,      // Sekunden zwischen zwei Gesten beim Emotionswechsel
  gestureMinLevel: 0.45,  // nur ab dieser Stärke
});

export const EMOTION_UI = Object.freeze({
  title: 'Stimmung',
  none: 'ausgeglichen',
});
