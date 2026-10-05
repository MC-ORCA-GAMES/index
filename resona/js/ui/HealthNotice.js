/*
  HealthNotice – freundliche Meldung, wenn sich Resons Gesundheitszustand ändert (Phase 17). Kein Knopf, keine eigene Fläche:
  der Text läuft über die Statuszeile des FeedPanels (`dock.say`, `role="status"`, wird vorgelesen).
    wird schlapp   „Reson fühlt sich etwas schlapp. Ein Happen würde ihr guttun.“ (zweiter Satz je nach niedrigstem Pflegewert)
    wieder fit     „Reson geht es wieder gut.“
  Ton: sagt, was ihr guttäte, nie, was der Spieler falsch gemacht hat. Der Zustand hängt nicht nur an der Meldung: die Emotion
  „angeschlagen“ zeigt Haltung, Augen und Leuchten, die Zeile „Stimmung“ und der Balken „Gesundheit“ (aufgeklappt) tragen ihn mit.

  createHealthNotice({ health, dock }) -> { dispose() }
    health: createHealthSystem(...), dock: createFeedPanel(...) (braucht `say`)
  Texte in HEALTH_UI (js/data/health.js). NICHT im Browser getestet.
*/
import { HEALTH_UI } from '../data/health.js';

export function createHealthNotice({ health, dock }) {
  const off = health.onChange(({ status }) => {
    if (status === 'weak') dock.say(HEALTH_UI.status.weak + ' ' + HEALTH_UI.hint[health.getHint()]);
    else dock.say(HEALTH_UI.status.recovered);
  });
  return { dispose: off };
}
