/*
  RoomPicker – Raumwahl (Phase 30 Teil C). Knopf „Räume“ in der Knopfzeile unten (neben „Füttern“, „Schlafen“ usw.); die Auswahl klappt
  darüber auf: ein Feld je Raum (Halle, Dekoration, Forschungsbereich, Schlafplatz, Futterplatz, Spielbereich, Waschplatz) und
  „Reson folgen“. Ein Antippen eines Raums schickt die Kamera dorthin und lässt sie dort bleiben, auch wenn Reson woanders ist;
  „Reson folgen“ holt sie zurück und die Kamera folgt wieder automatisch (Phase 30 Teil A).

  Nicht nur Farbe: jedes Feld trägt den Raumnamen, der angesehene Raum ist `aria-pressed` und mit „✓“ markiert, der Raum, in dem
  Reson gerade ist, trägt den Zusatz „Reson ist hier“. Meldungen laufen über die Statuszeile des FeedPanels (`dock.say`, `role="status"`).
  Touch-Ziele: Knopf 48 px (`.dock-btn`), Felder 56 px (`.chip`).

  createRoomPicker({ rooms, dock, onView, onFollow, getHere, closeOthers }) -> { update(), setOpen(bool), isOpen(), setViewing(id|null), setVisible(bool), dispose() }
    rooms:       [{ id, label, color? }] in Anzeigereihenfolge (aus FLOORPLAN + Zonenfarben, siehe main.js)
    dock:        createFeedPanel(...) (braucht `say`, `addAction`, `addTray`)
    onView(id):  Kamera in diesen Raum und dort halten
    onFollow():  Kamera folgt Reson wieder
    getHere():   Id des Raums, in dem Reson gerade ist
    closeOthers: schließt die anderen Auswahlfelder, wenn diese aufgeht
  Texte in ROOM_UI (js/data/habitat.js). NICHT im Browser getestet.
*/
import { ROOM_UI } from '../data/habitat.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function createRoomPicker({ rooms, dock, onView, onFollow, getHere, closeOthers }) {
  let open = false;
  let viewing = null;   // Raum-Id oder null (= folgt Reson)
  let hereShown = null;
  const chips = new Map();

  const tray = el('div', 'tray tray-room');
  tray.id = 'roomTray';
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', ROOM_UI.trayLabel);

  for (const r of rooms) {
    const chip = el('button', 'chip chip-room');
    chip.type = 'button';
    chip.dataset.room = r.id;
    const dot = el('span', 'chip-dot');
    dot.dataset.shape = 'ring';
    dot.style.background = 'transparent';
    dot.style.border = '3px solid ' + hex(r.color ?? 0xd4af37);
    dot.setAttribute('aria-hidden', 'true');
    const text = el('span', 'chip-text');
    text.append(el('span', 'chip-label', r.label), el('span', 'chip-sub'));
    chip.append(dot, text);
    chip.addEventListener('click', () => view(r.id));
    tray.appendChild(chip);
    chips.set(r.id, { chip, sub: text.lastChild, label: r.label });
  }

  const followChip = el('button', 'chip chip-room chip-follow');
  followChip.type = 'button';
  followChip.setAttribute('aria-label', ROOM_UI.followAria);
  followChip.append(el('span', 'chip-label', ROOM_UI.followLabel));
  followChip.addEventListener('click', follow);
  tray.appendChild(followChip);

  const button = el('button', 'dock-btn');
  button.type = 'button';
  button.setAttribute('aria-controls', 'roomTray');

  dock.addTray(tray);
  dock.addAction(button);

  function render() {
    for (const [id, c] of chips) {
      const isView = viewing === id;
      c.chip.setAttribute('aria-pressed', String(isView));
      c.chip.classList.toggle('is-viewed', isView);
      const isHere = hereShown === id;
      c.sub.textContent = (isView ? '✓ ' : '') + (isHere ? ROOM_UI.here : '');
      c.chip.setAttribute('aria-label', c.label + (isHere ? ', ' + ROOM_UI.here : '') + (isView ? ', angesehen' : ''));
    }
    followChip.disabled = viewing === null;
    button.textContent = open ? ROOM_UI.closeLabel : ROOM_UI.openLabel;
    button.setAttribute('aria-label', open ? ROOM_UI.closeAria : ROOM_UI.openAria);
    button.setAttribute('aria-expanded', String(open));
  }

  function setOpen(on) {
    const next = !!on;
    if (next === open) return;
    open = next;
    tray.classList.toggle('is-open', open);
    if (open && closeOthers) closeOthers();
    render();
  }

  function view(id) {
    if (!chips.has(id)) return;
    viewing = id;
    onView(id);
    const label = chips.get(id).label;
    dock.say(getHere() === id ? ROOM_UI.viewingHere(label) : ROOM_UI.viewing(label));
    setOpen(false);
    render();
  }

  function follow() {
    if (viewing === null) return;
    viewing = null;
    onFollow();
    dock.say(ROOM_UI.following);
    setOpen(false);
    render();
  }

  /** Von außen setzen (z. B. wenn die Kamera aus anderem Grund wieder folgt), ohne Meldung. */
  function setViewing(id) {
    viewing = id && chips.has(id) ? id : null;
    render();
  }

  /** Pro Frame: nur das Feld „Reson ist hier“ nachführen (billig, schreibt nur bei Änderung). */
  function update() {
    const h = getHere();
    if (h !== hereShown) { hereShown = h; render(); }
  }

  const onButton = () => setOpen(!open);
  button.addEventListener('click', onButton);
  render();

  function setVisible(on) { button.hidden = !on; if (!on) setOpen(false); }

  function dispose() {
    button.removeEventListener('click', onButton);
    button.remove();
    tray.remove();
  }

  return { update, setOpen, isOpen: () => open, setViewing, setVisible, dispose };
}
