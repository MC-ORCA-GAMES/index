/*
  ToySystem – Spielen mit Spielzeugen (Phase 18). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Entscheidet nur, OB und WIE LANGE gespielt wird und WAS es bewirkt; Weg zum Spielbereich, Blick, Gesten, Objekt und Laute
  macht js/creature/Playing.js, Knopf und Meldungen js/ui/ToyPanel.js. Aufbau und Schnittstelle folgen bewusst dem
  HygieneSystem (Phase 16) und dem SleepSystem (Phase 15).

  Phasen:
    idle      nichts zu tun (Standard)
    going     geht zum Spielbereich (von Playing gesetzt, sobald die Aufgabe läuft)
    playing   spielt: `playedSec` zählt hoch, nach TOYS[id].playSec ist das Spiel fertig (`shouldFinish`)

  Wer löst aus: `start(toyId, source)` mit source 'player' (Knopf, Phase 18) oder 'auto' (freies Spiel, Phase 19). Die Prüfung, ob sie
  gerade frei ist (nicht beim Essen, im Schlaf, beim Waschen), macht Playing.

  Wirkung (bei `stop`): Punkte aus TOYS[id].effects, skaliert mit dem gespielten Anteil und dem Abnutzungsfaktor; bei natürlichem Ende
  kommt zusätzlich der Bonus der Passungsstufe dazu. Gestoppt = nur der gespielte Anteil, vor `minPlaySec` gar nichts (kostet nichts, keine Strafe).
  „Gezählt“ wird ein Spiel ab `countFraction` der Spielzeit: dann zählen Statistik, Abnutzung und (in main.js) Bindung und Nachwirkung.

  Passung: `getEnjoyment(toyId)` -> 'loves' | 'likes' | 'okay' aus der Persönlichkeit (Summe aus `fits`-Faktor * Gewicht des Zugs). Nie negativ.
  Abnutzung (gegen Grinden): jedes gezählte Spiel erhöht die Müdigkeit, sie klingt mit der Zeit ab; Wirkungsfaktor = 1 - Müdigkeit, mindestens `minFactor`.

  Freies Spiel (Phase 19): `pollAuto()` entscheidet, ob und womit Reson von selbst spielen will. Aufgerufen wird es von Playing nur, wenn sie
  frei ist (Zustand IDLE, nicht beim Essen, Schlafen, Waschen). Hier steht nur die Entscheidung: Pause (`cooldown`, nach jedem Spiel und
  nach Abbruch länger), Prüftakt, Energie/Sättigung, Lust (niedrige Neugier, Persönlichkeit, Frische) und die Wahl des Spielzeugs
  (Passung, Lieblingsspielzeug aus `getFavoriteToy`, nicht gleich das zuletzt benutzte). Alle Zahlen in TOY_RULES.free.

  Zeit: `update(dt)` pro Frame (nur Laufzeit). Offline-Zeit rechnet Phase 45 nicht nach (Spielen braucht den Spieler oder Phase 19).
  Nichts wird bestraft: kein Wert sinkt außer der Energie bei lebhaften Spielzeugen, und die nie unter ihren Komfortboden.

  createToySystem({ needs, personality, getFavoriteToy, getToyAffinity, cooldownScale, seed }) ->   (getToyAffinity(id) -> 0..1, optional, Phase 24)
    {
      pollAuto() -> toyId | null, setFreePlay(bool), isFreePlay(), getAutoCooldown(),
      update(dt), getPhase(), isPlaying(), getToyId(), getPlayedSec(), getSource(), getFatigue(), getFactor(),
      canRequest(toyId) -> { ok, reason },       reason: 'busy' | 'tired' | 'unknown' | null
      getEnjoyment(toyId), getScore(toyId),
      shouldFinish(), start(toyId, source), arrived(), cancel(), stop({ natural }) -> Ergebnis | null,
      onEvent(fn), getStats(), serialize(), restore(data), reset()
    }
  Ereignisse: { type: 'start' | 'playing' | 'done' | 'cancelled', toyId, ... }
    start: { toyId, source }, playing: { toyId }
    done: { toyId, natural, playedSec, counted, enjoyment, reaction, mood, applied, factor }
  Ergebnis von stop(): dasselbe Objekt wie das done-Ereignis.
  Format von serialize(): { version: 1, plays, byToy, lastToy, autoPlays } (für Phase 44; `autoPlays` ist optional beim Laden; Müdigkeit,
  Pause und laufendes Spiel werden nicht gespeichert).
  getFavoriteToy(): optional, liefert die Id des Lieblingsspielzeugs oder null (spät gebunden an die Bindung); cooldownScale: Faktor auf die
  Pausen des freien Spiels (z. B. 1,5 bei „reduzierte Bewegung“).
  Werte in js/data/toys.js (TOYS, TOY_RULES), NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { TOYS, TOY_IDS, TOY_RULES } from '../data/toys.js';
import { createRng } from '../core/rng.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const TOY_SAVE_VERSION = 1;

export function createToySystem({
  needs, personality = null, getFavoriteToy = () => null, getToyAffinity = null, cooldownScale = 1, seed = 9019,
}) {
  const R = TOY_RULES;
  const F = TOY_RULES.free;
  const rng = createRng(seed);
  const listeners = new Set();

  let phase = 'idle';
  let toyId = null;
  let source = 'player';
  let playedSec = 0;
  let fatigue = 0;          // 0..1, klingt ab; macht die Wirkung kleiner
  let plays = 0;            // gezählte Spiele (Statistik)
  let byToy = {};           // toyId -> gezählte Spiele
  let lastToy = null;       // zuletzt gezähltes Spielzeug (für sameToyExtra)
  let autoPlays = 0;        // davon von selbst begonnen (Phase 19, Statistik)
  let freePlay = !!F.enabled;
  let cooldown = F.firstDelaySec * cooldownScale;   // Phase 19: so lange will sie nicht von selbst spielen
  let checkTimer = F.checkEverySec;

  function resetCounts() {
    plays = 0;
    autoPlays = 0;
    byToy = {};
    for (const id of TOY_IDS) byToy[id] = 0;
    lastToy = null;
  }
  resetCounts();

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Passung ----------
  function getScore(id) {
    const toy = TOYS[id];
    if (!toy) return 0;
    if (!personality) return R.defaultScore;
    let score = 0;
    for (const trait of Object.keys(toy.fits)) score += toy.fits[trait] * personality.getWeight(trait);
    return score;
  }

  function tierFor(id) {
    const score = getScore(id);
    for (const tier of R.tiers) if (score >= tier.minScore) return tier;
    return R.tiers[R.tiers.length - 1];
  }

  const getEnjoyment = (id) => (TOYS[id] ? tierFor(id).id : undefined);
  const getFactor = () => Math.max(R.minFactor, 1 - fatigue);

  // ---------- Abfragen ----------
  function canRequest(id) {
    if (!TOYS[id]) return { ok: false, reason: 'unknown' };
    if (phase !== 'idle') return { ok: false, reason: 'busy' };
    if (needs.get('energy') < R.minEnergy) return { ok: false, reason: 'tired' };
    return { ok: true, reason: null };
  }

  function shouldFinish() {
    return phase === 'playing' && playedSec >= TOYS[toyId].playSec;
  }

  // ---------- Übergänge ----------
  /** Beginnt den Weg zum Spielbereich. source: 'player' | 'auto'. Gibt false zurück, wenn es nicht geht. */
  function start(id, from = 'player') {
    if (!canRequest(id).ok) return false;
    phase = 'going';
    toyId = id;
    source = from === 'auto' ? 'auto' : 'player';
    playedSec = 0;
    emit({ type: 'start', toyId: id, source });
    return true;
  }

  /** Im Spielbereich angekommen: ab jetzt wird gespielt. */
  function arrived() {
    if (phase !== 'going') return false;
    phase = 'playing';
    playedSec = 0;
    emit({ type: 'playing', toyId });
    return true;
  }

  /** Der Weg wird abgebrochen (Spieler oder von außen ersetzt). Kostet nichts. */
  function cancel() {
    if (phase !== 'going') return false;
    const id = toyId;
    phase = 'idle';
    toyId = null;
    cooldown = F.cooldownStoppedSec * cooldownScale;   // Phase 19: nach Abbruch drängt sie sich nicht gleich wieder auf
    emit({ type: 'cancelled', toyId: id });
    return true;
  }

  /**
   * Ende des Spielens. natural: true = Spielzeit voll gespielt (Bonus der Passungsstufe), false = gestoppt (nur der gespielte Anteil).
   * Gibt das Ergebnis zurück (auch als Ereignis `done`) oder null, wenn gerade nicht gespielt wurde.
   */
  function stop({ natural = false } = {}) {
    if (phase !== 'playing') return null;
    const id = toyId;
    const toy = TOYS[id];
    const tier = tierFor(id);
    const fraction = natural ? 1 : (playedSec >= R.minPlaySec ? Math.min(1, playedSec / toy.playSec) : 0);
    const factor = getFactor();
    const counted = fraction >= R.countFraction;

    const applied = {};
    for (const k of Object.keys(toy.effects)) applied[k] = toy.effects[k] * fraction * factor;
    if (natural) for (const k of Object.keys(tier.bonus)) applied[k] = (applied[k] || 0) + tier.bonus[k] * factor;
    if (fraction > 0) needs.adjustMany(applied);

    if (counted) {
      plays += 1;
      byToy[id] = (byToy[id] || 0) + 1;
      fatigue = Math.min(1, fatigue + R.fatiguePerPlay + (lastToy === id ? R.sameToyExtra : 0));
      lastToy = id;
      if (source === 'auto') autoPlays += 1;
    }
    cooldown = (natural ? F.cooldownSec : F.cooldownStoppedSec) * cooldownScale;   // Phase 19: Pause nach jedem Spiel

    const result = {
      type: 'done', toyId: id, natural: !!natural, playedSec, counted,
      enjoyment: tier.id, reaction: tier.reaction, mood: toy.mood, applied, factor, source,
    };
    phase = 'idle';
    toyId = null;
    emit(result);
    return result;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
    if (checkTimer > 0) checkTimer -= dt;
    if (fatigue > 0) fatigue = Math.max(0, fatigue - R.fatigueDecayPerSec * dt);
    if (phase === 'playing') playedSec += dt;
  }

  // ---------- Freies Spiel (Phase 19) ----------
  /** Lust zu spielen (Faktor um 1): niedrige Neugier, Persönlichkeit, Frische. */
  function getDesire() {
    const c = needs.get('curiosity');
    const u = Math.max(0, Math.min(1, (F.curiosityFrom - c) / (F.curiosityFrom - F.curiosityTo)));
    let factor = 1;
    if (personality) for (const trait of Object.keys(F.traitFactor)) factor += F.traitFactor[trait] * personality.getWeight(trait);
    factor = Math.max(F.desireMin, Math.min(F.desireMax, factor));
    const fresh = (1 - F.freshness) + F.freshness * getFactor();
    return (F.needMin + (F.needMax - F.needMin) * u) * factor * fresh;
  }

  /** Wählt ein Spielzeug nach Passung, Lieblingsspielzeug und Abwechslung (gewichteter Zufall). */
  function chooseAutoToy() {
    const fav = getFavoriteToy ? getFavoriteToy() : null;
    const weights = TOY_IDS.map((id) => {
      let w = 1 + getScore(id) * F.fitWeight;
      if (id === fav) w += F.favoriteBonus;
      if (getToyAffinity) w *= 1 + getToyAffinity(id) * F.affinityWeight;   // Phase 24: Gelerntes (positive Erfahrung) macht ein Spielzeug etwas wahrscheinlicher
      if (id === lastToy) w *= F.sameToyFactor;
      return Math.max(0.05, w);
    });
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < TOY_IDS.length; i++) {
      r -= weights[i];
      if (r <= 0) return TOY_IDS[i];
    }
    return TOY_IDS[TOY_IDS.length - 1];
  }

  /**
   * Möchte Reson jetzt von selbst spielen? Gibt die Id des Spielzeugs zurück oder null. Prüft nur die eigenen Bedingungen (aus, Pause, Prüftakt,
   * Energie, Sättigung, Lust); ob sie gerade frei ist, prüft der Aufrufer (Playing). Beginnt selbst nichts: der Aufrufer ruft danach start/play.
   */
  function pollAuto() {
    if (!freePlay || phase !== 'idle' || cooldown > 0 || checkTimer > 0) return null;
    checkTimer = F.checkEverySec;
    if (needs.get('energy') < F.minEnergy || needs.get('hunger') < F.minHunger) return null;
    if (rng() >= Math.min(0.95, F.baseChance * getDesire())) return null;
    return chooseAutoToy();
  }

  function setFreePlay(on) { freePlay = !!on; }

  // ---------- Statistik, Speichern (für Phase 44) ----------
  function getStats() { return { plays, autoPlays, byToy: { ...byToy } }; }

  function serialize() {
    return { version: TOY_SAVE_VERSION, plays, byToy: { ...byToy }, lastToy, autoPlays };
  }

  /** Stellt die Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Das laufende Spiel und die Müdigkeit werden nicht gespeichert. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== TOY_SAVE_VERSION) return false;
    resetCounts();
    if (data.byToy && typeof data.byToy === 'object') {
      for (const id of TOY_IDS) {
        const n = data.byToy[id];
        if (Number.isFinite(n) && n > 0) byToy[id] = Math.floor(n);
      }
    }
    plays = TOY_IDS.reduce((sum, id) => sum + byToy[id], 0);
    lastToy = typeof data.lastToy === 'string' && TOYS[data.lastToy] ? data.lastToy : null;
    autoPlays = Number.isFinite(data.autoPlays) && data.autoPlays >= 0 ? Math.min(plays, Math.floor(data.autoPlays)) : 0;
    return true;
  }

  function reset() {
    phase = 'idle';
    toyId = null;
    source = 'player';
    playedSec = 0;
    fatigue = 0;
    cooldown = F.firstDelaySec * cooldownScale;
    checkTimer = F.checkEverySec;
    freePlay = !!F.enabled;
    resetCounts();
  }

  return {
    update,
    getPhase: () => phase,
    isPlaying: () => phase === 'playing',
    getToyId: () => toyId,
    getPlayedSec: () => playedSec,
    getSource: () => source,
    getFatigue: () => fatigue,
    getFactor,
    pollAuto, setFreePlay, isFreePlay: () => freePlay, getAutoCooldown: () => cooldown,
    canRequest, getEnjoyment, getScore, shouldFinish,
    start, arrived, cancel, stop,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getStats, serialize, restore, reset,
  };
}
