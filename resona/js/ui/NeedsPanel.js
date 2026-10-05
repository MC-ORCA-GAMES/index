/*
  NeedsPanel – kleine Bedürfnis-Anzeige oben im Bild (Phase 10).
  Zeigt standardmäßig nur die vier wichtigsten Werte (NEED_UI.primary: Sättigung, Energie, Hygiene, Glück);
  ein Knopf (44 px, Touch-tauglich) klappt Gesundheit, Bindung und Neugier auf. Keine Zahlen, nur Balken:
  die Kreatur soll nicht wie reine Zahlenverwaltung wirken.

  Nicht nur Farbe: jeder Balken hat Beschriftung und Länge; „niedrig" wird zusätzlich gestreift und mit dem Wort
  „niedrig" markiert; im aufgeklappten Zustand steht bei jedem Wert gut/mittel/niedrig. Jeder Wert ist ein
  `role="meter"` mit lesbarem `aria-valuetext`, der Knopf trägt `aria-expanded` und `aria-label`.

  Aufbau: DOM per createElement (kein innerHTML), Stil steht in game.html (Klassen `.needs`, `.need`, ...).
  Aktualisierung nur alle CONFIG.ui.needsRefreshSec Sekunden, und nur dort, wo sich die gerundete Anzeige
  oder die Stufe geändert hat. Die Leiste fängt Eingaben nur auf sich selbst ab, der Canvas bleibt bedienbar.

  Phase 12: optionales `personality` (PersonalitySystem) zeigt aufgeklappt eine Textzeile „Wesen: ..." (ohne Zahlen).

  Phase 13: optionales `emotion` (EmotionSystem) zeigt aufgeklappt zusätzlich „Stimmung: müde" (Wort, nicht nur Farbe),
  aktualisiert beim Auffrischen nur bei Änderung.

  Phase 14: optionales `bond` (BondSystem) zeigt aufgeklappt zwei weitere Textzeilen: „Beziehung: vertraut · mag besonders
  Glutwurzel · Lieblingsplatz: Schlafplatz" (nur, was die Kreatur schon gezeigt hat) und „Erinnerung: Das erste Futter"
  (die jüngste). Ohne Zahlen, neu aufgebaut nur bei geänderter Revision oder Stufe.

  Phase 15: optionales `sleeping` (Sleeping.js) ersetzt in der Zeile „Stimmung: ...“ das Wort durch „schläft“, solange sie schläft
  (`sleeping.isAsleep()`), damit der Zustand auch ohne Blick auf die Kreatur und nicht nur über Farbe oder Licht lesbar ist.
  Phase 16: optionales `cleaning` (Cleaning.js) setzt dort „wird gewaschen“, solange `cleaning.isWashing()`.
  Phase 18: optionales `playing` (Playing.js) setzt dort „spielt“, solange `playing.isPlaying()`.
  Phase 20: optionales `gaming` (Gaming.js) setzt dort „spielt mit dir“, solange `gaming.isPlaying()` (Minispiel läuft).
  Phase 24: optionales `learning` (LearningSystem) zeigt im aufgeklappten Zustand „Gelernt: Futterplatz (mag) · Sterngelee (vertraut)“ (nur Bekanntes ab Stufe „vertraut“, ohne Zahlen).
  Phase 23: optionales `trainer` (Training.js) setzt dort „übt“, solange `trainer.isTraining()` (Übung läuft).
  Phase 25: optionales `lifecycle` (LifecycleSystem) zeigt im aufgeklappten Zustand „Wachstum: Baby · wächst · 12 Min. alt“ (Stufe, Wort für den
  Fortschritt, Alter; keine Prozentzahl) und setzt in der Zeile „Stimmung“ „noch im Ei“, solange `lifecycle.isDormant()`.

  Phase 26: optionales `evolution` (EvolutionSystem) zeigt im aufgeklappten Zustand „Entwicklung: stärkste Neigung Neugier · kommt voran“ bzw. nach
  der Verwandlung „Entwicklung: Erwachte Form · hat sich verwandelt“ (Wörter, keine Zahlen); im Ei ausgeblendet.

  createNeedsPanel({ needs, container, personality, emotion, bond, sleeping, cleaning, playing, gaming, trainer, learning, lifecycle, evolution }) -> { update(dt), refresh(), setVisible(bool), setOpen(bool), dispose() }
  Werte in CONFIG.ui, Daten in js/data/needs.js (NEEDS, NEED_UI). NICHT im Browser getestet.
*/
import { CONFIG } from '../config.js';
import { NEEDS, NEED_UI } from '../data/needs.js';
import { PERSONALITY_UI } from '../data/personality.js';
import { EMOTION_UI } from '../data/emotions.js';
import { BOND_UI } from '../data/bond.js';
import { SLEEP_UI } from '../data/sleep.js';
import { HYGIENE_UI } from '../data/hygiene.js';
import { TOY_UI } from '../data/toys.js';
import { REACTION_UI } from '../data/minigames.js';
import { TRAINING_UI } from '../data/training.js';
import { LEARN_UI } from '../data/learning.js';
import { LIFE_UI } from '../data/lifecycle.js';
import { EVO_UI } from '../data/evolution.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createNeedsPanel({ needs, container, personality = null, emotion = null, bond = null, sleeping = null, cleaning = null, playing = null, gaming = null, trainer = null, learning = null, lifecycle = null, evolution = null }) {
  const refreshSec = CONFIG.ui.needsRefreshSec;
  const items = [];     // { id, root, fill, state, shown, level }
  let acc = 0;
  let open = false;

  function buildItem(id) {
    const def = NEEDS[id];
    const root = el('div', 'need');
    root.dataset.id = id;
    root.dataset.level = 'ok';
    root.setAttribute('role', 'meter');
    root.setAttribute('aria-label', def.label);
    root.setAttribute('aria-valuemin', '0');
    root.setAttribute('aria-valuemax', '100');

    const label = el('span', 'need-label', def.label);
    const bar = el('span', 'need-bar');
    const fill = el('span', 'need-fill');
    bar.appendChild(fill);
    const state = el('span', 'need-state', '');
    root.append(label, bar, state);

    const item = { id, root, fill, state, shown: null, level: null };
    items.push(item);
    return root;
  }

  // ---------- Aufbau ----------
  const panel = el('section', 'needs');
  panel.setAttribute('aria-label', 'Bedürfnisse');

  const list = el('div', 'needs-list');
  for (const id of NEED_UI.primary) list.appendChild(buildItem(id));

  const extra = el('div', 'needs-extra');
  extra.id = 'needsExtra';
  for (const id of NEED_UI.secondary) extra.appendChild(buildItem(id));

  const toggle = el('button', 'needs-toggle', '+');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'needsExtra');

  panel.append(list, toggle, extra);
  if (personality) {
    const persona = el('p', 'needs-persona', PERSONALITY_UI.title + ': ' + personality.describe());
    panel.appendChild(persona);
  }
  let lifeLine = null;
  let lifeShown = null;
  if (lifecycle) {
    lifeLine = el('p', 'needs-persona', '');
    panel.appendChild(lifeLine);
  }
  let evoLine = null;
  let evoShown = null;
  if (evolution) {
    evoLine = el('p', 'needs-persona', '');
    panel.appendChild(evoLine);
  }
  let moodLine = null;
  let moodShown = null;
  if (emotion) {
    moodLine = el('p', 'needs-persona', '');
    panel.appendChild(moodLine);
  }
  let bondLine = null;
  let memoryLine = null;
  let bondRev = -1;
  let bondTierId = null;
  if (bond) {
    bondLine = el('p', 'needs-persona', '');
    memoryLine = el('p', 'needs-persona', '');
    memoryLine.style.display = 'none';      // erst sichtbar (im aufgeklappten Zustand), wenn es eine Erinnerung gibt
    panel.append(bondLine, memoryLine);
  }
  let learnLine = null;
  let learnRev = -1;
  if (learning) {
    learnLine = el('p', 'needs-persona', '');
    learnLine.style.display = 'none';       // erst sichtbar (im aufgeklappten Zustand), wenn es etwas Gelerntes gibt
    panel.appendChild(learnLine);
  }
  container.appendChild(panel);

  // ---------- Anzeige ----------
  function refreshLearning() {
    const rev = learning.getRevision();
    if (rev === learnRev) return;
    learnRev = rev;
    const text = learning.getSummary().text;
    learnLine.textContent = text ? LEARN_UI.title + ': ' + text : '';
    learnLine.style.display = text ? '' : 'none';
  }

  function refreshBond() {
    const tier = bond.getTier();
    const rev = bond.getRevision();
    if (rev === bondRev && tier.id === bondTierId) return;
    bondRev = rev;
    bondTierId = tier.id;
    const s = bond.getSummary();
    const parts = [tier.label];
    if (s.favoriteFood) parts.push(BOND_UI.foodLabel + ' ' + s.favoriteFood.label);
    if (s.favoritePlace) parts.push(BOND_UI.placeLabel + ': ' + s.favoritePlace.label);
    if (s.favoriteToy) parts.push(BOND_UI.toyLabel + ': ' + s.favoriteToy.label);
    bondLine.textContent = BOND_UI.title + ': ' + parts.join(BOND_UI.separator);
    memoryLine.textContent = s.latest ? BOND_UI.memoryTitle + ': ' + s.latest.label : '';
    memoryLine.style.display = s.latest ? '' : 'none';
  }

  function refreshLife() {
    const s = lifecycle.getSummary();
    const parts = [s.label, s.word];
    if (s.ageText) parts.push(s.ageText === LIFE_UI.age.justNow ? s.ageText : s.ageText + ' ' + LIFE_UI.ageSuffix);
    const text = LIFE_UI.title + ': ' + parts.join(LIFE_UI.separator);
    if (text !== lifeShown) { lifeLine.textContent = text; lifeShown = text; }
  }

  function refreshEvolution() {
    const s = evolution.getSummary();
    let text = '';
    if (!(lifecycle && lifecycle.isDormant())) {
      const parts = [];
      if (s.evolved) parts.push(s.label);
      else if (s.dominant) parts.push(EVO_UI.leaning + ' ' + s.dominant.label);
      parts.push(s.word);
      text = EVO_UI.title + ': ' + parts.join(EVO_UI.separator);
    }
    if (text !== evoShown) { evoLine.textContent = text; evoLine.style.display = text ? '' : 'none'; evoShown = text; }
  }

  function refresh() {
    if (evoLine) refreshEvolution();
    if (lifeLine) refreshLife();
    if (bondLine) refreshBond();
    if (learnLine) refreshLearning();
    if (moodLine) {
      let label;
      if (lifecycle && lifecycle.isDormant()) label = LIFE_UI.eggMood;   // Phase 25: noch im Ei
      else if (sleeping && sleeping.isAsleep()) label = SLEEP_UI.moodWord;
      else if (cleaning && cleaning.isWashing()) label = HYGIENE_UI.moodWord;   // Phase 16
      else if (playing && playing.isPlaying()) label = TOY_UI.moodWord;         // Phase 18
      else if (gaming && gaming.isPlaying()) label = REACTION_UI.moodWord;      // Phase 20
      else if (trainer && trainer.isTraining()) label = TRAINING_UI.moodWord;   // Phase 23
      else label = emotion.getCurrent().label;
      if (label !== moodShown) { moodLine.textContent = EMOTION_UI.title + ': ' + label; moodShown = label; }
    }
    for (const item of items) {
      const v = needs.get(item.id);
      if (v === undefined) continue;
      const rounded = Math.round(v);
      const level = needs.getLevel(item.id);
      if (rounded !== item.shown) {
        item.fill.style.transform = 'scaleX(' + (Math.max(0, Math.min(100, v)) / 100).toFixed(3) + ')';
        item.root.setAttribute('aria-valuenow', String(rounded));
        item.shown = rounded;
      }
      if (level !== item.level) {
        const text = NEED_UI.levelText[level] || '';
        item.root.dataset.level = level;
        item.state.textContent = text;
        item.root.setAttribute('aria-valuetext', text);
        item.level = level;
      }
    }
  }

  function setOpen(on) {
    open = !!on;
    panel.classList.toggle('open', open);
    toggle.textContent = open ? '\u2212' : '+';      // Minuszeichen
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Weitere Werte ausblenden' : 'Weitere Werte anzeigen');
  }

  const onToggle = () => setOpen(!open);
  toggle.addEventListener('click', onToggle);

  setOpen(false);
  refresh();

  function update(dt) {
    acc += dt;
    if (acc < refreshSec) return;
    acc = 0;
    refresh();
  }

  /** Blendet die Leiste ein/aus (z. B. Foto-Modus, Phase 41). */
  function setVisible(on) { panel.hidden = !on; }

  function dispose() {
    toggle.removeEventListener('click', onToggle);
    panel.remove();
    items.length = 0;
  }

  return { update, refresh, setVisible, setOpen, dispose };
}
