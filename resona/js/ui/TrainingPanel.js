/*
  TrainingPanel – Knopf „Üben“, Auswahl der Fähigkeit und Übungsleiste (Phase 23). Der Knopf steht in der Knopfzeile unten (neben „Füttern“,
  „Schlafen“, „Waschen“, „Spielen“, „Minispiel“). Ein Knopf, der je nach Zustand wechselt:
    frei, alles zu             „Üben“ öffnet die Auswahl (fünf Felder: Folgen, Warten, Springen, Bringen, Lauschen; Futter-, Spielzeug- und Minispiel-Auswahl schließen sich)
    Auswahl oder Ergebnis offen  „Schließen“ schließt sie wieder
    Übung läuft                „Beenden“ beendet vorzeitig (kostet nichts, bereits Gelerntes bleibt)
  Jedes Auswahlfeld zeigt Namen, Kurzbeschreibung und die Wortstufe des Lernstands („Anfänger“, „lernt“, „geübt“, „sicher“) plus einen kleinen
  Balken (nur Beiwerk, `aria-hidden`; keine Zahlen). Ein Antippen startet die Übung über `trainer.start(id)`.

  Die Übungsleiste (schmal, über der Knopfzeile) zeigt: Kopfzeile (Name der Fähigkeit, „Versuch 3 von 5“), eine Meldungszeile (`aria-live`) und den
  Knopf „Loben“. Ablauf der Meldungen: Hinweis -> Kommando („Spring, Reson!“) -> „Reson springt …“ -> Rückmeldung („Das hat super geklappt!“, „Gut – fast
  perfekt.“, „Noch nicht ganz – das übt ihr weiter.“; bei Stufenwechsel zusätzlich „Stufe erreicht: …“). „Loben“ ist nur in der Rückmeldung nach einem
  Versuch aktiv und einmal je Versuch (zusätzlicher Lernzuwachs, kleiner Schub für Glück und Bindung). Nach dem Ende ein Ergebnis mit Wortstufe,
  „Nochmal“ (erst aktiv, wenn Reson wieder frei ist) und „Schließen“. Vorzeitig beendet: nur eine kurze Meldung in der Statuszeile des FeedPanels.

  Ist sie zu müde oder beschäftigt, sagt die Statuszeile es (`dock.say`, Texte in TRAINING_UI.status), nichts wird bestraft.
  Zusammenspiel: beginnt eine Übung (Ereignis `start`), schließt sich die Auswahl. Geht die Futterwahl auf, machen Auswahl und stehendes
  Ergebnis Platz (eine laufende Übung bleibt, die anderen Panels lehnen dann freundlich ab).

  Nicht nur Farbe: Namen, Beschreibung und Wortstufe in der Auswahl, `aria-label` an jedem Feld, `aria-expanded` am Knopf, Rückmeldungen als Text in
  einer `aria-live`-Zeile. Touch-Ziele: Auswahlfelder mindestens 72 px hoch, Knopf 48 px (Klasse `.dock-btn`), „Loben“ als `.game-action`.

  createTrainingPanel({ trainer, training, dock, closeOthers }) -> { setVisible(bool), setOpen(bool), closeIdle(), dispose() }
    trainer: createTrainer(...), training: createTrainingSystem(...), dock: createFeedPanel(...) (braucht `say`, `addAction`, `addTray`, `onOpenChange`),
    closeOthers(): optional, schließt die anderen Auswahlfelder (Futter, Spielzeug, Minispiel), wenn die Auswahl aufgeht oder eine Übung startet.
    setOpen(true) öffnet die Auswahl, setOpen(false) und closeIdle() schließen Auswahl und stehendes Ergebnis (eine laufende Übung bleibt).
  Texte in TRAINING_UI (js/data/training.js), Stil in game.html. NICHT im Browser getestet.
*/
import { SKILLS, SKILL_IDS, TRAINING_UI } from '../data/training.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createTrainingPanel({ trainer, training, dock, closeOthers = null }) {
  const U = TRAINING_UI;
  let pickOpen = false;
  let open = false;            // Übungsleiste oder Ergebnis offen
  let mode = 'play';           // 'play' (Meldungen) | 'result' (Ergebnis)
  let skillId = null;          // Fähigkeit der laufenden oder zuletzt beendeten Übung
  let shownMsg = '';
  const choiceRefs = [];

  // ---------- Aufbau: Auswahl ----------
  const pickTray = el('div', 'tray tray-game tray-train-pick');
  pickTray.id = 'trainPickTray';
  pickTray.setAttribute('role', 'group');
  pickTray.setAttribute('aria-label', U.pickTitle);

  const pickHead = el('div', 'game-head');
  pickHead.appendChild(el('span', 'game-title', U.pickTitle));

  const choices = el('div', 'game-choices');
  for (const id of SKILL_IDS) {
    const def = SKILLS[id];
    const choice = el('button', 'game-choice');
    choice.type = 'button';
    choice.dataset.skill = id;
    choice.setAttribute('aria-label', def.aria);
    const levelText = el('span', 'train-level-text', '');
    const barFill = el('span', 'train-bar-fill');
    const bar = el('span', 'train-bar');
    bar.setAttribute('aria-hidden', 'true');
    bar.appendChild(barFill);
    const level = el('span', 'train-level');
    level.append(levelText, bar);
    choice.append(el('span', 'game-choice-name', def.label), el('span', 'game-choice-desc', def.desc), level);
    choice.addEventListener('click', () => pick(id));
    choices.appendChild(choice);
    choiceRefs.push({ id, choice, levelText, barFill });
  }
  pickTray.append(pickHead, choices);

  // ---------- Aufbau: Übungsleiste ----------
  const tray = el('div', 'tray tray-game tray-train');
  tray.id = 'trainTray';
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', U.title);
  tray.dataset.mode = mode;

  const head = el('div', 'game-head');
  const title = el('span', 'game-title', U.title);
  const attemptText = el('span', 'game-round', '');
  head.append(title, attemptText);

  const msg = el('p', 'game-msg', '');
  msg.setAttribute('aria-live', 'polite');
  msg.setAttribute('aria-atomic', 'true');

  const praiseRow = el('div', 'game-actions train-praise');
  const praiseBtn = el('button', 'game-action', U.praiseLabel);
  praiseBtn.type = 'button';
  praiseBtn.setAttribute('aria-label', U.praiseAria);
  praiseBtn.disabled = true;
  praiseRow.appendChild(praiseBtn);

  const resultBox = el('div', 'game-result');
  const resultText = el('p', 'game-result-text', '');
  const levelLine = el('p', 'game-result-line', '');
  const upLine = el('p', 'game-result-line', '');
  const resultNote = el('p', 'game-result-note', '');   // z. B. „zu müde“ nach „Nochmal“
  const actions = el('div', 'game-actions');
  const againBtn = el('button', 'game-action', U.againLabel);
  againBtn.type = 'button';
  const closeBtn = el('button', 'game-action', U.closeLabel);
  closeBtn.type = 'button';
  actions.append(againBtn, closeBtn);
  resultBox.append(resultText, levelLine, upLine, resultNote, actions);

  tray.append(head, msg, praiseRow, resultBox);

  // ---------- Aufbau: Knopf ----------
  const button = el('button', 'dock-btn');
  button.type = 'button';
  button.setAttribute('aria-controls', 'trainPickTray');

  dock.addTray(pickTray);
  dock.addTray(tray);
  dock.addAction(button);

  // ---------- Zustand ----------
  /** Beschriftung nach Zustand: „Beenden“ solange geübt wird, „Schließen“ bei Auswahl oder Ergebnis, sonst „Üben“. */
  function refresh() {
    if (training.isTraining()) {
      button.textContent = U.stopLabel;
      button.setAttribute('aria-label', U.stopAria);
      button.removeAttribute('aria-expanded');
    } else if (pickOpen || open) {
      button.textContent = U.closeLabel;
      button.setAttribute('aria-label', U.closeLabel);
      button.setAttribute('aria-expanded', 'true');
    } else {
      button.textContent = U.openLabel;
      button.setAttribute('aria-label', U.openAria);
      button.setAttribute('aria-expanded', 'false');
    }
  }

  /** Wortstufe und Balken jedes Auswahlfelds nach dem aktuellen Lernstand. */
  function refreshChoices() {
    for (const ref of choiceRefs) {
      const sk = training.getSkill(ref.id);
      if (!sk) continue;
      ref.levelText.textContent = sk.tierLabel;
      ref.barFill.style.transform = 'scaleX(' + Math.max(0.04, Math.min(1, sk.level)).toFixed(3) + ')';
    }
  }

  function setMsg(text) {
    if (text === shownMsg) return;
    shownMsg = text;
    msg.textContent = text;
  }

  function setMode(next) {
    mode = next;
    tray.dataset.mode = next;
  }

  function setPickOpen(on) {
    pickOpen = !!on;
    if (pickOpen) refreshChoices();
    pickTray.classList.toggle('is-open', pickOpen);
    refresh();
  }

  function setOpen(on) {
    open = !!on;
    tray.classList.toggle('is-open', open);
    refresh();
  }

  /** Schließt Auswahl und stehendes Ergebnis; eine laufende Übung bleibt. */
  function closeIdle() {
    if (training.isTraining()) return;
    setOpen(false);
    setPickOpen(false);
  }

  /** Startet eine Übung (auch für „Nochmal“). Futter-, Spielzeug- und Minispiel-Auswahl schließen sich. */
  function begin(id) {
    if (closeOthers) closeOthers();
    return trainer.start(id, { source: 'player' });
  }

  function say(res) {
    const text = U.status[res.reason];
    if (typeof text !== 'string') return;
    if (mode === 'result' && open) resultNote.textContent = text;
    else dock.say(text);
  }

  function pick(id) {
    setPickOpen(false);
    const res = begin(id);
    if (!res.ok) say(res);
  }

  function onButton() {
    if (training.isTraining()) {
      trainer.requestStop();
      return;
    }
    if (pickOpen || open) {
      closeIdle();
      return;
    }
    if (closeOthers) closeOthers();
    setPickOpen(true);
  }
  button.addEventListener('click', onButton);

  praiseBtn.addEventListener('click', () => {
    if (praiseBtn.disabled) return;
    training.praise();
  });
  againBtn.addEventListener('click', () => {
    if (againBtn.disabled || !skillId) return;
    const res = begin(skillId);
    if (!res.ok) say(res);
  });
  closeBtn.addEventListener('click', () => setOpen(false));

  function showResult(r) {
    setMode('result');
    const sk = SKILLS[r.skillId];
    resultText.textContent = U.result[r.result] || U.result.ok;
    levelLine.textContent = sk ? U.levelLine(sk.label, r.tierLabel) : '';
    levelLine.hidden = !levelLine.textContent;
    upLine.textContent = r.tierUp ? U.levelUp(r.tierLabel) : '';
    upLine.hidden = !upLine.textContent;
    resultNote.textContent = '';
    againBtn.disabled = trainer.isResting();   // erst „Nochmal“, wenn Reson wieder frei ist (kurzes Ausklingen)
    setOpen(true);
  }

  // ---------- Ereignisse ----------
  const offTraining = training.onEvent((e) => {
    switch (e.type) {
      case 'start': {
        skillId = e.skillId;
        setMode('play');
        const def = SKILLS[e.skillId];
        title.textContent = def ? def.label : U.title;
        attemptText.textContent = '';
        setMsg(U.intro);
        praiseBtn.disabled = true;
        setPickOpen(false);
        setOpen(true);
        break;
      }
      case 'cue':
        attemptText.textContent = U.attemptOf(e.attempt, e.total);
        setMsg(U.cue[e.skillId] || '');
        praiseBtn.disabled = true;
        break;
      case 'act':
        setMsg(U.acting[e.skillId] || '');
        break;
      case 'feedback': {
        let text = U.feedback[e.kind] || U.feedback.tried;
        if (e.tierUp) text += ' ' + U.levelUp(e.tierLabel);
        setMsg(text);
        praiseBtn.disabled = !training.canPraise();
        break;
      }
      case 'praise': {
        let text = U.praised;
        if (e.tierUp) text += ' ' + U.levelUp(e.tierLabel);
        setMsg(text);
        praiseBtn.disabled = true;
        break;
      }
      case 'done':
        praiseBtn.disabled = true;
        if (e.natural) {
          showResult(e);
        } else {
          setOpen(false);   // vorzeitig beendet: kurze Meldung, kein Ergebnisfeld
          dock.say(U.result.stopped);
        }
        break;
      default:
        break;
    }
    refresh();
  });

  const offTrainer = trainer.onEvent((e) => {
    if (e.type !== 'finished' || mode !== 'result') return;
    againBtn.disabled = false;
    // Tastatur: war „Beenden“ fokussiert, landet der Fokus sonst im Leeren
    if (document.activeElement === document.body) againBtn.focus({ preventScroll: true });
  });

  // Die Futterwahl geht auf: Auswahl und stehendes Ergebnis machen Platz (eine laufende Übung bleibt, die Futterwahl lehnt dann freundlich ab)
  const offDock = dock.onOpenChange((foodOpen) => { if (foodOpen) closeIdle(); });

  refreshChoices();
  setOpen(false);
  setPickOpen(false);

  /** Blendet Knopf, Auswahl und Übungsleiste ein/aus (z. B. Foto-Modus, Phase 41). Eine laufende Übung wird dabei nicht beendet. */
  function setVisible(on) {
    button.hidden = !on;
    if (!on) closeIdle();
    pickTray.hidden = !on;
    tray.hidden = !on;
  }

  /** Öffnet die Auswahl (true) oder schließt Auswahl und stehendes Ergebnis (false). Eine laufende Übung bleibt. */
  function setOpenPublic(on) {
    if (on) {
      if (!training.isTraining() && !open) setPickOpen(true);
    } else {
      closeIdle();
    }
  }

  function dispose() {
    offTraining();
    offTrainer();
    offDock();
    button.removeEventListener('click', onButton);
    button.remove();
    pickTray.remove();
    tray.remove();
    choiceRefs.length = 0;
  }

  return { setVisible, setOpen: setOpenPublic, closeIdle, dispose };
}
