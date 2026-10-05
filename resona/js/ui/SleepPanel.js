/*
  SleepPanel – Knopf „Schlafen“ / „Wecken“ (Phase 15), steht in der Knopfzeile unten neben „Füttern“.
  Ein Knopf, der je nach Zustand wechselt:
    wach                      „Schlafen“ legt Reson schlafen (ist sie noch ausgeruht oder beschäftigt, sagt die Statuszeile es,
                              nichts wird bestraft)
    geht zum Schlafplatz/schläft  „Wecken“ weckt sie sanft bzw. bricht den Weg ab
  Meldungen laufen über die Statuszeile des FeedPanels (`dock.say`, `role="status"`, wird vorgelesen):
  „Reson ist müde und geht zum Schlafplatz.“, „Reson schläft.“, „Reson ist ausgeschlafen.“ usw. Der Zustand hängt nicht nur
  an Farbe oder Bewegung: Beschriftung, Statuszeile und `aria-label` ändern sich mit.

  Touch-Ziel 48 px (gleiche Klasse `.dock-btn` wie „Füttern“, Stil in game.html).

  createSleepPanel({ sleeping, sleep, dock }) -> { setVisible(bool), dispose() }
    sleeping: createSleeping(...), sleep: createSleepSystem(...), dock: createFeedPanel(...) (braucht `say`, `addAction`)
  Texte in SLEEP_UI (js/data/sleep.js). NICHT im Browser getestet.
*/
import { SLEEP_UI } from '../data/sleep.js';

export function createSleepPanel({ sleeping, sleep, dock }) {
  const button = document.createElement('button');
  button.className = 'dock-btn';
  button.type = 'button';
  dock.addAction(button);

  /** Beschriftung nach Zustand: „Wecken“, solange sie zum Schlafplatz geht oder schläft. */
  function refresh() {
    const resting = sleep.getPhase() !== 'awake';
    button.textContent = resting ? SLEEP_UI.wakeLabel : SLEEP_UI.sleepLabel;
    button.setAttribute('aria-label', resting ? SLEEP_UI.wakeAria : SLEEP_UI.sleepAria);
  }

  function onClick() {
    if (sleep.getPhase() !== 'awake') {
      sleeping.requestWake();
      return;
    }
    const res = sleeping.requestSleep();
    if (res.ok) return;
    const text = SLEEP_UI.status[res.reason === 'asleep' ? 'waking' : res.reason];
    if (text) dock.say(text);
  }
  button.addEventListener('click', onClick);

  const offEvent = sleep.onEvent((e) => {
    switch (e.type) {
      case 'start':
        dock.say(e.reason === 'auto' ? SLEEP_UI.status.goingAuto : SLEEP_UI.status.going);
        break;
      case 'asleep':
        dock.say(SLEEP_UI.status.asleep);
        break;
      case 'wake':
        dock.say(e.natural ? SLEEP_UI.status.woke : SLEEP_UI.status.wokeEarly);
        break;
      case 'cancelled':
        dock.say(SLEEP_UI.status.cancelled);
        break;
      default:
        break;
    }
    refresh();
  });

  refresh();

  /** Blendet den Knopf ein/aus (z. B. Foto-Modus, Phase 41). */
  function setVisible(on) { button.hidden = !on; }

  function dispose() {
    offEvent();
    button.removeEventListener('click', onClick);
    button.remove();
  }

  return { setVisible, dispose };
}
