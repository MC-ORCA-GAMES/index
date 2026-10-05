/*
  SkillView – Anzeige des Minispiels „Lichtfunken“ (Phase 22). Anders als Reaktionsspiel und Memory gibt es hier keine Felder auf der Oberfläche:
  das Ziel (der Funke) liegt in der 3D-Szene (js/world/SparkField.js), getippt wird im Bild. Die Ansicht zeigt nur eine schmale Leiste über der
  Knopfzeile: Kopfzeile („Lichtfunken“, „Funke 3 von 10“), eine Meldungszeile und nach dem Ende das Ergebnis mit „Nochmal“ und „Schließen“.
  Bewusst klein, damit die Kuppel und Reson im Bild frei bleiben.
  Ablauf in den Meldungen: Hinweis -> „Gleich erscheint ein Funke …“ -> „Fang ihn!“ -> Rückmeldung der Runde („Volltreffer!“, „Gut!“, „Erwischt.“,
  „Entwischt – kein Problem.“) bzw. bei einem Fehltipp „Knapp daneben – versuch es weiter.“ Nach dem Ende ein Ergebnis mit Punkten, bestem Ergebnis,
  ggf. „Neues bestes Ergebnis!“ und den Resonanzsplittern. Vorzeitig beendet: nur eine kurze Meldung in der Statuszeile des FeedPanels.

  Barrierefreiheit: die Meldungszeile ist `aria-live="polite"` und trägt alles Wichtige als Text („Fang ihn!“, Stufe, Fehltipp); es gibt keine
  Bedienung, die nur über Farbe läuft. Für Menschen, die im 3D-Bild nicht tippen können, gibt es in dieser Phase keine Ersatzbedienung (offen,
  siehe PROJECT_STATE.md, Phase 47). „Reduzierte Bewegung“: der Funke steht still und bleibt länger (Logik und Szene).

  createSkillView({ gaming, game, dock, start, onChange }) -> { id: 'skill', isOpen(), setOpen(bool), setVisible(bool), dispose() }
    gaming: createGaming(...), game: createSkillGameSystem(...), dock: createFeedPanel(...) (braucht `say`, `addTray`),
    start(): startet das Spiel über das GamePanel (schließt Futter-/Spielzeugwahl) -> { ok, reason },
    onChange(): meldet dem GamePanel, dass sich Öffnung oder Zustand geändert haben (Knopfbeschriftung).
  Texte in SKILL_UI und MINIGAME_UI.status (js/data/minigames.js), Stil in game.html (Klassen wie bei den anderen Spielen). NICHT im Browser getestet.
*/
import { SKILL_UI, MINIGAME_UI } from '../data/minigames.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSkillView({ gaming, game, dock, start, onChange = () => {} }) {
  let open = false;
  let mode = 'play';       // 'play' (Meldungen) | 'result' (Ergebnis)
  let shownMsg = '';
  const U = SKILL_UI;

  // ---------- Aufbau ----------
  const tray = el('div', 'tray tray-game tray-skill');
  tray.id = 'skillTray';
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

  tray.append(head, msg, resultBox);
  dock.addTray(tray);

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
        roundText.textContent = U.roundOf(1, e.rounds);
        setMsg(U.intro);
        setOpen(true);
        break;
      case 'round':
        roundText.textContent = U.roundOf(e.round, e.total);
        setMsg(U.waiting);
        break;
      case 'spark':
        setMsg(U.spark);
        break;
      case 'stray':
        setMsg(U.stray);
        break;
      case 'feedback':
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
    // Tastatur: war „Beenden“ fokussiert, landet der Fokus sonst im Leeren
    if (document.activeElement === document.body) againBtn.focus({ preventScroll: true });
  });

  setOpen(false);

  /** Blendet die Leiste ein/aus (z. B. Foto-Modus, Phase 41). Ein laufendes Spiel wird dabei nicht beendet. */
  function setVisible(on) {
    if (!on && !game.isPlaying()) setOpen(false);
    tray.hidden = !on;
  }

  function dispose() {
    offGame();
    offGaming();
    tray.remove();
  }

  return { id: 'skill', isOpen: () => open, setOpen, setVisible, dispose };
}
