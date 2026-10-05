/*
  Verborgene Merkmale (Phase 28). Nur Daten, Logik: js/systems/HiddenTraitSystem.js.
  Jede Kreatur besitzt (Master-Prompt, Phase 28): Energiebedarf, Wachstum, Farbpigmente, Persönlichkeitstendenzen, Evolutionsneigung, Lieblingsumgebung.
  Sie stehen aus dem Seed fest, sind für den Spieler NICHT sichtbar (keine Zahlen, keine Anzeige) und ändern sich nicht von selbst.
  Phase 28 ist in drei Teile geteilt (Jens, 2026-10-04):
    A  Energiebedarf und Wachstum (Anschlüsse `NeedSystem.setRateScale` und `LifecycleSystem.setGrowthTrait`)
    B  Persönlichkeitstendenzen (`hints`: zwei ganz leise Züge, die nicht zur sichtbaren Mischung gehören, Anschluss `PersonalitySystem.setHints`)
       und Evolutionsneigung (`evoLean`: ein Punkt-Faktor wächst eine Spur schneller, Anschluss `EvolutionSystem.setLean`)
    C  Farbpigmente (`pigments`: wie stark jede Farbe in ihr steckt) und Lieblingsumgebung (`environment`: Bereich, Dekoration, Tageszeit).
       Teil C legt nur Werte aus dem Seed fest und macht sie abrufbar (`getPigments()`, `getFavoriteEnvironment()`); es gibt KEINEN Anschluss
       und keine sichtbare Wirkung. Sichtbar wird es erst mit Phase 29 (Farbentwicklung) und Phase 30–32 (Habitat, Dekoration, Tageszeit).
  Fairness: nur enge Faktoren um 1, kein Merkmal ist besser oder schlechter (mehr Energiebedarf = müder, aber auch kein Nachteil bei Werten),
  nichts bestraft, nichts sperrt. Alle Zahlen sind Startwerte (Vorschlag), NICHT im Browser gesehen.
*/
const freeze = (o) => Object.freeze(o);

/** Teil A. `range` = kleinster und größter Faktor, `spread` = wie stark Mittelwerte bevorzugt werden (2 = Mittel zweier Zufallszahlen, 1 = gleichverteilt). */
export const HIDDEN_TRAITS = freeze({
  energyNeed: freeze({ range: freeze([0.85, 1.2]), spread: 2, note: 'Faktor auf die Abnahme der Energie (NeedSystem.setRateScale). Größer = wird schneller müde.' }),
  growth:     freeze({ range: freeze([0.92, 1.1]), spread: 2, note: 'Faktor auf das Wachstumstempo (LifecycleSystem.setGrowthTrait). Größer = wächst etwas schneller.' }),
});
export const HIDDEN_TRAIT_IDS = freeze(Object.keys(HIDDEN_TRAITS));

export const HIDDEN_RULES = freeze({
  version: 3,   // 3: Teil C (pigments, environment); 2: Teil B (hints, evoLean); ältere Stände werden beim Laden aus dem Seed ergänzt
  // Teil A bindet nur Energie (nicht Hunger, Hygiene, Neugier): ein Merkmal, ein klarer Anschluss.
  energyNeedId: 'energy',
  // Teil B. Persönlichkeitstendenzen: so viele leise Züge, Gewicht je Zug (die sichtbare Mischung hat 0,3–1, ein leiser Zug höchstens 0,15).
  hints: freeze({ count: 2, weight: freeze([0.06, 0.14]) }),
  // Evolutionsneigung: ein Punkt-Faktor (aus `POINT_FACTORS`) wächst um diesen Faktor schneller (nie langsamer; der Gesamtfaktor bleibt in `EVO_RULES.biasRange`).
  // Sie ENTSCHEIDET keine Form, sie verschiebt nur ein wenig, welcher Faktor zuerst voll ist. Alle Formen bleiben für jeden Spielstil erreichbar.
  evoLean: freeze({ factor: freeze([1.05, 1.12]) }),
});

/* Teil C. Farbpigmente. Jede Farbe steckt unterschiedlich stark in der Kreatur (Gewicht 0–1). Die Gewichte sagen nur, welche Farben ihr „liegen“;
   Phase 29 (Farbentwicklung) entscheidet, wie und wann sich daraus ein Aussehen ergibt. Ids und Gruppen nach dem Master-Prompt (Phase 29):
   `base` = MC-ORCA-Grundfarben (Schwarz, Rot, Gold, Neonorange), `extra` = Zusatzfarben (Blau, Violett, Cyan). Weitere seltene Farben und die
   `rare`-Varianten der Formen (evolution.js) gehören zu Phase 29 und stehen hier bewusst NICHT.
   Fairness: keine Farbe ist besser oder schlechter (kein Wert, kein Gewinn, nichts gesperrt). Die Zusatzfarben führen nur seltener, weil ihr Bereich
   tiefer liegt; kommt eine vor, ist sie nicht „mehr wert“. Die Reihenfolge der Ids ist die Ziehreihenfolge (nicht ändern, nur hinten anhängen). */
export const PIGMENTS = freeze({
  black:  freeze({ group: 'base',  range: freeze([0.35, 1]),    label: 'Schwarz' }),
  red:    freeze({ group: 'base',  range: freeze([0.35, 1]),    label: 'Rot' }),
  gold:   freeze({ group: 'base',  range: freeze([0.35, 1]),    label: 'Gold' }),
  orange: freeze({ group: 'base',  range: freeze([0.35, 1]),    label: 'Neonorange' }),
  blue:   freeze({ group: 'extra', range: freeze([0, 0.65]),    label: 'Blau' }),
  violet: freeze({ group: 'extra', range: freeze([0, 0.65]),    label: 'Violett' }),
  cyan:   freeze({ group: 'extra', range: freeze([0, 0.65]),    label: 'Cyan' }),
});
export const PIGMENT_IDS = freeze(Object.keys(PIGMENTS));

/* Teil C. Lieblingsumgebung: drei kleine Vorlieben, je eine Wahl aus einer Liste (gleich wahrscheinlich, keine ist besser).
   `area`       Bereich im Habitat (Phase 30; Ids wie `CONFIG.habitat.zones`, die fünf Bereiche des Master-Prompts ohne den Waschplatz)
   `decoration` Art der Dekoration (Phase 31: Pflanzen, Möbel, Kristalle, Lampen, Maschinen, Hologramme)
   `time`       Tageszeit (Phase 32: Morgen, Tag, Abend, Nacht)
   Die Ids der Dekoration und der Tageszeit sind VORLÄUFIG: Phase 31/32 dürfen sie umbenennen; geladene Stände mit unbekannter Id werden aus dem Seed ersetzt.
   Die Reihenfolge der Facetten ist die Ziehreihenfolge. Das ist nicht der beobachtete `favoritePlace` des BondSystems (der entsteht aus gelebter Zeit);
   hier steht nur eine verborgene Neigung, die Phase 30–32 später leise berücksichtigen können, ohne sie zu erzwingen. */
export const ENVIRONMENT = freeze({
  area:       freeze(['sleep', 'food', 'play', 'research', 'deco']),
  decoration: freeze(['plants', 'furniture', 'crystals', 'lamps', 'machines', 'holograms']),
  time:       freeze(['morning', 'day', 'evening', 'night']),
});
export const ENVIRONMENT_KEYS = freeze(Object.keys(ENVIRONMENT));
