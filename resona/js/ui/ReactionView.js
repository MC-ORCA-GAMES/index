/*
  ReactionView – Spielfeld des Reaktionsspiels (Phase 20, ab Phase 21 eigene Datei). Der Code stammt aus dem damaligen GamePanel; angepasst
  wurden nur die Übergabe (`start`, `onChange` statt `closeOthers`/Knopf) und der Rückgabewert, die Texte der Ablehnungsgründe kommen aus
  `MINIGAME_UI.status`. Knopf, Start und das Platzmachen für die Futterwahl liegen jetzt im GamePanel. Über der Knopfzeile klappt das Spielfeld auf: Kopfzeile („Reaktionsspiel“, „Runde 3 von 8“),
  eine Meldungszeile und drei große Felder (Kreis, Dreieck, Raute), nach dem Ende das Ergebnis mit „Nochmal“ und „Schließen“.
  Ablauf in den Meldungen: Hinweis -> „Warte auf das Leuchten …“ -> „Jetzt!“ -> Rückmeldung der Runde („Blitzschnell!“, „Gut!“, „Geschafft.“,
  „Verpasst – kein Problem.“, „Noch nicht – warte auf das Leuchten.“, „Das war ein anderes Feld.“). Nach dem Ende ein Ergebnis mit Punkten, bestem
  Ergebnis, ggf. „Neues bestes Ergebnis!“ und den Resonanzsplittern. Vorzeitig beendet: nur eine kurze Meldung in der Statuszeile des FeedPanels.

  Nicht nur Farbe, nicht nur Bewegung: jedes Feld hat Namen und eine eigene Form (Kreis, Dreieck, Raute); das leuchtende Feld trägt zusätzlich
  einen weißen Rahmen und ist größer, und die Meldung sagt „Jetzt!“. „Reduzierte Bewegung“: keine Übergänge (CSS), nur Rahmen und Farbe wechseln.
  Touch-Ziele: Felder mindestens 88 px hoch, Knöpfe 48 px. Die Felder reagieren schon beim Berühren (`pointerdown`), das spart die Verzögerung
  des Klicks; mit der Tastatur (Enter/Leertaste, `click` ohne Zeigereingabe) geht es auch. Meldungszeile ist `aria-live="polite"`.

  createReactionView({ gaming, game, dock, start, onChange }) -> { id: 'reaction', isOpen(), setOpen(bool), setVisible(bool), dispose() }
    gaming: createGaming(...), game: createReactionGameSystem(...), dock: createFeedPanel(...) (braucht `say`, `addTray`),
    start(): startet das Spiel über das GamePanel (schließt Futter-/Spielzeugwahl) -> { ok, reason },
    onChange(): meldet dem GamePanel, dass sich Öffnung oder Zustand geändert haben (Knopfbeschriftung).
  Texte in REACTION_UI und MINIGAME_UI.status (js/data/minigames.js), Felder in REACTION.pads, Stil in game.html. NICHT im Browser getestet.
*/
import { REACTION, REACTION_UI, MINIGAME_UI } from '../data/minigames.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function createReactionView({ gaming, game, dock, start, onChange = () => {} }) {
  let open = false;
  let mode = 'play';       // 'play' (Felder) | 'result' (Ergebnis)
  let shownMsg = '';
  const pads = new Map();  // padId -> Knopf
  const U = REACTION_UI;

  // ---------- Aufbau ----------
  const tray = el('div', 'tray tray-game');
  tray.id = 'gameTray';
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', U.title);
  tray.dataset.mode = mode;

  const head = el('div', 'game-head');
  const title = el('span', 'game-title', U.title);
  const roundText = el('span', 'game-round', '');
  head.append(title, roundText);

  const msg = el('p', 'game-msg', '');
  msg.setAttribute('aria-live', 'polite');
  msg.setAttribute('aria-atomic', 'true');

  const padRow = el('div', 'game-pads');
  for (const def of REACTION.pads) {
    const pad = el('button', 'game-pad');
    pad.type = 'button';
    pad.dataset.pad = def.id;
    pad.style.setProperty('--pad', hex(def.color));
    const shape = el('span', 'game-shape');
    shape.dataset.shape = def.shape;
    shape.setAttribute('aria-hidden', 'true');
    pad.append(shape, el('span', 'game-pad-label', def.label));
    // Schon beim Berühren reagieren (kein Warten auf den Klick). Tastatur: `click` ohne Zeigereingabe (detail 0).
    pad.addEventListener('pointerdown', (ev) => {
      if (ev.button > 0) return;
      ev.preventDefault();
      game.tap(def.id);
    });
    pad.addEventListener('click', (ev) => { if (ev.detail === 0) game.tap(def.id); });
    padRow.appendChild(pad);
    pads.set(def.id, pad);
  }

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

  tray.append(head, msg, padRow, resultBox);
  dock.addTray(tray);

  // ---------- Zustand ----------
  function setMsg(text) {
    if (text === shownMsg) return;
    shownMsg = text;
    msg.textContent = text;
  }

  function setLit(padId) {
    for (const [id, pad] of pads) pad.classList.toggle('is-lit', id === padId);
  }

  function setMode(next) {
    mode = next;
    tray.dataset.mode = next;
  }

  function setOpen(on) {
    open = !!on;
    tray.classList.toggle('is-open', open);
    if (!open) setLit(null);
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
    setLit(null);
    resultText.textContent = U.result[r.result] || U.result.ok;
    scoreText.textContent = U.scoreLine(r.points, r.maxPoints);
    bestText.textContent = r.newBest ? U.newBest : (r.bestPoints > 0 ? U.bestLine(r.bestPoints) : '');
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
        setLit(null);
        roundText.textContent = U.roundOf(1, e.rounds);
        setMsg(U.intro);
        setOpen(true);
        break;
      case 'round':
        setLit(null);
        roundText.textContent = U.roundOf(e.round, e.total);
        setMsg(U.waiting);
        break;
      case 'lit':
        setLit(e.padId);
        setMsg(U.go);
        break;
      case 'early':
        setMsg(U.early);
        break;
      case 'wrong':
        setMsg(U.wrong);
        break;
      case 'feedback':
        setLit(null);
        setMsg(U.feedback[e.kind] || U.feedback.ok);
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
    // Tastatur: war ein Feld fokussiert (jetzt ausgeblendet), landet der Fokus sonst im Leeren
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
    pads.clear();
  }

  return { id: 'reaction', isOpen: () => open, setOpen, setVisible, dispose };
}
