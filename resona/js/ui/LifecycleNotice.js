/*
  LifecycleNotice – freundliche Meldungen zum Lebenszyklus und der „Ei-Zustand“ der Oberfläche (Phase 25).
  Kein Knopf, keine eigene Fläche: die Texte laufen über die Statuszeile des FeedPanels (`dock.say`, `role="status"`, wird vorgelesen).
    am Anfang im Ei   „Ein Ei ruht im Habitat. Antippen wärmt es, bald schlüpft etwas.“
    Ei wird gewärmt   wechselnde kurze Sätze („Das Ei fühlt sich warm an.“), höchstens alle 8 s
    Übergang beginnt  „Das Ei bebt und leuchtet auf …“ bzw. „Reson leuchtet auf – sie verändert sich.“
    neue Stufe        „Reson ist geschlüpft!“, „Reson ist jetzt ein Jungtier.“, …
    Verwandlung       (Phase 27, nur mit `evolution`) die Meldung der erreichten Form aus `EVO_UI.evolved`, z. B. „Reson ist zur Entdeckerform geworden.“
  Solange Reson noch im Ei ist (`lifecycle.isDormant()`), setzt es die Klasse `is-dormant` auf den Oberflächen-Container (`#ui`):
  das CSS in game.html blendet dann alle Knöpfe und Auswahlfelder der Knopfzeile aus (es gibt nichts zu füttern, waschen, spielen);
  die Statuszeile und die Bedürfnis-Leiste bleiben. Die Klasse folgt dem Zustand pro Frame (`update`), auch wenn die Stufe von außen
  gesetzt wird (Laden, Phase 44).

  createLifecycleNotice({ lifecycle, dock, container, evolution }) -> { update(dt), dispose() }
    dock: createFeedPanel(...) (braucht `say`), container: Element der Oberfläche (#ui), evolution: optional (EvolutionSystem). Mit `evolution`
    spricht beim Eintritt der Spezialstufe die Meldung der Form (Ereignis `evolved`) statt des allgemeinen Satzes; die Reihenfolge der
    Ereignisse spielt keine Rolle, weil die Stufen-Meldung `special` dann bewusst nichts sagt.
  Texte in LIFE_UI (js/data/lifecycle.js) und EVO_UI (js/data/evolution.js). NICHT im Browser getestet.
*/
import { LIFE_UI } from '../data/lifecycle.js';
import { EVO_UI } from '../data/evolution.js';

const WARM_SAY_GAP_SEC = 8;    // so selten kommt ein Wärme-Satz

export function createLifecycleNotice({ lifecycle, dock, container, evolution = null }) {
  let dormantShown = null;
  let sinceWarmSay = WARM_SAY_GAP_SEC;
  let warmIndex = 0;

  function syncDormant() {
    const dormant = lifecycle.isDormant();
    if (dormant === dormantShown) return;
    dormantShown = dormant;
    if (container) container.classList.toggle('is-dormant', dormant);
  }

  const off = lifecycle.onEvent((e) => {
    if (e.type === 'growing') {
      dock.say(LIFE_UI.growing[e.from] || LIFE_UI.growing.default);
    } else if (e.type === 'stage') {
      syncDormant();
      if (e.to === 'special' && evolution) return;   // die Form spricht selbst (`evolved`, unten)
      const text = LIFE_UI.stage[e.to];
      if (text) dock.say(text);
    } else if (e.type === 'warm' && e.effective && sinceWarmSay >= WARM_SAY_GAP_SEC) {
      sinceWarmSay = 0;
      dock.say(LIFE_UI.warm[warmIndex % LIFE_UI.warm.length]);
      warmIndex += 1;
    }
  });

  const offEvo = evolution ? evolution.onEvent((e) => {
    if (e.type !== 'evolved') return;
    dock.say(EVO_UI.evolved[e.id] || LIFE_UI.stage.special);
  }) : null;

  syncDormant();
  if (lifecycle.isDormant()) dock.say(LIFE_UI.hint.egg);

  function update(dt) {
    sinceWarmSay += dt;
    syncDormant();
  }

  function dispose() {
    off();
    if (offEvo) offEvo();
    if (container) container.classList.remove('is-dormant');
  }

  return { update, dispose };
}
