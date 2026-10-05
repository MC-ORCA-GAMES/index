/*
  GamePanel – Knopf „Minispiel“ und Spielauswahl (Phase 20, ab Phase 21 für mehrere Minispiele). Der Knopf steht in der Knopfzeile unten
  (neben „Füttern“, „Schlafen“, „Waschen“, „Spielen“). Ein Knopf, der je nach Zustand wechselt:
    frei, alles zu             „Minispiel“ öffnet die Auswahl (drei große Felder: „Reaktion“, „Memory“, „Funken“; Futter- und Spielzeugwahl schließen sich)
    Auswahl oder Ergebnis offen  „Schließen“ schließt sie wieder
    Spiel läuft                „Beenden“ beendet vorzeitig (kostet nichts)
  Ein Antippen in der Auswahl startet das Spiel über `gaming.start({ id })`; das Spielfeld des Spiels klappt dann an derselben Stelle auf.
  Jedes Spiel hat seine eigene Ansicht (Karten, Felder, Ergebnis):
    reaction -> js/ui/ReactionView.js,   memory -> js/ui/MemoryView.js,   skill -> js/ui/SkillView.js (das Spiel selbst läuft in der 3D-Szene)
  Neue Minispiele tragen sich in VIEW_FACTORIES und in MINIGAME_UI.games (js/data/minigames.js) ein. Ist sie zu müde oder beschäftigt, sagt die
  Statuszeile es (`dock.say`, Texte in MINIGAME_UI.status), nichts wird bestraft.

  Zusammenspiel: Beginnt ein Spiel (Ereignis `start`), schließen sich die Auswahl und die Ansichten der anderen Spiele. Geht die Futterwahl oder
  die Spielzeug-Auswahl auf, macht ein stehendes Ergebnis oder die Auswahl Platz (ein laufendes Spiel bleibt, die anderen Panels lehnen dann
  freundlich ab). Die Ansichten rufen `start()` (über `startGame`) auch für „Nochmal“ im Ergebnis.

  Nicht nur Farbe: Namen und Beschreibung in der Auswahl, `aria-label` an jedem Feld, `aria-expanded` am Knopf. Touch-Ziele: Auswahlfelder
  mindestens 72 px hoch, Knopf 48 px (Klasse `.dock-btn`).

  createGamePanel({ gaming, games, dock, closeOthers }) -> { setVisible(bool), setOpen(bool), closeIdle(), dispose() }
    gaming: createGaming(...), games: { reaction: createReactionGameSystem(...), memory: createMemoryGameSystem(...), skill: createSkillGameSystem(...) } (Schlüssel = Spiel-Id),
    dock: createFeedPanel(...) (braucht `say`, `addAction`, `addTray`, `onOpenChange`),
    closeOthers(): optional, schließt die anderen Auswahlfelder (Futter, Spielzeug), wenn die Auswahl aufgeht oder ein Spiel startet.
    setOpen(true) öffnet die Auswahl, setOpen(false) und closeIdle() schließen Auswahl und stehende Ergebnisse (ein laufendes Spiel bleibt).
  Texte in MINIGAME_UI (js/data/minigames.js), Stil in game.html. NICHT im Browser getestet.
*/
import { MINIGAME_UI } from '../data/minigames.js';
import { createReactionView } from './ReactionView.js';
import { createMemoryView } from './MemoryView.js';
import { createSkillView } from './SkillView.js';

const VIEW_FACTORIES = { reaction: createReactionView, memory: createMemoryView, skill: createSkillView };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createGamePanel({ gaming, games, dock, closeOthers = null }) {
  const U = MINIGAME_UI;
  const ids = Object.keys(games);
  const views = [];
  let pickOpen = false;

  // ---------- Aufbau: Auswahl und Knopf ----------
  const pickTray = el('div', 'tray tray-game tray-pick');
  pickTray.id = 'gamePickTray';
  pickTray.setAttribute('role', 'group');
  pickTray.setAttribute('aria-label', U.pickTitle);

  const pickHead = el('div', 'game-head');
  pickHead.appendChild(el('span', 'game-title', U.pickTitle));

  const choices = el('div', 'game-choices');
  for (const g of U.games) {
    if (!games[g.id]) continue;
    const choice = el('button', 'game-choice');
    choice.type = 'button';
    choice.dataset.game = g.id;
    choice.setAttribute('aria-label', g.aria);
    choice.append(el('span', 'game-choice-name', g.name), el('span', 'game-choice-desc', g.desc));
    choice.addEventListener('click', () => pick(g.id));
    choices.appendChild(choice);
  }
  pickTray.append(pickHead, choices);

  const button = el('button', 'dock-btn');
  button.type = 'button';
  button.setAttribute('aria-controls', 'gamePickTray');

  dock.addTray(pickTray);
  dock.addAction(button);

  // ---------- Zustand ----------
  const anyPlaying = () => ids.some((id) => games[id].isPlaying());
  const anyViewOpen = () => views.some((v) => v.isOpen());

  /** Beschriftung nach Zustand: „Beenden“ solange ein Spiel läuft, „Schließen“ bei Auswahl oder Ergebnis, sonst „Minispiel“. */
  function refresh() {
    if (anyPlaying()) {
      button.textContent = U.stopLabel;
      button.setAttribute('aria-label', U.stopAria);
      button.removeAttribute('aria-expanded');
    } else if (pickOpen || anyViewOpen()) {
      button.textContent = U.closeLabel;
      button.setAttribute('aria-label', U.closeLabel);
      button.setAttribute('aria-expanded', 'true');
    } else {
      button.textContent = U.openLabel;
      button.setAttribute('aria-label', U.openAria);
      button.setAttribute('aria-expanded', 'false');
    }
  }

  function setPickOpen(on) {
    pickOpen = !!on;
    pickTray.classList.toggle('is-open', pickOpen);
    refresh();
  }

  /** Schließt Auswahl und stehende Ergebnisse; ein laufendes Spiel bleibt. */
  function closeIdle() {
    if (anyPlaying()) return;
    for (const v of views) v.setOpen(false);
    setPickOpen(false);
  }

  /** Startet ein Spiel (auch für „Nochmal“ in den Ansichten). Futter- und Spielzeugwahl schließen sich. */
  function startGame(id) {
    if (closeOthers) closeOthers();
    return gaming.start({ id, source: 'player' });
  }

  function pick(id) {
    setPickOpen(false);
    const res = startGame(id);
    if (res.ok) return;
    const text = U.status[res.reason];
    if (typeof text === 'string') dock.say(text);
  }

  function onButton() {
    if (anyPlaying()) {
      gaming.requestStop();
      return;
    }
    if (pickOpen || anyViewOpen()) {
      closeIdle();
      return;
    }
    if (closeOthers) closeOthers();
    setPickOpen(true);
  }
  button.addEventListener('click', onButton);

  // ---------- Ansichten ----------
  for (const id of ids) {
    const make = VIEW_FACTORIES[id];
    if (!make) continue;
    views.push(make({ gaming, game: games[id], dock, start: () => startGame(id), onChange: refresh }));
  }

  // Beginnt ein Spiel: Auswahl und die Ansichten der anderen Spiele machen Platz. (Nach den Ansichten angemeldet, die Ansicht des Spiels ist also schon offen.)
  const offGames = ids.map((id) => games[id].onEvent((e) => {
    if (e.type === 'start') {
      setPickOpen(false);
      for (const v of views) if (v.id !== id) v.setOpen(false);
    }
    refresh();
  }));

  // Die Futterwahl geht auf: Auswahl und stehende Ergebnisse machen Platz (ein laufendes Spiel bleibt, die Futterwahl lehnt dann freundlich ab)
  const offDock = dock.onOpenChange((foodOpen) => { if (foodOpen) closeIdle(); });

  setPickOpen(false);

  /** Öffnet die Auswahl (true) oder schließt Auswahl und stehende Ergebnisse (false). Ein laufendes Spiel bleibt. */
  function setOpen(on) {
    if (on) {
      if (!anyPlaying() && !anyViewOpen()) setPickOpen(true);
    } else {
      closeIdle();
    }
  }

  /** Blendet Knopf, Auswahl und Spielfelder ein/aus (z. B. Foto-Modus, Phase 41). Ein laufendes Spiel wird dabei nicht beendet. */
  function setVisible(on) {
    button.hidden = !on;
    if (!on) closeIdle();
    pickTray.hidden = !on;
    for (const v of views) v.setVisible(on);
  }

  function dispose() {
    for (const off of offGames) off();
    offDock();
    button.removeEventListener('click', onButton);
    button.remove();
    pickTray.remove();
    for (const v of views) v.dispose();
    views.length = 0;
  }

  return { setVisible, setOpen, closeIdle, dispose };
}
