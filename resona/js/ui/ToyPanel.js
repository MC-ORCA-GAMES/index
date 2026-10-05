/*
  ToyPanel – Knopf „Spielen“ mit Spielzeug-Auswahl (Phase 18). Der Knopf steht in der Knopfzeile unten neben „Füttern“, „Schlafen“
  und „Waschen“, die Auswahl (fünf Felder) klappt darüber auf, dort, wo sonst die Futterwahl aufklappt. Ein Knopf, der je nach Zustand wechselt:
    frei, Auswahl zu           „Spielen“ öffnet die Spielzeug-Auswahl (die Futterwahl schließt sich)
    frei, Auswahl offen        „Schließen“ schließt sie wieder
    geht hin / spielt          „Fertig“ beendet das Spielen bzw. bricht den Weg ab (kostet nichts)
  Ein Antippen eines Spielzeugs schickt `playing.play(id)` los, die Auswahl schließt sich. Ist sie zu müde oder beschäftigt, sagt die
  Statuszeile es (nichts wird bestraft). Meldungen laufen über die Statuszeile des FeedPanels (`dock.say`, `role="status"`, wird vorgelesen).

  Nicht nur Farbe: jedes Spielzeug hat Namen und eine eigene Form (Kreis, Quadrat, Ellipse, Raute, Ring); der Zustand hängt an Beschriftung,
  Statuszeile und `aria-label`. Touch-Ziele: Knopf 48 px (Klasse `.dock-btn`), Auswahlfelder 56 px (Klasse `.chip`, Stil in game.html).

  createToyPanel({ playing, toys, dock }) -> { setVisible(bool), setOpen(bool), onOpenChange(fn(open)), dispose() }
    onOpenChange (Phase 21): meldet, wenn die Spielzeug-Auswahl auf- oder zugeht (das Minispiel-Panel schließt dann seine Auswahl).
    playing: createPlaying(...), toys: createToySystem(...), dock: createFeedPanel(...) (braucht `say`, `addAction`, `addTray`, `setOpen`, `onOpenChange`)
  Texte in TOY_UI (js/data/toys.js). NICHT im Browser getestet.
*/
import { TOYS, TOY_IDS, TOY_UI } from '../data/toys.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function createToyPanel({ playing, toys, dock }) {
  let open = false;
  const openListeners = new Set();   // Phase 21: onOpenChange
  const chips = [];

  const tray = el('div', 'tray tray-toy');
  tray.id = 'toyTray';
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', TOY_UI.trayLabel);

  for (const id of TOY_IDS) {
    const def = TOYS[id];
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.dataset.toy = id;
    const dot = el('span', 'chip-dot');
    dot.dataset.shape = def.shape;
    if (def.shape === 'ring') {          // Ring: nur der Rand ist gefüllt
      dot.style.background = 'transparent';
      dot.style.border = '3px solid ' + hex(def.color);
    } else {
      dot.style.background = hex(def.color);
    }
    dot.setAttribute('aria-hidden', 'true');
    chip.append(dot, el('span', 'chip-label', def.label));
    chip.addEventListener('click', () => onChip(id));
    tray.appendChild(chip);
    chips.push(chip);
  }

  const button = el('button', 'dock-btn');
  button.type = 'button';
  button.setAttribute('aria-controls', 'toyTray');

  dock.addTray(tray);
  dock.addAction(button);

  // ---------- Zustand ----------
  const isActive = () => toys.getPhase() !== 'idle';

  function setBusy(busy) {
    for (const chip of chips) chip.disabled = busy;
  }

  /** Beschriftung nach Zustand: „Fertig“, solange sie zum Spielbereich geht oder spielt, sonst „Spielen“/„Schließen“. */
  function refresh() {
    const active = isActive();
    if (active) {
      button.textContent = TOY_UI.stopLabel;
      button.setAttribute('aria-label', TOY_UI.stopAria);
      button.removeAttribute('aria-expanded');
    } else {
      button.textContent = open ? TOY_UI.closeLabel : TOY_UI.openLabel;
      button.setAttribute('aria-label', open ? TOY_UI.closeAria : TOY_UI.openAria);
      button.setAttribute('aria-expanded', String(open));
    }
    setBusy(active);
  }

  function setOpen(on) {
    open = !!on;
    tray.classList.toggle('is-open', open);
    refresh();
    for (const fn of openListeners) fn(open);
  }

  function onOpenChange(fn) { openListeners.add(fn); return () => openListeners.delete(fn); }

  function onChip(id) {
    const res = playing.play(id);
    if (res.ok) {
      setOpen(false);
      return;
    }
    if (res.reason !== 'busy') setOpen(false);
    const text = TOY_UI.status[res.reason];
    if (typeof text === 'string') dock.say(text);
  }

  function onButton() {
    if (isActive()) {
      playing.requestStop();
      return;
    }
    if (!open) dock.setOpen(false);   // die Futterwahl schließt sich, damit sich beide nicht verdecken
    setOpen(!open);
  }
  button.addEventListener('click', onButton);

  const offDock = dock.onOpenChange((foodOpen) => { if (foodOpen && open) setOpen(false); });

  const offEvent = toys.onEvent((e) => {
    switch (e.type) {
      case 'start':
        if (open) setOpen(false);
        dock.say(e.source === 'auto' ? TOY_UI.status.goingAuto : TOY_UI.status.going);
        break;
      case 'playing':
        dock.say(TOY_UI.status.playing(TOYS[e.toyId].withText));
        break;
      case 'done':
        dock.say(e.natural ? (TOY_UI.status.done[e.enjoyment] || TOY_UI.status.done.okay) : TOY_UI.status.stopped);
        break;
      case 'cancelled':
        dock.say(TOY_UI.status.cancelled);
        break;
      default:
        break;
    }
    refresh();
  });

  setOpen(false);

  /** Blendet Knopf und Auswahl ein/aus (z. B. Foto-Modus, Phase 41). */
  function setVisible(on) {
    button.hidden = !on;
    if (!on) setOpen(false);
  }

  function dispose() {
    offEvent();
    offDock();
    button.removeEventListener('click', onButton);
    button.remove();
    tray.remove();
    chips.length = 0;
  }

  return { setVisible, setOpen, onOpenChange, dispose };
}
