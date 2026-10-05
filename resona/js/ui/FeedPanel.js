/*
  FeedPanel – Futterwahl am unteren Bildrand (Phase 11).
  Ein Knopf „Füttern" öffnet eine Auswahl mit den Futterarten (FOODS). Antippen schickt `feeding.feed(id)` los,
  die Auswahl schließt sich. Darüber steht eine kurze Statuszeile (`role="status"`, wird vorgelesen):
  „Reson geht zum Futterplatz.", „Reson ist gerade satt.", nach dem Fressen ein Satz zur Vorliebe.
  Welche Richtung die Kreatur mag, verrät die Auswahl bewusst nicht; der Spieler erkennt es an den Reaktionen
  und an der Statuszeile.

  Nicht nur Farbe: jedes Futter hat Namen und eine eigene Form (Punkt, Raute, Tropfen, Quadrat). Touch-Ziele mindestens
  44 px (Knopf 48 px, Auswahlfelder 56 px). Während die Kreatur frisst, sind die Felder deaktiviert.

  Phase 15: `say(text)` zeigt eine Meldung in der Statuszeile (auch für andere Panels), `addAction(node)` hängt einen weiteren
  Knopf neben „Füttern“ in dieselbe Zeile (SleepPanel: „Schlafen“/„Wecken“). Schläft die Kreatur, lehnt `feeding.feed` mit
  `reason: 'asleep'` ab, die Statuszeile sagt es. Phase 16: dasselbe mit `reason: 'washing'`, solange sie gewaschen wird.

  Phase 20: dasselbe mit `reason: 'gaming'`, solange das Minispiel läuft.

  Phase 18: dasselbe mit `reason: 'playing'`, solange sie spielt. Für das zweite Auswahlfeld (ToyPanel: Spielzeuge) gibt es
  `addTray(node)` (hängt es über die Knopfzeile ein; es zeigt sich über seine eigene Klasse `.is-open`, nicht über `.dock.open`)
  und `onOpenChange(fn(open))` (meldet, wenn die Futterwahl auf- oder zugeht, damit sich die Felder nicht gegenseitig verdecken).

  createFeedPanel({ container, feeding }) -> { update(dt), setVisible(bool), setOpen(bool), say(text), addAction(node), addTray(node), onOpenChange(fn), dispose() }
  Texte in FOOD_UI (js/data/foods.js), Stil in game.html. NICHT im Browser getestet.
*/
import { FOODS, FOOD_IDS, FOOD_UI } from '../data/foods.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function createFeedPanel({ container, feeding }) {
  let open = false;
  let statusLeft = 0;
  const chips = [];
  const openListeners = new Set();

  const dock = el('section', 'dock');
  dock.setAttribute('aria-label', FOOD_UI.openLabel);

  const status = el('div', 'dock-status', '');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const tray = el('div', 'tray');
  tray.id = 'foodTray';
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', FOOD_UI.trayLabel);

  for (const id of FOOD_IDS) {
    const def = FOODS[id];
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.dataset.food = id;
    const dot = el('span', 'chip-dot');
    dot.dataset.shape = def.shape;
    dot.style.background = hex(def.color);
    dot.setAttribute('aria-hidden', 'true');
    chip.append(dot, el('span', 'chip-label', def.label));
    chip.addEventListener('click', () => onChip(id));
    tray.appendChild(chip);
    chips.push(chip);
  }

  const button = el('button', 'dock-btn', FOOD_UI.openLabel);
  button.type = 'button';
  button.setAttribute('aria-controls', 'foodTray');

  const row = el('div', 'dock-row');      // Knopfzeile (Phase 15): „Füttern“ plus weitere Aktionen
  row.appendChild(button);

  dock.append(status, tray, row);
  container.appendChild(dock);

  // ---------- Zustand ----------
  function say(text) {
    status.textContent = text;
    statusLeft = text ? FOOD_UI.statusSec : 0;
  }

  function setBusy(busy) {
    for (const chip of chips) chip.disabled = busy;
  }

  function setOpen(on) {
    open = !!on;
    dock.classList.toggle('open', open);
    button.textContent = open ? FOOD_UI.closeLabel : FOOD_UI.openLabel;
    button.setAttribute('aria-expanded', String(open));
    for (const fn of openListeners) fn(open);
  }

  function onChip(id) {
    const res = feeding.feed(id);
    if (res.ok) {
      setOpen(false);
    } else if (res.reason === 'full') {
      setOpen(false);
      say(FOOD_UI.status.full);
    } else if (res.reason === 'busy') {
      say(FOOD_UI.status.busy);
    } else if (res.reason === 'asleep') {
      setOpen(false);
      say(FOOD_UI.status.asleep);
    } else if (res.reason === 'washing') {
      setOpen(false);
      say(FOOD_UI.status.washing);   // Phase 16
    } else if (res.reason === 'playing') {
      setOpen(false);
      say(FOOD_UI.status.playing);   // Phase 18
    } else if (res.reason === 'gaming') {
      setOpen(false);
      say(FOOD_UI.status.gaming);    // Phase 20
    } else if (res.reason === 'training') {
      setOpen(false);
      say(FOOD_UI.status.training);  // Phase 23
    } else if (res.reason === 'egg') {
      setOpen(false);
      say(FOOD_UI.status.egg);       // Phase 25
    }
  }

  const onButton = () => setOpen(!open);
  button.addEventListener('click', onButton);

  const offEvent = feeding.onEvent((e) => {
    switch (e.type) {
      case 'start':
        setBusy(true);
        say(FOOD_UI.status.walking);
        break;
      case 'done':
        setBusy(false);
        say(FOOD_UI.status.done[e.enjoyment] || '');
        break;
      case 'cancelled':
      case 'refused':
        setBusy(false);
        break;
      default:
        break;
    }
  });

  setOpen(false);
  setBusy(feeding.isBusy());

  function update(dt) {
    if (statusLeft > 0) {
      statusLeft -= dt;
      if (statusLeft <= 0 && !feeding.isBusy()) status.textContent = '';
    }
  }

  /** Blendet die Futterwahl ein/aus (z. B. Foto-Modus, Phase 41). */
  function setVisible(on) { dock.hidden = !on; }

  /** Weiterer Knopf in der Knopfzeile (Phase 15). */
  function addAction(node) { row.appendChild(node); }

  /** Weiteres Auswahlfeld über der Knopfzeile (Phase 18, Spielzeuge). Der Aufrufer steuert es über die Klasse `.is-open` am Feld selbst. */
  function addTray(node) { dock.insertBefore(node, row); }

  /** Meldet, wenn die Futterwahl auf- (true) oder zugeht (false). Liefert eine Abmelde-Funktion. */
  function onOpenChange(fn) { openListeners.add(fn); return () => openListeners.delete(fn); }

  function dispose() {
    offEvent();
    button.removeEventListener('click', onButton);
    dock.remove();
    chips.length = 0;
    openListeners.clear();
  }

  return { update, setVisible, setOpen, say, addAction, addTray, onOpenChange, dispose };
}
