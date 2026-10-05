/*
  Bindungs-Daten (Phase 14). Nur Daten, keine Logik (Logik: js/systems/BondSystem.js).
  Neue Erinnerung = neuer Eintrag in BOND_MEMORIES (Inhalts-Pipeline, Master-Prompt Abschnitt 26).

  Erinnerungen (Master-Prompt Abschnitt 23): wichtige Ereignisse, die die Kreatur sich merkt. Pro Eintrag:
    label   kurzer deutscher Text für die Oberfläche (keine Zahlen)
    bond    kleiner EINMALIGER Schub auf den Bindungswert (needs `bond`), wenn die Erinnerung entsteht.
            Einmalig = kein Grinden: jede Erinnerung entsteht nur einmal (special_event einmal pro Ereignis-Id).
    note    wer sie auslöst (nur Doku)
  Die Schlüssel aus dem Master-Prompt: first_feed, first_play, first_discovery, first_evolution,
  favorite_toy_found, special_event. Zusätzlich in Phase 14 (eigene Erweiterung, dokumentiert): first_touch,
  favorite_food_found, favorite_place_found.
  Alle Zahlen und Texte sind Startwerte (Vorschlag), NICHT getestet und NICHT balanciert.
*/
const freeze = (o) => Object.freeze(o);

export const BOND_MEMORIES = freeze({
  first_touch:          freeze({ label: 'Die erste Berührung',          bond: 1,   note: 'erstes Antippen (BondSystem.onReaction)' }),
  first_feed:           freeze({ label: 'Das erste Futter',             bond: 1,   note: 'erstes Fressen (BondSystem.onFeed)' }),
  first_play:           freeze({ label: 'Das erste gemeinsame Spiel',   bond: 1.5, note: 'Phase 18/19 ruft BondSystem.notePlay()' }),
  first_discovery:      freeze({ label: 'Die erste Entdeckung',         bond: 2,   note: 'Phase 34 ruft BondSystem.remember(\'first_discovery\')' }),
  first_evolution:      freeze({ label: 'Die erste Verwandlung',        bond: 3,   note: 'Phase 26 ruft BondSystem.remember(\'first_evolution\')' }),
  favorite_food_found:  freeze({ label: 'Ein Lieblingsfutter',          bond: 1.5, note: 'automatisch aus FoodSystem-Statistik' }),
  favorite_toy_found:   freeze({ label: 'Ein Lieblingsspielzeug',       bond: 1.5, note: 'automatisch aus notePlay({ toyId })' }),
  favorite_place_found: freeze({ label: 'Ein Lieblingsplatz',           bond: 1.5, note: 'automatisch aus der Aufenthaltszeit je Zone' }),
  special_event:        freeze({ label: 'Ein besonderer Moment',        bond: 1.5, note: 'noteSpecial(id) und Bindungsstufen' }),
});

export const BOND_MEMORY_KEYS = Object.freeze(Object.keys(BOND_MEMORIES));

/** Texte für besondere Ereignisse (`special_event` mit data.id). Unbekannte Ids zeigen BOND_MEMORIES.special_event.label. */
export const BOND_SPECIAL = freeze({
  bond_trusted:   'Sie vertraut dir',
  bond_connected: 'Ihr seid verbunden',
  bond_deep:      'Eine tiefe Verbindung',
  // Phase 23: Training, die oberste Stufe einer Fähigkeit (main.js: training.onEvent 'mastered' -> bond.noteSpecial('skill_' + id))
  learned_first:  'Reson verbindet etwas Schönes mit einem Ort',   // Phase 24: erster gelernter Moment (LearningSystem)
  // Phase 25: Lebenszyklus (main.js: lifecycle.onEvent 'stage' -> bond.noteSpecial; je Stufe einmalig)
  hatched:          'Reson ist geschlüpft',
  stage_juvenile:   'Reson ist kein Baby mehr',
  stage_adolescent: 'Reson wächst heran',
  stage_adult:      'Reson ist ausgewachsen',
  stage_special:    'Reson hat eine besondere Form',
  skill_follow:   'Reson folgt dir sicher',
  skill_wait:     'Reson kann geduldig warten',
  skill_jump:     'Reson springt auf Kommando',
  skill_fetch:    'Reson bringt dir den Ball',
  skill_listen:   'Reson erkennt Geräusche',
});

/**
 * Bindungsstufen aus dem Bindungswert (needs `bond`, 0..100). Aufsteigend nach `min`.
 * Die Stufe sinkt nie (der Wert sinkt nie von selbst). Das Erreichen einer Stufe über der ersten wird als
 * besonderer Moment (`special_event`, Id `special`) gemerkt.
 */
export const BOND_TIERS = Object.freeze([
  freeze({ id: 'getting_to_know', min: 0,  label: 'lernt dich kennen', special: null }),
  freeze({ id: 'trusted',         min: 30, label: 'vertraut',          special: 'bond_trusted' }),
  freeze({ id: 'connected',       min: 60, label: 'verbunden',         special: 'bond_connected' }),
  freeze({ id: 'deep',            min: 85, label: 'tief verbunden',    special: 'bond_deep' }),
]);

/** Arten von Zuwendung, die gezählt werden („häufige Interaktionen"). Label nur für Oberfläche/Debug. */
export const BOND_KINDS = freeze({
  tap:  'Antippen',
  feed: 'Füttern',
  play: 'Spielen',
});

export const BOND_RULES = freeze({
  // „Häufige Interaktionen": eine Art der Zuwendung gilt als häufig, ab so vielen Malen insgesamt (die häufigste zählt).
  frequentMin: 5,

  // Lieblingsfutter: das am häufigsten gefressene Futter (FoodSystem.getFavorite), ab dieser Anzahl Mahlzeiten insgesamt.
  favoriteFoodMinMeals: 4,

  // Lieblingsspielzeug: am häufigsten benutztes Spielzeug, ab so vielen Benutzungen insgesamt und mit Vorsprung.
  favoriteToyMinUses: 4,

  // Lieblingsplatz: Aufenthaltszeit (Sekunden Laufzeit, Kreatur steht still in der Nähe der Zonenmitte).
  placeRadius: 1.15,         // Abstand zur Zonenmitte (Habitat-Einheiten); Zonen-Standoff ist 0,6–0,8
  favoritePlaceMinSec: 90,   // so lange muss sie insgesamt in einer Zone gewesen sein
  placeSampleMaxDt: 0.25,    // größere Frame-Sprünge zählen nur so viel (z. B. nach Tab-Wechsel)

  // Ein Favorit wechselt nur, wenn der neue Kandidat den alten um diesen Faktor übertrifft (kein Hin und Her).
  switchFactor: 1.25,

  // Begrenzung der Speichergröße
  maxMemories: 60,
  maxToyIds: 32,
  maxIdLength: 40,
});

// Texte der Oberfläche (Phase 14). Nur Deutsch. Keine Zahlen.
export const BOND_UI = freeze({
  title: 'Beziehung',
  foodLabel: 'mag besonders',
  placeLabel: 'Lieblingsplatz',
  toyLabel: 'Lieblingsspielzeug',
  memoryTitle: 'Erinnerung',
  separator: ' \u00b7 ',
});
