/*
  HygienePanel – Knopf „Waschen“ / „Fertig“ (Phase 16, Teil B), steht in der Knopfzeile unten neben „Füttern“ und „Schlafen“.
  Ein Knopf, der je nach Zustand wechselt:
    frei                      „Waschen“ schickt Reson zum Waschplatz (ist sie noch sauber, schläft oder ist beschäftigt, sagt die
                              Statuszeile es, nichts wird bestraft)
    geht zum Waschplatz/wird gewaschen  „Fertig“ beendet das Waschen bzw. bricht den Weg ab
  Meldungen laufen über die Statuszeile des FeedPanels (`dock.say`, `role="status"`, wird vorgelesen):
  „Reson geht zum Waschplatz.“, „Reson wird gewaschen.“, „Reson ist frisch und sauber.“ usw. Der Zustand hängt nicht nur an
  Farbe oder Bewegung: Beschriftung, Statuszeile und `aria-label` ändern sich mit.

  Touch-Ziel 48 px (gleiche Klasse `.dock-btn` wie „Füttern“, Stil in game.html; die Zeile bricht auf schmalen Handys um).

  createHygienePanel({ cleaning, hygiene, dock }) -> { setVisible(bool), dispose() }
    cleaning: createCleaning(...), hygiene: createHygieneSystem(...), dock: createFeedPanel(...) (braucht `say`, `addAction`)
  Texte in HYGIENE_UI (js/data/hygiene.js). NICHT im Browser getestet.
*/
import { HYGIENE_UI } from '../data/hygiene.js';

export function createHygienePanel({ cleaning, hygiene, dock }) {
  const button = document.createElement('button');
  button.className = 'dock-btn';
  button.type = 'button';
  dock.addAction(button);

  /** Beschriftung nach Zustand: „Fertig“, solange sie zum Waschplatz geht oder gewaschen wird. */
  function refresh() {
    const active = hygiene.getPhase() !== 'idle';
    button.textContent = active ? HYGIENE_UI.stopLabel : HYGIENE_UI.washLabel;
    button.setAttribute('aria-label', active ? HYGIENE_UI.stopAria : HYGIENE_UI.washAria);
  }

  function onClick() {
    if (hygiene.getPhase() !== 'idle') {
      cleaning.requestStop();
      return;
    }
    const res = cleaning.requestWash();
    if (res.ok) return;
    const text = HYGIENE_UI.status[res.reason];
    if (text) dock.say(text);
  }
  button.addEventListener('click', onClick);

  const offEvent = hygiene.onEvent((e) => {
    switch (e.type) {
      case 'start':
        dock.say(e.reason === 'auto' ? HYGIENE_UI.status.goingAuto : HYGIENE_UI.status.going);
        break;
      case 'washing':
        dock.say(HYGIENE_UI.status.washing);
        break;
      case 'done':
        dock.say(e.natural ? HYGIENE_UI.status.done : HYGIENE_UI.status.stopped);
        break;
      case 'cancelled':
        dock.say(HYGIENE_UI.status.cancelled);
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
