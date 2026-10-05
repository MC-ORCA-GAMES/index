/*
  MemoryView – Spielfeld des Memory (Phase 21). Über der Knopfzeile klappt das Spielfeld auf: Kopfzeile („Memory“, „Paare 2/6 · Versuche 5“),
  eine Meldungszeile und ein Raster aus zwölf Karten (sechs Paare), nach dem Ende das Ergebnis mit „Nochmal“ und „Schließen“.
  Ablauf in den Meldungen: Hinweis -> „Schau genau hin!“ (alle Karten kurz offen) -> „Finde die Paare.“ -> „Welche Karte passt dazu?“ ->
  „Ein Paar!“ bzw. „Nicht ganz – merk dir die Karten.“ -> „Alle Paare gefunden!“. Das Ergebnis nennt die Versuche, das beste Ergebnis,
  ggf. „Neues bestes Ergebnis!“ und die Resonanzsplitter. Vorzeitig beendet: nur eine kurze Meldung in der Statuszeile des FeedPanels.

  Das Raster liest seinen Zustand immer aus `game.getCards()`/`getState()` und zeichnet bei jedem Ereignis neu (nur Klassen und Beschriftungen,
  die Knöpfe bleiben bestehen, der Tastaturfokus geht nicht verloren). Karten werden erst beim Ereignis `start` angelegt (Anzahl aus `e.total`).

  Nicht nur Farbe: jede Karte zeigt eine eigene Form (Kreis, Dreieck, Raute, Quadrat, Stern, Sechseck); verdeckte Karten zeigen „?“, gefundene
  Karten tragen einen goldenen Rahmen, sind abgedunkelt und zeigen ein Häkchen. `aria-label` je Karte: „Karte 3 von 12, verdeckt“ / „… Stern“ /
  „… Stern, Paar gefunden“ (gefundene Karten sind `aria-disabled`, bleiben aber fokussierbar). Touch-Ziele: Karten mindestens 64 px hoch, Knöpfe
  48 px. Karten reagieren schon beim Berühren (`pointerdown`); mit der Tastatur (Enter/Leertaste, `click` ohne Zeigereingabe) geht es auch.
  Meldungszeile ist `aria-live="polite"`. „Reduzierte Bewegung“: das Umdrehen ist ein sofortiger Wechsel ohne Übergang (CSS).
  Raster: im Hochformat `MEMORY.columns` Spalten (CSS-Variable `--cols`), im flachen Querformat sechs Spalten (zwei Reihen, schont die Sicht auf Reson).

  createMemoryView({ gaming, game, dock, start, onChange }) -> { id: 'memory', isOpen(), setOpen(bool), setVisible(bool), dispose() }
    gaming: createGaming(...), game: createMemoryGameSystem(...), dock: createFeedPanel(...) (braucht `say`, `addTray`),
    start(): startet das Spiel über das GamePanel (schließt Futter-/Spielzeugwahl) -> { ok, reason },
    onChange(): meldet dem GamePanel, dass sich Öffnung oder Zustand geändert haben (Knopfbeschriftung).
  Texte in MEMORY_UI und MINIGAME_UI.status (js/data/minigames.js), Kartenbilder in MEMORY.symbols, Stil in game.html. NICHT im Browser getestet.
*/
import { MEMORY, MEMORY_UI, MINIGAME_UI } from '../data/minigames.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function createMemoryView({ gaming, game, dock, start, onChange = () => {} }) {
  let open = false;
  let mode = 'play';       // 'play' (Karten) | 'result' (Ergebnis)
  let shownMsg = '';
  const cardButtons = [];  // Index -> { button, shape }
  const symbols = new Map(MEMORY.symbols.map((s) => [s.id, s]));
  const U = MEMORY_UI;

  // ---------- Aufbau ----------
  const tray = el('div', 'tray tray-game tray-memory');
  tray.id = 'memoryTray';
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', U.title);
  tray.dataset.mode = mode;

  const head = el('div', 'game-head');
  const title = el('span', 'game-title', U.title);
  const counterText = el('span', 'game-round', '');
  head.append(title, counterText);

  const msg = el('p', 'game-msg', '');
  msg.setAttribute('aria-live', 'polite');
  msg.setAttribute('aria-atomic', 'true');

  const grid = el('div', 'memory-grid');
  grid.style.setProperty('--cols', String(MEMORY.columns));

  // Ergebnis
  const resultBox = el('div', 'game-result');
  const resultText = el('p', 'game-result-text', '');
  const scoreText = el('p', 'game-result-line', '');
  const bestText = el('p', 'game-result-line', '');
  const shardsText = el('p', 'game-result-line', '');
  const resultNote = el('p', 'game-result-note', '');   // z. B. „zu müde“ nach „Nochmal“
  const actions = el('div', 'game-actions');
  const againBtn = el('button', 'game-action', U.againLabel);
  againBtn.type = 'button';
  const closeBtn = el('button', 'game-action', U.closeLabel);
  closeBtn.type = 'button';
  actions.append(againBtn, closeBtn);
  resultBox.append(resultText, scoreText, bestText, shardsText, resultNote, actions);

  tray.append(head, msg, grid, resultBox);
  dock.addTray(tray);

  // ---------- Karten ----------
  /** Legt die Kartenknöpfe an (einmal je Kartenzahl). */
  function buildGrid(total) {
    if (cardButtons.length === total) return;
    grid.textContent = '';
    cardButtons.length = 0;
    for (let i = 0; i < total; i += 1) {
      const button = el('button', 'memory-card');
      button.type = 'button';
      button.dataset.index = String(i);
      const back = el('span', 'memory-back', '?');
      back.setAttribute('aria-hidden', 'true');
      const face = el('span', 'memory-face');
      face.setAttribute('aria-hidden', 'true');
      const shape = el('span', 'game-shape');
      face.appendChild(shape);
      button.append(back, face);
      // Schon beim Berühren reagieren (kein Warten auf den Klick). Tastatur: `click` ohne Zeigereingabe (detail 0).
      button.addEventListener('pointerdown', (ev) => {
        if (ev.button > 0) return;
        ev.preventDefault();
        game.tap(i);
      });
      button.addEventListener('click', (ev) => { if (ev.detail === 0) game.tap(i); });
      grid.appendChild(button);
      cardButtons.push({ button, shape });
    }
  }

  /** Zeichnet alle Karten und den Zähler nach dem Zustand des Spiels. */
  function render() {
    const cards = game.getCards();
    for (const c of cards) {
      const slot = cardButtons[c.index];
      if (!slot) continue;
      const def = c.symbolId ? symbols.get(c.symbolId) : null;
      slot.button.classList.toggle('is-up', c.faceUp);
      slot.button.classList.toggle('is-matched', c.matched);
      slot.button.setAttribute('aria-disabled', c.matched ? 'true' : 'false');
      if (def) {
        slot.shape.dataset.shape = def.shape;
        slot.button.style.setProperty('--pad', hex(def.color));
      }
      let state = U.cardHidden;
      if (def) state = c.matched ? U.cardMatched(def.label) : U.cardOpen(def.label);
      slot.button.setAttribute('aria-label', U.cardAria(c.index + 1, cards.length, state));
    }
    const st = game.getState();
    counterText.textContent = U.counter(st.turns, st.pairsFound, st.pairs);
  }

  // ---------- Zustand ----------
  function setMsg(text) {
    if (text === shownMsg) return;
    shownMsg = text;
    msg.textContent = text;
  }

  function setMode(next) {
    mode = next;
    tray.dataset.mode = next;
  }

  function setOpen(on) {
    open = !!on;
    tray.classList.toggle('is-open', open);
    onChange();
  }

  function begin() {
    const res = start();
    if (res.ok) return true;
    const text = MINIGAME_UI.status[res.reason];
    if (typeof text === 'string') {
      if (mode === 'result' && open) resultNote.textContent = text;
      else dock.say(text);
    }
    return false;
  }

  function showResult(r) {
    setMode('result');
    resultText.textContent = U.result[r.result] || U.result.ok;
    scoreText.textContent = U.scoreLine(r.turns, r.pairs);
    bestText.textContent = r.newBest ? U.newBest : (r.bestTurns > 0 ? U.bestLine(r.bestTurns) : '');
    bestText.hidden = !bestText.textContent;
    shardsText.textContent = r.shards > 0 ? U.shardsLine(r.shards) : '';
    shardsText.hidden = !shardsText.textContent;
    resultNote.textContent = '';
    againBtn.disabled = gaming.isResting();   // erst „Nochmal“, wenn Reson wieder frei ist (kurzes Ausklingen)
    setOpen(true);
  }

  againBtn.addEventListener('click', () => { if (!againBtn.disabled) begin(); });
  closeBtn.addEventListener('click', () => setOpen(false));

  // ---------- Ereignisse ----------
  const offGame = game.onEvent((e) => {
    switch (e.type) {
      case 'start':
        setMode('play');
        buildGrid(e.total);
        render();
        setMsg(U.intro);
        setOpen(true);
        break;
      case 'peek':
        render();
        setMsg(U.peek);
        break;
      case 'begin':
        render();
        setMsg(U.pick);
        break;
      case 'flip':
        render();
        if (!e.second) setMsg(U.pickSecond);
        break;
      case 'match':
        render();
        setMsg(e.pairsFound >= e.pairs ? U.matchLast : U.match);
        break;
      case 'mismatch':
        render();
        setMsg(U.mismatch);
        break;
      case 'hide':
        render();
        setMsg(U.pick);
        break;
      case 'done':
        if (e.natural) {
          showResult(e);
        } else {
          setOpen(false);   // vorzeitig beendet: kurze Meldung, kein Ergebnisfeld
          let text = U.result.stopped;
          if (e.shards > 0) text += ' ' + U.shardsLine(e.shards) + '.';
          dock.say(text);
        }
        break;
      default:
        break;
    }
    onChange();
  });

  const offGaming = gaming.onEvent((e) => {
    if (e.type !== 'finished' || mode !== 'result') return;
    againBtn.disabled = false;
    // Tastatur: war eine Karte fokussiert (jetzt ausgeblendet), landet der Fokus sonst im Leeren
    if (document.activeElement === document.body) againBtn.focus({ preventScroll: true });
  });

  setOpen(false);

  /** Blendet das Spielfeld ein/aus (z. B. Foto-Modus, Phase 41). Ein laufendes Spiel wird dabei nicht beendet. */
  function setVisible(on) {
    if (!on && !game.isPlaying()) setOpen(false);
    tray.hidden = !on;
  }

  function dispose() {
    offGame();
    offGaming();
    tray.remove();
    cardButtons.length = 0;
  }

  return { id: 'memory', isOpen: () => open, setOpen, setVisible, dispose };
}
