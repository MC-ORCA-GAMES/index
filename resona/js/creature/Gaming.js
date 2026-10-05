/*
  Gaming – Reson sieht beim Minispiel zu und freut sich mit (Phase 20, ab Phase 21 für mehrere Minispiele). Verbindet die Spiel-Logik
  (ReactionGameSystem, MemoryGameSystem, SkillGameSystem), Verhalten und Körper:
    1. Start: `start({ id })` auf Wunsch des Spielers (GamePanel). Ist sie zu müde, lehnt sie freundlich ab (Reaktion „zufrieden“, nichts kostet
       etwas). Sie wendet sich der Kamera (= dem Spieler) zu und bleibt stehen (Zustand GAME, Aufgabe `behavior.observe`, höchstens
       `maxGameSec` des Spiels lang als Sicherung). Sie läuft nicht zum Spielbereich: das Spiel passiert auf der Oberfläche, sie schaut zu.
    2. Beim Zusehen: kleine Gesten und Töne nach den Ereignissen des Spiels (je Spiel eine kleine Zuschauer-Funktion in `WATCH`), mit
       Mindestabstand `gestureGapSec`. Keine zufälligen Idle-Gesten (`quiet`).
         Reaktion: Aufleuchten -> Ton; Runde great -> Hüpfer, good -> Schwanzwedeln, verpasst -> Kopfneigung (kein Vorwurf).
         Lichtfunken: Funke erscheint -> Ton; Treffer great -> Hüpfer + Glockenton, good -> Schwanzwedeln, entwischt -> Kopfneigung.
         Memory:   Karte aufgedeckt -> Ton; Paar -> Schwanzwedeln + Ton; letztes Paar -> Hüpfer (ohne Mindestabstand); jeder dritte
                   Fehlversuch -> Kopfneigung (neugierig).
    3. Ende: vom System (`done`). Kurzes Ausklingen (`endSec` bzw. `stopEndSec`), dann endet die Aufgabe, bei natürlichem Ende folgt die
       Reaktion nach Ergebnisstufe (freundlicher Blick zum Spieler). Erst danach ist sie wieder frei (`isResting()`).
  Es läuft immer nur ein Minispiel. Beim Zusehen lässt sie sich nicht stören (BUSY_STATES: Antippen der Kreatur tut nichts), gefüttert, gewaschen
  und mit Spielzeug gespielt wird nicht (Gates in main.js), sie legt sich auch nicht hin (`isBusy` in Sleeping). Wirkung auf die Werte, Bindung
  und Emotionen hängen an den Ereignissen der Systeme (siehe main.js), nicht an diesem Modul. Keine Bestrafung: Beenden kostet nichts, zu müde =
  freundlich ablehnen.

  Wird die Aufgabe von außen ersetzt oder beendet (z. B. Sicherheitszeit `maxGameSec`), beendet Gaming das laufende Spiel vorzeitig (kostet
  nichts, ab minRoundsForReward Runden bzw. minPairsForReward Paaren zählt der gespielte Teil).

  „Reduzierte Bewegung“: `idle.triggerGesture` tut dann nichts (keine Hüpfer, kein Wedeln); Blick und Ton bleiben.

  REIHENFOLGE: `update` ruft `update(dt)` aller Spielsysteme (Rundenzeit, Müdigkeit läuft hier, einmal pro Frame). Gaming schreibt keine
  Körperwinkel, nur `idle.triggerGesture`, daher ist die Reihenfolge der Updater unkritisch; es steht in main.js bei den anderen Verhaltensmodulen.

  createGaming({ games, behavior, idle, sfx, camera, isBusy, isSleeping, isWashing, isToyPlaying, react }) ->
    {
      update(dt), start({ id, source }) -> { ok, reason }, requestStop() -> bool,
      isResting() (ein Spiel läuft oder klingt aus), isPlaying() (dasselbe, für die Stimmungszeile), onEvent(fn), dispose()
    }
    games: { reaction: ReactionGameSystem, memory: MemoryGameSystem, skill: SkillGameSystem } (Schlüssel = Spiel-Id, Daten je Id in GAME_DATA unten; das erste ist der Standard)
    reason: 'busy' | 'tired' | 'asleep' | 'washing' | 'playing'
  isBusy(): läuft gerade eine Fütterung; isSleeping(): geht sie schlafen oder schläft sie; isWashing(): geht sie zum Waschplatz oder wird sie
  gewaschen; isToyPlaying(): geht sie zum Spielbereich, spielt oder klingt aus (alle spät gebunden, die Module entstehen vor oder nach diesem);
  react(type, { source }): Reaktion der Kreatur (spät gebunden an `interaction.react`, source 'game' zählt nicht als Tippen).
  Ereignis von onEvent: { type: 'finished' } sobald das Ausklingen vorbei ist und sie wieder frei ist (für „Nochmal“ in den Spielansichten).
  Werte in js/data/minigames.js (REACTION, MEMORY, SKILL), NICHT im Browser getestet.
*/
import { REACTION, MEMORY, SKILL } from '../data/minigames.js';
import { STATES } from './Behavior.js';

/** Daten je Spiel-Id (Zeiten fürs Ausklingen, Sicherheitszeit, Gesten-Abstand). Neue Minispiele tragen sich hier und in WATCH ein. */
const GAME_DATA = { reaction: REACTION, memory: MEMORY, skill: SKILL };

/**
 * Zuschauer-Funktionen je Spiel: reagieren auf die Ereignisse des Spiels mit Geste und Ton. `a.gesture(name, { force })` zeigt eine Geste
 * (mit Mindestabstand, `force` ignoriert ihn), `a.sound(name)` spielt einen Ton, `a.state` ist ein kleiner Zähler-Speicher je Spiel.
 * Das Ereignis `done` behandelt Gaming selbst (Ausklingen, Reaktion).
 */
const WATCH = {
  reaction(e, a) {
    const R = REACTION;
    switch (e.type) {
      case 'lit':
        a.sound('tick');
        break;
      case 'feedback':
        if (e.kind === 'great') { a.gesture(R.gestureGreat); a.sound('pop'); }
        else if (e.kind === 'good') { a.gesture(R.gestureGood); a.sound('pop'); }
        else if (e.kind === 'miss') a.gesture(R.gestureMiss);
        break;
      default:
        break;
    }
  },
  memory(e, a) {
    const M = MEMORY;
    switch (e.type) {
      case 'flip':
        a.sound('tick');
        break;
      case 'match':
        if (e.pairsFound >= e.pairs) { a.gesture(M.gestureClear, { force: true }); a.sound('chime'); }
        else { a.gesture(M.gestureMatch); a.sound('pop'); }
        break;
      case 'mismatch':
        a.state.mismatches += 1;
        if (a.state.mismatches % M.gestureMismatchEvery === 0) a.gesture(M.gestureMismatch);
        break;
      default:
        break;
    }
  },
  skill(e, a) {
    const K = SKILL;
    switch (e.type) {
      case 'spark':
        a.sound('tick');
        break;
      case 'feedback':
        if (e.kind === 'great') { a.gesture(K.gestureGreat); a.sound('chime'); }
        else if (e.kind === 'good') { a.gesture(K.gestureGood); a.sound('pop'); }
        else if (e.kind === 'ok') a.sound('pop');
        else if (e.kind === 'miss') a.gesture(K.gestureMiss);
        break;
      default:
        break;
    }
  },
};

export function createGaming({
  games, behavior, idle, sfx, camera,
  isBusy = () => false, isSleeping = () => false, isWashing = () => false, isToyPlaying = () => false, react = () => false,
}) {
  const ids = Object.keys(games);
  const defaultId = ids[0];
  const listeners = new Set();

  let finishing = null;        // { id, natural, t, dur, result }: Ausklingen nach dem Ende, die Verhaltensaufgabe läuft bis dahin weiter
  let internalChange = false;  // eigene Zustandswechsel (interrupt) dürfen den Fremdwechsel-Schutz nicht auslösen
  let gestureLeft = 0;         // Sekunden bis zur nächsten erlaubten Geste
  let activeId = defaultId;    // zuletzt gestartetes Spiel (für den Gesten-Abstand)
  const watchState = { mismatches: 0 };   // kleine Zähler der Zuschauer-Funktionen, wird bei jedem Start zurückgesetzt

  function emit(event) { for (const fn of listeners) fn(event); }

  function clearFinishing() {
    if (!finishing) return;
    finishing = null;
    emit({ type: 'finished' });
  }

  const anyPlaying = () => ids.some((id) => games[id].getPhase() === 'playing');
  const anyActive = () => ids.some((id) => games[id].getPhase() !== 'idle');

  /** Beendet das laufende Spiel vorzeitig (kostet nichts). Gibt wahr zurück, wenn eines lief. */
  function stopPlaying() {
    let stopped = false;
    for (const id of ids) {
      if (games[id].getPhase() === 'playing') { games[id].stop({ natural: false }); stopped = true; }
    }
    return stopped;
  }

  // ---------- Ereignisse der Spiele ----------
  function gesture(name, { force = false } = {}) {
    if ((gestureLeft > 0 && !force) || !name) return;
    if (idle.triggerGesture(name)) gestureLeft = GAME_DATA[activeId].gestureGapSec;
  }

  const actions = {
    gesture,
    sound: (name) => { if (sfx) sfx.play(name); },
    state: watchState,
  };

  const offGames = ids.map((id) => games[id].onEvent((e) => {
    if (e.type === 'done') {
      const data = GAME_DATA[id];
      finishing = { id, natural: e.natural, t: 0, dur: e.natural ? data.endSec : data.stopEndSec, result: e };
      return;
    }
    const watch = WATCH[id];
    if (watch) watch(e, actions);
  }));

  // Wird die Aufgabe von außen ersetzt oder beendet (auch durch die Sicherheitszeit), verlässt der Zustand GAME ohne unser Zutun.
  const offState = behavior.onStateChange((next) => {
    if (internalChange || next === STATES.GAME) return;
    stopPlaying();
    clearFinishing();
  });

  /** Ende der Verhaltensaufgabe (nur eine Sicherung, falls sie ohne Zustandswechsel endet). */
  function onTaskDone() {
    stopPlaying();
    clearFinishing();
  }

  function finishDone() {
    const f = finishing;
    internalChange = true;
    behavior.interrupt();   // Aufgabe beenden -> IDLE (ohne onDone)
    internalChange = false;
    clearFinishing();
    if (f && f.natural && f.result.reaction) react(f.result.reaction, { source: 'game' });   // fertig gespielt: freundlicher Blick zum Spieler
  }

  // ---------- Von außen ----------
  /** Startet ein Minispiel (`id`, Standard: das erste). Ist sie zu müde oder beschäftigt, passiert nichts (freundlich, ohne Strafe). */
  function start({ id = defaultId, source = 'player' } = {}) {
    const game = games[id];
    if (!game) return { ok: false, reason: 'busy' };
    if (finishing || anyActive()) return { ok: false, reason: 'busy' };
    if (isSleeping()) return { ok: false, reason: 'asleep' };
    if (isWashing()) return { ok: false, reason: 'washing' };
    if (isToyPlaying()) return { ok: false, reason: 'playing' };
    if (isBusy()) return { ok: false, reason: 'busy' };   // beim Füttern nicht dazwischenfunken (die Aufgabe würde die Fütterung ersetzen)
    const check = game.canRequest();
    if (!check.ok) {
      if (check.reason === 'tired' && source === 'player') react('content', { source: 'game' });
      return check;
    }
    watchState.mismatches = 0;
    activeId = id;
    if (!game.start(source)) return { ok: false, reason: 'busy' };
    gestureLeft = 0;
    // Zur Kamera drehen und stehen bleiben; `quiet`: keine zufälligen Idle-Gesten, die Gesten kommen von den Spielereignissen.
    behavior.observe(camera.position.clone(), { state: STATES.GAME, dwell: GAME_DATA[id].maxGameSec, quiet: true, onDone: onTaskDone });
    return { ok: true, reason: null };
  }

  /** Beendet das laufende Spiel vorzeitig („Beenden“, kostet nichts). Gibt false zurück, wenn gerade nicht gespielt wurde. */
  function requestStop() {
    return stopPlaying();
  }

  // ---------- Frame ----------
  function update(dt) {
    for (const id of ids) games[id].update(dt);
    if (gestureLeft > 0) gestureLeft -= dt;
    if (finishing) {
      finishing.t += dt;
      if (finishing.t >= finishing.dur) finishDone();
    }
  }

  const isResting = () => anyActive() || finishing !== null;

  function dispose() {
    for (const off of offGames) off();
    offState();
    listeners.clear();
  }

  return {
    update, start, requestStop,
    isResting, isPlaying: isResting,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose,
  };
}
